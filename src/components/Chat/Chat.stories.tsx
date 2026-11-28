import type { Story } from "@ladle/react";
import { useEffect, useState } from "react";
import { Box } from "../Box";
import { Button } from "../Button";
import { Stat } from "../Stat";
import {
  Chat,
  type ChatAction,
  type ChatMessage,
  type ChatProps,
  type ChatThinkingPart,
  type ChatTreeNode,
} from "./Chat";
import { ChatBlock } from "./ChatBlock";
import { useChatPrompt } from "./useChatPrompt";

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
 * The editor's rules are neutral by default and the send key shows only on
 * touch (a keyboard submits with Enter). `borderColor` colours the rules,
 * `sendKey` shows the key on any device, and `sendVariant`, `sendLabel` and
 * `placeholder` tune it.
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
        sendKey
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

export const ErrorState: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "u1", role: "user", content: "Summarise the quarterly report." },
    {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "error",
          partId: "err",
          message: "Overloaded — couldn't answer. Try again.",
          requestId: "req_011Cd5ReJN3vNgRyshH9DNQb",
          retryable: true,
        },
      ],
    },
  ]);

  const handleAction = (a: ChatAction) => {
    if (a.type === "error" && a.value === "retry") {
      // The app re-sends; here we just replace the error with an answer.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === a.messageId
            ? { id: m.id, role: "assistant", content: "Here's the summary you asked for." }
            : m,
        ),
      );
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={messages}
        onSubmit={() => {}}
        onAction={handleAction}
        onError={(e) => console.log("chat error:", e)}
      />
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

/**
 * `variant="plain"` drops the frame, the title bar and its marker, so a custom
 * part brings its own look. The block contributes a block box and nothing else;
 * here a `Box` carries the surface instead.
 */
export const CustomBlockPlain: Story = () => {
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
            <ChatBlock variant="plain">
              <Box elevation={2} padding={1}>
                <Stat
                  label={String(part.service)}
                  value={String(part.latencyMs)}
                  valueUnit="ms"
                  caption={String(part.state)}
                  tone="success"
                  size="sm"
                />
              </Box>
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
        onAction={() => {}}
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

// --- The terminal structure ---

const SESSION_REPLY = `## Result

The date test passes. Two changes:

- \`formatDate\` formats in local time
- the fixture pins the zone to \`Europe/Zurich\`

| File | Lines | Change |
| --- | ---: | --- |
| src/date.ts | 2 | local format |
| test/date.test.ts | 1 | pinned zone |

\`\`\`ts
export function formatDate(input: string) {
  return formatLocal(new Date(input));
}
\`\`\``;

const TEST_LOG = [
  " RUN  v3.2.4 /src/app",
  "",
  " ✓ test/format.test.ts (12 tests) 31ms",
  " ✓ test/parse.test.ts (9 tests) 18ms",
  " ❯ test/date.test.ts (4 tests | 1 failed) 44ms",
  "   × formats a local date",
  "     expected '2026-07-01', received '2026-06-30'",
  "",
  " Test Files  1 failed | 11 passed (12)",
  "      Tests  1 failed | 41 passed (42)",
  "   Duration  2.31s",
].join("\n");

const SESSION: ChatMessage[] = [
  { id: "u1", role: "user", content: "Fix the off-by-one in the date test" },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "thinking", partId: "th", status: "done", summary: "Thought for 4s" },
      { type: "text", text: "I'll run the tests first." },
      {
        type: "tool",
        partId: "t1",
        name: "$",
        args: "npm test",
        output: TEST_LOG,
        note: "Took 2.9s",
      },
      { type: "tool", partId: "t2", name: "read", args: "src/date.ts:40-80" },
      {
        type: "tool",
        partId: "t3",
        name: "deploy",
        args: 'target="staging" dryRun=true',
        status: "error",
        error: "missing credentials",
      },
      { type: "text", text: SESSION_REPLY },
      {
        type: "table",
        partId: "tb",
        caption: "Test runs",
        columns: [
          { key: "suite", label: "Suite" },
          { key: "tests", label: "Tests" },
          { key: "failed", label: "Failed" },
          { key: "ms", label: "Time", format: (v) => `${v} ms`, align: "end" },
        ],
        rows: [
          { suite: "format", tests: 12, failed: 0, ms: 31 },
          { suite: "parse", tests: 9, failed: 0, ms: 18 },
          { suite: "date", tests: 4, failed: 0, ms: 44 },
          { suite: "all", tests: 1284, failed: 0, ms: 2310 },
        ],
      },
    ],
  },
  { id: "u2", role: "user", content: "Run the linter as well" },
  {
    id: "a2",
    role: "assistant",
    parts: [{ type: "tool", partId: "t4", name: "$", args: "npm run check", status: "running" }],
  },
];

