import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { bowlClass } from "../../lib/surface";
import { Button, type ButtonVariant } from "../Button";
import { ArrowUp, ChevronDown } from "../Icon";
import { Markdown } from "../Markdown";
import { useMinimapMarkers } from "../Minimap/useMinimapMarkers";
import { StreamingTerminalText } from "../StreamingTerminalText";
import { TextEdit } from "../TextEdit";
import styles from "./Chat.module.css";
import { type ChatChoice, ChatChoices } from "./ChatChoices";
import { ChatError } from "./ChatError";
import { ChatThinking } from "./ChatThinking";
import { type ChatStepStatus, ChatTree, type ChatTreeNode } from "./ChatTree";

export type { ChatChoice, ChatStepStatus, ChatTreeNode };

/** Sub-pixel slack when asking "is the viewport at the bottom": `scrollHeight`
 *  and `clientHeight` are integers over fractional layout, so the true bottom
 *  can read a pixel or two short. This is not a reading-distance threshold —
 *  following stops on the first scroll away from the bottom, however small. */
const BOTTOM_SLACK = 4;

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export type ChatRole = "user" | "assistant";

/** How a message's surface reads:
 *  - `plain`: no surface, the text sits on the page.
 *  - `box`: a raised box, the material layer's key at message scale.
 *  - `tape`: a strip of label-maker tape, a run of the primary colour with
 *    the letters embossed in the page colour.
 *  - `squircle`: the raised box with a superellipse round-over. */
export type ChatMessageStyle = "plain" | "box" | "tape" | "squircle";

/** One style for both voices, or one per role. */
export type ChatMessageStyles =
  | ChatMessageStyle
  | { user?: ChatMessageStyle; assistant?: ChatMessageStyle };

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

/** Tuning for the transcript's `Minimap` rail (see `ChatProps.minimap`). */
/** The rail is opt-in, so it is loaded on demand: a chat that never sets
 *  `minimap` carries none of Minimap's geometry or styles (the pattern
 *  DataTable's header menu uses). Until the chunk lands, the transcript renders
 *  as the plain scroller it is without it. */
const MinimapRail = lazy(async () => ({ default: (await import("../Minimap")).Minimap }));

/** The chat rail's width in units: wider than the `--sf-minimap-width` token,
 *  because these labels are the questions asked, not field names. */
const CHAT_RAIL_WIDTH = 5;

export interface ChatMinimap {
  /** Which edge the rail occupies. Default `"right"`. */
  side?: "left" | "right";
  /** Rail width in `--sf-unit` multiples. Default 5. */
  width?: number;
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
   *  by default) and `width` in `--sf-unit` multiples. The rail is wider here
   *  than the `--sf-minimap-width` token (5u against 3u), because a chat's
   *  labels are the questions asked, which are sentences, where a form's are
   *  field names. Default `false`. */
  minimap?: boolean | ChatMinimap;
  /** Placeholder text shown in the empty input. Default "Ask anything…". */
  placeholder?: string;
  /** Caption for the submit button. Default "Send". */
  sendLabel?: string;
  /** Visual variant of the submit button. Default "secondary" (non-primary). */
  sendVariant?: ButtonVariant;
  /** Override the input field's border colour (any CSS colour). Defaults to the
   *  neutral `--sf-color-border` token; pass e.g. `var(--sf-color-primary)` to
   *  restore the accented look. */
  borderColor?: string;
  /** How each voice shows up: `plain` (no surface), `box` (a raised box),
   *  `tape` (the label-maker run) or `squircle` (the raised box with a
   *  round-over). One value styles both roles; an object styles them apart.
   *  Default `{ user: "tape", assistant: "plain" }`. The role keeps its place
   *  whichever surface carries it: the user's turn is right-aligned and capped
   *  at 75% of the column, the assistant's runs across it. The stamped
   *  monospace letters belong to the tape, not to the user. */
  messageStyle?: ChatMessageStyles;
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

/** The tape is the user's turn by default; the assistant's prose sits on the
 *  page, as it has since the component shipped. */
const DEFAULT_STYLE: Record<ChatRole, ChatMessageStyle> = { user: "tape", assistant: "plain" };

