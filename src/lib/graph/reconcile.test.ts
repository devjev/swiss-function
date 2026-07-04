import { describe, expect, it } from "vitest";
import { ARROW_MAX_EDGES, buildGraph, edgeTypeFor, reconcile } from "./build";
import type { GraphData, GraphNode } from "./types";

const hooks = {};

/** Two unconnected nodes at known positions. */
function base(): GraphData {
  return {
    nodes: [
      { id: "a", label: "A", x: 0, y: 0 },
      { id: "b", label: "B", x: 10, y: 10 },
    ],
    edges: [],
  };
}

describe("reconcile structure", () => {
  it("adds a new edge in place and reports a structural change", () => {
    const data = base();
    const g = buildGraph(data, hooks);
    const next: GraphData = { ...data, edges: [{ id: "e1", source: "a", target: "b" }] };

    const changed = reconcile(g, next, hooks);

    expect(changed).toBe(true);
    expect(g.hasEdge("e1")).toBe(true);
    expect(g.order).toBe(2);
    expect(g.size).toBe(1);
  });

  it("preserves existing node positions when adding an edge", () => {
    const data = base();
    const g = buildGraph(data, hooks);
    reconcile(g, { ...data, edges: [{ id: "e1", source: "a", target: "b" }] }, hooks);

    expect(g.getNodeAttribute("a", "x")).toBe(0);
    expect(g.getNodeAttribute("a", "y")).toBe(0);
    expect(g.getNodeAttribute("b", "x")).toBe(10);
    expect(g.getNodeAttribute("b", "y")).toBe(10);
  });

  it("drops a removed edge", () => {
    const data: GraphData = { ...base(), edges: [{ id: "e1", source: "a", target: "b" }] };
    const g = buildGraph(data, hooks);
    expect(g.hasEdge("e1")).toBe(true);

    const changed = reconcile(g, { ...data, edges: [] }, hooks);

    expect(changed).toBe(true);
    expect(g.hasEdge("e1")).toBe(false);
  });

  it("drops a removed node along with its incident edges", () => {
    const data: GraphData = { ...base(), edges: [{ id: "e1", source: "a", target: "b" }] };
    const g = buildGraph(data, hooks);

    reconcile(g, { nodes: [{ id: "a", x: 0, y: 0 }], edges: [] }, hooks);

    expect(g.hasNode("b")).toBe(false);
    expect(g.hasEdge("e1")).toBe(false);
    expect(g.hasNode("a")).toBe(true);
  });

  it("seeds a new node near the centroid of its present neighbors", () => {
    const data = base();
    const g = buildGraph(data, hooks);
    // `c` connects to both a (0,0) and b (10,10) → centroid (5,5).
    const next: GraphData = {
      nodes: [...data.nodes, { id: "c", label: "C" }],
      edges: [
        { id: "ea", source: "c", target: "a" },
        { id: "eb", source: "c", target: "b" },
      ],
    };

    reconcile(g, next, hooks);

    expect(g.getNodeAttribute("c", "x")).toBeCloseTo(5, 1);
    expect(g.getNodeAttribute("c", "y")).toBeCloseTo(5, 1);
  });
});

describe("reconcile guards", () => {
  it("skips self-loops", () => {
    const data = base();
    const g = buildGraph(data, hooks);
    const changed = reconcile(
      g,
      { ...data, edges: [{ id: "loop", source: "a", target: "a" }] },
      hooks,
    );

    expect(g.hasEdge("loop")).toBe(false);
    expect(changed).toBe(false);
  });

  it("skips a duplicate edge between an already-connected directed pair", () => {
    const data: GraphData = { ...base(), edges: [{ id: "e1", source: "a", target: "b" }] };
    const g = buildGraph(data, hooks);
    const next: GraphData = {
      ...data,
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "b" },
      ],
    };

    reconcile(g, next, hooks);

    expect(g.hasEdge("e1")).toBe(true);
    expect(g.hasEdge("e2")).toBe(false);
    expect(g.size).toBe(1);
  });

  it("skips edges with a dangling endpoint", () => {
    const data = base();
    const g = buildGraph(data, hooks);
    reconcile(g, { ...data, edges: [{ id: "e1", source: "a", target: "ghost" }] }, hooks);

    expect(g.hasEdge("e1")).toBe(false);
  });
});