/**
 * The whole window, structured as a terminal agent's: a start banner that
 * scrolls away with the transcript, full-width entries one line apart (the
 * user's turn a band in a tint of the accent, tool calls neutral bands, a
 * failure marked by the danger rule), and under them the dock: the editor
 * between its two rules with the working indicator set into the top one, and
 * the status lines. Ctrl+O expands every tool's output; a press on a marker
 * line expands one. Escape interrupts the run.
 */
export const Session: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(SESSION);
  const [working, setWorking] = useState(true);
  return (
    <div style={{ maxWidth: 760 }}>
      <Chat
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", content: text }])
        }
        height={640}
        working={working}
        onInterrupt={() => setWorking(false)}
        header={
          <>
            <strong>agent</strong> v1.7.0
            <br />
            esc interrupt · ctrl+o expand · up history
          </>
        }
        footer={[
          { left: "~/src/app (main) • date fix" },
          { left: "↑14k ↓206 $0.076 9.7%/272k", right: "model-large • high" },
        ]}
      />
    </div>
  );
};

/**
 * The same session in the log view (`variant="log"`): no blank lines and no
 * bands. The user's line starts with an accent `>`, a reply is indented under
 * it, and a tool call is one line with its status at the end, its output folded
 * to one line (a press on `+N lines` or Ctrl+O opens it). The chat has no frame,
 * so it fills whatever holds it; here the story draws a border around it.
 */
export const Log: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(SESSION);
  const [working, setWorking] = useState(true);
  return (
    <div style={{ maxWidth: 760, border: "1px solid var(--sf-color-border-strong)" }}>
      <Chat
        variant="log"
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", content: text }])
        }
        height={640}
        working={working}
        onInterrupt={() => setWorking(false)}
        footer={[
          { left: "~/src/app (main) • date fix" },
          { left: "↑14k ↓206 $0.076 9.7%/272k", right: "model-large • high" },
        ]}
      />
    </div>
  );
};

/** The faces the story offers, as `font-family` values. */
const FACES = {
  monospace: "var(--sf-font-mono)",
  sans: "var(--sf-font-sans)",
  serif: 'ui-serif, "Iowan Old Style", Georgia, serif',
  system: "system-ui, sans-serif",
} as const;
type Face = keyof typeof FACES;

/**
 * The chat's faces, chosen per role with the story's controls: `text` for the
 * replies and the chrome, `user` for the user's text and the editor, `code`
 * for code and tool calls (`fonts={{ text, user, code }}`, or the
 * `--sf-chat-font*` variables app-wide). The default is monospace throughout;
 * here the replies are set in the sans and the code stays monospace. Every
 * face is sized to the system's x-height, and the tree guides stay monospace.
 */
export const Fonts: Story<{ variant: "log" | "terminal"; text: Face; user: Face; code: Face }> = ({
  variant,
  text,
  user,
  code,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(SESSION);
  return (
    <div style={{ maxWidth: 760, border: "1px solid var(--sf-color-border-strong)" }}>
      <Chat
        variant={variant}
        fonts={{ text: FACES[text], user: FACES[user], code: FACES[code] }}
        messages={messages}
        onSubmit={(t) =>
          setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", content: t }])
        }
        height={640}
        footer={[{ left: "~/src/app (main) • date fix", right: "model-large • high" }]}
      />
    </div>
  );
};
Fonts.args = { variant: "log", text: "sans", user: "sans", code: "monospace" };
Fonts.argTypes = {
  variant: { options: ["log", "terminal"], control: { type: "radio" } },
  text: { options: Object.keys(FACES), control: { type: "select" } },
  user: { options: Object.keys(FACES), control: { type: "select" } },
  code: { options: Object.keys(FACES), control: { type: "select" } },
};

/**
 * A tool call is a part: `{ type: "tool", name, args, status, output, note,
 * error }`. The output is cut to its last lines (`truncate: "head"` keeps the
 * first ones); the marker line says how many are left out and expands the
 * block. A running call shows the spinner, a failed one the danger rule and its
 * message; a finished one takes no colour.
 */
export const Tools: Story = () => {
  const [messages] = useState<ChatMessage[]>([
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "tool", name: "$", args: "sleep 30", status: "running", note: "Elapsed 4.0s" },
        { type: "tool", name: "$", args: "npm test", output: TEST_LOG, note: "Took 2.9s" },
        {
          type: "tool",
          name: "grep",
          args: '"formatDate" src',
          truncate: "head",
          lines: 3,
          output: Array.from(
            { length: 9 },
            (_, i) => `src/file-${i + 1}.ts:${12 + i}: formatDate(`,
          ).join("\n"),
        },
        {
          type: "tool",
          name: "deploy",
          args: 'target="prod"',
          status: "error",
          error: "missing credentials",
        },
      ],
    },
  ]);
  return (
    <div style={{ maxWidth: 640 }}>
      <Chat messages={messages} onSubmit={() => {}} height={560} />
    </div>
  );
};

