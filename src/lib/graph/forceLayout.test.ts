import { describe, expect, it } from "vitest";
import { buildGraph } from "./build";
import {
  applyPositions,
  detachForLayout,
  FORCE_ASYNC_MIN_ORDER,
  forceIterations,
} from "./forceLayout";
import type { GraphData } from "./types";

const hooks = {};

/** A triangle with known positions plus one isolated node. */
function base(): GraphData {
  return {
    nodes: [
      { id: "a", label: "A", kind: "primary", x: 0, y: 0 },
      { id: "b", label: "B", kind: "secondary", x: 10, y: 10 },
      { id: "c", label: "C", kind: "tertiary", x: -5, y: 5 },
      { id: "lone", x: 99, y: 99 },
    ],
    edges: [
      { id: "e1", source: "a", target: "b", weight: 0.8 },
      { id: "e2", source: "b", target: "c", weight: 0.4 },
    ],
  };
}

describe("forceIterations", () => {
  it("time-boxes by size tier, shared by the sync block and the worker settle", () => {
    expect(forceIterations(100)).toBe(200);
    expect(forceIterations(2000)).toBe(200);
    expect(forceIterations(2001)).toBe(80);
    expect(forceIterations(5000)).toBe(80);
    expect(forceIterations(5001)).toBe(30);
    expect(forceIterations(10000)).toBe(30);
  });

  it("aligns the async threshold with the sync tiers: at the gate the sync path still applies", () => {
    // Order ≤ FORCE_ASYNC_MIN_ORDER stays synchronous, where the full 200
    // iterations are the trivially-cheap small-graph budget.
    expect(forceIterations(FORCE_ASYNC_MIN_ORDER)).toBe(200);
  });
});

describe("detachForLayout", () => {
  it("copies node keys, positions, and edge topology", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);

    expect(copy.order).toBe(g.order);
    expect(copy.size).toBe(g.size);
    expect(copy.getNodeAttribute("a", "x")).toBe(0);
    expect(copy.getNodeAttribute("b", "y")).toBe(10);
    expect(copy.hasNode("lone")).toBe(true);
    expect(copy.areNeighbors("a", "b")).toBe(true);
    expect(copy.areNeighbors("b", "c")).toBe(true);
    expect(copy.areNeighbors("a", "c")).toBe(false);
  });

  it("strips visual attributes — the worker only needs positions", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);

    expect(copy.getNodeAttributes("a")).toEqual({ x: 0, y: 0 });
  });

  it("is detached: writes to the copy never touch the live graph", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);

    copy.setNodeAttribute("a", "x", 123);
    copy.setNodeAttribute("a", "y", -7);

    expect(g.getNodeAttribute("a", "x")).toBe(0);
    expect(g.getNodeAttribute("a", "y")).toBe(0);
  });

  it("is detached structurally: live-graph mutations emit nothing on the copy", () => {
    // This is what shields the worker supervisor (listening on the copy) from
    // reconcile()/Connect-mode edge adds terminating + respawning mid-settle.
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);
    let copyEvents = 0;
    copy.on("nodeAdded", () => copyEvents++);
    copy.on("edgeAdded", () => copyEvents++);

    g.addNode("new", { x: 1, y: 1 });
    g.addEdgeWithKey("e-new", "new", "a");

    expect(copyEvents).toBe(0);
    expect(copy.hasNode("new")).toBe(false);
  });
});

describe("applyPositions", () => {
  it("writes the copy's x/y back onto the live graph", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);
    copy.setNodeAttribute("a", "x", 42);
    copy.setNodeAttribute("a", "y", -42);

    applyPositions(copy, g);

    expect(g.getNodeAttribute("a", "x")).toBe(42);
    expect(g.getNodeAttribute("a", "y")).toBe(-42);
    expect(g.getNodeAttribute("b", "x")).toBe(10);
  });

  it("emits a single batched update event (one scheduled Sigma render per apply)", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);
    let batches = 0;
    let perNode = 0;
    g.on("eachNodeAttributesUpdated", () => batches++);
    g.on("nodeAttributesUpdated", () => perNode++);

    applyPositions(copy, g);

    expect(batches).toBe(1);
    expect(perNode).toBe(0);
  });

  it("keeps seeded positions for nodes added to the live graph mid-settle", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);
    g.addNode("late", { x: 7, y: 8 });

    applyPositions(copy, g);

    expect(g.getNodeAttribute("late", "x")).toBe(7);
    expect(g.getNodeAttribute("late", "y")).toBe(8);
  });

  it("skips nodes dropped from the live graph mid-settle", () => {
    const g = buildGraph(base(), hooks);
    const copy = detachForLayout(g);
    g.dropNode("lone");

    expect(() => applyPositions(copy, g)).not.toThrow();
    expect(g.hasNode("lone")).toBe(false);
  });
});
