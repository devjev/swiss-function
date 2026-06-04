import type { Story } from "@ladle/react";
import { useEffect, useState } from "react";
import { Button } from "../Button";
import { StreamingTerminalText } from "./StreamingTerminalText";

const SAMPLE = `# Hello World

This is a **bold** statement with some \`inline code\` and a small list:

- First item
- Second item
- Third item

\`\`\`js
const greet = (name) => \`Hello, \${name}!\`;
console.log(greet("world"));
\`\`\`

After the code block, more text wraps across multiple lines so we can confirm
the line-wrapping holds through both the shade-block stream view and the
materialized Markdown render.`;

export const Static: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <StreamingTerminalText content={SAMPLE} isComplete />
  </div>
);

/**
 * Simulates chunked arrival via setInterval — adds 4-12 chars per tick so
 * arrival is bursty, like a real LLM stream.
 */
export const Simulated: Story = () => {
  const [content, setContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [running, setRunning] = useState(false);

  const start = () => {
    setContent("");
    setIsComplete(false);
    setRunning(true);
    let i = 0;
    const id = window.setInterval(() => {
      const burst = 4 + Math.floor(Math.random() * 9); // 4..12
      i = Math.min(i + burst, SAMPLE.length);
      setContent(SAMPLE.slice(0, i));
      if (i >= SAMPLE.length) {
        window.clearInterval(id);
        setIsComplete(true);
        setRunning(false);
      }
    }, 80);
  };

  return (
    <div
      style={{
        maxWidth: 640,
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--sf-unit) / 2)",
      }}
    >
      <div>
        <Button variant="primary" onClick={start} disabled={running}>
          {running ? "Streaming…" : "Start streaming"}
        </Button>
      </div>
      <StreamingTerminalText content={content} isComplete={isComplete} tailLength={6} />
    </div>
  );
};

export const Configured: Story = () => {
  const [content, setContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(i + 3, SAMPLE.length);
      setContent(SAMPLE.slice(0, i));
      if (i >= SAMPLE.length) {
        window.clearInterval(id);
        setIsComplete(true);
      }
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ maxWidth: 640 }}>
      <StreamingTerminalText
        content={content}
        isComplete={isComplete}
        tailLength={6}
        charIntervalMs={100}
        shadeRamp={["░", "▒", "▓"]}
      />
    </div>
  );
};

/**
 * Sketch of the consumer-side wiring for a real `fetch` streaming response.
 * The stream loop is commented out because Ladle can't reach a real backend;
 * adapt to your endpoint.
 *
 * ```ts
 * const res = await fetch("/api/chat", {
 *   method: "POST",
 *   body: JSON.stringify({ messages }),
 * });
 * const reader = res.body!.getReader();
 * const decoder = new TextDecoder();
 * let acc = "";
 * setIsComplete(false);
 * while (true) {
 *   const { value, done } = await reader.read();
 *   if (done) { setIsComplete(true); break; }
 *   acc += decoder.decode(value, { stream: true });
 *   setContent(acc);
 * }
 * ```
 */
export const FromFetch: Story = () => (
  <div style={{ maxWidth: 640, color: "var(--sf-color-fg)" }}>
    <p>
      See the comment block at the top of this story for the consumer-side wiring pattern with a
      real <code>fetch().body.getReader()</code> stream.
    </p>
    <p>
      For an interactive demo of the component itself, see the <strong>Simulated</strong> story.
    </p>
  </div>
);