/**
 * A host's table in the transcript: `{ type: "table", columns, rows, caption }`
 * draws a real table as a terminal draws one. Numbers print in Swiss format and
 * end their column; a table wider than the transcript scrolls inside itself.
 * `ChatTable` is exported for a `renderPart` block of the host's own.
 */
export const Table: Story = () => {
  const [messages] = useState<ChatMessage[]>([
    { id: "u1", role: "user", content: "Where did the Q3 inflows come from?" },
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Two thirds from the **Swiss** share classes." },
        {
          type: "table",
          caption: "Net flows, Q3, CHF",
          columns: [
            { key: "class", label: "Share class" },
            { key: "subs", label: "Subscriptions" },
            { key: "reds", label: "Redemptions" },
            { key: "net", label: "Net" },
            { key: "share", label: "Share", format: (v) => `${v}%`, align: "end" },
          ],
          rows: [
            { class: "CH A acc", subs: 1284500, reds: -312000, net: 972500, share: 41 },
            { class: "CH I dist", subs: 804200, reds: -190400, net: 613800, share: 26 },
            { class: "Nordic mandates", subs: 990000, reds: -210750, net: 779250, share: 33 },
          ],
        },
      ],
    },
  ]);
  return (
    <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 2)" }}>
      <div style={{ maxWidth: 640 }}>
        <Chat messages={messages} onSubmit={() => {}} height={360} />
      </div>
      <div style={{ maxWidth: 320 }}>
        <Chat messages={messages} onSubmit={() => {}} height={360} />
      </div>
    </div>
  );
};

/**
 * The dock's slots: `aboveEditor` and `belowEditor` hold the host's own
 * content beside the editor (here a queue of messages waiting for the run to
 * end), and `footer` the status lines. None of it scrolls with the transcript.
 */
// --- Completion and prompts ---

const COMMANDS = [
  { label: "help", description: "List the commands" },
  { label: "model", description: "Pick the model" },
  { label: "rename", description: "Name this session" },
  { label: "clear", description: "Clear the conversation" },
  { label: "compact", description: "Summarise the context to save room" },
  { label: "export", description: "Write the session to a file" },
  { label: "settings", description: "Open the settings" },
];

/** A file tree for `@`: a directory is a partial entry, so the list asks again
 *  for what is inside it. */
const FILES: Record<string, string[]> = {
  "": ["src/", "test/", "package.json", "README.md"],
  "src/": ["src/date.ts", "src/format.ts", "src/parse.ts", "src/lib/"],
  "src/lib/": ["src/lib/locale.ts", "src/lib/zone.ts"],
  "test/": ["test/date.test.ts", "test/format.test.ts"],
};

const TAGS = ["urgent", "review", "later", "blocked"];

const MODELS = [
  { id: "large", label: "model-large", description: "slow, careful" },
  { id: "medium", label: "model-medium", description: "the default" },
  { id: "small", label: "model-small", description: "fast, cheap" },
];

