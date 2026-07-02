import type { Story } from "@ladle/react";
import { useState } from "react";
import { Explorer } from "./Explorer";
import type { ExplorerNode } from "./types";

export default { title: "Perf/Explorer" };

// Deterministic ~11k-node tree (depth 4 × breadth 10) for the perf probes
// (scripts/perf/scenarios/explorer.mjs): scrolling, folder toggles, and
// filter keystrokes at scale. Doubles as a manual stress story.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Meta {
  size: number;
  [key: string]: unknown;
}

function makeTree(
  depth: number,
  breadth: number,
  rand: () => number,
  prefix = "n",
): ExplorerNode<Meta>[] {
  return Array.from({ length: breadth }, (_, i) => {
    const id = `${prefix}-${i}`;
    const node: ExplorerNode<Meta> = {
      id,
      name: `node-${id}-${Math.floor(rand() * 1e6).toString(36)}`,
      meta: { size: Math.floor(rand() * 1e6) },
    };
    if (depth > 1) node.children = makeTree(depth - 1, breadth, rand, id);
    return node;
  });
}

/** ~11k nodes, two levels expanded — the perf-probe target. */
export const PerfTree: Story = () => {
  const [nodes] = useState<ExplorerNode<Meta>[]>(() => makeTree(4, 10, mulberry32(11)));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(nodes.flatMap((n) => [n.id, ...(n.children?.map((c) => c.id) ?? [])])),
  );
  return (
    <div data-perf-ready="">
      <Explorer
        nodes={nodes}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        height={480}
        filterableColumns
        columns={[
          { id: "name", header: "Name" },
          { id: "size", header: "Size", align: "end", width: 110 },
        ]}
      />
    </div>
  );
};
