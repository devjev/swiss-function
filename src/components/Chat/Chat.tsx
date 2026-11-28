import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { hitArea } from "../../lib/hitArea";
import { useKeyboardOpen } from "../../lib/keyboard";
import { useCoarsePointer } from "../../lib/useMediaQuery";
import { Button, type ButtonVariant } from "../Button";
import { ArrowUp } from "../Icon";
import { Markdown } from "../Markdown";
import { useMinimapMarkers } from "../Minimap/useMinimapMarkers";
import { Spinner } from "../Spinner";
import { StreamingTerminalText } from "../StreamingTerminalText";
import { TextEdit } from "../TextEdit";
import styles from "./Chat.module.css";
import { type ChatChoice, ChatChoices } from "./ChatChoices";
import { ChatError } from "./ChatError";
import {
  ChatExpandContext,
  type ChatExpandState,
  type ChatVariant,
  ChatVariantContext,
} from "./ChatExpand";
import type { ChatPrompt } from "./ChatPrompt";
import { ChatTable, type ChatTableColumn } from "./ChatTable";
import { ChatThinking } from "./ChatThinking";
import { ChatTool, type ChatToolStatus } from "./ChatTool";
import { type ChatStepStatus, ChatTree, type ChatTreeNode } from "./ChatTree";
import {
  applyChatCompletion,
  type ChatCompletionMatch,
  type ChatCompletionTrigger,
  findChatTrigger,
  removeChatTrigger,
  windowStart,
} from "./completion";

export type { ChatChoice, ChatCompletionTrigger, ChatStepStatus, ChatTreeNode, ChatVariant };

/** What the editor asks the host for while a trigger is typed. */
export interface ChatCompletionRequest {
  /** `/` (a command, only as the first character of the input), `@` or `#`
   *  (at the start of any word). */
  trigger: ChatCompletionTrigger;
  /** What has been typed after the trigger, up to the caret. */
  query: string;
}

/** One entry of the completion list under the editor. */
export interface ChatCompletion {
  /** Shown in the list. */
  label: string;
  /** Shown beside the label, as `# description`, where the dock is wide
   *  enough. */
  description?: string;
  /** Written after the trigger in place of the query; `label` when omitted.
   *  A space follows. */
  insert?: string;
  /** One step of a longer value (a directory on the way to a file): no space
   *  follows, and the list asks again for what comes after it. */
  partial?: boolean;
  /** An entry that does something instead of writing text (`/clear`): the
   *  trigger and the query are taken out of the input (`insert`, when given,
   *  goes in their place) and this is called. */
  onSelect?: () => void;
}

/** Entries shown at a time in the completion list. */
const COMPLETION_ROWS = 5;

interface CompletionState {
  match: ChatCompletionMatch;
  items: ChatCompletion[];
  index: number;
}

/** Sub-pixel slack when asking "is the viewport at the bottom": `scrollHeight`
 *  and `clientHeight` are integers over fractional layout, so the true bottom
 *  can read a pixel or two short. This is not a reading-distance threshold —
 *  following stops on the first scroll away from the bottom, however small. */
const BOTTOM_SLACK = 4;

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export type ChatRole = "user" | "assistant";

/** A plain markdown / text block. */
export interface ChatTextPart {
  type: "text";
  partId?: string;
  text: string;
}

/** An in-chat choice menu. Selections are reported via `Chat`'s `onAction`. */
export interface ChatChoicesPart {
  type: "choices";
  partId?: string;
  prompt?: string;
  options: ChatChoice[];
  multiple?: boolean;
}

/** A decision / orchestration tree, rendered as a terminal directory tree.
 *  Node clicks are reported via `onAction`. */
export interface ChatTreePart {
  type: "tree";
  partId?: string;
  /** Top-level nodes (a forest of `ChatTreeNode`). */
  roots: ChatTreeNode[];
}

/** An assistant "thinking" block: a spinner that expands into a live
 *  orchestration fan-out (a status tree), collapsing to a summary when done.
 *  Drive it by updating the message — like `isStreaming`. */
export interface ChatThinkingPart {
  type: "thinking";
  partId?: string;
  /** Run state. `running` shows a live spinner; `done` collapses to `summary`. */
  status: "running" | "done" | "error";
  /** Header text while running / on error. Default "Thinking…" / "Failed". */
  label?: string;
  /** The fan-out — status-annotated `ChatTreeNode`s, grown as agents spawn. */
  steps?: ChatTreeNode[];
  /** Collapsed-line text when done. Default `Ran N steps`. */
  summary?: string;
  /** Force the initial expand state (otherwise expanded unless `done`). */
  defaultExpanded?: boolean;
}

/** An error surfaced by the backend (e.g. an overloaded/timeout response),
 *  shown as a small glitch block. The app parses its payload into a clean
 *  `message` (+ optional `requestId`); `onError` fires when it appears, and a
 *  `retryable` error's Retry reports through `onAction`. */
export interface ChatErrorPart {
  type: "error";
  partId?: string;
  message: string;
  requestId?: string;
  retryable?: boolean;
}

/** A tool call, as a terminal agent prints one: a band with the call on its
 *  first line, the output cut to its last (or first) lines, and a closing
 *  note. Drive it by updating the message: `running`, then `done` or `error`. */
export interface ChatToolPart {
  type: "tool";
  partId?: string;
  /** The call's name, printed bold: `read`, `grep`, `$` for a shell command. */
  name: string;
  /** The rest of the call line: a path, a command, the arguments. */
  args?: string;
  /** Default `"done"`. */
  status?: ChatToolStatus;
  /** The tool's text output. */
  output?: string;
  /** Which end stays in view while collapsed. Default `"tail"`. */
  truncate?: "tail" | "head";
  /** Lines shown while collapsed. Default 5 for a tail, 10 for a head. */
  lines?: number;
  /** A closing line: `Took 2.9s`. */
  note?: string;
  /** The failure message. */
  error?: string;
  defaultExpanded?: boolean;
}

