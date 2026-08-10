import type { Story } from "@ladle/react";
import { useState } from "react";
import { type ContextBlock, ContextEditor } from "./ContextEditor";

export default { title: "ContextEditor" };

// A plausible AI-app context: system prompt, developer instructions, memory,
// retrieved documents, tool results, and the running message thread. The big
// API_REFERENCE.md sits in the attention trough (flagged wasted); drag it toward
// the current request or exclude it to watch the gauge react.
const SAMPLE: ContextBlock[] = [
  {
    id: "sys",
    kind: "system",
    title: "System prompt",
    detail: "assistant policy · tools",
    tokens: 1_400,
    salience: 0.9,
    pinned: true,
  },
  {
    id: "dev",
    kind: "developer",
    title: "Developer instructions",
    detail: "app-specific rules",
    tokens: 900,
    salience: 0.85,
  },
  {
    id: "mem-prefs",
    kind: "memory",
    title: "User memory · preferences",
    detail: "recalled",
    tokens: 700,
    salience: 0.6,
  },
  {
    id: "doc-prd",
    kind: "document",
    title: "PRD.md",
    detail: "attached · 18.2k tok",
    tokens: 18_200,
    salience: 0.7,
  },
  {
    id: "doc-api",
    kind: "document",
    title: "API_REFERENCE.md",
    detail: "attached · 41.8k tok",
    tokens: 41_800,
    salience: 0.35,
  },
  {
    id: "tool-search",
    kind: "tool",
    title: "web_search · 'lost in the middle'",
    detail: "3 results",
    tokens: 3_400,
    salience: 0.75,
  },
  {
    id: "tool-file",
    kind: "tool",
    title: "read_file · pricing.ts",
    detail: "212 lines",
    tokens: 6_100,
    salience: 0.4,
  },
  {
    id: "msg-u1",
    kind: "message",
    title: "User · billing question",
    detail: "earlier turn",
    tokens: 500,
    salience: 0.3,
  },
  {
    id: "msg-a1",
    kind: "message",
    title: "Assistant · billing answer",
    detail: "earlier turn",
    tokens: 4_900,
    salience: 0.45,
  },
  {
    id: "mem-onboard",
    kind: "memory",
    title: "Retrieved · onboarding.md",
    detail: "vector match 0.82",
    tokens: 3_600,
    salience: 0.8,
  },
  {
    id: "msg-u2",
    kind: "message",
    title: "User · current request",
    detail: "live",
    tokens: 400,
    salience: 0.95,
    pinned: true,
  },
];

const frame = {
  blockSize: "40rem",
  inlineSize: "min(64rem, 100%)",
} as const;
const page = { padding: "calc(var(--sf-unit) * 1.5)" } as const;

const MODELS = [
  { id: "opus", label: "Claude Opus 4.8", contextWindow: 1_000_000 },
  { id: "sonnet", label: "Claude Sonnet 5", contextWindow: 200_000 },
  { id: "haiku", label: "Claude Haiku 4.5", contextWindow: 128_000 },
];

// Controlled: edit the list on the right, the budget gauge reacts. The header
// carries a flag legend and a model selector (sets the window); toggle the
// scale control to compare linear against log.
export const Playground: Story<{ scale: "linear" | "log" }> = ({ scale }) => {
  const [blocks, setBlocks] = useState<ContextBlock[]>(SAMPLE);
  return (
    <div style={page}>
      <div style={frame}>
        <ContextEditor
          value={blocks}
          onChange={setBlocks}
          models={MODELS}
          defaultModel="opus"
          scale={scale}
        />
      </div>
    </div>
  );
};
Playground.args = { scale: "log" };
Playground.argTypes = {
  scale: { options: ["linear", "log"], control: { type: "radio" } },
};

// A read-only viewer: the gauge and blocks render, but there are no controls.
export const ReadOnly: Story = () => (
  <div style={page}>
    <div style={frame}>
      <ContextEditor defaultValue={SAMPLE} readOnly />
    </div>
  </div>
);

// A small context well within the window (no cutoff pressure), and a smaller
// window to show the gauge scale is configurable.
export const SmallContext: Story = () => {
  const [blocks, setBlocks] = useState<ContextBlock[]>(SAMPLE.slice(0, 4));
  return (
    <div style={page}>
      <div style={{ blockSize: "28rem", inlineSize: "min(52rem, 100%)" }}>
        <ContextEditor
          value={blocks}
          onChange={setBlocks}
          contextWindow={32_000}
          lowestAttention={{ at: 20_000 }}
        />
      </div>
    </div>
  );
};

// No blocks: the gauge is empty, the list shows nothing.
export const Empty: Story = () => {
  const [blocks, setBlocks] = useState<ContextBlock[]>([]);
  return (
    <div style={page}>
      <div style={{ blockSize: "24rem", inlineSize: "min(48rem, 100%)" }}>
        <ContextEditor value={blocks} onChange={setBlocks} />
      </div>
    </div>
  );
};
