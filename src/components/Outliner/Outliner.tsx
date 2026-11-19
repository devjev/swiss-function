import type { ComponentProps, FocusEvent, KeyboardEvent } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
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
import { caretLine, offsetAtX } from "./caret";
import {
  MAX_TRANSCLUSION_DEPTH,
  passthroughUrlTransform,
  preprocessOutlinerMarkdown,
} from "./markdown-extensions";
import styles from "./Outliner.module.css";
import { OutlinerBullet } from "./OutlinerBullet";
import {
  deleteBullet,
  findBullet,
  flatVisible,
  getNextVisible,
  getParentId,
  getPrevVisible,
  indent,
  mergeInto,
  moveDown,
  moveUp,
  outdent,
  setCollapsed,
  splitBullet,
  toggleCollapsed,
  updateContent,
} from "./tree";
import type { BulletId, OutlinerProps, OutlinerValue } from "./types";

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

/**
 * An outline edited as one document, after Roam Research and Logseq: a block
 * is a textarea over its markdown while the caret is in it and rendered
 * markdown otherwise, and Enter, Backspace, Tab and the arrows carry the caret
 * and the structure from block to block.
 *
 * Two levels of focus. In a block's text, the keys edit. Escape steps out to
 * the block itself (selected): the arrows walk the tree, Enter goes back in.
 * Escape again releases the selection, and Tab then leaves the outline.
 */
