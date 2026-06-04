import type { Story } from "@ladle/react";
import { useState } from "react";
import { Chat, type ChatMessage } from "./Chat";

const SAMPLE_REPLY = `Sure — here's a tiny example of how to throttle a function in JavaScript:

\`\`\`js
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}
\`\`\`

This is a **leading-edge** throttle — the first call goes through immediately, and subsequent calls within \`ms\` are dropped. Perfect for scroll handlers and resize listeners.`;

export const Default: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "user",
      content: "Hi! Can you show me how to throttle a JavaScript function?",
    },
    {
      id: "2",
      role: "assistant",
      content: SAMPLE_REPLY,
    },
    {
      id: "3",
      role: "user",
      content: "Thanks! And what's the difference between throttle and debounce?",
    },
  ]);

  const [streaming, setStreaming] = useState(false);

  const handleSubmit = (text: string) => {
    if (streaming) return;
    // Push the user message immediately.
    const userId = String(Date.now());
    const assistantId = `${userId}-a`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);
    setStreaming(true);

    // Simulate a streamed assistant reply.
    const reply = `Good question. **Throttle** caps how often a function can run — at most once per \`ms\`. **Debounce** waits until a quiet period of \`ms\` after the last call before running once. Throttle is "rate limit"; debounce is "wait until they stop typing".`;
    let i = 0;
    const id = window.setInterval(() => {
      const burst = 4 + Math.floor(Math.random() * 7);
      i = Math.min(i + burst, reply.length);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: reply.slice(0, i) } : m)),
      );
      if (i >= reply.length) {
        window.clearInterval(id);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        );
        setStreaming(false);
      }
    }, 90);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <Chat messages={messages} onSubmit={handleSubmit} disabled={streaming} />
    </div>
  );
};

export const Empty: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", content: text }])
        }
        placeholder="Start a conversation…"
      />
    </div>
  );
};
