import Graphology from "graphology";
import { describe, expect, it } from "vitest";
import { makeGraph } from "./fixtures";
import type { CardBox, OrgLayoutEnv } from "./orgLayout";
import { ORG_DEFAULTS, orgLayout } from "./orgLayout";
import type { GraphData, GraphLayoutOptions } from "./types";

/** Directed graphology instance from plain GraphData (no render hooks/DOM). */
function gFrom(data: GraphData): Graphology {
  const g = new Graphology();
  for (const n of data.nodes) g.addNode(n.id, {});
  for (const e of data.edges) g.addEdgeWithKey(e.id, e.source, e.target, {});
  return g;
}

function nodes(ids: string[]): GraphData["nodes"] {
  return ids.map((id) => ({ id }));
}

function edges(pairs: Array<[string, string]>): GraphData["edges"] {
  return pairs.map(([source, target], i) => ({ id: `e${i}`, source, target }));
}

/** Deterministic per-id card sizes (varying widths stress the tidy pass). */
function hashMeasure(id: string): CardBox {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return { width: 60 + (Math.abs(h) % 5) * 20, height: 28 };
}

const env: OrgLayoutEnv = { measure: hashMeasure };

/** Assert no two card rects overlap (centres from the mapping, sizes from the
 *  same measure the layout saw). */
function expectNoOverlaps(
  mapping: Record<string, { x: number; y: number }>,
  measure: (id: string) => CardBox,
): void {
  const ids = Object.keys(mapping);
  const eps = 0.01;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i] as string;
      const b = ids[j] as string;
      const pa = mapping[a] as { x: number; y: number };
      const pb = mapping[b] as { x: number; y: number };
      const ba = measure(a);
      const bb = measure(b);
      const overlapX = Math.abs(pa.x - pb.x) < (ba.width + bb.width) / 2 - eps;
      const overlapY = Math.abs(pa.y - pb.y) < (ba.height + bb.height) / 2 - eps;
      if (overlapX && overlapY) {
        throw new Error(`nodes ${a} and ${b} overlap: ${JSON.stringify(pa)} ${JSON.stringify(pb)}`);
      }
    }
  }
}

const STACKS: Array<GraphLayoutOptions["org"]> = [
  { stack: "none" },
  { stack: "leaves" },
  { stack: { depth: 2 } },
];