/** A table of the host's data, drawn as a terminal draws one (`ChatTable`). */
export interface ChatTablePart {
  type: "table";
  partId?: string;
  columns: ChatTableColumn[];
  rows: Record<string, unknown>[];
  caption?: string;
}

/** Escape hatch for any other block — rendered by `Chat`'s `renderPart`. */
export interface ChatCustomPart {
  type: string;
  partId?: string;
  [key: string]: unknown;
}

export type ChatPart =
  | ChatTextPart
  | ChatChoicesPart
  | ChatTreePart
  | ChatThinkingPart
  | ChatErrorPart
  | ChatToolPart
  | ChatTablePart
  | ChatCustomPart;

/** Passed to `onError` when an error part appears in the transcript. */
export interface ChatErrorContext {
  messageId: string;
  partId?: string;
  message: string;
  requestId?: string;
}

/** Emitted when a user interacts with a non-text block (chooses an option,
 *  clicks a tree node, or a custom block calls back). */
export interface ChatAction {
  messageId: string;
  partId?: string;
  /** The part `type` that produced the action (e.g. "choices", "tree"). */
  type: string;
  value: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Markdown source (assistant) or plain text (user). Optional when `parts`
   *  is provided. */
  content?: string;
  /** Ordered rich blocks. When present, takes precedence over `content`. */
  parts?: ChatPart[];
  /** True while an assistant message is still streaming in. */
  isStreaming?: boolean;
}

/** The shortest message's band, in units. Every other band is proportional to
 *  it, so this is the rail's scale as much as its floor. */
const CHAT_MIN_BLOCK = 0.5;

/** Tuning for the transcript's `Minimap` rail (see `ChatProps.minimap`). */
/** The rail is opt-in, so it is loaded on demand: a chat that never sets
 *  `minimap` carries none of Minimap's geometry or styles (the pattern
 *  DataTable's header menu uses). Until the chunk lands, the transcript renders
 *  as the plain scroller it is without it. */
const MinimapRail = lazy(async () => ({ default: (await import("../Minimap")).Minimap }));

/** The prompt panel is loaded on demand, as the rail is: most chats never ask
 *  a question, so a chat carries none of it until the first prompt opens.
 *  While the chunk lands the editor's place stays empty, so a keystroke meant
 *  for the editor cannot reach it and miss the question. */
const PromptPanel = lazy(async () => ({ default: (await import("./ChatPrompt")).ChatPromptPanel }));

export interface ChatMinimap {
  /** Which edge the rail occupies. Default `"right"`. */
  side?: "left" | "right";
  /** Rail width in `--sf-unit` multiples. Default 5. */
  width?: number;
}

/** One line of the footer. */
/** The chat's faces, as CSS `font-family` values. Each unset one falls back
 *  to its `--sf-chat-font*` variable, then to the terminal's monospace. */
export interface ChatFonts {
  /** The replies and the chrome (status lines, lists, prompts). */
  text?: string;
  /** The user's text and the editor. Default: the text face. */
  user?: string;
  /** Code, tool calls and their output. Default: the monospace. */
  code?: string;
}

export interface ChatStatusLine {
  /** Gives way first: cut with an ellipsis when the line is too narrow. */
  left?: ReactNode;
  /** Stays whole. */
  right?: ReactNode;
}

