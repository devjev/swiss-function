import { bench, describe } from "vitest";
import { BENCH } from "../../../perf/benchOptions";
import { buildGraph, reconcile } from "./build";
import { makeGraph } from "./fixtures";

// LARGE-shaped fixture (deterministic — makeGraph is seeded internally).
const data = makeGraph({ nodes: 2_000, avgDegree: 3, shape: "scaleFree", seed: 42 });
// 10% churn: drop the last 10% of nodes and their edges, add fresh ones.
const keep = data.nodes.slice(0, Math.floor(data.nodes.length * 0.9));
const keptIds = new Set(keep.map((n) => n.id));
const churned = {
  nodes: [
    ...keep,
    ...Array.from({ length: data.nodes.length - keep.length }, (_, i) => ({
      id: `new-${i}`,
      label: `new ${i}`,
    })),
  ],
  edges: data.edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)),
};

describe("graph build (2k nodes, ~3k edges)", () => {
  bench(
    "buildGraph from scratch",
    () => {
      buildGraph(data, {});
    },
    BENCH,
  );

  bench(
    "reconcile with 10% node churn",
    () => {
      const g = buildGraph(data, {});
      reconcile(g, churned, {});
    },
    BENCH,
  );
});
