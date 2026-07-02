import type { Story } from "@ladle/react";
import { useRef, useState } from "react";
import type { ChatMessage } from "./Chat";
import { Chat } from "./Chat";

export default { title: "Perf/Chat" };

// 200-message markdown transcript for the perf probes (scripts/perf/scenarios/
// chat.mjs): keystroke→paint with a long list mounted, send latency, and frame
// times while a scripted stream appends chunks (started via the
// [data-perf-stream] button). Doubles as a manual stress story.

const BODY = `A paragraph with **bold**, *italic*, \`inline code\`, and a [link](https://example.com).

- one list item
- another with \`code\`

\`\`\`ts
const answer: number = 42;
\`\`\``;

function seedMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${i}`,
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: i % 2 === 0 ? `Question ${i}: what about item ${i}?` : `Answer ${i}.\n\n${BODY}`,
  }));
}

const CHUNK = "Streaming tokens arrive **incrementally**, exercising markdown re-parse. ";

/** 200 markdown messages + scripted streaming — the perf-probe target. */
export const PerfTranscript: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => seedMessages(200));
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const startStream = () => {
    clearInterval(timer.current);
    const id = `stream-${messages.length}`;
    setMessages((prev) => [...prev, { id, role: "assistant", content: "", isStreaming: true }]);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks += 1;
      const done = ticks >= 40;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: CHUNK.repeat(ticks), isStreaming: !done } : m,
        ),
      );
      if (done) clearInterval(timer.current);
    }, 80);
  };

  return (
    <div data-perf-ready="">
      <button type="button" data-perf-stream="" onClick={startStream}>
        stream
      </button>
      <Chat
        messages={messages}
        height={520}
        onSubmit={(text) =>
          setMessages((prev) => [...prev, { id: `u-${prev.length}`, role: "user", content: text }])
        }
      />
    </div>
  );
};
