import { describe, expect, it } from "vitest";
import { lttb, minMaxDownsample, sliceRange } from "./downsample";

interface Point {
  x: number;
  y: number;
}

const getX = (p: Point) => p.x;
const getY = (p: Point) => p.y;

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeries(n: number, seed: number): Point[] {
  const rand = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => ({ x: i, y: rand() * 1000 }));
}

describe("sliceRange", () => {
  const data = makeSeries(10, 1);

  it("finds exact boundaries and widens by one point on each side", () => {
    expect(sliceRange(data, getX, 2, 5)).toEqual([1, 7]);
  });

  it("widens ranges whose bounds fall between points", () => {
    expect(sliceRange(data, getX, 2.5, 4.5)).toEqual([2, 6]);
  });

  it("clamps widening at the data extremes", () => {
    expect(sliceRange(data, getX, 0, 9)).toEqual([0, 10]);
  });

  it("returns [0, 0] for empty data", () => {
    expect(sliceRange([], getX, 0, 10)).toEqual([0, 0]);
  });

  it("handles a range fully left of the data", () => {
    expect(sliceRange(data, getX, -10, -5)).toEqual([0, 1]);
  });

  it("handles a range fully right of the data", () => {
    expect(sliceRange(data, getX, 20, 30)).toEqual([9, 10]);
  });
});

describe("minMaxDownsample", () => {
  const data = makeSeries(10_000, 2);
  const out = minMaxDownsample(data, getX, getY, 100);

  it("keeps the global min-y and max-y points", () => {
    let min = data[0] as Point;
    let max = data[0] as Point;
    for (const p of data) {
      if (p.y < min.y) min = p;
      if (p.y > max.y) max = p;
    }
    expect(out).toContain(min);
    expect(out).toContain(max);
  });

  it("keeps the first and last points", () => {
    expect(out[0]).toBe(data[0]);
    expect(out[out.length - 1]).toBe(data[data.length - 1]);
  });

  it("returns a subset of the input, sorted by x", () => {
    const members = new Set(data);
    for (const p of out) expect(members.has(p)).toBe(true);
    for (let i = 1; i < out.length; i++) {
      expect((out[i] as Point).x).toBeGreaterThan((out[i - 1] as Point).x);
    }
  });

  it("actually reduces the point count", () => {
    expect(out.length).toBeLessThan(data.length);
    expect(out.length).toBeLessThanOrEqual(400);
  });

  it("returns the same array reference when already small enough", () => {
    const small = makeSeries(400, 3);
    expect(minMaxDownsample(small, getX, getY, 100)).toBe(small);
  });

  it("returns the same array reference for non-positive bucket counts", () => {
    expect(minMaxDownsample(data, getX, getY, 0)).toBe(data);
  });

  it("returns the same array reference when all x are equal", () => {
    const flat = Array.from({ length: 1000 }, (_, i) => ({ x: 5, y: i }));
    expect(minMaxDownsample(flat, getX, getY, 100)).toBe(flat);
  });

  it("preserves a spike in a 10k sine series decimated to 100 buckets", () => {
    const sine: Point[] = Array.from({ length: 10_000 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 50),
    }));
    const spike = { x: 5000.5, y: 100 };
    sine.splice(5001, 0, spike);
    const decimated = minMaxDownsample(sine, getX, getY, 100);
    expect(decimated).toContain(spike);
  });
});

describe("lttb", () => {
  const data = makeSeries(1000, 4);
  const out = lttb(data, getX, getY, 100);

  it("returns exactly `target` points when n > target", () => {
    expect(out.length).toBe(100);
  });

  it("keeps the first and last points", () => {
    expect(out[0]).toBe(data[0]);
    expect(out[out.length - 1]).toBe(data[data.length - 1]);
  });

  it("returns points with strictly increasing x", () => {
    for (let i = 1; i < out.length; i++) {
      expect((out[i] as Point).x).toBeGreaterThan((out[i - 1] as Point).x);
    }
  });

  it("returns the same array reference when n <= target", () => {
    const small = makeSeries(50, 5);
    expect(lttb(small, getX, getY, 100)).toBe(small);
    expect(lttb(small, getX, getY, 50)).toBe(small);
  });

  it("returns first and last for target < 3", () => {
    expect(lttb(data, getX, getY, 2)).toEqual([data[0], data[data.length - 1]]);
  });
});
