import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { filteredTreeMeta, filterTreeRows } from "./treeRows";

type Node = { name: string; team: string; children?: Node[] };

const TEAMS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

// 2,500 roots × 19 children = 50k nodes, the shape of the PerfTree story.
function makeTree(roots: number, childrenPer: number, rand: () => number): Node[] {
  const node = (name: string): Node => ({
    name,
    team: TEAMS[Math.floor(rand() * TEAMS.length)] as string,
  });
  return Array.from({ length: roots }, (_, i) => ({
    ...node(`Root ${i}`),
    children: Array.from({ length: childrenPer }, (_, j) => node(`Child ${i}.${j}`)),
  }));
}

const tree50k = makeTree(2_500, 19, seededRandom(31));
const getSubRows = (n: Node) => n.children;
const notAlpha = (n: Node) => n.team !== "Alpha";
const oneChild = (n: Node) => n.name === "Child 1234.5";

describe("DataTable tree filter (issue #108)", () => {
  bench(
    "filterTreeRows, one team of five unchecked (50k nodes)",
    () => {
      filterTreeRows(tree50k, getSubRows, notAlpha);
    },
    BENCH,
  );
  bench(
    "filterTreeRows, one match deep in the tree (50k nodes)",
    () => {
      filterTreeRows(tree50k, getSubRows, oneChild);
    },
    BENCH,
  );
  const kept = filterTreeRows(tree50k, getSubRows, notAlpha);
  const shown: Record<string, boolean> = {};
  for (const id of kept.paths) shown[id] = true;
  bench(
    "filteredTreeMeta over the kept tree, paths open",
    () => {
      filteredTreeMeta(kept, shown);
    },
    BENCH,
  );
});
