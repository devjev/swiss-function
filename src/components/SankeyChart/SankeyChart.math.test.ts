import { describe, expect, it } from "vitest";
import {
  type SankeyLayoutOptions,
  type SankeyLink,
  type SankeyNode,
  sankeyLayout,
  sankeyLinkMidpoint,
  sankeyLinkPath,
} from "./SankeyChart.math";

const OPTS: SankeyLayoutOptions = {
  width: 600,
  height: 300,
  nodeWidth: 12,
  nodePadding: 8,
  align: "justify",
  iterations: 6,
  sort: "auto",
};

const nodes: SankeyNode[] = [
  { id: "revenue" },
  { id: "ops" },
  { id: "rnd" },
  { id: "salaries" },
  { id: "rent" },
  { id: "cloud" },
];
const links: SankeyLink[] = [
  { source: "revenue", target: "ops", value: 60 },
  { source: "revenue", target: "rnd", value: 40 },
  { source: "ops", target: "salaries", value: 40 },
  { source: "ops", target: "rent", value: 20 },
  { source: "rnd", target: "salaries", value: 30 },
  { source: "rnd", target: "cloud", value: 10 },
];

const byId = (layout: ReturnType<typeof sankeyLayout>, id: string) => {
  const n = layout.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};

describe("sankeyLayout: layering", () => {
  it("layers by the longest path from the sources", () => {
    const l = sankeyLayout(nodes, links, OPTS);
    expect(byId(l, "revenue").layer).toBe(0);
    expect(byId(l, "ops").layer).toBe(1);
    expect(byId(l, "rnd").layer).toBe(1);
    expect(byId(l, "salaries").layer).toBe(2);
    expect(l.layers).toHaveLength(3);
    expect(l.warnings).toEqual([]);
  });

  it("justify moves an early sink to the last layer, left keeps it", () => {
    const withShortSink: SankeyLink[] = [...links, { source: "revenue", target: "tax", value: 5 }];
    const ns: SankeyNode[] = [...nodes, { id: "tax" }];
    expect(byId(sankeyLayout(ns, withShortSink, OPTS), "tax").layer).toBe(2);
    expect(byId(sankeyLayout(ns, withShortSink, { ...OPTS, align: "left" }), "tax").layer).toBe(1);
  });

  it("right aligns by the longest path to a sink, center pulls a late source toward its targets", () => {
    const ns: SankeyNode[] = [...nodes, { id: "grant" }];
    const ls: SankeyLink[] = [...links, { source: "grant", target: "cloud", value: 5 }];
    const left = sankeyLayout(ns, ls, { ...OPTS, align: "left" });
    expect(byId(left, "grant").layer).toBe(0);
    const center = sankeyLayout(ns, ls, { ...OPTS, align: "center" });
    expect(byId(center, "grant").layer).toBe(1);
    const right = sankeyLayout(ns, ls, { ...OPTS, align: "right" });
    expect(byId(right, "grant").layer).toBe(1);
    expect(byId(right, "revenue").layer).toBe(0);
  });

  it("respects a pinned layer", () => {
    const ns: SankeyNode[] = nodes.map((n) => (n.id === "rent" ? { ...n, layer: 1 } : n));
    expect(byId(sankeyLayout(ns, links, OPTS), "rent").layer).toBe(1);
  });

  it("marks a link that closes a cycle and keeps the layering acyclic", () => {
    const ls: SankeyLink[] = [...links, { source: "salaries", target: "revenue", value: 10 }];
    const l = sankeyLayout(nodes, ls, OPTS);
    const cyclic = l.links.filter((x) => x.cyclic);
    expect(cyclic).toHaveLength(1);
    expect(cyclic[0]?.source.id).toBe("salaries");
    expect(l.warnings.some((w) => w.includes("cycle"))).toBe(true);
    expect(byId(l, "revenue").layer).toBe(0);
    expect(byId(l, "salaries").layer).toBe(2);
  });

  it("leaves out a node no link reaches, with a warning", () => {
    const l = sankeyLayout([...nodes, { id: "orphan" }], links, OPTS);
    expect(l.nodes.map((n) => n.id)).not.toContain("orphan");
    expect(l.warnings).toEqual(['node "orphan" carries no flow']);
  });

  it("drops links with unknown ends or no value, with a warning each", () => {
    const ls: SankeyLink[] = [
      ...links,
      { source: "revenue", target: "nowhere", value: 3 },
      { source: "revenue", target: "ops", value: 0 },
    ];
    const l = sankeyLayout(nodes, ls, OPTS);
    expect(l.links).toHaveLength(links.length);
    expect(l.warnings).toHaveLength(2);
  });
});