export interface ChatProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit" | "onError"> {
  messages: ChatMessage[];
  /** Fired with the trimmed text when the user submits. Input clears automatically. */
  onSubmit: (text: string) => void;
  /** Render a custom (non-built-in) part by `type`. Return null/undefined to skip. */
  renderPart?: (part: ChatPart, ctx: { message: ChatMessage }) => ReactNode;
  /** Fired when a user interacts with a choices / tree / custom block. */
  onAction?: (action: ChatAction) => void;
  /** Fired once when an error part appears in the transcript (a notification
   *  hook: log / toast / auto-retry). A `retryable` error also renders a Retry,
   *  reported through `onAction` (`type: "error", value: "retry"`). */
  onError?: (error: ChatErrorContext) => void;
  /** Replace the transcript's scrollbar with a `Minimap` rail: the user's
   *  messages become clickable labels down the side (the questions are what you
   *  navigate a conversation by) and the assistant's replies dithered blocks,
   *  with the viewport band showing where you are. Worth it on a long
   *  conversation, or a wide one (a `ChatDrawer` panel, fullscreen); a short
   *  exchange has nothing to navigate.
   *
   *  `true` takes the defaults; the object form tunes the rail: `side` (right
   *  by default) and `width` in `--sf-unit` multiples. Without a `width` the
   *  rail reads `--sf-chat-minimap-width`, which defaults to 5u: wider than the
   *  `--sf-minimap-width` token (4u), because a chat's labels are the questions
   *  asked, which are sentences, where a form's are field names. Set that
   *  variable on any ancestor to retune every rail; the prop overrides it on
   *  one chat. Default `false`. */
  minimap?: boolean | ChatMinimap;
  /** How the transcript is set.
   *  - `"terminal"` (default): entries one blank line apart, the user's turn
   *    and every tool call a band across the transcript.
   *  - `"log"`: a dense log. No blank lines between entries and no bands: the
   *    user's line starts with an accent `>`, a reply is indented under it, and
   *    a tool call is one line with its status at the end, its output folded
   *    to one line until expanded. The chat drops its frame by default. */
  variant?: ChatVariant;
  /** The chat's faces: `text` for the replies and the chrome, `user` for the
   *  user's text and the editor, `code` for code and tool calls. Unset, each
   *  reads its variable (`--sf-chat-font`, `--sf-chat-font-user`,
   *  `--sf-chat-font-code`), so an app can set them once on an ancestor; all
   *  three default to the terminal's monospace. Any face is sized to the
   *  system's x-height. The tree guides stay monospace, as they only line up
   *  in a fixed-width face. */
  fonts?: ChatFonts;
  /** Draw the chat's border. Default `true` for the terminal variant and
   *  `false` for the log, which is meant to fill a panel edge to edge (a
   *  `ChatDrawer`, a pane). */
  frame?: boolean;
  /** A start banner at the top of the transcript, which scrolls away with it:
   *  a title, the keys, what is loaded. Set in the transcript's monospace. */
  header?: ReactNode;
  /** Status lines under the editor, as a terminal's footer: each line has a
   *  left side that gives way (an ellipsis) and a right side that stays (a
   *  path and a session on the left, the model on the right). */
  footer?: ChatStatusLine[];
  /** The host's own content docked above the editor (a queue, a plan, a
   *  progress line). It does not scroll with the transcript. */
  aboveEditor?: ReactNode;
  /** The host's own content docked under the editor, above the footer. */
  belowEditor?: ReactNode;
  /** Show the working indicator in the editor's top rule: a spinner and a
   *  message (`true` prints "Working"; a string prints itself). */
  working?: boolean | string;
  /** Called on Escape while `working`. With it the working message carries
   *  `(esc to interrupt)`. */
  onInterrupt?: () => void;
  /** Entries for the completion list under the editor, asked for while a
   *  trigger is typed: `/` as the first character of the input (commands),
   *  `@` or `#` at the start of a word (files, tags). Return the entries for
   *  the query, now or as a promise; an empty list shows nothing. Without
   *  this prop no list opens. */
  completions?: (request: ChatCompletionRequest) => ChatCompletion[] | Promise<ChatCompletion[]>;
  /** A question in the editor's place: a list to pick from, yes or no, a line
   *  of text, or the host's own content (`useChatPrompt` asks from code and
   *  awaits the answer). The draft in the editor is kept, and the editor comes
   *  back when the prompt is gone. */
  prompt?: ChatPrompt | null;
  /** Placeholder text shown in the empty input. Default "Ask anything…". */
  placeholder?: string;
  /** Whether Enter sends. `"auto"` (default): with a mouse and a keyboard it
   *  does (Shift+Enter breaks the line), and where the primary pointer is a
   *  finger Return breaks the line and the send key sends, as in a messaging
   *  app: a soft keyboard has no Shift+Enter. Ctrl+Enter (Cmd+Enter) sends
   *  either way, for a hardware keyboard on a tablet. */
  enterSends?: "auto" | boolean;
  /** Whether the send key shows. `"auto"` (default): only where the primary
   *  pointer is a finger, since a keyboard submits with Enter. `true` on any
   *  device, `false` never. */
  sendKey?: "auto" | boolean;
  /** The send key's accessible name. Default "Send". */
  sendLabel?: string;
  /** Visual variant of the send key, a small square key. Default "ghost":
   *  the up arrow alone. */
  sendVariant?: ButtonVariant;
  /** Colour of the editor's two rules and of the working indicator (any CSS
   *  colour). Defaults to the neutral `--sf-color-border` token; a host can
   *  use it as a status signal, as a terminal agent colours its editor by
   *  mode. */
  borderColor?: string;
  /** Container height. Default `calc(var(--sf-unit) * 20)` (= ~480px). */
  height?: number | string;
  /** Whether the input is disabled (e.g., while the assistant is still streaming). */
  disabled?: boolean;
  /** How streaming assistant text is revealed. Omit for the default terminal
   *  reveal (dramatic, per-character). Pass an object to tune it: `mode`
   *  (`"stream"` tracks a live token stream so it doesn't lag then burst),
   *  `charIntervalMs`, `tailLength` — all forwarded to `StreamingTerminalText`.
   *  Pass `false` to skip the reveal entirely: streaming text renders as plain
   *  `Markdown`, landing exactly as tokens arrive (no per-character shimmer). */
  reveal?: false | { mode?: "dramatic" | "stream"; charIntervalMs?: number; tailLength?: number };
}

