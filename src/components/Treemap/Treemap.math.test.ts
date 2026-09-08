import { describe, expect, it } from "vitest";
import {
  aggregate,
  dice,
  findNode,
  layoutTreemap,
  type Rect,
  slice,
  snapCell,
  squarify,
  type TreemapLayoutOptions,
  type TreemapNode,
  treemapPath,
  worstAspect,
} from "./Treemap.math";

const box: Rect = { x0: 0, y0: 0, x1: 600, y1: 400 };

const portfolio: TreemapNode = {
  name: "Portfolio",
  children: [
    {
      name: "Tech",
      children: [
        { name: "AAPL", value: 30, change: 1.2 },
        { name: "MSFT", value: 20, change: -0.4 },
      ],
    },
    { name: "Energy", children: [{ name: "XOM", value: 10, change: 2 }] },
    { name: "Cash", value: 40 },
  ],
};

const options: TreemapLayoutOptions = {
  layout: "squarify",
  padding: 1,
  groupPadding: 1,
  headerHeight: 18,
  maxDepth: Number.POSITIVE_INFINITY,
  minHeaderWidth: 40,
};

describe("aggregate", () => {
  it("sums leaf values upward and keeps an explicit parent value", () => {
    const root = aggregate(portfolio);
    expect(root.value).toBe(100);
    expect(root.children.map((c) => c.value)).toEqual([50, 10, 40]);
    const explicit = aggregate({ name: "r", value: 7, children: [{ name: "a", value: 100 }] });
    expect(explicit.value).toBe(7);
  });

  it("derives a group's change as the value-weighted mean of its children", () => {
    const root = aggregate(portfolio);
    const tech = root.children[0];
    expect(tech?.change).toBeCloseTo((30 * 1.2 + 20 * -0.4) / 50);
    expect(root.children[2]?.change).toBeUndefined();
  });

  it("assigns path ids unless a node brings its own", () => {
    const root = aggregate(portfolio);
    expect(root.children[0]?.children[0]?.id).toBe("Portfolio/Tech/AAPL");
    const own = aggregate({ name: "r", children: [{ id: "x", name: "a", value: 1 }] });
    expect(own.children[0]?.id).toBe("x");
  });

  it("finds nodes by id and builds a breadcrumb path", () => {
    const root = aggregate(portfolio);
    expect(findNode(root, "Portfolio/Energy")?.name).toBe("Energy");
    expect(treemapPath(portfolio, "Portfolio/Tech/MSFT").map((n) => n.name)).toEqual([
      "Portfolio",
      "Tech",
      "MSFT",
    ]);
    expect(treemapPath(portfolio, "nope")).toEqual([]);
  });
});

describe("slice / dice", () => {
  it("dice splits along x in proportion and in input order", () => {
    const rects = dice([1, 3], box);
    expect(rects[0]).toEqual({ x0: 0, y0: 0, x1: 150, y1: 400 });
    expect(rects[1]).toEqual({ x0: 150, y0: 0, x1: 600, y1: 400 });
  });

  it("slice splits along y", () => {
    const rects = slice([1, 1], box);
    expect(rects[0]).toEqual({ x0: 0, y0: 0, x1: 600, y1: 200 });
    expect(rects[1]?.y0).toBe(200);
  });

  it("degrades to empty rects for a zero total", () => {
    expect(dice([0, 0], box).every((r) => r.x1 === r.x0)).toBe(true);
  });
});

