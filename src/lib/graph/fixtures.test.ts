import { describe, expect, it } from "vitest";
import { LARGE, MEDIUM, makeGraph, SMALL } from "./fixtures";
import type { GraphData } from "./types";

/** All edge endpoints reference an existing node id (no dangling edges). */
function hasNoDanglingEdges(g: GraphData): boolean {
  const ids = new Set(g.nodes.map((n) => n.id));
  return g.edges.every((e) => ids.has(e.source) && ids.has(e.target));
}

/** No edge connects a node to itself. */
function hasNoSelfLoops(g: GraphData): boolean {
  return g.edges.every((e) => e.source !== e.target);
}

/** No undirected edge pair appears twice. */
function hasNoDuplicateEdges(g: GraphData): boolean {
  const seen = new Set<string>();
  for (const e of g.edges) {
    const key = e.source < e.target ? `${e.source}-${e.target}` : `${e.target}-${e.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

describe("makeGraph node counts", () => {
  it("produces exactly the requested number of nodes for each shape", () => {
    for (const shape of ["scaleFree", "tree", "clustered"] as const) {
      const g = makeGraph({ nodes: 50, avgDegree: 4, shape, seed: 7 });
      expect(g.nodes).toHaveLength(50);
    }
  });

  it("floors fractional node counts and clamps to at least one node", () => {
    expect(makeGraph({ nodes: 3.9, seed: 1 }).nodes).toHaveLength(3);
    expect(makeGraph({ nodes: 0, seed: 1 }).nodes).toHaveLength(1);
    expect(makeGraph({ nodes: -5, seed: 1 }).nodes).toHaveLength(1);
  });

  it("gives every node a unique id, label, kind, and data", () => {
    const g = makeGraph({ nodes: 30, seed: 2 });
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.size).toBe(30);
    for (const n of g.nodes) {
      expect(typeof n.id).toBe("string");
      expect(typeof n.label).toBe("string");
      expect(typeof n.kind).toBe("string");
      expect(n.data).toBeDefined();
    }
  });
});

describe("makeGraph edge structure", () => {
  it("tree shape has exactly n-1 edges and is acyclic by construction", () => {
    const g = makeGraph({ nodes: 200, shape: "tree", seed: 4 });
    expect(g.edges).toHaveLength(199);
  });

  it("never produces dangling edges, self-loops, or duplicate undirected edges", () => {
    for (const shape of ["scaleFree", "tree", "clustered"] as const) {
      const g = makeGraph({ nodes: 300, avgDegree: 6, shape, seed: 11 });
      expect(hasNoDanglingEdges(g)).toBe(true);
      expect(hasNoSelfLoops(g)).toBe(true);
      expect(hasNoDuplicateEdges(g)).toBe(true);
    }
  });

  it("gives every edge a unique id and a weight in (0, 1]", () => {
    const g = makeGraph({ nodes: 150, avgDegree: 4, shape: "clustered", seed: 5 });
    const ids = new Set(g.edges.map((e) => e.id));
    expect(ids.size).toBe(g.edges.length);
    for (const e of g.edges) {
      expect(e.weight).toBeGreaterThan(0);
      expect(e.weight).toBeLessThanOrEqual(1);
    }
  });

  it("scales edge count roughly with avgDegree for clustered graphs", () => {
    const sparse = makeGraph({ nodes: 500, avgDegree: 2, shape: "clustered", seed: 9 });
    const dense = makeGraph({ nodes: 500, avgDegree: 8, shape: "clustered", seed: 9 });
    expect(dense.edges.length).toBeGreaterThan(sparse.edges.length);
  });
});

describe("makeGraph determinism", () => {
  it("is byte-identical for the same seed and options", () => {
    const a = makeGraph({ nodes: 250, avgDegree: 5, shape: "scaleFree", seed: 42 });
    const b = makeGraph({ nodes: 250, avgDegree: 5, shape: "scaleFree", seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("differs for different seeds", () => {
    const a = makeGraph({ nodes: 250, avgDegree: 5, shape: "scaleFree", seed: 1 });
    const b = makeGraph({ nodes: 250, avgDegree: 5, shape: "scaleFree", seed: 2 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("ready-made fixtures", () => {
  it("SMALL is a valid ~100-node graph", () => {
    expect(SMALL.nodes).toHaveLength(100);
    expect(hasNoDanglingEdges(SMALL)).toBe(true);
    expect(hasNoSelfLoops(SMALL)).toBe(true);
    expect(hasNoDuplicateEdges(SMALL)).toBe(true);
  });

  it("MEDIUM is a valid ~1k-node graph", () => {
    expect(MEDIUM.nodes).toHaveLength(1000);
    expect(hasNoDanglingEdges(MEDIUM)).toBe(true);
    expect(hasNoSelfLoops(MEDIUM)).toBe(true);
    expect(hasNoDuplicateEdges(MEDIUM)).toBe(true);
  });

  it("LARGE is a valid 10k-node graph", () => {
    expect(LARGE.nodes).toHaveLength(10000);
    expect(hasNoDanglingEdges(LARGE)).toBe(true);
    expect(hasNoSelfLoops(LARGE)).toBe(true);
    expect(hasNoDuplicateEdges(LARGE)).toBe(true);
  });
});
