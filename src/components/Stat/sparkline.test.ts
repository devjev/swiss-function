import { describe, expect, it } from "vitest";
import { sparklineBars, sparklinePoints, sparklinePointsAttr } from "./sparkline";

describe("sparklinePoints", () => {
  it("returns nothing for an empty series", () => {
    expect(sparklinePoints([])).toEqual([]);
  });

  it("maps the max to the top and the min to the bottom (inside padding)", () => {
    const pts = sparklinePoints([0, 10], 100, 30, 2);
    expect(pts).toHaveLength(2);
    // First value is the min -> bottom (height - pad); second is max -> top (pad).
    expect(pts[0]?.[1]).toBeCloseTo(28); // 30 - 2
    expect(pts[1]?.[1]).toBeCloseTo(2);
  });

  it("spreads x evenly across the inner width", () => {
    const pts = sparklinePoints([1, 2, 3], 100, 30, 2);
    expect(pts.map((p) => p[0])).toEqual([2, 50, 98]);
  });

  it("centers a flat series on the vertical middle", () => {
    const pts = sparklinePoints([5, 5, 5], 100, 30, 2);
    for (const [, y] of pts) expect(y).toBeCloseTo(15);
  });

  it("places a single point at the horizontal center", () => {
    const pts = sparklinePoints([7], 100, 30, 2);
    expect(pts).toEqual([[50, 15]]);
  });

  it("serializes to an SVG points attribute", () => {
    expect(sparklinePointsAttr([0, 10], 100, 30, 2)).toBe("2,28 98,2");
  });

  it("drops non-finite points instead of blanking the line", () => {
    // The NaN is filtered; the remaining two points map min->bottom, max->top.
    expect(sparklinePoints([Number.NaN, 0, 10], 100, 30, 2)).toEqual([
      [2, 28],
      [98, 2],
    ]);
    expect(sparklinePoints([1, 2, Number.POSITIVE_INFINITY], 100, 30, 2)).toHaveLength(2);
  });
});

describe("sparklineBars", () => {
  it("returns nothing for an empty series", () => {
    expect(sparklineBars([])).toEqual([]);
  });

  it("tallest bar for the max, floored bar for the min", () => {
    const bars = sparklineBars([0, 10], 100, 30, 1, 1);
    expect(bars).toHaveLength(2);
    expect(bars[0]?.height).toBe(1); // min floored to minBar
    expect(bars[1]?.height).toBe(30); // max -> full height
    // y is the top of the bar (baseline at height).
    expect(bars[1]?.y).toBe(0);
    expect(bars[0]?.y).toBe(29);
  });

  it("splits the width into even slots with a gap", () => {
    const bars = sparklineBars([1, 2, 3, 4], 100, 30, 2);
    expect(bars).toHaveLength(4);
    for (const b of bars) expect(b.width).toBeCloseTo(23); // 25 slot - 2 gap
    expect(bars.map((b) => b.x)).toEqual([1, 26, 51, 76]);
  });

  it("measures a non-negative series from a zero baseline (no truncated bars)", () => {
    // 100..102 are near-equal from zero: all bars near full height, NOT [1,15,30].
    const bars = sparklineBars([100, 101, 102], 100, 30);
    expect(bars.map((b) => b.height)).toEqual([
      Math.round((100 / 102) * 30 * 100) / 100,
      Math.round((101 / 102) * 30 * 100) / 100,
      30,
    ]);
    // And the shape is distinct from a small series scaled the same way.
    const small = sparklineBars([2, 4, 6], 100, 30);
    expect(small.map((b) => b.height)).not.toEqual(bars.map((b) => b.height));
  });

  it("a series that dips below zero measures from its own minimum", () => {
    const bars = sparklineBars([-5, 0, 5], 100, 30, 1, 1);
    expect(bars[0]?.height).toBe(1); // the most-negative floored to a baseline tick
    expect(bars[2]?.height).toBe(30); // the max
  });

  it("drops non-finite bars", () => {
    expect(sparklineBars([Number.NaN, 1, 2], 100, 30)).toHaveLength(2);
  });
});
