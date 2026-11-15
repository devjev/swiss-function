import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGraph } from "./build";
import {
  animatePositions,
  applyPositions,
  assignPositions,
  detachForLayout,
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

describe("assignPositions / animatePositions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Node has no requestAnimationFrame: a 16ms timer under fake time. */
  function fakeFrames() {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  }

  /** Count graph events of each kind (Sigma refreshes once per event). */
  function countEvents(g: ReturnType<typeof buildGraph>) {
    const counts = { each: 0, single: 0 };
    g.on("eachNodeAttributesUpdated", () => counts.each++);
    g.on("nodeAttributesUpdated", () => counts.single++);
    return counts;
  }

  it("writes every position in one event and skips unknown nodes", () => {
    const g = buildGraph(base(), hooks);
    const counts = countEvents(g);
    assignPositions(g, { a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, ghost: { x: 9, y: 9 } });
    expect(counts).toEqual({ each: 1, single: 0 });
    expect(g.getNodeAttributes("a")).toMatchObject({ x: 1, y: 2 });
    expect(g.getNodeAttributes("b")).toMatchObject({ x: 3, y: 4 });
    expect(g.getNodeAttributes("lone")).toMatchObject({ x: 99, y: 99 });
  });

  it("animates with one event per frame and lands exactly on the targets", () => {
    fakeFrames();
    const g = buildGraph(base(), hooks);
    const counts = countEvents(g);
    let done = false;
    animatePositions(g, { a: { x: 100, y: 50 } }, { duration: 100, easing: (t) => t }, () => {
      done = true;
    });
    expect(counts.each).toBe(1); // the first frame runs at once
    vi.advanceTimersByTime(48);
    const mid = g.getNodeAttribute("a", "x") as number;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
    vi.advanceTimersByTime(100);
    expect(done).toBe(true);
    expect(g.getNodeAttributes("a")).toMatchObject({ x: 100, y: 50 });
    expect(g.getNodeAttributes("b")).toMatchObject({ x: 10, y: 10 });
    expect(counts.single).toBe(0);
    expect(counts.each).toBeGreaterThan(2);
  });

  it("stops when cancelled", () => {
    fakeFrames();
    const g = buildGraph(base(), hooks);
    let done = false;
    const cancel = animatePositions(
      g,
      { a: { x: 100, y: 0 } },
      { duration: 100, easing: (t) => t },
      () => {
        done = true;
      },
    );
    vi.advanceTimersByTime(32);
    cancel();
    const at = g.getNodeAttribute("a", "x");
    vi.advanceTimersByTime(200);
    expect(done).toBe(false);
    expect(g.getNodeAttribute("a", "x")).toBe(at);
  });
});