/**
 * Commands and prompts, as a terminal agent offers them. Type `/` at the start
 * of the input for the commands, `@` for a file (a directory opens the next
 * level; the answer arrives after a short delay, as a file search would) and
 * `#` for a tag. The arrows move the cursor, Enter or Tab take the entry,
 * Escape closes the list.
 *
 * `/model`, `/rename` and `/clear` act instead of writing: they ask through
 * `useChatPrompt`, whose question takes the editor's place (a list, a line of
 * text, yes or no) and resolves with the answer. The draft in the editor is
 * kept and comes back with the editor.
 */
export const Commands: Story = () => {
  const ui = useChatPrompt();
  const [messages, setMessages] = useState<ChatMessage[]>(SESSION.slice(0, 2));
  const [model, setModel] = useState("model-medium");
  const [session, setSession] = useState("date fix");

  const completions: ChatProps["completions"] = ({ trigger, query }) => {
    if (trigger === "/") {
      return COMMANDS.filter((c) => c.label.startsWith(query)).map((c) => ({
        ...c,
        onSelect:
          c.label === "model"
            ? async () => {
                const id = await ui.select("Pick the model", MODELS);
                const picked = MODELS.find((m) => m.id === id);
                if (picked) setModel(picked.label);
              }
            : c.label === "rename"
              ? async () => {
                  const name = await ui.input("Name this session", { defaultValue: session });
                  if (name?.trim()) setSession(name.trim());
                }
              : c.label === "clear"
                ? async () => {
                    const yes = await ui.confirm("Clear the conversation?", {
                      message: "The messages are removed from this window.",
                    });
                    if (yes) setMessages([]);
                  }
                : undefined,
      }));
    }
    if (trigger === "@") {
      const dir = query.slice(0, query.lastIndexOf("/") + 1);
      const entries = (FILES[dir] ?? []).filter((f) => f.startsWith(query));
      return new Promise((resolve) =>
        window.setTimeout(
          () =>
            resolve(
              entries.map((f) => ({
                label: f.slice(dir.length),
                insert: f,
                description: f.endsWith("/") ? "directory" : undefined,
                partial: f.endsWith("/"),
              })),
            ),
          80,
        ),
      );
    }
    return TAGS.filter((t) => t.startsWith(query)).map((t) => ({ label: t }));
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [...prev, { id: String(Date.now()), role: "user", content: text }])
        }
        height={480}
        completions={completions}
        prompt={ui.prompt}
        placeholder="Type / for a command, @ for a file"
        footer={[{ left: `~/src/app (main) • ${session}`, right: model }]}
      />
    </div>
  );
};

/**
 * A prompt in the editor's place, as it shows while a question is open: here
 * the model picker with its key hints and its `[Cancel]` key.
 */
export const Prompt: Story = () => {
  const [answer, setAnswer] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={SESSION.slice(0, 1)}
        onSubmit={() => {}}
        height={360}
        working
        prompt={
          answer === null
            ? {
                type: "select",
                title: "Pick the model",
                message: "The next reply uses it.",
                options: MODELS,
                onAnswer: setAnswer,
                onCancel: () => setAnswer(""),
              }
            : null
        }
        aboveEditor={answer ? <div>Model: {answer}</div> : undefined}
        footer={[{ left: "~/src/app (main)", right: "model-medium" }]}
      />
    </div>
  );
};

export const Dock: Story = () => {
  const [messages] = useState<ChatMessage[]>(SESSION.slice(0, 1));
  return (
    <div style={{ maxWidth: 640 }}>
      <Chat
        messages={messages}
        onSubmit={() => {}}
        height={360}
        working="Compacting context"
        aboveEditor={
          <div style={{ color: "var(--sf-color-muted)" }}>
            Queued: also update the changelog
            <br />
            Queued: then run the linter
          </div>
        }
        belowEditor={<div>plan: 2 of 5 steps</div>}
        footer={[{ left: "~/src/app (main)", right: "model-large" }]}
      />
    </div>
  );
};

const BACKLOG: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
  id: `b-${i}`,
  role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
  content:
    i % 2 === 0
      ? `Question ${i / 2 + 1}: how does the follow behaviour work?`
      : `The view holds the bottom as the reply arrives. Scroll away from it and it lets go at once, however small the move, so it never pulls against you.\n\nThe key below brings you back, and takes the accent once something has arrived while you were reading up here.`,
}));

/** A conversation with distinct questions, so the rail reads as a list of them
 *  and the replies differ enough in length to give the blocks a density. */
