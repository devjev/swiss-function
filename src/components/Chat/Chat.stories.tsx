import type { Story } from "@ladle/react";
import { useEffect, useState } from "react";
import {
  Chat,
  type ChatAction,
  type ChatMessage,
  type ChatThinkingPart,
  type ChatTreeNode,
} from "./Chat";
import { ChatBlock } from "./ChatBlock";

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

/**
 * The chat is **non-primary by default** — neutral input border, secondary send
 * button. Re-accent it (and rename the button) when you want it to: `borderColor`,
 * `sendVariant`, `sendLabel`, and `placeholder`.
 */
export const Customized: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", content: text }])
        }
        placeholder="Message the agent…"
        sendLabel="Run"
        sendVariant="primary"
        borderColor="var(--sf-color-primary)"
      />
    </div>
  );
};

/**
 * Rich responses: an assistant message can carry ordered `parts` instead of a
 * single markdown string. Here a text block is followed by an in-chat **choice
 * menu**; picking an option fires `onAction`, which the app turns into the next
 * turn.
 */
export const Choices: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "u1", role: "user", content: "Help me start a new project." },
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Sure — which **template** do you want?" },
        {
          type: "choices",
          partId: "template",
          prompt: "Pick one:",
          options: [
            { id: "React app", label: "React app", description: "Vite + TypeScript" },
            { id: "Node service", label: "Node service", description: "Express + REST" },
            { id: "Library", label: "Library", description: "Bundled, typed, published" },
          ],
        },
      ],
    },
  ]);

  const handleAction = (a: ChatAction) => {
    const choice = String(a.value);
    const base = String(Date.now());
    setMessages((prev) => [
      ...prev,
      { id: `${base}-u`, role: "user", content: choice },
      {
        id: `${base}-a`,
        role: "assistant",
        content: `Scaffolding a **${choice}** for you now.`,
      },
    ]);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <Chat messages={messages} onSubmit={() => {}} onAction={handleAction} />
    </div>
  );
};

const ORCHESTRATION_TREE: ChatTreeNode[] = [
  {
    id: "request",
    label: "request",
    children: [
      {
        id: "plan",
        label: "plan",
        children: [
          { id: "search", label: "search", children: [{ id: "read", label: "read sources" }] },
          { id: "code", label: "code", children: [{ id: "edit", label: "edit files" }] },
        ],
      },
      { id: "verify", label: "verify", children: [{ id: "tests", label: "run tests" }] },
      { id: "answer", label: "answer" },
    ],
  },
];

/**
 * A **decision / orchestration tree** part renders as a terminal directory tree.
 * Clicking a node fires `onAction` with the node id.
 */
export const DecisionTree: Story = () => {
  const [picked, setPicked] = useState<string | null>(null);
  const [messages] = useState<ChatMessage[]>([
    { id: "u1", role: "user", content: "Show me how you'll handle this." },
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Here's the plan — click a node to inspect a step:" },
        { type: "tree", partId: "plan", roots: ORCHESTRATION_TREE },
      ],
    },
  ]);

  return (
    <div style={{ maxWidth: 720 }}>
      <Chat
        height={560}
        messages={messages}
        onSubmit={() => {}}
        onAction={(a) => setPicked(String(a.value))}
      />
      {picked ? <p>Inspecting step: {picked}</p> : null}
    </div>
  );
};

/**
 * Any other block type is rendered by `renderPart` — an escape hatch for custom
 * micro-UIs. Here a `status` part renders a small service-health card.
 */
export const CustomBlock: Story = () => {
  const [messages] = useState<ChatMessage[]>([
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Deployment finished. Current status:" },
        { type: "status", partId: "st", service: "api", state: "healthy", latencyMs: 42 },
      ],
    },
  ]);

  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={messages}
        onSubmit={() => {}}
        renderPart={(part) =>
          part.type === "status" ? (
            <ChatBlock title="status">
              <div
                style={{
                  display: "flex",
                  gap: "var(--sf-unit)",
                  alignItems: "baseline",
                  fontFamily: "var(--sf-font-mono)",
                }}
              >
                <strong>{String(part.service)}</strong>
                <span>{String(part.state)}</span>
                <span># {String(part.latencyMs)} ms</span>
              </div>
            </ChatBlock>
          ) : null
        }
      />
    </div>
  );
};

// --- Thinking / orchestration fan-out ---

const FAN_LEAVES = ["search the web", "design schema", "build UI", "wire data", "write tests"];

/** The thinking part at "phase" k: k leaves done, the (k+1)th running. */
function thinkingPhase(k: number, running: boolean): ChatThinkingPart {
  const children: ChatTreeNode[] = FAN_LEAVES.map((label, i) => ({
    id: `s${i}`,
    label,
    status: i < k ? "done" : i === k && running ? "running" : "pending",
  }));
  const planDone = k >= FAN_LEAVES.length;
  return {
    type: "thinking",
    status: running ? "running" : "done",
    steps: [{ id: "plan", label: "plan", status: planDone ? "done" : "running", children }],
    summary: `Ran ${FAN_LEAVES.length} steps · 4.2s`,
  };
}

// Scripted frames: a bare "Thinking…" → fan-out filling in → done (collapses) →
// final answer appended.
const FRAMES: ChatThinkingPart[] = [
  { type: "thinking", status: "running", label: "Thinking…" },
  ...FAN_LEAVES.map((_, i) => thinkingPhase(i, true)),
  thinkingPhase(FAN_LEAVES.length, false),
];

export const Thinking: Story = () => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frame >= FRAMES.length - 1) return;
    const id = window.setTimeout(() => setFrame((f) => f + 1), 800);
    return () => window.clearTimeout(id);
  }, [frame]);

  const done = frame >= FRAMES.length - 1;
  const messages: ChatMessage[] = [
    { id: "u1", role: "user", content: "Build me an analytics dashboard." },
    {
      id: "a1",
      role: "assistant",
      parts: [
        FRAMES[frame] as ChatThinkingPart,
        ...(done ? [{ type: "text" as const, text: "Done — here's your dashboard plan. ✦" }] : []),
      ],
    },
  ];
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <Chat
        messages={messages}
        onSubmit={() => {}}
        onAction={(a: ChatAction) => console.log("action", a)}
        disabled={!done}
        height={420}
      />
    </div>
  );
};

export const ThinkingError: Story = () => {
  const messages: ChatMessage[] = [
    { id: "u1", role: "user", content: "Deploy to production." },
    {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "thinking",
          status: "error",
          label: "Failed after 2 steps",
          defaultExpanded: true,
          steps: [
            {
              id: "deploy",
              label: "deploy",
              status: "error",
              children: [
                { id: "build", label: "build image", status: "done" },
                { id: "push", label: "push registry", status: "error" },
              ],
            },
          ],
        },
      ],
    },
  ];
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <Chat messages={messages} onSubmit={() => {}} height={320} />
    </div>
  );
};