export const Chat = forwardRef<HTMLDivElement, ChatProps>(function Chat(
  {
    messages,
    onSubmit,
    renderPart,
    onAction,
    onError,
    variant = "terminal",
    frame,
    fonts,
    header,
    footer,
    aboveEditor,
    belowEditor,
    working = false,
    onInterrupt,
    completions,
    prompt,
    placeholder = "Ask anything…",
    enterSends = "auto",
    sendKey = "auto",
    sendLabel = "Send",
    sendVariant = "ghost",
    borderColor,
    height,
    disabled,
    reveal,
    minimap = false,
    className,
    style,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [input, setInput] = useState("");
  // Where Up and Down stand in the user's earlier messages; null while the
  // field holds a draft of its own.
  const [recall, setRecall] = useState<number | null>(null);
  // A finger on a phone: the keyboard is a soft one, it covers half the
  // screen, and it opens whenever the field takes the focus.
  const coarse = useCoarsePointer();
  const sendOnEnter = enterSends === "auto" ? !coarse : enterSends;
  // While an on-screen keyboard is open for the chat's own field, the dock
  // gives the transcript the room the status lines took.
  const keyboardUp = useKeyboardOpen();
  const [dockFocus, setDockFocus] = useState(false);
  // The transcript-wide expand state of the tool blocks (Ctrl+O).
  const [expand, setExpand] = useState<ChatExpandState>({ expanded: false, version: 0 });
  // The completion list under the editor: the trigger it answers, its
  // entries and the cursor.
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const listId = useId();
  // The scroll element and the message list, held as state as well as refs: the
  // rail owns the scroller, so turning it on (and its chunk landing) REPLACES
  // both nodes. Handlers read the refs synchronously; the effects below key on
  // the state, so they re-observe the new nodes instead of a detached pair.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const setScroller = useCallback((node: HTMLDivElement | null) => {
    scrollerRef.current = node;
    setScrollEl(node);
  }, []);
  const setContent = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    setContentEl(node);
  }, []);
  /** A ref object the marker hook can key on: a new identity per content node,
   *  so it re-measures and re-observes after a swap. */
  const markerRoot = useMemo(() => ({ current: contentEl }), [contentEl]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Whether the viewport follows the bottom. Read by the ResizeObserver on
  // every growth tick, so it lives in a ref; `following` mirrors it for render.
  const stickRef = useRef(true);
  // Distance from the bottom at the last scroll or growth, to tell a scroll
  // away from the bottom (the user is reading history) from one toward it.
  const lastDistRef = useRef(0);
  // The offset we last wrote ourselves. A scroll event is ours only when the
  // view is still sitting on it: a one-shot "we wrote it" flag would be spent
  // by a user scroll landing in the same frame as a pin, and during a stream
  // there is a pin most frames.
  const selfTopRef = useRef(-1);
  // The last offset the user scrolled to, and whether the transcript has been
  // hidden since. A `display: none` ancestor (a ChatDrawer view the user
  // switched away from) destroys the scroll offset, so we put it back.
  const lastTopRef = useRef(0);
  const wasHiddenRef = useRef(false);
  // Render state: whether the jump-to-latest key shows, and whether anything
  // has arrived below the fold since following stopped.
  const [following, setFollowing] = useState(true);
  const [behind, setBehind] = useState(false);

  /** The rail's structure, measured off the transcript: a user message is a
   *  header (its text the label, so the rail reads as the questions asked) over
   *  a block of its own height in the accent, the colour it is spoken in down
   *  in the transcript, and an assistant message a neutral block the height of
   *  the reply, which is the density read. The rail then carries the two voices
   *  the way the conversation does. Measured from the DOM, so a streaming reply
   *  re-measures as it lands. Off, the empty source list measures and observes
   *  nothing. */
  const railOn = minimap !== false && minimap != null && minimap !== undefined;
  const rail: ChatMinimap = typeof minimap === "object" ? minimap : {};
  const measured = useMinimapMarkers(
    markerRoot,
    railOn
      ? [
          {
            selector: '[data-role="user"]',
            kind: "header" as const,
            label: (el: Element) =>
              (el.querySelector("[data-user-text]")?.textContent ?? el.textContent ?? "")
                .trim()
                .slice(0, 120),
            extent: true,
            tone: "primary" as const,
          },
          { selector: '[data-role="assistant"]', kind: "block" as const },
        ]
      : [],
  );

  /** Each band runs to the top of the next one. A message's own box is only
   *  part of the ground it covers: the 2u between turns is real space in the
   *  transcript, and left out of the rail it becomes a third of it in dead air,
   *  with a 6px tick floating over 20px of nothing. Packed, the rail reads as
   *  one ribbon alternating the two voices (the component trims a few px off
   *  each span, so they stay separate bands). Positions are untouched, so the
   *  viewport band still frames exactly what is on screen. */
  const markers = useMemo(() => {
    if (measured.length === 0) return measured;
    return measured.map((marker, i) => {
      const next = measured[i + 1];
      if (!next || marker.top == null || next.top == null) return marker;
      const own = marker.height ?? 0;
      const gap = next.top - marker.top - own;
      const height = own + Math.max(0, gap) / 2;
      return height > 0 ? { ...marker, height } : marker;
    });
  }, [measured]);

  const setFollow = useCallback((next: boolean) => {
    stickRef.current = next;
    setFollowing(next);
    if (next) setBehind(false);
  }, []);

  const pinToBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || distanceFromBottom(el) <= 0) return;
    el.scrollTop = el.scrollHeight;
    selfTopRef.current = el.scrollTop;
  }, []);

  // Fire `onError` once per error part, when it first appears (a notification,
  // never during render). Keyed by message + part identity.
  const reportedErrorsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onError) return;
    const reported = reportedErrorsRef.current;
    for (const msg of messages) {
      msg.parts?.forEach((part, i) => {
        if (part.type !== "error") return;
        const p = part as ChatErrorPart;
        const key = `${msg.id}:${p.partId ?? i}`;
        if (reported.has(key)) return;
        reported.add(key);
        onError({
          messageId: msg.id,
          partId: p.partId,
          message: p.message,
          requestId: p.requestId,
        });
      });
    }
  }, [messages, onError]);

  // Assistant messages whose reveal animation is still in flight. A message is
  // added while it streams and stays here — keeping its `StreamingTerminalText`
  // mounted — even after `isStreaming` flips off, until the reveal catches up
  // (drains) and reports completion. Only then do we hand off to a static
  // `Markdown` render. Without this the reveal would be abandoned mid-animation
  // and the full formatted reply would snap in at once.
  const [revealing, setRevealing] = useState<Set<string>>(() => new Set());
  // Stable boolean (an inline `reveal` object would otherwise re-trigger the
  // effect every render); only the opt-out matters to the reveal tracking.
  const revealOff = reveal === false;

  useEffect(() => {
    // With the reveal opted out (`reveal={false}`) no StreamingTerminalText
    // mounts, so nothing would ever call finishReveal — don't track these, or
    // the set would grow unbounded and keep messages flagged animating.
    if (revealOff) return;
    const streamingIds = messages
      .filter((m) => m.role === "assistant" && m.isStreaming)
      .map((m) => m.id);
    if (streamingIds.length === 0) return;
    setRevealing((prev) => {
      let next = prev;
      for (const id of streamingIds) {
        if (!next.has(id)) {
          if (next === prev) next = new Set(prev);
          next.add(id);
        }
      }
      return next;
    });
  }, [messages, revealOff]);

  const finishReveal = useCallback((id: string) => {
    setRevealing((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Hold the bottom as the bottom moves. Two things move it, and a
  // ResizeObserver over both catches each: the message list grows as the
  // streaming reveal lands tick by tick (including the post-stream drain), and
  // the viewport shrinks as the composer grows under `field-sizing: content`,
  // which would otherwise push the newest reply out of sight while you type.
  useEffect(() => {
    const scroller = scrollEl;
    const content = contentEl;
    if (!scroller || !content) return;
    const ro = new ResizeObserver(() => {
      // Zero height means a `display: none` ancestor; the offset is already
      // gone, so there is nothing to read and nothing to follow.
      if (scroller.clientHeight === 0) {
        wasHiddenRef.current = true;
        return;
      }
      if (wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (!stickRef.current) {
          scroller.scrollTop = lastTopRef.current;
          selfTopRef.current = scroller.scrollTop;
        }
      }
      if (stickRef.current) pinToBottom();
      else if (distanceFromBottom(scroller) > lastDistRef.current + BOTTOM_SLACK) {
        // Something landed below the fold while the user was reading back.
        setBehind(true);
      }
      lastDistRef.current = distanceFromBottom(scroller);
    });
    ro.observe(content);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [pinToBottom, scrollEl, contentEl]);

  // A fresh scroll element starts at the top, wherever the view was: put it
  // back. This is the rail's chunk landing and swapping the scroller under a
  // transcript that was already at the bottom (or scrolled back through).
  useEffect(() => {
    if (!scrollEl) return;
    if (stickRef.current) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      selfTopRef.current = scrollEl.scrollTop;
    } else if (lastTopRef.current > 0 && scrollEl.scrollTop === 0) {
      scrollEl.scrollTop = lastTopRef.current;
      selfTopRef.current = scrollEl.scrollTop;
    }
  }, [scrollEl]);

  // Following stops the moment the view moves away from the bottom, whatever
  // moved it (wheel, trackpad, scrollbar drag, keyboard) and however far, so we
  // never pull against the user. It resumes on reaching the bottom again, or on
  // the jump-to-latest key. Reaching the bottom is tested first, so a growth
  // that lands while the user scrolls the last pixels in cannot stop it.
  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const dist = distanceFromBottom(el);
    const ours = el.scrollTop === selfTopRef.current;
    if (dist <= BOTTOM_SLACK) setFollow(true);
    else if (!ours && dist > lastDistRef.current + 1) setFollow(false);
    lastDistRef.current = dist;
    lastTopRef.current = el.scrollTop;
  };

  const jumpToLatest = () => {
    setFollow(true);
    pinToBottom();
    // The reply keeps arriving; the composer is where the next turn is typed.
    // With a finger, focusing it would raise the keyboard over the reply the
    // user just asked to read.
    if (!coarse) inputRef.current?.focus();
  };

  // Restore focus to the input whenever the chat becomes interactable again
  // (initial mount, or after a streaming response ends and `disabled` flips
  // back to false). The input itself is NEVER disabled — only submission is
  // gated — so we never lose focus while typing a follow-up question. Not
  // with a finger: there the focus raises the keyboard, which a user who
  // dismissed it to read the reply did not ask for.
  useEffect(() => {
    if (!disabled && !coarse) inputRef.current?.focus();
  }, [disabled, coarse]);

  const submit = () => {
    if (disabled) return;
    const text = input.trim();
    if (!text) return;
    const hadFocus = typeof document !== "undefined" && document.activeElement === inputRef.current;
    // The user just sent a message: follow the reply from the bottom again.
    setFollow(true);
    onSubmit(text);
    setInput("");
    setRecall(null);
    setCompletion(null);
    requestedRef.current = "";
    // The next turn is typed here; with a finger only when the keyboard was
    // already up for it.
    if (!coarse || hadFocus) inputRef.current?.focus();
  };

  /** What the user has sent, oldest first, for Up and Down to walk. */
  const history = useMemo(() => {
    const out: string[] = [];
    for (const m of messages) {
      if (m.role !== "user" || !m.content) continue;
      if (out[out.length - 1] !== m.content) out.push(m.content);
    }
    return out;
  }, [messages]);

  // --- Completion: `/command`, `@file`, `#tag` ---
  // The host's function is read at the moment it is needed, so an inline one
  // does not reopen the list on every render.
  const completionsRef = useRef(completions);
  completionsRef.current = completions;
  // The request the list is showing (or waiting for), and the trigger Escape
  // closed: the list stays shut for that trigger and comes back for the next.
  const requestedRef = useRef("");
  const dismissedRef = useRef("");
  // Where the caret goes after an entry is accepted, once the text is in.
  const pendingCaretRef = useRef<{ at: number; again: boolean } | null>(null);

  /** Look at the caret and open, update or close the list. */
  const refreshCompletion = useCallback(() => {
    const source = completionsRef.current;
    const el = inputRef.current;
    if (!source || !el) return;
    const match =
      el.selectionStart === el.selectionEnd ? findChatTrigger(el.value, el.selectionStart) : null;
    if (!match) {
      requestedRef.current = "";
      dismissedRef.current = "";
      setCompletion(null);
      return;
    }
    const place = `${match.trigger}:${match.from}`;
    if (dismissedRef.current === place) return;
    const request = `${place}:${match.query}`;
    if (requestedRef.current === request) return;
    requestedRef.current = request;
    // A late answer to an earlier query is dropped.
    const settle = (items: ChatCompletion[]) => {
      if (requestedRef.current !== request) return;
      setCompletion(items.length > 0 ? { match, items, index: 0 } : null);
    };
    let result: ChatCompletion[] | Promise<ChatCompletion[]>;
    try {
      result = source({ trigger: match.trigger, query: match.query });
    } catch {
      result = [];
    }
    if (Array.isArray(result)) settle(result);
    else result.then(settle, () => settle([]));
  }, []);

  const closeCompletion = useCallback(() => {
    setCompletion((open) => {
      if (open) dismissedRef.current = `${open.match.trigger}:${open.match.from}`;
      return null;
    });
  }, []);

  const acceptCompletion = (item: ChatCompletion | undefined) => {
    const el = inputRef.current;
    if (!el || !item || !completion) return;
    const match = findChatTrigger(el.value, el.selectionStart) ?? completion.match;
    setCompletion(null);
    requestedRef.current = "";
    const edit = item.onSelect
      ? removeChatTrigger(el.value, match, item.insert ?? "")
      : applyChatCompletion(el.value, match, item.insert ?? item.label, item.partial);
    pendingCaretRef.current = { at: edit.caret, again: !!item.partial };
    setInput(edit.text);
    setRecall(null);
    item.onSelect?.();
  };

  // The accepted text is in: put the caret after it, and for a partial entry
  // ask again for the next step.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the text changes; the caret it places was set with it.
  useLayoutEffect(() => {
    const pending = pendingCaretRef.current;
    const el = inputRef.current;
    // Spent either way: an entry whose action opened a prompt has taken the
    // editor away, and the caret it meant must not land on the next keystroke
    // once the editor is back.
    pendingCaretRef.current = null;
    if (!pending || !el) return;
    el.focus();
    el.setSelectionRange(pending.at, pending.at);
    if (pending.again) refreshCompletion();
  }, [input, refreshCompletion]);

  // The editor comes back when a prompt goes: the focus returns to it, unless
  // the user has put it somewhere else in the meantime.
  // With a finger, only after a prompt that was typed into: the keyboard was
  // up for it and stays up. After a list or yes-or-no answered by a tap, it was
  // down, and focusing the editor would raise it uninvited.
  const hadPrompt = useRef<ChatPrompt["type"] | null>(null);
  useEffect(() => {
    const was = hadPrompt.current;
    if (was && !prompt) {
      const active = document.activeElement;
      const idle = !active || active === document.body;
      if (idle && (!coarse || was === "input")) inputRef.current?.focus();
    }
    hadPrompt.current = prompt?.type ?? null;
  }, [prompt, coarse]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // While the list is open it has the arrows, Enter, Tab and Escape.
    if (completion && completion.items.length > 0) {
      const count = completion.items.length;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setCompletion({ ...completion, index: (completion.index + step + count) % count });
        return;
      }
      if (
        ((e.key === "Enter" && !e.shiftKey) || (e.key === "Tab" && !e.shiftKey)) &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault();
        acceptCompletion(completion.items[completion.index]);
        return;
      }
      if (e.key === "Escape") {
        // Stopped here, so the chat does not also interrupt the run.
        e.preventDefault();
        e.stopPropagation();
        closeCompletion();
        return;
      }
    }
    // Enter submits (Shift+Enter breaks the line), or with a finger breaks
    // the line (the send key submits); Ctrl+Enter or Cmd+Enter submits either
    // way. IME composing is respected.
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      const send = e.ctrlKey || e.metaKey || (sendOnEnter && !e.shiftKey);
      if (send) {
        e.preventDefault();
        submit();
        return;
      }
    }
    // Up and Down walk the earlier messages, as a shell's history does, while
    // the field is empty or still holds the recalled text untouched. A draft
    // keeps the arrows for itself.
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey && !e.altKey) {
      const browsing = recall != null && input === history[recall];
      if (!(input === "" || browsing) || history.length === 0) return;
      const at = browsing ? (recall as number) : history.length;
      const next = e.key === "ArrowUp" ? at - 1 : at + 1;
      if (next < 0 || (!browsing && e.key === "ArrowDown")) return;
      e.preventDefault();
      if (next >= history.length) {
        setRecall(null);
        setInput("");
      } else {
        setRecall(next);
        setInput(history[next] as string);
      }
    }
  };

  const isWorking = working !== false && working !== "";
  const handleRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    // Ctrl+O: every tool block open, or every one shut.
    if (e.key.toLowerCase() === "o" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      setExpand((prev) => ({ expanded: !prev.expanded, version: prev.version + 1 }));
      return;
    }
    // Escape interrupts the run. It is stopped here, so a host's own Escape
    // (a drawer leaving full screen) does not fire on the same press.
    if (e.key === "Escape" && isWorking && onInterrupt) {
      e.preventDefault();
      e.stopPropagation();
      onInterrupt();
    }
  };

  const wrapperStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : (height ?? "calc(var(--sf-unit) * 20)"),
    ...(borderColor ? { "--sf-chat-rule": borderColor } : null),
    ...(fonts?.text ? { "--sf-chat-font": fonts.text } : null),
    ...(fonts?.user ? { "--sf-chat-font-user": fonts.user } : null),
    ...(fonts?.code ? { "--sf-chat-font-code": fonts.code } : null),
    ...style,
  };

  // A text/markdown block. Animates (terminal reveal) while it's the active
  // streaming target; otherwise renders as static markdown. The reveal is kept
  // mounted through the `isStreaming` flip until it drains — see `revealing`.
  const renderText = (text: string, msg: ChatMessage, animate: boolean) =>
    // `reveal={false}` opts out of the terminal reveal: streaming text renders
    // as plain Markdown, landing as tokens arrive. Otherwise the reveal props
    // (mode / charIntervalMs / tailLength) are forwarded.
    animate && !revealOff ? (
      <StreamingTerminalText
        content={text}
        isComplete={!msg.isStreaming}
        onRevealComplete={() => finishReveal(msg.id)}
        mode={reveal?.mode}
        charIntervalMs={reveal?.charIntervalMs}
        tailLength={reveal?.tailLength}
        variant="terminal"
      />
    ) : (
      <Markdown value={text} variant="terminal" />
    );

  const renderAssistant = (msg: ChatMessage): ReactNode => {
    const animating = !!msg.isStreaming || revealing.has(msg.id);

    // No parts → the legacy single markdown string.
    if (!msg.parts) return renderText(msg.content ?? "", msg, animating);

    // Only the trailing text block animates while streaming; earlier blocks and
    // interactive blocks render statically.
    let lastTextIdx = -1;
    msg.parts.forEach((p, i) => {
      if (p.type === "text") lastTextIdx = i;
    });

    return msg.parts.map((part, i) => {
      const key = part.partId ?? `${msg.id}-${i}`;
      switch (part.type) {
        case "text":
          return (
            <div key={key} className={styles.part}>
              {renderText((part as ChatTextPart).text, msg, animating && i === lastTextIdx)}
            </div>
          );
        case "choices": {
          const p = part as ChatChoicesPart;
          return (
            <div key={key} className={styles.part}>
              <ChatChoices
                prompt={p.prompt}
                options={p.options}
                multiple={p.multiple}
                onSelect={(value) =>
                  onAction?.({ messageId: msg.id, partId: p.partId, type: "choices", value })
                }
              />
            </div>
          );
        }
        case "tree": {
          const p = part as ChatTreePart;
          return (
            <div key={key} className={styles.part}>
              <ChatTree
                roots={p.roots}
                onSelect={(id) =>
                  onAction?.({ messageId: msg.id, partId: p.partId, type: "tree", value: id })
                }
              />
            </div>
          );
        }
        case "thinking": {
          const p = part as ChatThinkingPart;
          return (
            <div key={key} className={styles.part}>
              <ChatThinking
                status={p.status}
                label={p.label}
                steps={p.steps}
                summary={p.summary}
                defaultExpanded={p.defaultExpanded}
                onSelect={(id) =>
                  onAction?.({ messageId: msg.id, partId: p.partId, type: "thinking", value: id })
                }
              />
            </div>
          );
        }
        case "error": {
          const p = part as ChatErrorPart;
          return (
            <div key={key} className={styles.part}>
              <ChatError
                message={p.message}
                requestId={p.requestId}
                retryable={p.retryable}
                onRetry={() =>
                  onAction?.({ messageId: msg.id, partId: p.partId, type: "error", value: "retry" })
                }
              />
            </div>
          );
        }
        case "tool": {
          const p = part as ChatToolPart;
          return (
            <div key={key} className={styles.part}>
              <ChatTool
                name={p.name}
                args={p.args}
                status={p.status}
                output={p.output}
                truncate={p.truncate}
                lines={p.lines}
                note={p.note}
                error={p.error}
                defaultExpanded={p.defaultExpanded}
              />
            </div>
          );
        }
        case "table": {
          const p = part as ChatTablePart;
          return (
            <div key={key} className={styles.part}>
              <ChatTable columns={p.columns} rows={p.rows} caption={p.caption} />
            </div>
          );
        }
        default: {
          const node = renderPart?.(part, { message: msg });
          return node ? (
            <div key={key} className={styles.part}>
              {node}
            </div>
          ) : null;
        }
      }
    });
  };

  // The transcript is its own scrollable region: focusable, so a keyboard user
  // can page back through it (the composer holds focus the rest of the time),
  // and a log, so a reply is announced. The same semantics either way: with a
  // minimap the element is the rail's, so they are handed to it.
  const scrollProps = {
    "data-testid": "chat-messages",
    onScroll: handleScroll,
    role: "log",
    "aria-label": "Conversation",
  } as const;

  const transcript = (
    <>
      <div ref={setContent} className={styles.content}>
        {header != null && header !== false ? <div className={styles.header}>{header}</div> : null}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <article
              key={msg.id}
              className={cx(styles.message, isUser && styles.userMessage)}
              data-role={msg.role}
              aria-label={isUser ? "You" : "Assistant"}
              aria-busy={!isUser && (!!msg.isStreaming || revealing.has(msg.id)) ? true : undefined}
            >
              {isUser ? (
                <>
                  {/* The log's sign, the editor's own: the line's mark, not
                      its text, so it is hidden from assistive technology and
                      left out of a copy. */}
                  {variant === "log" ? (
                    <span className={styles.userSign} aria-hidden="true">
                      &gt;
                    </span>
                  ) : null}
                  <span data-user-text="">{msg.content}</span>
                </>
              ) : (
                renderAssistant(msg)
              )}
            </article>
          );
        })}
      </div>
      {/* Inside the scroller, so a wheel over the key scrolls the transcript
            rather than stopping at it. A zero-height sticky row holds the key at
            the bottom of the scrollport without taking any of the content's
            space. */}
      <div className={styles.foot}>
        {!following && (
          <button
            type="button"
            className={cx(styles.jump, hitArea.both)}
            data-behind={behind || undefined}
            onClick={jumpToLatest}
            aria-label="Jump to the latest message"
            title="Jump to the latest message"
          >
            <span aria-hidden="true">↓ latest</span>
          </button>
        )}
      </div>
    </>
  );

  const workingText = typeof working === "string" ? working : "Working";
  const hasFooter = !!footer && footer.length > 0;
  const hasBelow = belowEditor != null && belowEditor !== false;
  const listOpen = !prompt && !!completion && completion.items.length > 0;
  const listIndex = completion?.index ?? 0;
  const listStart = completion
    ? windowStart(completion.items.length, listIndex, COMPLETION_ROWS)
    : 0;

  const plainScroller = (
    <div
      ref={setScroller}
      className={styles.messages}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region has to be reachable by keyboard (WCAG 2.1.1); the rule does not know about overflow containers.
      tabIndex={0}
      // Standing in for the rail while its chunk lands: the native scrollbar
      // stays hidden, so the swap is not a flash of a bar that is about to go.
      data-rail-pending={railOn || undefined}
      {...scrollProps}
    >
      {transcript}
    </div>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys are the transcript's own (Ctrl+O, Escape) and are caught as they bubble from the focusable parts inside.
    <div
      ref={ref}
      {...rest}
      className={cx(styles.root, className)}
      style={wrapperStyle}
      onKeyDown={handleRootKey}
      data-variant={variant}
      data-frame={String(frame ?? variant !== "log")}
      data-keyboard={(keyboardUp && dockFocus) || undefined}
    >
      <ChatVariantContext.Provider value={variant}>
        <ChatExpandContext.Provider value={expand}>
          {railOn ? (
            /* The rail replaces the scrollbar: Minimap owns the scroll element (so
           `scrollerRef`, and with it the whole follow-the-bottom machinery,
           points at it) and hides the native bar. */
            <Suspense fallback={plainScroller}>
              <MinimapRail
                ref={setScroller}
                className={styles.rail}
                markers={markers}
                side={rail.side}
                // Unset, the width comes from `--sf-chat-minimap-width` (the class
                // below), so a theme can retune every rail; the prop lands inline
                // and wins for this one.
                width={rail.width}
                // A conversation starts short, and its markers tile it: three turns
                // blown up to the rail's full height say nothing about how much
                // there is. The bands keep a minimum size and accumulate from the
                // top instead, so the rail fills as the conversation does (and
                // scrolls once it is longer than the rail can hold).
                minMarkerSize={CHAT_MIN_BLOCK}
                stretch={false}
                scrollProps={scrollProps}
                ariaLabel="Conversation position"
              >
                {transcript}
              </MinimapRail>
            </Suspense>
          ) : (
            plainScroller
          )}
        </ChatExpandContext.Provider>
      </ChatVariantContext.Provider>
      {/* The dock: everything under the transcript stays put, as a terminal
          agent keeps its editor and footer on the last lines. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the focus handlers only track whether the focus is in the dock; the controls inside take the input. */}
      <div
        className={styles.dock}
        onFocus={() => setDockFocus(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDockFocus(false);
        }}
      >
        {aboveEditor != null && aboveEditor !== false ? (
          <div className={styles.slot} data-slot="above">
            {aboveEditor}
          </div>
        ) : null}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the press on the block is a larger target for a finger; a keyboard reaches the field with Tab. */}
        <form
          className={styles.editor}
          data-open-end={hasFooter || hasBelow || listOpen ? undefined : ""}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          // A press anywhere on the editor block (its rules, the space beside
          // the sign) puts the caret in the field: the field is one line, a
          // small target for a finger.
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (prompt || target.closest("button, textarea, input, a, [role='option']")) return;
            if (window.getSelection()?.toString()) return;
            inputRef.current?.focus();
          }}
        >
          {/* The editor's top rule: one line of the grid with the stroke
              through its middle. The working indicator is set into it, so a
              run starting or ending moves nothing. */}
          <div className={styles.rule} data-working={isWorking || undefined}>
            {isWorking ? (
              <span className={styles.working} role="status">
                <Spinner variant="braille" label="" aria-hidden="true" />
                <span className={styles.workingText}>
                  {workingText}
                  {onInterrupt ? (
                    <span className={styles.workingHint}> (esc to interrupt)</span>
                  ) : null}
                </span>
              </span>
            ) : null}
            {isWorking && onInterrupt ? (
              // A soft keyboard has no Escape: a finger stops the run here.
              <button
                type="button"
                className={cx(styles.stopKey, hitArea.block)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onInterrupt}
              >
                [<span className={styles.stopLabel}>stop</span>]
              </button>
            ) : null}
          </div>
          {prompt ? (
            <Suspense fallback={null}>
              <PromptPanel key={`${prompt.type}:${prompt.id ?? ""}`} prompt={prompt} />
            </Suspense>
          ) : (
            <div className={styles.inputRow} data-send={String(sendKey)}>
              <TextEdit
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  refreshCompletion();
                }}
                onSelect={refreshCompletion}
                onBlur={() => {
                  // The list belongs to the caret; it opens again when the caret
                  // comes back to a trigger.
                  setCompletion(null);
                  requestedRef.current = "";
                }}
                onKeyDown={handleKey}
                placeholder={placeholder}
                rows={1}
                className={styles.input}
                // The soft keyboard's Return key says what it does.
                enterKeyHint={sendOnEnter ? "send" : "enter"}
                aria-autocomplete={completions ? "list" : undefined}
                aria-controls={listOpen ? listId : undefined}
                aria-activedescendant={listOpen ? `${listId}-${listIndex}` : undefined}
              />
              {/* The prompt sign: marks the line as editable. After the field in the
              DOM so the field's focus can colour it. */}
              <span className={styles.prompt} aria-hidden="true">
                &gt;
              </span>
              {sendKey !== false ? (
                <Button
                  type="submit"
                  variant={sendVariant}
                  size="sm"
                  aria-label={sendLabel}
                  title={sendLabel}
                  disabled={disabled || !input.trim()}
                  className={styles.send}
                  // The press must not take the focus from the field: the
                  // on-screen keyboard stays up for the next turn.
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <ArrowUp size={0.8} />
                </Button>
              ) : null}
            </div>
          )}
          {hasFooter || hasBelow || listOpen ? <div className={styles.rule} /> : null}
          {listOpen && completion ? (
            /* Under the editor, as a terminal prints it: one entry per line,
               `→` and the accent on the one Enter or Tab takes. The focus
               stays in the field; the list is read through
               aria-activedescendant. */
            <div className={styles.completions}>
              <div
                role="listbox"
                id={listId}
                aria-label="Suggestions"
                className={styles.completionList}
              >
                {completion.items.slice(listStart, listStart + COMPLETION_ROWS).map((item, i) => {
                  const n = listStart + i;
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are the field's (arrows, Enter, Tab), which keeps the focus; the press is for a pointer.
                    <div
                      key={n}
                      id={`${listId}-${n}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={n === listIndex}
                      data-current={n === listIndex || undefined}
                      className={styles.completion}
                      // Keep the caret in the field while the pointer chooses.
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerMove={(e) => {
                        if (e.pointerType === "mouse" && n !== listIndex) {
                          setCompletion({ ...completion, index: n });
                        }
                      }}
                      onClick={() => acceptCompletion(item)}
                    >
                      <span className={styles.completionMarker} aria-hidden="true">
                        →
                      </span>
                      <span className={styles.completionLabel}>{item.label}</span>
                      {item.description ? (
                        <span className={styles.completionDescription}># {item.description}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {completion.items.length > COMPLETION_ROWS ? (
                <div className={styles.completionCount}>
                  ({listIndex + 1}/{completion.items.length})
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
        {hasBelow ? (
          <div className={styles.slot} data-slot="below">
            {belowEditor}
          </div>
        ) : null}
        {hasFooter ? (
          <div className={styles.footer}>
            {(footer ?? []).map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: footer lines are positional.
              <div key={i} className={styles.status}>
                <span className={styles.statusLeft}>{line.left}</span>
                {line.right != null ? (
                  <span className={styles.statusRight}>{line.right}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});