describe("orgLayout", () => {
  it("places every node exactly once", () => {
    const data = makeGraph({ nodes: 150, shape: "tree", seed: 7 });
    const g = gFrom(data);
    const mapping = orgLayout(g, {}, env);
    expect(Object.keys(mapping).sort()).toEqual(data.nodes.map((n) => n.id).sort());
  });

  it("never overlaps cards on random trees, any stacking mode", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const data = makeGraph({ nodes: 200, shape: "tree", seed });
      const g = gFrom(data);
      for (const options of STACKS) {
        const mapping = orgLayout(g, options, env);
        expectNoOverlaps(mapping, hashMeasure);
      }
    }
  });

  it("is deterministic", () => {
    const data = makeGraph({ nodes: 120, shape: "tree", seed: 11 });
    const g = gFrom(data);
    const a = orgLayout(g, { stack: "leaves" }, env);
    const b = orgLayout(g, { stack: "leaves" }, env);
    expect(a).toEqual(b);
  });

  it("centres a parent over its children's span", () => {
    const g = gFrom({
      nodes: nodes(["root", "a", "b", "c"]),
      edges: edges([
        ["root", "a"],
        ["root", "b"],
        ["root", "c"],
      ]),
    });
    const mapping = orgLayout(g, { stack: "none" }, env);
    const xs = ["a", "b", "c"].map((id) => (mapping[id] as { x: number }).x);
    const first = Math.min(...xs);
    const last = Math.max(...xs);
    expect((mapping.root as { x: number }).x).toBeCloseTo((first + last) / 2, 6);
  });

  it("ranks sit below their parent for direction down", () => {
    const g = gFrom({
      nodes: nodes(["root", "a", "b"]),
      edges: edges([
        ["root", "a"],
        ["a", "b"],
      ]),
    });
    const m = orgLayout(g, {}, env);
    expect((m.a as { y: number }).y).toBeLessThan((m.root as { y: number }).y);
    expect((m.b as { y: number }).y).toBeLessThan((m.a as { y: number }).y);
  });

  it("direction right advances x by rank instead", () => {
    const g = gFrom({
      nodes: nodes(["root", "a"]),
      edges: edges([["root", "a"]]),
    });
    const m = orgLayout(g, { direction: "right" }, env);
    expect((m.a as { x: number }).x).toBeGreaterThan((m.root as { x: number }).x);
  });

  it("stacks leaves into one left-aligned indented column", () => {
    const fixed: OrgLayoutEnv = { measure: () => ({ width: 100, height: 30 }) };
    const g = gFrom({
      nodes: nodes(["boss", "mgr", "ic1", "ic2", "ic3", "report"]),
      edges: edges([
        ["boss", "mgr"],
        ["boss", "ic1"],
        ["boss", "ic2"],
        ["boss", "ic3"],
        ["mgr", "report"],
      ]),
    });
    const m = orgLayout(g, { stack: "leaves" }, fixed);
    // Equal-width members of the same stack share an x column…
    const xs = ["ic1", "ic2", "ic3"].map((id) => (m[id] as { x: number }).x);
    expect(new Set(xs.map((x) => Math.round(x * 1e6))).size).toBe(1);
    // …and list downward at card-height + nodeGap pitch.
    const ys = ["ic1", "ic2", "ic3"].map((id) => (m[id] as { y: number }).y);
    expect(ys[0] as number).toBeGreaterThan(ys[1] as number);
    expect((ys[0] as number) - (ys[1] as number)).toBeCloseTo(30 + ORG_DEFAULTS.nodeGap, 6);
    // The non-leaf child stays a regular card on its rank (same y as stack top).
    expectNoOverlaps(m, fixed.measure);
  });

  it("depth stacking nests indentation", () => {
    const fixed: OrgLayoutEnv = { measure: () => ({ width: 80, height: 24 }) };
    const g = gFrom({
      nodes: nodes(["root", "a", "b", "c"]),
      edges: edges([
        ["root", "a"],
        ["a", "b"],
        ["b", "c"],
      ]),
    });
    const m = orgLayout(g, { stack: { depth: 1 } }, fixed);
    const xa = (m.a as { x: number }).x;
    const xb = (m.b as { x: number }).x;
    const xc = (m.c as { x: number }).x;
    expect(xb - xa).toBeCloseTo(ORG_DEFAULTS.stackIndent, 6);
    expect(xc - xb).toBeCloseTo(ORG_DEFAULTS.stackIndent, 6);
  });

  it("keeps a tall stack clear of a deeper neighbouring subtree (phantoms)", () => {
    const fixed: OrgLayoutEnv = { measure: () => ({ width: 90, height: 26 }) };
    // A carries a tall leaf stack; B carries a deep chain whose lower ranks
    // would slide under A's stack without contour phantoms.
    const leafIds = Array.from({ length: 10 }, (_, i) => `ic${i}`);
    const g = gFrom({
      nodes: nodes(["root", "A", "B", ...leafIds, "b1", "b2", "b3", "b4"]),
      edges: edges([
        ["root", "A"],
        ["root", "B"],
        ...leafIds.map((id): [string, string] => ["A", id]),
        ["B", "b1"],
        ["b1", "b2"],
        ["b2", "b3"],
        ["b3", "b4"],
      ]),
    });
    const m = orgLayout(g, { stack: "leaves" }, fixed);
    expectNoOverlaps(m, fixed.measure);
  });

  it("lays a forest side by side and covers cycles and islands", () => {
    const g = gFrom({
      nodes: nodes(["r1", "r1a", "r2", "r2a", "c1", "c2", "c3", "lone"]),
      edges: edges([
        ["r1", "r1a"],
        ["r2", "r2a"],
        // A pure cycle: no zero-in-degree node, must still be placed.
        ["c1", "c2"],
        ["c2", "c3"],
        ["c3", "c1"],
      ]),
    });
    const m = orgLayout(g, {}, env);
    expect(Object.keys(m)).toHaveLength(8);
    expectNoOverlaps(m, hashMeasure);
  });

  it("auto stacks a wide flat tree in a portrait container", () => {
    const leafIds = Array.from({ length: 40 }, (_, i) => `p${i}`);
    const data: GraphData = {
      nodes: nodes(["root", ...leafIds]),
      edges: edges(leafIds.map((id): [string, string] => ["root", id])),
    };
    const g = gFrom(data);
    const fixed = (id: string): CardBox => ({ width: 100, height: 30, ...(id ? {} : {}) });
    const wide = orgLayout(g, { stack: "none" }, { measure: fixed });
    const auto = orgLayout(
      g,
      { stack: "auto" },
      { measure: fixed, container: { width: 400, height: 900 } },
    );
    const width = (m: Record<string, { x: number }>) => {
      const xs = Object.values(m).map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(auto)).toBeLessThan(width(wide) / 4);
  });

  it("auto keeps a deep narrow chain unstacked in a landscape container", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `n${i}`);
    const g = gFrom({
      nodes: nodes(ids),
      edges: edges(ids.slice(1).map((id, i): [string, string] => [ids[i] as string, id])),
    });
    const fixed: OrgLayoutEnv["measure"] = () => ({ width: 100, height: 30 });
    const auto = orgLayout(
      g,
      { stack: "auto" },
      { measure: fixed, container: { width: 1600, height: 600 } },
    );
    const none = orgLayout(g, { stack: "none" }, { measure: fixed });
    expect(auto).toEqual(none);
  });

  it("keeps a node under its first (primary) parent despite later cross-links", () => {
    const fixed: OrgLayoutEnv = { measure: () => ({ width: 100, height: 30 }) };
    // "x" reports primarily to a (edge listed first); the later b→x edge is a
    // dotted-line cross-link and must not re-home x — even though BFS visits
    // b before a's subtree would claim x.
    const g = gFrom({
      nodes: nodes(["root", "b", "a", "x"]),
      edges: edges([
        ["a", "x"],
        ["root", "b"],
        ["root", "a"],
        ["b", "x"],
      ]),
    });
    const m = orgLayout(g, { stack: "none" }, fixed);
    // x sits on rank 2 (under a), not rank 1 (as a child of b it would share
    // b's rank + 1 = the same, so assert the x alignment instead: centred
    // under a, its only tidy child).
    expect((m.x as { x: number }).x).toBeCloseTo((m.a as { x: number }).x, 6);
    expect((m.x as { y: number }).y).toBeLessThan((m.a as { y: number }).y);
  });

  it("honors rootId", () => {
    const g = gFrom({
      nodes: nodes(["a", "b"]),
      edges: edges([["a", "b"]]),
    });
    const m = orgLayout(g, { rootId: "b" }, env);
    // b roots the chart; a still gets placed (as a further tree or child).
    expect(Object.keys(m).sort()).toEqual(["a", "b"]);
  });

  it("returns {} for an empty graph", () => {
    expect(orgLayout(new Graphology(), {}, env)).toEqual({});
  });
});