describe("sankeyLayout: geometry", () => {
  it("sizes nodes by max(in, out) and stacks the ribbons to the node height", () => {
    const l = sankeyLayout(nodes, links, OPTS);
    const revenue = byId(l, "revenue");
    const ops = byId(l, "ops");
    expect(revenue.value).toBe(100);
    expect(ops.value).toBe(60);
    expect(ops.y1 - ops.y0).toBeCloseTo((revenue.y1 - revenue.y0) * 0.6, 6);
    const outWidths = revenue.sourceLinks.reduce((s, x) => s + x.width, 0);
    expect(outWidths).toBeCloseTo(revenue.y1 - revenue.y0, 6);
    for (const link of l.links) {
      expect(link.y0 - link.width / 2).toBeGreaterThanOrEqual(link.source.y0 - 1e-6);
      expect(link.y0 + link.width / 2).toBeLessThanOrEqual(link.source.y1 + 1e-6);
      expect(link.y1 - link.width / 2).toBeGreaterThanOrEqual(link.target.y0 - 1e-6);
      expect(link.y1 + link.width / 2).toBeLessThanOrEqual(link.target.y1 + 1e-6);
    }
  });

  it("keeps the columns inside the box with no overlaps", () => {
    const l = sankeyLayout(nodes, links, OPTS);
    for (const column of l.layers) {
      const sorted = [...column].sort((a, b) => a.y0 - b.y0);
      for (let i = 0; i < sorted.length; i++) {
        const n = sorted[i];
        if (!n) continue;
        expect(n.y0).toBeGreaterThanOrEqual(-1e-6);
        expect(n.y1).toBeLessThanOrEqual(OPTS.height + 1e-6);
        const next = sorted[i + 1];
        if (next) expect(next.y0).toBeGreaterThanOrEqual(n.y1 + OPTS.nodePadding - 1e-6);
      }
    }
    expect(byId(l, "revenue").x0).toBe(0);
    expect(byId(l, "salaries").x1).toBe(OPTS.width);
  });

  it("a comparator fixes the order within a column", () => {
    const l = sankeyLayout(nodes, links, { ...OPTS, sort: (a, b) => a.id.localeCompare(b.id) });
    const middle = l.layers[1]?.map((n) => n.id);
    expect(middle).toEqual(["ops", "rnd"]);
    const last = l.layers[2]?.map((n) => n.id);
    expect(last).toEqual(["cloud", "rent", "salaries"]);
  });

  it("'none' keeps the input order, 'auto' may reorder toward the flow", () => {
    const ns: SankeyNode[] = [{ id: "a" }, { id: "b" }, { id: "x" }, { id: "y" }];
    const ls: SankeyLink[] = [
      { source: "a", target: "y", value: 10 },
      { source: "b", target: "x", value: 10 },
    ];
    const none = sankeyLayout(ns, ls, { ...OPTS, sort: "none" });
    expect(none.layers[1]?.map((n) => n.id)).toEqual(["x", "y"]);
    const auto = sankeyLayout(ns, ls, { ...OPTS, sort: "auto", iterations: 12 });
    expect(auto.layers[1]?.map((n) => n.id)).toEqual(["y", "x"]);
  });

  it("handles an empty graph and a zero-size box", () => {
    expect(sankeyLayout([], [], OPTS).nodes).toEqual([]);
    const l = sankeyLayout(nodes, links, { ...OPTS, width: 0 });
    expect(l.nodes).toHaveLength(nodes.length);
  });
});

describe("sankeyLinkPath / midpoint", () => {
  it("draws a horizontal cubic from the source edge to the target edge", () => {
    const l = sankeyLayout(nodes, links, OPTS);
    const link = l.links[0];
    if (!link) throw new Error("no link");
    const d = sankeyLinkPath(link);
    expect(d.startsWith(`M ${link.source.x1} `)).toBe(true);
    expect(d).toMatch(/ C /);
    expect(d.endsWith(` ${link.target.x0} ${Math.round(link.y1 * 100) / 100}`)).toBe(true);
    const m = sankeyLinkMidpoint(link);
    expect(m.x).toBeCloseTo((link.source.x1 + link.target.x0) / 2);
    expect(m.y).toBeCloseTo((link.y0 + link.y1) / 2);
  });
});
