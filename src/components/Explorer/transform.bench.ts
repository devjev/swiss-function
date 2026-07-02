import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { checklistTest, filterTree, makeComparator, rangeTest, sortTree } from "./transform";
import type { ExplorerNode } from "./types";

interface Meta {
  size: number;
  kind: string;
  [key: string]: unknown;
}

// Deterministic ~10k-node tree: depth 4, breadth 10 (10 + 100 + 1000 + 10000).
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
      name: `node ${id} ${Math.floor(rand() * 1e6)}`,
      meta: { size: Math.floor(rand() * 1e6), kind: rand() > 0.5 ? "alpha" : "beta" },
    };
    if (depth > 1) node.children = makeTree(depth - 1, breadth, rand, id);
    return node;
  });
}

const tree = makeTree(4, 10, seededRandom(5));
const byName = makeComparator<Meta>((n) => n.name, "asc", "string");
const bySize = makeComparator<Meta>((n) => n.meta?.size, "desc", "number");

describe("Explorer transform (~11k-node tree)", () => {
  bench(
    "sortTree by name (string, foldersFirst)",
    () => {
      sortTree(tree, byName, true);
    },
    BENCH,
  );

  bench(
    "sortTree by size (number)",
    () => {
      sortTree(tree, bySize, false);
    },
    BENCH,
  );

  bench(
    "filterTree with checklist + range filters",
    () => {
      filterTree(tree, [
        { read: (n) => n.meta?.kind, test: checklistTest(["alpha"]) },
        { read: (n) => n.meta?.size, test: rangeTest([100_000, 900_000]) },
      ]);
    },
    BENCH,
  );
});
