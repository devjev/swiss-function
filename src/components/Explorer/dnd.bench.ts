import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { computeDropZone, flatten, wouldCycle } from "./dnd";
import type { ExplorerNode } from "./types";

// Same shape as transform.bench: ~11k nodes, depth 4, breadth 10.
function makeTree(
  depth: number,
  breadth: number,
  rand: () => number,
  prefix = "n",
): ExplorerNode[] {
  return Array.from({ length: breadth }, (_, i) => {
    const id = `${prefix}-${i}`;
    const node: ExplorerNode = { id, name: `node ${id}` };
    if (depth > 1) node.children = makeTree(depth - 1, breadth, rand, id);
    return node;
  });
}

const rand = seededRandom(6);
const tree = makeTree(4, 10, rand);
// Expand ~50% of folders, deterministically.
const expanded = new Set<string>();
const visit = (nodes: ExplorerNode[]) => {
  for (const n of nodes) {
    if (n.children) {
      if (rand() > 0.5) expanded.add(n.id);
      visit(n.children);
    }
  }
};
visit(tree);
// Worst case for wouldCycle: the root of the deepest chain vs a leaf inside it.
const deepRoot = tree[0] as ExplorerNode;
// A mid-tree subtree (~111 nodes) as the dragged node: computeDropZone runs a
// cycle check per call, so the dragged subtree's size is part of the cost.
const draggedNode = deepRoot.children?.[0] as ExplorerNode;
const flatRows = flatten(tree, expanded);

describe("Explorer dnd (~11k-node tree)", () => {
  bench(
    "flatten with ~50% expanded folders",
    () => {
      flatten(tree, expanded);
    },
    BENCH,
  );

  bench(
    "wouldCycle deep-descendant worst case ×100",
    () => {
      for (let i = 0; i < 100; i++) wouldCycle(deepRoot, "n-0-9-9-9");
    },
    BENCH,
  );

  bench(
    "computeDropZone sweep across zones ×10k",
    () => {
      for (let i = 0; i < 10_000; i++) {
        computeDropZone({
          draggedNode,
          flatRows,
          rowIndex: i % flatRows.length,
          yWithinRow: i % 32,
          rowHeight: 32,
        });
      }
    },
    BENCH,
  );
});
