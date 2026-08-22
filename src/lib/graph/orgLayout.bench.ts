import Graphology from "graphology";
import { bench, describe } from "vitest";
import { BENCH } from "../../../perf/benchOptions";
import { makeGraph } from "./fixtures";
import type { CardBox } from "./orgLayout";
import { orgLayout } from "./orgLayout";
import type { GraphData } from "./types";

function gFrom(data: GraphData): Graphology {
  const g = new Graphology();
  for (const n of data.nodes) g.addNode(n.id, {});
  for (const e of data.edges) g.addEdgeWithKey(e.id, e.source, e.target, {});
  return g;
}

function measure(id: string): CardBox {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return { width: 60 + (Math.abs(h) % 5) * 20, height: 28 };
}

const oneK = gFrom(makeGraph({ nodes: 1_000, shape: "tree", seed: 21 }));
const tenK = gFrom(makeGraph({ nodes: 10_000, shape: "tree", seed: 22 }));

describe("orgLayout", () => {
  bench(
    "1k tree, tidy (stack none)",
    () => {
      orgLayout(oneK, { stack: "none" }, { measure });
    },
    BENCH,
  );

  bench(
    "10k tree, tidy (stack none)",
    () => {
      orgLayout(tenK, { stack: "none" }, { measure });
    },
    BENCH,
  );

  bench(
    "10k tree, leaf stacking",
    () => {
      orgLayout(tenK, { stack: "leaves" }, { measure });
    },
    BENCH,
  );

  bench(
    "10k tree, auto (worst-case multi-pass)",
    () => {
      orgLayout(tenK, { stack: "auto" }, { measure, container: { width: 1200, height: 800 } });
    },
    BENCH,
  );
});
