import { describe, expect, it } from "vitest";
import {
  autoBinCount,
  binValues,
  cumulative,
  densityScale,
  extent,
  gaussianKde,
  isUniform,
  linspace,
  MAX_AUTO_BINS,
  niceThresholds,
  normalizeBin,
  normalizeThresholds,
  quantileSorted,
  silvermanBandwidth,
} from "./Histogram.math";

/** Deterministic PRNG (mulberry32), as the stories and benches use. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(n: number, seed: number): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rand() || 1e-12;
    const v = rand();
    out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
}

describe("extent / quantileSorted", () => {
  it("skips non-finite values and reports null for an empty sample", () => {
    expect(extent([3, Number.NaN, -1, Number.POSITIVE_INFINITY, 7])).toEqual([-1, 7]);
    expect(extent([])).toBeNull();
    expect(extent([Number.NaN])).toBeNull();
  });

  it("interpolates quantiles linearly", () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantileSorted([9], 0.9)).toBe(9);
  });
});

describe("autoBinCount", () => {
  it("uses Freedman-Diaconis for a spread sample and grows with n", () => {
    const small = autoBinCount(normalSample(200, 1));
    const large = autoBinCount(normalSample(5000, 1));
    expect(small).toBeGreaterThan(5);
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThanOrEqual(MAX_AUTO_BINS);
  });

  it("falls back to Sturges when the IQR is zero", () => {
    // Half the values are identical: IQR 0, but a range remains.
    const values = [...Array.from({ length: 60 }, () => 5), 1, 9];
    expect(autoBinCount(values)).toBe(Math.ceil(Math.log2(62) + 1));
  });

  it("is 1 for degenerate samples", () => {
    expect(autoBinCount([])).toBe(1);
    expect(autoBinCount([4])).toBe(1);
    expect(autoBinCount([4, 4, 4])).toBe(1);
  });
});

describe("niceThresholds / normalizeThresholds / isUniform", () => {
  it("lands the edges on round numbers spanning the range", () => {
    const edges = niceThresholds(0.3, 9.7, 10);
    expect(edges[0]).toBeLessThanOrEqual(0.3);
    expect(edges[edges.length - 1]).toBeGreaterThanOrEqual(9.7);
    expect(isUniform(edges)).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(8);
    expect(edges.length).toBeLessThanOrEqual(14);
  });

  it("pads a zero-width range into a real bin", () => {
    const edges = niceThresholds(5, 5, 4);
    expect(edges.length).toBeGreaterThanOrEqual(2);
    expect(edges[0]).toBeLessThan(5);
    expect(edges[edges.length - 1]).toBeGreaterThan(5);
  });

  it("cleans explicit thresholds: sorted, unique, finite", () => {
    expect(normalizeThresholds([10, 0, Number.NaN, 5, 5, 20])).toEqual([0, 5, 10, 20]);
    expect(isUniform([0, 5, 10, 20])).toBe(false);
  });
});

describe("binValues", () => {
  it("counts into half-open bins with a closed last bin and drops out-of-range values", () => {
    const bins = binValues([0, 1, 9.99, 10, 15, 20, 25, -1, 30], [0, 10, 20]);
    expect(bins).toEqual([
      { x0: 0, x1: 10, count: 3 },
      { x0: 10, x1: 20, count: 3 },
    ]);
  });

  it("agrees between the uniform fast path and the binary search", () => {
    const values = normalSample(3000, 3).map((v) => v * 10);
    const uniform = binValues(values, [-40, -20, 0, 20, 40]);
    const irregular = binValues(values, [-40, -20, 0, 20, 40 + 1e-7]);
    expect(irregular.map((b) => b.count)).toEqual(uniform.map((b) => b.count));
    expect(isUniform([-40, -20, 0, 20, 40 + 1e-7])).toBe(false);
  });

  it("returns no bins for fewer than two edges", () => {
    expect(binValues([1, 2], [1])).toEqual([]);
  });

  it("bins 100k values in one pass", () => {
    const values = normalSample(100_000, 5);
    const edges = niceThresholds(-5, 5, 40);
    const bins = binValues(values, edges);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(values.filter((v) => v >= -5 && v <= 5).length);
  });
});

describe("normalizeBin / cumulative / densityScale", () => {
  const bins = [
    { x0: 0, x1: 2, count: 2 },
    { x0: 2, x1: 4, count: 6 },
    { x0: 4, x1: 6, count: 2 },
  ];

  it("normalizes to count, percent and density", () => {
    const b = bins[1] as (typeof bins)[number];
    expect(normalizeBin(b, "count", 10)).toBe(6);
    expect(normalizeBin(b, "percent", 10)).toBe(60);
    expect(normalizeBin(b, "density", 10)).toBeCloseTo(0.3);
    // Density integrates to 1 across the bins.
    const area = bins.reduce((s, x) => s + normalizeBin(x, "density", 10) * (x.x1 - x.x0), 0);
    expect(area).toBeCloseTo(1);
  });

  it("accumulates in the unit of the mode", () => {
    expect(cumulative(bins, "count", 10)).toEqual([2, 8, 10]);
    expect(cumulative(bins, "percent", 10)).toEqual([20, 80, 100]);
    expect(cumulative(bins, "density", 10)).toEqual([0.2, 0.8, 1]);
  });

  it("scales a density onto the bar unit", () => {
    expect(densityScale(bins, "count", 10)).toBe(20);
    expect(densityScale(bins, "percent", 10)).toBe(200);
    expect(densityScale(bins, "density", 10)).toBe(1);
  });
});

describe("gaussianKde / silvermanBandwidth / linspace", () => {
  it("integrates to about 1 and peaks near the mean of a normal sample", () => {
    const values = normalSample(2000, 11);
    const grid = linspace(-5, 5, 400);
    const h = silvermanBandwidth(values);
    expect(h).toBeGreaterThan(0.1);
    expect(h).toBeLessThan(0.6);
    const density = gaussianKde(values, grid, h);
    const dx = 10 / 400;
    const area = density.reduce((s, d) => s + d * dx, 0);
    expect(area).toBeGreaterThan(0.97);
    expect(area).toBeLessThan(1.03);
    const peakAt = grid[density.indexOf(Math.max(...density))] as number;
    expect(Math.abs(peakAt)).toBeLessThan(0.3);
  });

  it("matches the exact estimate closely when it pre-bins a large sample", () => {
    const values = normalSample(6000, 13);
    const grid = linspace(-4, 4, 80);
    const h = 0.3;
    const binned = gaussianKde(values, grid, h);
    const exact = gaussianKde(values.slice(0, 4000), grid, h);
    for (let i = 0; i < grid.length; i++) {
      expect(Math.abs((binned[i] as number) - (exact[i] as number))).toBeLessThan(0.05);
    }
  });

  it("handles empty input and a flat sample", () => {
    expect(gaussianKde([], [0, 1], 1)).toEqual([0, 0]);
    expect(silvermanBandwidth([2, 2, 2, 2])).toBe(1);
    expect(silvermanBandwidth([1])).toBe(1);
    expect(linspace(0, 1, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