describe("squarify", () => {
  it("tiles the whole rect with the areas in proportion to the values", () => {
    const values = [6, 6, 4, 3, 2, 2, 1];
    const rects = squarify(values, box);
    const total = values.reduce((a, b) => a + b, 0);
    const area = (box.x1 - box.x0) * (box.y1 - box.y0);
    rects.forEach((r, i) => {
      expect((r.x1 - r.x0) * (r.y1 - r.y0)).toBeCloseTo((area * (values[i] ?? 0)) / total, 6);
    });
  });

  it("produces squarer cells than a plain slice", () => {
    const values = [6, 6, 4, 3, 2, 2, 1];
    expect(worstAspect(squarify(values, box))).toBeLessThan(worstAspect(slice(values, box)));
    expect(worstAspect(squarify(values, box))).toBeLessThan(3);
  });

  it("keeps the rects in input order and gives zero values empty rects", () => {
    const rects = squarify([4, 0, 2], box);
    expect(rects).toHaveLength(3);
    expect(rects[1]?.x1).toBe(rects[1]?.x0);
    expect((rects[0]?.x1 ?? 0) - (rects[0]?.x0 ?? 0)).toBeGreaterThan(0);
  });

  it("handles a single value and an empty list", () => {
    expect(squarify([5], box)).toEqual([box]);
    expect(squarify([], box)).toEqual([]);
  });
});

describe("snapCell", () => {
  it("rounds to whole pixels and leaves the gap only on interior edges", () => {
    const parent: Rect = { x0: 0, y0: 0, x1: 100, y1: 50 };
    expect(snapCell({ x0: 0, y0: 0, x1: 49.6, y1: 50 }, parent, 1)).toEqual({
      x: 0,
      y: 0,
      width: 49,
      height: 50,
    });
    expect(snapCell({ x0: 49.6, y0: 0, x1: 100, y1: 50 }, parent, 1)).toEqual({
      x: 50,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it("returns null for a cell thinner than a pixel", () => {
    expect(snapCell({ x0: 10, y0: 0, x1: 10.3, y1: 50 }, box, 1)).toBeNull();
  });
});

describe("layoutTreemap", () => {
  it("emits groups, headers and leaves that stay inside the box", () => {
    const cells = layoutTreemap(aggregate(portfolio), 600, 400, options);
    expect(
      cells
        .filter((c) => c.kind === "group")
        .map((c) => c.name)
        .sort(),
    ).toEqual(["Energy", "Tech"]);
    expect(cells.filter((c) => c.kind === "header")).toHaveLength(2);
    expect(
      cells
        .filter((c) => c.kind === "leaf")
        .map((c) => c.name)
        .sort(),
    ).toEqual(["AAPL", "Cash", "MSFT", "XOM"]);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(600);
      expect(c.y + c.height).toBeLessThanOrEqual(400);
      expect(Number.isInteger(c.x) && Number.isInteger(c.width)).toBe(true);
    }
  });

  it("carries shares, group index and parent names", () => {
    const cells = layoutTreemap(aggregate(portfolio), 600, 400, options);
    const aapl = cells.find((c) => c.name === "AAPL");
    expect(aapl?.shareOfParent).toBeCloseTo(0.6);
    expect(aapl?.shareOfTotal).toBeCloseTo(0.3);
    expect(aapl?.parentName).toBe("Tech");
    expect(aapl?.groupIndex).toBe(0);
    expect(cells.find((c) => c.name === "XOM")?.groupIndex).toBe(1);
  });

  it("aggregates below the depth cut", () => {
    const cells = layoutTreemap(aggregate(portfolio), 600, 400, { ...options, maxDepth: 1 });
    expect(cells.every((c) => c.kind === "leaf")).toBe(true);
    const tech = cells.find((c) => c.name === "Tech");
    expect(tech?.aggregated).toBe(true);
    expect(tech?.value).toBe(50);
  });

  it("drops the header when a group is too small for one", () => {
    const cells = layoutTreemap(aggregate(portfolio), 600, 40, options);
    expect(cells.filter((c) => c.kind === "header")).toHaveLength(0);
  });

  it("returns nothing for an empty box or an empty tree", () => {
    expect(layoutTreemap(aggregate(portfolio), 0, 400, options)).toEqual([]);
    expect(layoutTreemap(aggregate({ name: "r" }), 600, 400, options)).toEqual([]);
  });
});