const TOPICS: ChatMessage[] = [
  [
    "How do I lay out a form?",
    "Reach for `FieldLayout`: justified rows of rigid, flexible and filler fields that collapse gradually with the container, no breakpoints. A single labelled row is a bare `Field`.",
  ],
  [
    "What about validation?",
    "`Form` is the layer above: bring your own resolver, and `FormField` binds one control to a named field with its label, description and live error.\n\nPer-field `validate` runs as you go; the whole-form resolver gates `onSubmit`.",
  ],
  [
    "Which chart for a share of a total?",
    "`PieChart` for a few parts of one whole the reader already understands as one, `Treemap` once it is a hierarchy or more parts than a circle carries, and `Marimekko` when the columns must carry a second measure.",
  ],
  [
    "How do I show a table of 100k rows?",
    '`DataTable`. It virtualizes, and its columns size themselves with `columnFit="content"`.',
  ],
  [
    "Can a column show its total?",
    "Declare a `total` on it. The summary band sits at the foot of the grid, covering every filtered row rather than the page on screen, and a tree table totals its roots so a subtotal is never counted twice.",
  ],
  [
    "Is there a date drill-down?",
    '`DatePicker path={["year", "month", "day"]}`: the popup asks one step at a time, the header carries the trail, and the last step is the precision.',
  ],
  [
    "And a map?",
    "`Map`, on MapLibre. Points, areas and vectors in GeoJSON order, with a restrained basemap coloured from the tokens.",
  ],
].flatMap(([q, a], i) => [
  { id: `t-${i}-q`, role: "user" as const, content: q as string },
  { id: `t-${i}-a`, role: "assistant" as const, content: a as string },
]);

/** A transcript long enough to scroll, with a reply arriving at the bottom.
 *  Scroll up and the view stops following: the jump-to-latest key appears over
 *  the bottom edge and turns accent as the reply keeps growing out of sight.
 *  Typing several lines into the composer shows the other half: the composer
 *  grows into the transcript's space and the bottom stays in view. */
export const Following: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(BACKLOG);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!streaming) return;
    const id = `s-${Date.now()}`;
    setMessages((prev) => [...prev, { id, role: "assistant", content: "", isStreaming: true }]);
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      const done = n >= 30;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                content:
                  `A reply arriving a sentence at a time, so the bottom keeps moving. `.repeat(n),
                isStreaming: !done,
              }
            : m,
        ),
      );
      if (done) {
        clearInterval(timer);
        setStreaming(false);
      }
    }, 120);
    return () => clearInterval(timer);
  }, [streaming]);

  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", maxInlineSize: "34rem" }}>
      <Chat
        messages={messages}
        onSubmit={(text) => {
          setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
          setStreaming(true);
        }}
        height={420}
        disabled={streaming}
        // Tracks the tokens as they arrive, so the bottom really does keep
        // moving while you read further up.
        reveal={{ mode: "stream" }}
      />
      <Button onClick={() => setStreaming(true)} disabled={streaming} size="sm">
        Send a reply
      </Button>
    </div>
  );
};

/** The same rail on a short exchange: a handful of turns should read as a few
 *  bricks at the top of the rail, not as a few huge blocks stretched down it. */
export const MinimapSparse: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(TOPICS.slice(0, 6));
  return (
    <div style={{ height: 420, width: "min(40rem, 100%)" }}>
      <Chat
        minimap
        height="100%"
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [
            ...prev,
            { id: `u-${Date.now()}`, role: "user", content: text },
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: "Another turn, so the rail fills a little further.",
            },
          ])
        }
      />
    </div>
  );
};

/** `minimap` swaps the transcript's scrollbar for a rail: every question you
 *  asked becomes a label down the side (click one to jump back to it), the
 *  replies are dithered blocks whose height is their length, and the band shows
 *  the part of the conversation on screen. Scroll, or click a label and watch
 *  the view stop following the bottom. */
export const WithMinimap: Story = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(TOPICS);
  return (
    <div style={{ height: 520, width: "min(46rem, 100%)" }}>
      <Chat
        minimap
        height="100%"
        messages={messages}
        onSubmit={(text) =>
          setMessages((prev) => [
            ...prev,
            { id: `u-${Date.now()}`, role: "user", content: text },
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: "Noted. The rail grows a label for the question and a block for this reply.",
            },
          ])
        }
      />
    </div>
  );
};
