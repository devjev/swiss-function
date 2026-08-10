import { useState } from "react";
import { type ContextBlock, ContextEditor } from "./ContextEditor";

const DATA: ContextBlock[] = [
  { id: "sys", kind: "system", title: "System prompt", tokens: 1_000, salience: 0.9, pinned: true },
  { id: "doc", kind: "document", title: "PRD.md", tokens: 4_000, salience: 0.5 },
  { id: "tool", kind: "tool", title: "web_search", tokens: 2_000, salience: 0.6 },
];

// Controlled harness for the CT spec: holds the block state and mirrors it into
// test-only readouts the spec can assert on.
export function ContextEditorHarness({
  readOnly,
  contextWindow = 16_000,
}: {
  readOnly?: boolean;
  contextWindow?: number;
}) {
  const [blocks, setBlocks] = useState<ContextBlock[]>(DATA);
  const enabled = blocks.filter((b) => b.enabled !== false);
  return (
    <div style={{ blockSize: "24rem", inlineSize: "52rem" }}>
      <ContextEditor
        value={blocks}
        onChange={setBlocks}
        readOnly={readOnly}
        contextWindow={contextWindow}
      />
      <div data-testid="ids">{blocks.map((b) => b.id).join(",")}</div>
      <div data-testid="enabled">{enabled.map((b) => b.id).join(",")}</div>
    </div>
  );
}
