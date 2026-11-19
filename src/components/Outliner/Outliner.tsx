import { Popover as BasePopover } from "@base-ui/react/popover";
import type {
  ClipboardEvent,
  ComponentProps,
  FocusEvent,
  InputEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type ReactMarkdown from "react-markdown";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { Markdown } from "../Markdown";
import { Popover } from "../Popover";
import {
  applyCompletion,
  type CompletionMatch,
  cycleTask,
  findTrigger,
  insertLink,
  pairInput,
  setTaskDone,
  type TextEdit,
  toggleWrap,
  unpairBackspace,
} from "./assist";
import { caretLine, caretRect, offsetAtX } from "./caret";
import { isOutlineText, parseOutline, toMarkdownList, withIds } from "./clipboard";
import { History } from "./history";
import {
  MAX_TRANSCLUSION_DEPTH,
  passthroughUrlTransform,
  preprocessOutlinerMarkdown,
} from "./markdown-extensions";
import styles from "./Outliner.module.css";
import { OutlinerBullet } from "./OutlinerBullet";
import { blockSelection, extendSelection } from "./selection";
import {
  deleteBullet,
  deleteSubtree,
  fillBullet,
  findBullet,
  flatVisible,
  getNextVisible,
  getParentId,
  getPrevVisible,
  indent,
  insertSiblingsAfter,
  mergeInto,
  moveDown,
  moveUp,
  outdent,
  setCollapsed,
  splitBullet,
  toggleCollapsed,
  updateContent,
} from "./tree";
import type { Bullet, BulletId, OutlinerCompletion, OutlinerProps, OutlinerValue } from "./types";

type Components = ComponentProps<typeof ReactMarkdown>["components"];

function defaultGenerateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b_${Math.random().toString(36).slice(2)}`;
}

/** Where the caret belongs once the next render is on screen. A structural
 *  edit (a split, a merge, a move to the next block) names the block and the
 *  position; the textarea it refers to may not exist until React has rendered. */
type Caret =
  | { id: BulletId; start: number; end: number }
  | { id: BulletId; edge: "start" | "end" }
  /** The first or last visual line, at a viewport x: Arrow Up / Down. */
  | { id: BulletId; clientX: number; line: "first" | "last" };

/** Where the user was, kept with every undo step: the caret in a block's
 *  text, or a selection of blocks. */
type Place =
  | { kind: "text"; id: BulletId; start: number; end: number }
  | { kind: "blocks"; anchor: BulletId; focus: BulletId }
  | null;

/** An open completion list: the block and the trigger it belongs to, the
 *  entries, and the highlighted one. */
interface CompletionState {
  blockId: BulletId;
  match: CompletionMatch;
  items: OutlinerCompletion[];
  index: number;
}

/**
 * An outline edited as one document, after Roam Research and Logseq: a block
 * is a textarea over its markdown while the caret is in it and rendered
 * markdown otherwise, and Enter, Backspace, Tab and the arrows carry the caret
 * and the structure from block to block.
 *
 * Two levels of focus. In a block's text, the keys edit. Escape steps out to
 * the block itself (selected): the arrows walk the tree, Shift extends the
 * selection over several blocks, Enter goes back in. Escape again releases the
 * selection, and Tab then leaves the outline.
 */
export const Outliner = forwardRef<HTMLDivElement, OutlinerProps>(function Outliner(props, ref) {
  const {
    value,
    onChange,
    readOnly = false,
    generateId = defaultGenerateId,
    onWikiLinkClick,
    resolveBlockRef,
    completions,
    placeholder = "Empty outline. Click to write.",
    className,
    onKeyDown,
    onBlur,
    onCopy,
    onCut,
    onPaste,
    ...rest
  } = props;

  // The selection runs from an anchor to a focus; `active` is the focus, the
  // row that holds the keyboard.
  const [activeState, setActiveId] = useState<BulletId | null>(null);
  const [anchorState, setAnchorId] = useState<BulletId | null>(null);
  const [editingState, setEditingId] = useState<BulletId | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [completionState, setCompletion] = useState<CompletionState | null>(null);

  const flat = useMemo(() => flatVisible(value), [value]);
  const visible = useMemo(() => new Set(flat.map((f) => f.id)), [flat]);
  // A block that left the screen (deleted, or folded away) holds neither the
  // selection nor the caret.
  const activeId = activeState && visible.has(activeState) ? activeState : null;
  const anchorId = anchorState && visible.has(anchorState) ? anchorState : activeId;
  const editingId = !readOnly && editingState && visible.has(editingState) ? editingState : null;
  const selection = useMemo(
    () => (activeId && anchorId && !editingId ? blockSelection(flat, anchorId, activeId) : null),
    [flat, activeId, anchorId, editingId],
  );

  // The list shows for the block being edited, once there is something in it.
  const completion =
    completionState && completionState.blockId === editingId && completionState.items.length > 0
      ? completionState
      : null;

  // The handlers below are created once, so a keystroke re-renders one row;
  // they read what is current from here.
  const current = {
    value,
    onChange,
    readOnly,
    generateId,
    completions,
    flat,
    activeId,
    anchorId,
    editingId,
    completion,
  };
  const latest = useRef(current);
  latest.current = current;

  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<BulletId, HTMLDivElement>());
  const editorRefs = useRef(new Map<BulletId, HTMLTextAreaElement>());
  const pendingCaret = useRef<Caret | null>(null);
  /** The x the caret keeps while Arrow Up / Down run through several blocks. */
  const goalX = useRef<number | null>(null);
  /** The last selected block: where a Tab back into the outline lands. */
  const lastActive = useRef<BulletId | null>(null);
  if (activeId) lastActive.current = activeId;
  /** The caret as it was before the key or paste being handled changed the
   *  text: what an undo of that change returns to. */
  const caretBefore = useRef<{ id: BulletId; start: number; end: number } | null>(null);
  /** A drag or Shift+click that selected blocks: the click that ends it must
   *  not enter a block. */
  const suppressClick = useRef(false);
  /** The completion request last sent (so a caret that has not moved does not
   *  ask again), and the one the user closed with Escape. */
  const requested = useRef("");
  const dismissed = useRef("");
  const listId = useId();

  // --- History ---
  const [history] = useState(() => new History<Place>());
  /** The tree this component last put out. Any other `value` came from
   *  outside, and the recorded steps no longer lead to it. */
  const emitted = useRef(value);
  if (emitted.current !== value) {
    history.clear();
    emitted.current = value;
  }

  const registerRow = useCallback((id: BulletId, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);
  const registerEditor = useCallback((id: BulletId, el: HTMLTextAreaElement | null) => {
    if (el) editorRefs.current.set(id, el);
    else editorRefs.current.delete(id);
  }, []);

  // --- Caret placement, after the render that shows the block ---
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (!caret) return;
    const textarea = editorRefs.current.get(caret.id);
    if (!textarea) return;
    pendingCaret.current = null;
    const length = textarea.value.length;
    let start: number;
    let end: number;
    if ("line" in caret) {
      const x = caret.clientX - textarea.getBoundingClientRect().left;
      start = end = offsetAtX(textarea, x, caret.line);
    } else if ("edge" in caret) {
      start = end = caret.edge === "start" ? 0 : length;
    } else {
      start = Math.min(caret.start, length);
      end = Math.min(caret.end, length);
    }
    if (textarea.ownerDocument.activeElement !== textarea) textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(start, end);
    rowRefs.current.get(caret.id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    refreshCompletion(caret.id);
  });

  // --- Focus on the selected block ---
  // A layout effect: the focus is back inside the outline before the blur
  // handler's deferred check runs.
  useLayoutEffect(() => {
    if (!activeId || editingId) return;
    rowRefs.current.get(activeId)?.focus();
  }, [activeId, editingId]);
  // A move reorders the rows, and a row the browser re-inserts loses focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the tree changes
  useEffect(() => {
    if (!activeId || editingId) return;
    const row = rowRefs.current.get(activeId);
    const doc = row?.ownerDocument;
    if (row && doc && (doc.activeElement === doc.body || doc.activeElement === null)) row.focus();
  }, [value]);

  /** Select blocks: one, or the run from `anchor` to `focus`. */
  const select = useCallback((focus: BulletId | null, anchor: BulletId | null = focus) => {
    setEditingId(null);
    setAnchorId(anchor);
    setActiveId(focus);
  }, []);

  /** Put the caret in a block. */
  const editAt = useCallback((caret: Caret) => {
    pendingCaret.current = caret;
    setActiveId(caret.id);
    setAnchorId(caret.id);
    setEditingId(caret.id);
    // The block may already be the one being edited: render anyway, so the
    // caret is applied.
    rerender();
  }, []);

  /** Where the user is now. `beforeInput` asks for the caret as it was before
   *  the keystroke being handled. */
  const place = useCallback((beforeInput: boolean): Place => {
    const { editingId: editing, activeId: active, anchorId: anchor } = latest.current;
    if (editing) {
      const before = caretBefore.current;
      if (beforeInput && before?.id === editing) return { kind: "text", ...before };
      const textarea = editorRefs.current.get(editing);
      if (!textarea) return null;
      return {
        kind: "text",
        id: editing,
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    }
    return active ? { kind: "blocks", anchor: anchor ?? active, focus: active } : null;
  }, []);

  /** Put a change out, as one undo step. `typingIn` marks a keystroke in a
   *  block, which joins the run of typing in progress. */
  const commit = useCallback(
    (next: OutlinerValue, typingIn?: BulletId): boolean => {
      const current = latest.current.value;
      if (next === current) return false;
      history.record(
        { value: current, ui: place(true) },
        typingIn ? { id: typingIn, now: Date.now() } : undefined,
      );
      emitted.current = next;
      latest.current.onChange(next);
      return true;
    },
    [history, place],
  );

  const travel = useCallback(
    (direction: "undo" | "redo") => {
      if (latest.current.readOnly) return;
      const here = { value: latest.current.value, ui: place(false) };
      const state = direction === "undo" ? history.undo(here) : history.redo(here);
      if (!state) return;
      emitted.current = state.value;
      latest.current.onChange(state.value);
      const there = state.ui;
      if (!there) select(null);
      else if (there.kind === "text") editAt(there);
      else select(there.focus, there.anchor);
    },
    [history, place, select, editAt],
  );

  const handleEnter = useCallback(
    (id: BulletId, offset: number | null) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      goalX.current = null;
      history.breakTyping();
      if (latest.current.readOnly || offset === null) {
        select(id);
        return;
      }
      editAt({ id, start: offset, end: offset });
    },
    [editAt, select, history],
  );

  // --- Selecting blocks with the pointer: Shift+click, or a drag from one
  // block into another ---
  const handleRowMouseDown = useCallback(
    (id: BulletId, e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      const doc = root.ownerDocument;
      const { activeId: active, anchorId: anchor, editingId: editing } = latest.current;
      const from = e.shiftKey ? (anchor ?? active ?? editing) : null;
      if (from && from !== id) {
        // Keep the focus and the page's text selection out of it.
        e.preventDefault();
        suppressClick.current = true;
        select(id, from);
      }
      let dragged = false;
      const move = (ev: MouseEvent) => {
        const under = doc.elementFromPoint(ev.clientX, ev.clientY);
        const row = under && root.contains(under) ? under.closest("[data-bullet-id]") : null;
        const over = row?.getAttribute("data-bullet-id");
        if (!over || (!dragged && over === id)) return;
        dragged = true;
        suppressClick.current = true;
        root.toggleAttribute("data-dragging", true);
        doc.defaultView?.getSelection()?.removeAllRanges();
        select(over, from ?? id);
      };
      const up = () => {
        doc.removeEventListener("mousemove", move);
        doc.removeEventListener("mouseup", up);
        root.removeAttribute("data-dragging");
        // The click that follows lands on a row only when the press and the
        // release share one; either way the flag must not outlive it.
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      };
      doc.addEventListener("mousemove", move);
      doc.addEventListener("mouseup", up);
    },
    [select],
  );

  const handleToggleCollapsed = useCallback(
    (id: BulletId) => {
      commit(toggleCollapsed(latest.current.value, id));
    },
    [commit],
  );

  // --- Completion: `[[page`, `((block`, `#tag`, `/command` ---
  /** Look at the caret and open, update or close the completion list. */
  const refreshCompletion = useCallback((id: BulletId) => {
    const source = latest.current.completions;
    if (!source) return;
    const textarea = editorRefs.current.get(id);
    const match =
      textarea && textarea.selectionStart === textarea.selectionEnd
        ? findTrigger(textarea.value, textarea.selectionStart)
        : null;
    if (!match) {
      requested.current = "";
      dismissed.current = "";
      setCompletion(null);
      return;
    }
    // Escape closes the list for this trigger; it comes back for the next one.
    const place = `${id}:${match.trigger}:${match.from}`;
    if (dismissed.current === place) return;
    const request = `${place}:${match.query}`;
    if (requested.current === request) return;
    requested.current = request;
    const settle = (items: OutlinerCompletion[]) => {
      if (requested.current !== request) return;
      setCompletion({ blockId: id, match, items, index: 0 });
    };
    const result = source({ trigger: match.trigger, query: match.query, blockId: id });
    if (Array.isArray(result)) settle(result);
    else result.then(settle, () => settle([]));
  }, []);

  const closeCompletion = useCallback(() => {
    const open = latest.current.completion;
    if (open) dismissed.current = `${open.blockId}:${open.match.trigger}:${open.match.from}`;
    setCompletion(null);
  }, []);

  /** Change the text of the block being edited and place the selection.
   *  `typing` joins it to the run of keystrokes in progress. */
  const applyEdit = useCallback(
    (id: BulletId, edit: TextEdit, typing = false) => {
      commit(updateContent(latest.current.value, id, edit.text), typing ? id : undefined);
      pendingCaret.current = { id, start: edit.start, end: edit.end };
      rerender();
    },
    [commit],
  );

  const acceptCompletion = useCallback(
    (item: OutlinerCompletion | undefined) => {
      const open = latest.current.completion;
      const textarea = open && editorRefs.current.get(open.blockId);
      if (!open || !textarea || !item) return;
      const match = findTrigger(textarea.value, textarea.selectionStart) ?? open.match;
      caretBefore.current = {
        id: open.blockId,
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
      setCompletion(null);
      applyEdit(open.blockId, applyCompletion(textarea.value, match, item.insert ?? item.label));
    },
    [applyEdit],
  );

  const handleTextChange = useCallback(
    (id: BulletId, text: string) => {
      goalX.current = null;
      commit(updateContent(latest.current.value, id, text), id);
      refreshCompletion(id);
    },
    [commit, refreshCompletion],
  );

  // --- A character about to be typed: brackets come in pairs ---
  const handleEditorBeforeInput = useCallback(
    (id: BulletId, e: InputEvent<HTMLTextAreaElement>) => {
      if (e.data?.length !== 1) return;
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const edit = pairInput(textarea.value, start, end, e.data);
      if (!edit) return;
      e.preventDefault();
      caretBefore.current = { id, start, end };
      applyEdit(id, edit, true);
    },
    [applyEdit],
  );

  const handleTaskToggle = useCallback(
    (id: BulletId, done: boolean) => {
      const self = findBullet(latest.current.value, id)?.bullet;
      if (!self || latest.current.readOnly) return;
      commit(updateContent(latest.current.value, id, setTaskDone(self.content, done)));
    },
    [commit],
  );

  // --- Keys in a block's text ---
  const handleEditorKeyDown = useCallback(
    (id: BulletId, e: KeyboardEvent<HTMLTextAreaElement>) => {
      // A key that confirms an IME composition is not a command.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      const textarea = e.currentTarget;
      const { value: tree, generateId: newId, flat: rows } = latest.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const caretOnly = start === end;
      const length = textarea.value.length;
      const mod = e.metaKey || e.ctrlKey;
      const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!vertical) goalX.current = null;
      caretBefore.current = { id, start, end };
      // A caret move ends a run of typing: the next keystroke is its own step.
      if (/^(Arrow|Home|End|Page)/.test(e.key)) history.breakTyping();

      // An open completion list takes the keys that choose from it.
      const open = latest.current.completion;
      if (open && !mod && !e.altKey && !e.shiftKey) {
        if (vertical) {
          e.preventDefault();
          const step = e.key === "ArrowDown" ? 1 : -1;
          const count = open.items.length;
          setCompletion({ ...open, index: (open.index + step + count) % count });
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          acceptCompletion(open.items[open.index]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeCompletion();
          return;
        }
      }

      /** Apply a tree change that keeps the caret where it is. */
      const inPlace = (next: OutlinerValue) => {
        e.preventDefault();
        if (!commit(next)) return;
        pendingCaret.current = { id, start, end };
        rerender();
      };

      if (mod && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "z" || key === "y") {
          // One history for text and structure: the textarea's own undo would
          // know nothing of a split or a merge.
          e.preventDefault();
          travel(key === "y" || e.shiftKey ? "redo" : "undo");
          return;
        }
        // Formatting chords: bold, italic, link, strikethrough.
        const format =
          key === "b" && !e.shiftKey
            ? toggleWrap(textarea.value, start, end, "**")
            : key === "i" && !e.shiftKey
              ? toggleWrap(textarea.value, start, end, "*")
              : key === "k" && !e.shiftKey
                ? insertLink(textarea.value, start, end)
                : key === "s" && e.shiftKey
                  ? toggleWrap(textarea.value, start, end, "~~")
                  : null;
        if (format) {
          e.preventDefault();
          applyEdit(id, format);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          // Mod+Enter: no task, open, done.
          e.preventDefault();
          const text = cycleTask(textarea.value);
          const shift = text.length - textarea.value.length;
          applyEdit(id, {
            text,
            start: Math.max(0, start + shift),
            end: Math.max(0, end + shift),
          });
          return;
        }
        if (key === "a" && start === 0 && end === length) {
          // The text is already selected (or empty): the next level is every block.
          const first = rows[0];
          const last = rows[rows.length - 1];
          if (first && last) {
            e.preventDefault();
            select(last.id, first.id);
          }
          return;
        }
      }

      switch (e.key) {
        case "Escape": {
          e.preventDefault();
          select(id);
          return;
        }
        case "Enter": {
          // Shift+Enter is a line break inside the block (the textarea's own).
          if (e.shiftKey || mod || e.altKey) return;
          e.preventDefault();
          const split = splitBullet(tree, id, start, end, newId());
          if (!split) return;
          commit(split.value);
          editAt({ id: split.focusId, start: split.offset, end: split.offset });
          return;
        }
        case "Tab": {
          inPlace(e.shiftKey ? outdent(tree, id) : indent(tree, id));
          return;
        }
        case "Backspace": {
          const unpaired = unpairBackspace(textarea.value, start, end);
          if (unpaired) {
            e.preventDefault();
            applyEdit(id, unpaired, true);
            return;
          }
          if (!caretOnly || start !== 0) return;
          const prev = getPrevVisible(tree, id);
          if (!prev) {
            // The first block: an empty one goes, and the caret moves on.
            const self = findBullet(tree, id)?.bullet;
            const next = getNextVisible(tree, id);
            if (self && next && self.content === "" && !self.children?.length) {
              e.preventDefault();
              commit(deleteBullet(tree, id));
              editAt({ id: next, edge: "start" });
            }
            return;
          }
          e.preventDefault();
          const merged = mergeInto(tree, prev, id);
          if (!merged) return;
          commit(merged.value);
          editAt({ id: merged.focusId, start: merged.offset, end: merged.offset });
          return;
        }
        case "Delete": {
          if (!caretOnly || start !== length) return;
          const next = getNextVisible(tree, id);
          if (!next) return;
          e.preventDefault();
          const merged = mergeInto(tree, id, next);
          if (!merged) return;
          commit(merged.value);
          editAt({ id, start: merged.offset, end: merged.offset });
          return;
        }
        case "ArrowUp":
        case "ArrowDown": {
          const up = e.key === "ArrowUp";
          if (e.shiftKey && (mod || e.altKey)) {
            inPlace(up ? moveUp(tree, id) : moveDown(tree, id));
            return;
          }
          if (mod && !e.altKey) {
            const self = findBullet(tree, id)?.bullet;
            if (self?.children?.length) inPlace(setCollapsed(tree, id, up));
            else e.preventDefault();
            return;
          }
          if (e.altKey) return;
          if (e.shiftKey) {
            // Shift+Arrow selects text while there is a line to go to; from the
            // block's first / last line it selects the block itself.
            const tip = textarea.selectionDirection === "backward" ? start : end;
            const line = caretLine(textarea, tip);
            if (up ? line.first : line.last) {
              e.preventDefault();
              select(id);
            }
            return;
          }
          if (!caretOnly) return;
          const line = caretLine(textarea);
          const target = up
            ? line.first && getPrevVisible(tree, id)
            : line.last && getNextVisible(tree, id);
          if (!target) {
            // Still inside the block (the textarea moves the caret itself), or
            // at the outline's edge.
            if (!(up ? line.first : line.last)) goalX.current = null;
            return;
          }
          e.preventDefault();
          const clientX = goalX.current ?? textarea.getBoundingClientRect().left + line.x;
          goalX.current = clientX;
          editAt({ id: target, clientX, line: up ? "last" : "first" });
          return;
        }
        case "ArrowLeft": {
          if (!caretOnly || start !== 0 || mod || e.shiftKey || e.altKey) return;
          const prev = getPrevVisible(tree, id);
          if (!prev) return;
          e.preventDefault();
          editAt({ id: prev, edge: "end" });
          return;
        }
        case "ArrowRight": {
          if (!caretOnly || start !== length || mod || e.shiftKey || e.altKey) return;
          const next = getNextVisible(tree, id);
          if (!next) return;
          e.preventDefault();
          editAt({ id: next, edge: "start" });
          return;
        }
      }
    },
    [commit, editAt, select, travel, history, applyEdit, acceptCompletion, closeCompletion],
  );

  /** The blocks a command on row `id` acts on: the selection's roots when the
   *  row is in it, else the row alone. */
  const targets = (id: BulletId): BulletId[] => (selection?.ids.has(id) ? selection.roots : [id]);

  // --- Keys on a block (selected, or focused after a Tab into the outline) ---
  const handleRootKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || editingId) return;
    const target = e.target as HTMLElement;
    const id = target.dataset?.bulletId;
    // Only a key on the row itself: a wiki link inside it keeps its Enter.
    if (!id || rowRefs.current.get(id) !== target) return;
    const selected = activeId === id;
    const mod = e.metaKey || e.ctrlKey;
    const self = findBullet(value, id)?.bullet;
    const hasChildren = (self?.children?.length ?? 0) > 0;
    const roots = targets(id);

    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z" || key === "y") {
        e.preventDefault();
        travel(key === "y" || e.shiftKey ? "redo" : "undo");
        return;
      }
      if (key === "a") {
        const first = flat[0];
        const last = flat[flat.length - 1];
        if (first && last) {
          e.preventDefault();
          select(last.id, first.id);
        }
        return;
      }
    }

    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown": {
        const up = e.key === "ArrowUp";
        e.preventDefault();
        if (e.shiftKey && (mod || e.altKey)) {
          if (readOnly) return;
          // Each root in turn, leading with the one in the direction of travel;
          // if that one cannot move, none does.
          const order = up ? roots : [...roots].reverse();
          let next = value;
          for (const root of order) {
            const moved = up ? moveUp(next, root) : moveDown(next, root);
            if (moved === next) break;
            next = moved;
          }
          commit(next);
          if (!selected) select(id);
          return;
        }
        if (mod) {
          if (hasChildren) commit(setCollapsed(value, id, up));
          if (!selected) select(id);
          return;
        }
        if (e.shiftKey) {
          const anchor = selected ? (anchorId ?? id) : id;
          select(extendSelection(flat, anchor, id, up ? -1 : 1), anchor);
          return;
        }
        select((up ? getPrevVisible(value, id) : getNextVisible(value, id)) ?? id);
        return;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (hasChildren && !self?.collapsed) {
          commit(setCollapsed(value, id, true));
          select(id);
        } else {
          select(getParentId(value, id) ?? id);
        }
        return;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (hasChildren && self?.collapsed) {
          commit(setCollapsed(value, id, false));
          select(id);
        } else {
          select(self?.children?.[0]?.id ?? id);
        }
        return;
      }
      case "Home":
      case "End": {
        e.preventDefault();
        const edge = e.key === "Home" ? flat[0] : flat[flat.length - 1];
        const to = edge?.id ?? id;
        select(to, e.shiftKey && selected ? (anchorId ?? id) : to);
        return;
      }
      case " ": {
        e.preventDefault();
        select(id);
        return;
      }
      case "Enter":
      case "F2": {
        e.preventDefault();
        if (readOnly) select(id);
        else if (mod && e.key === "Enter") {
          // Mod+Enter: no task, open, done, on every selected block.
          commit(
            roots.reduce((tree, root) => {
              const text = findBullet(tree, root)?.bullet.content;
              return text === undefined ? tree : updateContent(tree, root, cycleTask(text));
            }, value),
          );
          if (!selected) select(id);
        } else editAt({ id, edge: "end" });
        return;
      }
      case "Tab": {
        // Tab indents the selected blocks; on a block that is only focused it
        // moves on, so the outline never holds the keyboard.
        if (readOnly || !selected || mod || e.altKey) return;
        e.preventDefault();
        commit(roots.reduce((tree, root) => (e.shiftKey ? outdent : indent)(tree, root), value));
        return;
      }
      case "Backspace":
      case "Delete": {
        if (readOnly || !selected) return;
        e.preventDefault();
        removeBlocks(roots);
        return;
      }
      case "Escape": {
        if (!selected) return;
        // Release the selection; the focus stays on the row, and Tab leaves.
        e.preventDefault();
        select(null);
        return;
      }
    }
  };

  /** Delete blocks with their children, and select what was next to them. */
  const removeBlocks = (roots: BulletId[]) => {
    const firstIndex = flat.findIndex((f) => f.id === roots[0]);
    const gone = new Set(roots);
    // The row above the first root, else the first row left below them.
    let neighbour = flat[firstIndex - 1]?.id ?? null;
    if (!neighbour) {
      let depth = Number.POSITIVE_INFINITY;
      for (const row of flat.slice(Math.max(firstIndex, 0))) {
        if (gone.has(row.id)) depth = row.depth;
        else if (row.depth <= depth) {
          neighbour = row.id;
          break;
        }
      }
    }
    commit(roots.reduce((tree, root) => deleteSubtree(tree, root), value));
    select(neighbour);
  };

  // --- Clipboard: selected blocks travel as a markdown list ---
  const copyBlocks = (e: ClipboardEvent<HTMLDivElement>): BulletId[] | null => {
    if (e.defaultPrevented || editingId || !selection || !activeId) return null;
    if (e.target !== rowRefs.current.get(activeId)) return null;
    const bullets = selection.roots
      .map((id) => findBullet(value, id)?.bullet)
      .filter((b): b is Bullet => b !== undefined);
    e.clipboardData.setData("text/plain", toMarkdownList(bullets));
    e.preventDefault();
    return selection.roots;
  };

  const handleCopy = (e: ClipboardEvent<HTMLDivElement>) => {
    onCopy?.(e);
    copyBlocks(e);
  };

  const handleCut = (e: ClipboardEvent<HTMLDivElement>) => {
    onCut?.(e);
    if (editingId) {
      // The textarea cuts its own text; note the caret for the undo step.
      const textarea = editorRefs.current.get(editingId);
      if (textarea) {
        caretBefore.current = {
          id: editingId,
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
        };
      }
      history.breakTyping();
      return;
    }
    const roots = readOnly ? null : copyBlocks(e);
    if (roots) removeBlocks(roots);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    onPaste?.(e);
    if (e.defaultPrevented || readOnly) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    if (editingId) {
      const textarea = editorRefs.current.get(editingId);
      if (!textarea || e.target !== textarea) return;
      caretBefore.current = {
        id: editingId,
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
      history.breakTyping();
      // One line, or the lines of one paragraph: the textarea pastes it as text.
      if (!isOutlineText(text)) return;
      e.preventDefault();
      const fresh = withIds(parseOutline(text), generateId);
      const [first, ...others] = fresh;
      if (!first) return;
      const self = findBullet(value, editingId)?.bullet;
      const last = fresh[fresh.length - 1] as Bullet;
      if (self && self.content === "" && !self.children?.length) {
        // An empty block becomes the first pasted one.
        const filled = fillBullet(value, editingId, first.content, first.children);
        commit(insertSiblingsAfter(filled, editingId, others));
        editAt({ id: others.length > 0 ? last.id : editingId, edge: "end" });
      } else {
        commit(insertSiblingsAfter(value, editingId, fresh));
        editAt({ id: last.id, edge: "end" });
      }
      return;
    }

    if (!selection || !activeId || e.target !== rowRefs.current.get(activeId)) return;
    e.preventDefault();
    const blocks = isOutlineText(text)
      ? parseOutline(text)
      : [{ content: text.trim(), children: [] }];
    const fresh = withIds(blocks, generateId);
    const after = selection.roots[selection.roots.length - 1];
    const first = fresh[0];
    const last = fresh[fresh.length - 1];
    if (!after || !first || !last) return;
    commit(insertSiblingsAfter(value, after, fresh));
    select(last.id, first.id);
  };

  // --- Focus leaving the outline drops the selection and the caret ---
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    onBlur?.(e);
    const root = rootRef.current;
    if (!root) return;
    const next = e.relatedTarget as Node | null;
    if (next && root.contains(next)) return;
    // The textarea of a block being left unmounts before the next one takes
    // the focus, so look again once that has happened.
    const doc = root.ownerDocument;
    (doc.defaultView ?? window).requestAnimationFrame(() => {
      if (root.contains(doc.activeElement)) return;
      select(null);
    });
  };

  const startFirstBlock = () => {
    const id = generateId();
    commit([{ id, content: "" }]);
    editAt({ id, edge: "start" });
  };

  // --- Markdown components for wiki-links + block-refs ---
  const markdownComponents = useMemo<Components>(
    () => buildOutlinerComponents({ onWikiLinkClick, resolveBlockRef, depth: 0 }),
    [onWikiLinkClick, resolveBlockRef],
  );

  // The list hangs under the trigger, where the query begins, and follows the
  // textarea when the outline scrolls.
  const completionBlock = completion?.blockId;
  const completionFrom = completion?.match.from;
  const completionAnchor = useMemo(() => {
    if (completionBlock === undefined || completionFrom === undefined) return null;
    const textarea = editorRefs.current.get(completionBlock);
    if (!textarea) return null;
    return {
      getBoundingClientRect: () => caretRect(textarea, completionFrom),
      contextElement: textarea,
    };
  }, [completionBlock, completionFrom]);

  const tabbableId =
    activeId ??
    (lastActive.current && visible.has(lastActive.current) ? lastActive.current : flat[0]?.id);

  return (
    <div
      {...rest}
      ref={mergeRefs(ref, rootRef)}
      role="tree"
      aria-multiselectable="true"
      className={cx(styles.root, className)}
      onKeyDown={handleRootKeyDown}
      onBlur={handleBlur}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
    >
      {flat.length === 0 && !readOnly ? (
        <div
          role="treeitem"
          aria-selected={false}
          className={styles.row}
          data-placeholder
          tabIndex={0}
          onClick={startFirstBlock}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            startFirstBlock();
          }}
        >
          <span className={styles.fold} />
          <span className={styles.bullet} aria-hidden="true">
            <span className={styles.dot} />
          </span>
          <div className={styles.content}>
            <span className={styles.placeholder}>{placeholder}</span>
          </div>
        </div>
      ) : (
        flat.map(({ id, bullet, depth, hasChildren }) => (
          <OutlinerBullet
            key={id}
            bullet={bullet}
            depth={depth}
            hasChildren={hasChildren}
            isActive={activeId === id}
            isSelected={selection?.ids.has(id) ?? false}
            isEditing={editingId === id}
            tabbable={tabbableId === id}
            readOnly={readOnly}
            markdownComponents={markdownComponents}
            completionListId={completion?.blockId === id ? listId : undefined}
            completionOptionId={
              completion?.blockId === id ? `${listId}-${completion.index}` : undefined
            }
            onEnter={handleEnter}
            onRowMouseDown={handleRowMouseDown}
            onToggleCollapsed={handleToggleCollapsed}
            onTaskToggle={handleTaskToggle}
            onTextChange={handleTextChange}
            onEditorKeyDown={handleEditorKeyDown}
            onEditorBeforeInput={handleEditorBeforeInput}
            onEditorSelect={refreshCompletion}
            registerRow={registerRow}
            registerEditor={registerEditor}
          />
        ))
      )}
      {completion && completionAnchor && (
        <Popover.Root
          open
          modal={false}
          onOpenChange={(open) => {
            if (!open) closeCompletion();
          }}
        >
          <Popover.Portal>
            <Popover.Positioner
              anchor={completionAnchor}
              side="bottom"
              align="start"
              sideOffset={2}
            >
              {/* The focus stays in the block's text: the arrows and Enter are
                  handled there, and the list is read through aria-activedescendant. */}
              <BasePopover.Popup
                className={styles.completions}
                initialFocus={false}
                finalFocus={false}
                aria-label="Suggestions"
              >
                <div role="listbox" id={listId} aria-label="Suggestions">
                  {completion.items.map((item, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: the list is replaced as a whole, and labels may repeat
                      key={index}
                      id={`${listId}-${index}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={index === completion.index}
                      data-highlighted={index === completion.index || undefined}
                      className={styles.completion}
                      // Keep the caret in the text while the pointer chooses.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setCompletion({ ...completion, index })}
                      onClick={() => acceptCompletion(item)}
                    >
                      <span className={styles.completionLabel}>{item.label}</span>
                      {item.description && (
                        <span className={styles.completionDescription}>{item.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </BasePopover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
});

// --- Markdown components factory (recursive, depth-capped) ---

interface BuildComponentsOpts {
  onWikiLinkClick?: (name: string) => void;
  resolveBlockRef?: (id: string) => string | null;
  depth: number;
}

function buildOutlinerComponents(opts: BuildComponentsOpts): Components {
  return {
    a: ({ href, children }) => {
      if (typeof href === "string" && href.startsWith("wiki:")) {
        const name = decodeURIComponent(href.slice("wiki:".length));
        return (
          <button
            type="button"
            className={styles.wikiLink}
            onClick={(e) => {
              e.stopPropagation();
              opts.onWikiLinkClick?.(name);
            }}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    },
    code: ({ children, className }) => {
      const text = typeof children === "string" ? children : String(children ?? "");
      if (text.startsWith("block-ref:")) {
        const id = text.slice("block-ref:".length);
        if (opts.depth >= MAX_TRANSCLUSION_DEPTH) {
          return <span className={styles.blockRefMissing}>⟨transclusion depth limit⟩</span>;
        }
        const resolved = opts.resolveBlockRef?.(id);
        if (resolved == null) {
          return <span className={styles.blockRefMissing}>⟨ref not found: {id}⟩</span>;
        }
        return (
          <span className={styles.blockRef}>
            <Markdown
              value={resolved}
              preprocess={preprocessOutlinerMarkdown}
              components={buildOutlinerComponents({ ...opts, depth: opts.depth + 1 })}
              urlTransform={passthroughUrlTransform}
              inline
            />
          </span>
        );
      }
      return <code className={className}>{children}</code>;
    },
  };
}