/** The class each style paints. `plain` carries no surface at all. */
const STYLE_CLASS: Record<ChatMessageStyle, string | undefined> = {
  plain: undefined,
  box: styles.raised,
  tape: styles.tape,
  // The squircle's face is scooped: the bowl ramp over the fill colour.
  squircle: cx(styles.squircle, bowlClass),
};

/** The squircle's backing element. Browsers with `corner-shape` cut the
 *  corners themselves and this stays `display: none`; the others get the same
 *  curve from the masks it carries (see Chat.module.css). */
const squircleBack = (style: ChatMessageStyle) =>
  style === "squircle" ? (
    <span className={styles.squircleBack} aria-hidden="true">
      <span className={cx(styles.squircleFace, bowlClass)} />
    </span>
  ) : null;

function resolveStyle(prop: ChatMessageStyles | undefined, role: ChatRole): ChatMessageStyle {
  if (typeof prop === "string") return prop;
  return prop?.[role] ?? DEFAULT_STYLE[role];
}

export const Chat = forwardRef<HTMLDivElement, ChatProps>(function Chat(
  {
    messages,
    onSubmit,
    renderPart,
    onAction,
    onError,
    placeholder = "Ask anything…",
    sendLabel = "Send",
    sendVariant = "secondary",
    borderColor,
    messageStyle,
    height,
    disabled,
    reveal,
    minimap = false,
    className,
    style,
    ...rest
  },
  ref,
) {
  const [input, setInput] = useState("");
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
            label: (el: Element) => (el.textContent ?? "").trim().slice(0, 120),
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
    inputRef.current?.focus();
  };

  // Restore focus to the input whenever the chat becomes interactable again
  // (initial mount, or after a streaming response ends and `disabled` flips
  // back to false). The input itself is NEVER disabled — only submission is
  // gated — so we never lose focus while typing a follow-up question.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const submit = () => {
    if (disabled) return;
    const text = input.trim();
    if (!text) return;
    // The user just sent a message: follow the reply from the bottom again.
    setFollow(true);
    onSubmit(text);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits, Shift+Enter inserts a newline. IME composing is respected.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const wrapperStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : (height ?? "calc(var(--sf-unit) * 20)"),
    ...(borderColor ? { "--sf-chat-input-border": borderColor } : null),
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
      />
    ) : (
      <Markdown value={text} />
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
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const style = resolveStyle(messageStyle, msg.role);
          // The surface goes on the user's run, so the tape follows its
          // lines and a box hugs the text, and on the assistant's whole
          // block, which carries prose and rich parts.
          const surface = STYLE_CLASS[style];
          return (
            <article
              key={msg.id}
              className={cx(styles.message, isUser ? styles.userMessage : surface)}
              data-role={msg.role}
              data-style={style}
              aria-label={isUser ? "You" : "Assistant"}
              aria-busy={!isUser && (!!msg.isStreaming || revealing.has(msg.id)) ? true : undefined}
            >
              {isUser ? (
                <span className={cx(styles.userContent, surface)}>
                  {squircleBack(style)}
                  {msg.content}
                </span>
              ) : (
                <>
                  {squircleBack(style)}
                  {renderAssistant(msg)}
                </>
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
          <Button
            variant={behind ? "primary" : "secondary"}
            build="solid"
            round
            size="sm"
            className={styles.jump}
            data-behind={behind || undefined}
            onClick={jumpToLatest}
            aria-label="Jump to the latest message"
            title="Jump to the latest message"
          >
            <Glyph slot="chevronDown" fallback={ChevronDown} />
          </Button>
        )}
      </div>
    </>
  );

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
    <div ref={ref} {...rest} className={cx(styles.root, className)} style={wrapperStyle}>
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
            width={rail.width ?? CHAT_RAIL_WIDTH}
            scrollProps={scrollProps}
            ariaLabel="Conversation position"
          >
            {transcript}
          </MinimapRail>
        </Suspense>
      ) : (
        plainScroller
      )}
      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextEdit
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          className={styles.input}
        />
        <Button
          type="submit"
          variant={sendVariant}
          build="solid"
          round
          size="sm"
          aria-label={sendLabel}
          title={sendLabel}
          disabled={disabled || !input.trim()}
          className={styles.send}
        >
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
});
