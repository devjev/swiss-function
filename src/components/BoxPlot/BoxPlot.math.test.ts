import { describe, expect, it } from "vitest";
import {
  boxStats,
  gaussianKde,
  paddedDomain,
  quantile,
  resolveCells,
  silvermanBandwidth,
  statsExtent,
  thinRows,
  violinCurve,
} from "./BoxPlot.math";

const ONE_TO_TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("quantile (type 7)", () => {
  it("interpolates like a spreadsheet", () => {
    expect(quantile(ONE_TO_TEN, 0.25)).toBe(3.25);
    expect(quantile(ONE_TO_TEN, 0.5)).toBe(5.5);
    expect(quantile(ONE_TO_TEN, 0.75)).toBe(7.75);
    expect(quantile(ONE_TO_TEN, 0)).toBe(1);
    expect(quantile(ONE_TO_TEN, 1)).toBe(10);
  });

  it("handles tiny samples and clamps p", () => {
    expect(quantile([], 0.5)).toBeNaN();
    expect(quantile([7], 0.9)).toBe(7);
    expect(quantile([2, 4], 0.5)).toBe(3);
    expect(quantile([2, 4], 2)).toBe(4);
  });
});

describe("boxStats", () => {
  it("summarises with Tukey whiskers and lists the outliers", () => {
    const s = boxStats([...ONE_TO_TEN, 30]);
    expect(s.q1).toBe(3.5);
    expect(s.median).toBe(6);
    expect(s.q3).toBe(8.5);
    // Fences: 3.5 - 7.5 = -4, 8.5 + 7.5 = 16 → 30 is out, 10 is the whisker end.
    expect(s.min).toBe(1);
    expect(s.max).toBe(10);
    expect(s.outliers).toEqual([30]);
    expect(s.n).toBe(11);
  });

  it("runs the whiskers to the extremes under minmax", () => {
    const s = boxStats([...ONE_TO_TEN, 30], "minmax");
    expect(s.max).toBe(30);
    expect(s.outliers).toBeUndefined();
  });

  it("ignores non-finite values and survives a flat sample", () => {
    const s = boxStats([5, 5, Number.NaN, 5, Number.POSITIVE_INFINITY]);
    expect(s).toMatchObject({ min: 5, q1: 5, median: 5, q3: 5, max: 5, n: 3 });
    expect(s.outliers).toEqual([]);
  });

  it("marks an empty sample as NaN with n 0", () => {
    const s = boxStats([]);
    expect(s.n).toBe(0);
    expect(s.median).toBeNaN();
  });
});

describe("statsExtent / paddedDomain", () => {
  it("spans whiskers and outliers across cells, skipping NaN", () => {
    const a = boxStats([...ONE_TO_TEN, 30]);
    const b = boxStats([-4, 0, 2]);
    expect(statsExtent([a, b, boxStats([])])).toEqual([-4, 30]);
    expect(statsExtent([boxStats([])])).toBeNull();
  });

  it("pads by a fraction of the span and opens a flat extent", () => {
    expect(paddedDomain([0, 100], 0.05)).toEqual([-5, 105]);
    expect(paddedDomain([7, 7])).toEqual([6, 8]);
  });
});

describe("gaussianKde", () => {
  it("integrates to about one and peaks at the data centre", () => {
    const values = [-1, -0.5, 0, 0.5, 1, 0, 0.2, -0.2];
    const curve = gaussianKde(values, { samples: 200, extent: [-5, 5] });
    const dx = 10 / 199;
    const area = curve.reduce((sum, p) => sum + p.y * dx, 0);
    expect(area).toBeGreaterThan(0.97);
    expect(area).toBeLessThan(1.03);
    const peak = curve.reduce(
      (best, p) => (p.y > best.y ? p : best),
      curve[0] as { x: number; y: number },
    );
    expect(Math.abs(peak.x)).toBeLessThan(0.15);
  });

  it("is empty for no data and uses Silverman's bandwidth", () => {
    expect(gaussianKde([])).toEqual([]);
    const bw = silvermanBandwidth([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(bw).toBeGreaterThan(1);
    expect(bw).toBeLessThan(3);
    expect(silvermanBandwidth([3, 3, 3])).toBe(1);
  });
});

describe("violinCurve", () => {
  it("spans the whiskers plus a bandwidth, not the outliers", () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 90];
    const stats = boxStats(values);
    const curve = violinCurve(values, stats);
    expect(curve.length).toBeGreaterThan(10);
    const first = curve[0] as { x: number };
    const last = curve[curve.length - 1] as { x: number };
    expect(first.x).toBeLessThan(10);
    expect(last.x).toBeGreaterThan(20);
    expect(last.x).toBeLessThan(60);
    expect(violinCurve([], stats)).toEqual([]);
  });
});

describe("resolveCells", () => {
  it("prefers precomputed stats, summarises samples, and leaves gaps null", () => {
    const stats = { min: 0, q1: 1, median: 2, q3: 3, max: 4 };
    const cells = resolveCells(
      [
        {
          name: "a",
          stats: [stats],
          values: [
            [9, 9, 9],
            [1, 2, 3],
          ],
        },
        { name: "b", values: [[1, 2, 3]] },
      ],
      2,
      "tukey",
    );
    expect(cells[0]?.[0]?.stats).toBe(stats);
    expect(cells[0]?.[0]?.values).toEqual([9, 9, 9]);
    expect(cells[0]?.[1]?.stats.median).toBe(2);
    expect(cells[1]?.[0]?.stats.median).toBe(2);
    expect(cells[1]?.[1]).toBeNull();
  });
});

describe("thinRows", () => {
  it("keeps every row when they fit and strides when they do not", () => {
    expect(thinRows(4, 20, 16)).toEqual([true, true, true, true]);
    const keep = thinRows(10, 8, 16);
    expect(keep[0]).toBe(true);
    expect(keep[9]).toBe(true);
    expect(keep.filter(Boolean).length).toBeLessThan(10);
  });

  it("never lets the last label collide with its neighbour", () => {
    const keep = thinRows(7, 6, 16);
    expect(keep[6]).toBe(true);
    expect(keep[5]).toBe(false);
    expect(keep[4]).toBe(false);
  });
});
