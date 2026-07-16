import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Button, type ButtonVariant } from "../Button";
import { Markdown } from "../Markdown";
import { StreamingTerminalText } from "../StreamingTerminalText";
import { TextEdit } from "../TextEdit";
import styles from "./Chat.module.css";
import { type ChatChoice, ChatChoices } from "./ChatChoices";
import { ChatError } from "./ChatError";
import { ChatThinking } from "./ChatThinking";
import { type ChatStepStatus, ChatTree, type ChatTreeNode } from "./ChatTree";

export type { ChatChoice, ChatStepStatus, ChatTreeNode };

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
    placeholder = "Ask anything…",
    sendLabel = "Send",
    sendVariant = "secondary",
    borderColor,
    height,
    disabled,
    reveal,
    className,
    style,
    ...rest
  },
  ref,
) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Whether the viewport is pinned to the bottom. Stays true until the user
  // scrolls up to read history — then we stop yanking the view down.
  const stickRef = useRef(true);

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

  // Keep the viewport pinned to the bottom as content grows — not just when
  // `messages` changes, but as the streaming reveal grows the DOM tick by tick
  // (including the post-stream drain). A ResizeObserver on the message list
  // catches every height change; we only follow when the user is at the bottom.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // Track whether the user is at the bottom (within a small threshold). Once
  // they scroll up, auto-follow pauses; scrolling back to the bottom resumes it.
  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
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
    // The user just sent a message — snap back to the bottom to follow the reply.
    stickRef.current = true;
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

  return (
    <div ref={ref} {...rest} className={cx(styles.root, className)} style={wrapperStyle}>
      <div
        ref={scrollerRef}
        className={styles.messages}
        data-testid="chat-messages"
        onScroll={handleScroll}
      >
        <div ref={contentRef} className={styles.content}>
          {messages.map((msg) => (
            <article
              key={msg.id}
              className={cx(styles.message, msg.role === "user" && styles.userMessage)}
              data-role={msg.role}
              aria-label={msg.role === "user" ? "You" : "Assistant"}
            >
              {msg.role === "user" ? (
                <span className={styles.userContent}>{msg.content}</span>
              ) : (
                renderAssistant(msg)
              )}
            </article>
          ))}
        </div>
      </div>
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
          elevation={1}
          disabled={disabled || !input.trim()}
        >
          {sendLabel}
        </Button>
      </form>
    </div>
  );
});