describe("reconcile attribute updates", () => {
  it("updates an edge label without a structural change", () => {
    const data: GraphData = {
      ...base(),
      edges: [{ id: "e1", source: "a", target: "b", label: "old" }],
    };
    const g = buildGraph(data, hooks);
    expect(g.getEdgeAttribute("e1", "label")).toBe("old");

    const changed = reconcile(
      g,
      { ...data, edges: [{ id: "e1", source: "a", target: "b", label: "new" }] },
      hooks,
    );

    expect(changed).toBe(false);
    expect(g.getEdgeAttribute("e1", "label")).toBe("new");
  });

  it("updates edge payload in place", () => {
    const data: GraphData = {
      ...base(),
      edges: [{ id: "e1", source: "a", target: "b", data: { p99: "12ms" } }],
    };
    const g = buildGraph(data, hooks);

    reconcile(
      g,
      { ...data, edges: [{ id: "e1", source: "a", target: "b", data: { p99: "30ms" } }] },
      hooks,
    );

    expect(g.getEdgeAttribute("e1", "payload")).toEqual({ p99: "30ms" });
  });

  it("updates a node's kind and re-runs color-by-kind hooks", () => {
    const data: GraphData = { nodes: [{ id: "a", kind: "primary" }], edges: [] };
    // A hook that colors strictly by kind, so the assertion doesn't depend on
    // tokens.css being loaded (the default color-by-kind falls back to one literal
    // outside the browser).
    const colorByKind = { renderNode: (n: GraphNode) => ({ color: `kind:${n.kind}` }) };
    const g = buildGraph(data, colorByKind);
    expect(g.getNodeAttribute("a", "color")).toBe("kind:primary");

    reconcile(g, { nodes: [{ id: "a", kind: "tertiary" }], edges: [] }, colorByKind);

    expect(g.getNodeAttribute("a", "kind")).toBe("tertiary");
    expect(g.getNodeAttribute("a", "color")).toBe("kind:tertiary");
  });

  it("applies renderEdge/renderNode hook overrides on reconcile", () => {
    const data = base();
    const g = buildGraph(data, hooks);
    reconcile(
      g,
      { ...data, edges: [{ id: "e1", source: "a", target: "b" }] },
      { renderEdge: () => ({ label: "hooked", size: 9 }) },
    );

    expect(g.getEdgeAttribute("e1", "label")).toBe("hooked");
    expect(g.getEdgeAttribute("e1", "size")).toBe(9);
  });
});

describe("edge arrowhead size gate", () => {
  it("gates edgeTypeFor at ARROW_MAX_EDGES: at most the threshold → arrow, above → line/thinline", () => {
    expect(edgeTypeFor(0, false)).toBe("arrow");
    expect(edgeTypeFor(ARROW_MAX_EDGES, false)).toBe("arrow");
    expect(edgeTypeFor(ARROW_MAX_EDGES + 1, false)).toBe("thinline");
    expect(edgeTypeFor(ARROW_MAX_EDGES + 1, true)).toBe("line");
  });

  it("keeps arrowheads below the gate regardless of interactivity", () => {
    // Interactivity only picks between quads and GL_LINES ABOVE the gate;
    // small graphs always render directed arrowheads.
    expect(edgeTypeFor(1, true)).toBe("arrow");
    expect(edgeTypeFor(ARROW_MAX_EDGES, true)).toBe("arrow");
  });

  it("stamps no per-edge type below the threshold (Sigma's defaultEdgeType governs)", () => {
    const data: GraphData = { ...base(), edges: [{ id: "e1", source: "a", target: "b" }] };
    const g = buildGraph(data, hooks);
    expect(g.getEdgeAttribute("e1", "type")).toBeUndefined();
    expect(edgeTypeFor(g.size, false)).toBe("arrow");

    reconcile(
      g,
      { ...data, edges: [...data.edges, { id: "e2", source: "b", target: "a" }] },
      hooks,
    );

    expect(g.getEdgeAttribute("e2", "type")).toBeUndefined();
  });

  it("stamps no per-edge type above the threshold either — retyping stays atomic", () => {
    // A path graph one edge over the gate: n0 → n1 → … → n{ARROW_MAX_EDGES+1}.
    const nodes = Array.from({ length: ARROW_MAX_EDGES + 2 }, (_, i) => ({ id: `n${i}` }));
    const edges = Array.from({ length: ARROW_MAX_EDGES + 1 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
    }));
    const g = buildGraph({ nodes, edges }, hooks);
    expect(g.size).toBe(ARROW_MAX_EDGES + 1);
    expect(edgeTypeFor(g.size, true)).toBe("line");
    expect(edgeTypeFor(g.size, false)).toBe("thinline");
    expect(g.getEdgeAttribute(`e${ARROW_MAX_EDGES}`, "type")).toBeUndefined();

    reconcile(g, { nodes, edges: [...edges, { id: "extra", source: "n0", target: "n2" }] }, hooks);

    expect(g.getEdgeAttribute("extra", "type")).toBeUndefined();
  });
});
