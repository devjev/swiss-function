import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Markdown } from "../Markdown";
import { StreamingTerminalText } from "../StreamingTerminalText";
import { TextEdit } from "../TextEdit";
import styles from "./Chat.module.css";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Markdown source for assistant messages, plain text for user messages. */
  content: string;
  /** True while an assistant message is still streaming in. */
  isStreaming?: boolean;
}

export interface ChatProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  messages: ChatMessage[];
  /** Fired with the trimmed text when the user submits. Input clears automatically. */
  onSubmit: (text: string) => void;
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
            ) : msg.isStreaming || revealing.has(msg.id) ? (
              <StreamingTerminalText
                content={msg.content}
                isComplete={!msg.isStreaming}
                onRevealComplete={() => finishReveal(msg.id)}
              />
            ) : (
              <Markdown value={msg.content} />
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
