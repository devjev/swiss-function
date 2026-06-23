import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Graph, type GraphData, type LayoutKind } from "../Graph";
import { Markdown } from "../Markdown";
import { StreamingTerminalText } from "../StreamingTerminalText";
import { TextEdit } from "../TextEdit";
import styles from "./Chat.module.css";
import { type ChatChoice, ChatChoices } from "./ChatChoices";

export type { ChatChoice };

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

/** A decision / orchestration tree, rendered with the `Graph` component
 *  (`tree` layout by default). Node clicks are reported via `onAction`. */
export interface ChatTreePart {
  type: "tree";
  partId?: string;
  data: GraphData;
  layout?: LayoutKind;
  /** Rendered height in px. Default 320. */
  height?: number;
}

/** Escape hatch for any other block — rendered by `Chat`'s `renderPart`. */
export interface ChatCustomPart {
  type: string;
  partId?: string;
  [key: string]: unknown;
}

export type ChatPart = ChatTextPart | ChatChoicesPart | ChatTreePart | ChatCustomPart;

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

export interface ChatProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  messages: ChatMessage[];
  /** Fired with the trimmed text when the user submits. Input clears automatically. */
  onSubmit: (text: string) => void;
  /** Render a custom (non-built-in) part by `type`. Return null/undefined to skip. */
  renderPart?: (part: ChatPart, ctx: { message: ChatMessage }) => ReactNode;
  /** Fired when a user interacts with a choices / tree / custom block. */
  onAction?: (action: ChatAction) => void;
  placeholder?: string;
  /** Container height. Default `calc(var(--sf-unit) * 20)` (= ~480px). */
  height?: number | string;
  /** Whether the input is disabled (e.g., while the assistant is still streaming). */
  disabled?: boolean;
}

export const Chat = forwardRef<HTMLDivElement, ChatProps>(function Chat(
  {
    messages,
    onSubmit,
    renderPart,
    onAction,
    placeholder = "Ask anything…",
    height,
    disabled,
    className,
    style,
    ...rest
  },
  ref,
) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Assistant messages whose reveal animation is still in flight. A message is
  // added while it streams and stays here — keeping its `StreamingTerminalText`
  // mounted — even after `isStreaming` flips off, until the reveal catches up
  // (drains) and reports completion. Only then do we hand off to a static
  // `Markdown` render. Without this the reveal would be abandoned mid-animation
  // and the full formatted reply would snap in at once.
  const [revealing, setRevealing] = useState<Set<string>>(() => new Set());

  useEffect(() => {
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
  }, [messages]);

  const finishReveal = useCallback((id: string) => {
    setRevealing((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Auto-scroll to bottom on every messages change — including streaming
  // text growth — so the latest content stays in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `messages` is the trigger; we don't read it inside.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

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
    ...style,
  };

  // A text/markdown block. Animates (terminal reveal) while it's the active
  // streaming target; otherwise renders as static markdown. The reveal is kept
  // mounted through the `isStreaming` flip until it drains — see `revealing`.
  const renderText = (text: string, msg: ChatMessage, animate: boolean) =>
    animate ? (
      <StreamingTerminalText
        content={text}
        isComplete={!msg.isStreaming}
        onRevealComplete={() => finishReveal(msg.id)}
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
              <Graph
                data={p.data}
                layout={p.layout ?? "tree"}
                fullscreen={false}
                style={{ blockSize: p.height ?? 320 }}
                onNodeClick={(id) =>
                  onAction?.({ messageId: msg.id, partId: p.partId, type: "tree", value: id })
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
      <div ref={scrollerRef} className={styles.messages} data-testid="chat-messages">
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
        <Button type="submit" variant="primary" elevation={1} disabled={disabled || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
});