export const Outliner = forwardRef<HTMLDivElement, OutlinerProps>(function Outliner(props, ref) {
  const {
    value,
    onChange,
    readOnly = false,
    generateId = defaultGenerateId,
    onWikiLinkClick,
    resolveBlockRef,
    placeholder = "Empty outline. Click to write.",
    className,
    onKeyDown,
    onBlur,
    ...rest
  } = props;

  const [activeState, setActiveId] = useState<BulletId | null>(null);
  const [editingState, setEditingId] = useState<BulletId | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const flat = useMemo(() => flatVisible(value), [value]);
  const visible = useMemo(() => new Set(flat.map((f) => f.id)), [flat]);
  // A block that left the screen (deleted, or folded away) holds neither the
  // selection nor the caret.
  const activeId = activeState && visible.has(activeState) ? activeState : null;
  const editingId = !readOnly && editingState && visible.has(editingState) ? editingState : null;

  // The handlers below are created once, so a keystroke re-renders one row;
  // they read what is current from here.
  const latest = useRef({ value, onChange, readOnly, generateId, activeId, editingId });
  latest.current = { value, onChange, readOnly, generateId, activeId, editingId };

  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<BulletId, HTMLDivElement>());
  const editorRefs = useRef(new Map<BulletId, HTMLTextAreaElement>());
  const pendingCaret = useRef<Caret | null>(null);
  /** The x the caret keeps while Arrow Up / Down run through several blocks. */
  const goalX = useRef<number | null>(null);
  /** The last selected block: where a Tab back into the outline lands. */
  const lastActive = useRef<BulletId | null>(null);
  if (activeId) lastActive.current = activeId;

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

  const commit = useCallback((next: OutlinerValue): boolean => {
    if (next === latest.current.value) return false;
    latest.current.onChange(next);
    return true;
  }, []);

  /** Put the caret in a block. */
  const editAt = useCallback((caret: Caret) => {
    pendingCaret.current = caret;
    setActiveId(caret.id);
    setEditingId(caret.id);
    // The block may already be the one being edited: render anyway, so the
    // caret is applied.
    rerender();
  }, []);

  const handleEnter = useCallback(
    (id: BulletId, offset: number | null) => {
      goalX.current = null;
      if (latest.current.readOnly || offset === null) {
        setEditingId(null);
        setActiveId(id);
        return;
      }
      editAt({ id, start: offset, end: offset });
    },
    [editAt],
  );

  const handleToggleCollapsed = useCallback(
    (id: BulletId) => {
      commit(toggleCollapsed(latest.current.value, id));
    },
    [commit],
  );

  const handleTextChange = useCallback(
    (id: BulletId, text: string) => {
      goalX.current = null;
      commit(updateContent(latest.current.value, id, text));
    },
    [commit],
  );

  // --- Keys in a block's text ---
  const handleEditorKeyDown = useCallback(
    (id: BulletId, e: KeyboardEvent<HTMLTextAreaElement>) => {
      // A key that confirms an IME composition is not a command.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      const textarea = e.currentTarget;
      const { value: tree, generateId: newId } = latest.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const caretOnly = start === end;
      const length = textarea.value.length;
      const mod = e.metaKey || e.ctrlKey;
      const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!vertical) goalX.current = null;

      /** Apply a tree change that keeps the caret where it is. */
      const inPlace = (next: OutlinerValue) => {
        e.preventDefault();
        if (!commit(next)) return;
        pendingCaret.current = { id, start, end };
        rerender();
      };

      switch (e.key) {
        case "Escape": {
          e.preventDefault();
          setEditingId(null);
          setActiveId(id);
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
          if (e.shiftKey || e.altKey || !caretOnly) {
            goalX.current = null;
            return;
          }
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
    [commit, editAt],
  );

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

    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown": {
        const up = e.key === "ArrowUp";
        e.preventDefault();
        if (e.shiftKey && (mod || e.altKey)) {
          if (!readOnly) commit(up ? moveUp(value, id) : moveDown(value, id));
          setActiveId(id);
          return;
        }
        if (mod) {
          if (hasChildren) commit(setCollapsed(value, id, up));
          setActiveId(id);
          return;
        }
        setActiveId((up ? getPrevVisible(value, id) : getNextVisible(value, id)) ?? id);
        return;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (hasChildren && !self?.collapsed) {
          commit(setCollapsed(value, id, true));
          setActiveId(id);
        } else {
          setActiveId(getParentId(value, id) ?? id);
        }
        return;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (hasChildren && self?.collapsed) {
          commit(setCollapsed(value, id, false));
          setActiveId(id);
        } else {
          setActiveId(self?.children?.[0]?.id ?? id);
        }
        return;
      }
      case "Home":
      case "End": {
        e.preventDefault();
        const edge = e.key === "Home" ? flat[0] : flat[flat.length - 1];
        setActiveId(edge?.id ?? id);
        return;
      }
      case " ": {
        e.preventDefault();
        setActiveId(id);
        return;
      }
      case "Enter":
      case "F2": {
        e.preventDefault();
        if (readOnly) setActiveId(id);
        else editAt({ id, edge: "end" });
        return;
      }
      case "Tab": {
        // Tab indents a selected block; on a block that is only focused it
        // moves on, so the outline never holds the keyboard.
        if (readOnly || !selected || mod || e.altKey) return;
        e.preventDefault();
        commit(e.shiftKey ? outdent(value, id) : indent(value, id));
        return;
      }
      case "Backspace":
      case "Delete": {
        if (readOnly || !selected) return;
        e.preventDefault();
        const neighbour = getPrevVisible(value, id) ?? getNextVisible(value, id);
        commit(deleteBullet(value, id));
        setActiveId(neighbour);
        return;
      }
      case "Escape": {
        if (!selected) return;
        // Release the selection; the focus stays on the row, and Tab leaves.
        e.preventDefault();
        setActiveId(null);
        return;
      }
    }
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
      setEditingId(null);
      setActiveId(null);
    });
  };

  const startFirstBlock = () => {
    const id = generateId();
    onChange([{ id, content: "" }]);
    editAt({ id, edge: "start" });
  };

  // --- Markdown components for wiki-links + block-refs ---
  const markdownComponents = useMemo<Components>(
    () => buildOutlinerComponents({ onWikiLinkClick, resolveBlockRef, depth: 0 }),
    [onWikiLinkClick, resolveBlockRef],
  );

  const tabbableId =
    activeId ??
    (lastActive.current && visible.has(lastActive.current) ? lastActive.current : flat[0]?.id);

  return (
    <div
      {...rest}
      ref={mergeRefs(ref, rootRef)}
      role="tree"
      className={cx(styles.root, className)}
      onKeyDown={handleRootKeyDown}
      onBlur={handleBlur}
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
            isEditing={editingId === id}
            tabbable={tabbableId === id}
            readOnly={readOnly}
            markdownComponents={markdownComponents}
            onEnter={handleEnter}
            onToggleCollapsed={handleToggleCollapsed}
            onTextChange={handleTextChange}
            onEditorKeyDown={handleEditorKeyDown}
            registerRow={registerRow}
            registerEditor={registerEditor}
          />
        ))
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
