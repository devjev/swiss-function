import type { Story } from "@ladle/react";
import { useState } from "react";
import { AgentComposer, type AgentComposerAgent } from "./AgentComposer";

export default { title: "AgentComposer" };

// A support-desk composition: an orchestrator routing to three desks. Two
// instances share the `summarizer` type under different names (bullet_summary,
// exec_summary) — hover one to see both highlight (⧉ ×2). Adding children is a
// consumer concern (drag from the app's catalog, dnd milestone); the composer
// edits the structure that is already there.
const SUPPORT_DESK: AgentComposerAgent = {
  id: "triage",
  kind: "agent",
  name: "front_desk",
  agent: "triage",
  model: "sonnet",
  hyperparams: { max_turns: 4 },
  context: "route to the right desk…",
  children: [
    { id: "faq", kind: "fn", tool: "handbook_faq", context: "FAQ knowledge base" },
    {
      id: "researcher",
      kind: "agent",
      agent: "researcher",
      model: "sonnet",
      context: "find and verify sources…",
      children: [
        { id: "web", kind: "fn", tool: "web_search" },
        { id: "read", kind: "fn", tool: "read_url" },
        {
          id: "extractor",
          kind: "agent",
          agent: "extractor",
          model: "haiku",
          context: "extract entities and dates…",
          children: [
            { id: "pdf", kind: "fn", tool: "parse_pdf" },
            { id: "ocr", kind: "fn", tool: "ocr_image" },
          ],
        },
        {
          id: "sum-1",
          kind: "agent",
          name: "bullet_summary",
          agent: "summarizer",
          model: "haiku",
          context: "compress to five bullets…",
          children: [],
        },
      ],
    },
    {
      id: "billing",
      kind: "agent",
      agent: "billing",
      model: "haiku",
      hyperparams: { max_turns: 2 },
      children: [
        { id: "sql", kind: "fn", tool: "sql_query" },
        { id: "stripe", kind: "mcp", tool: "stripe_api", context: "charges + refunds" },
      ],
    },
    {
      id: "sum-2",
      kind: "agent",
      name: "exec_summary",
      agent: "summarizer",
      model: "sonnet",
      context: "one-paragraph executive summary…",
      children: [],
    },
  ],
};

const eventStyle = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg-subtle)",
} as const;

export const Playground: Story<{ readOnly: boolean }> = ({ readOnly }) => {
  const [value, setValue] = useState(SUPPORT_DESK);
  const [event, setEvent] = useState("(structure edits: Alt+arrows · Delete · Enter on a row)");
  return (
    <div style={{ maxWidth: 640 }}>
      <AgentComposer
        value={value}
        onChange={setValue}
        readOnly={readOnly}
        onRequestEdit={(nodeId, part) => setEvent(`edit ${part} requested on ${nodeId}`)}
      />
      <p style={eventStyle}>{event}</p>
    </div>
  );
};
Playground.args = { readOnly: false };

export const ReadOnly: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <AgentComposer value={SUPPORT_DESK} readOnly />
  </div>
);

export const Collapsed: Story = () => {
  const [value, setValue] = useState(SUPPORT_DESK);
  return (
    <div style={{ maxWidth: 640 }}>
      <AgentComposer
        value={value}
        onChange={setValue}
        defaultCollapsed={["researcher", "billing", "sum-2"]}
        onRequestEdit={() => {}}
      />
    </div>
  );
};

export const Empty: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <AgentComposer
      value={{ id: "root", kind: "agent", agent: "orchestrator", children: [] }}
      onRequestEdit={() => {}}
    />
  </div>
);
