import { describe, expect, it } from "vitest";
import { ditherCells, ditherDots, formatShare, rampStrength } from "./partToWhole";

describe("ramp / dither", () => {
  it("steps the ramp from dark to light and the dots from dense to sparse", () => {
    expect(rampStrength(0, 3)).toBeGreaterThan(rampStrength(1, 3));
    expect(rampStrength(0, 3)).toBeCloseTo(0.88);
    expect(rampStrength(2, 3)).toBeCloseTo(0.24);
    expect(rampStrength(0, 1)).toBe(0.7);
    expect(ditherDots(0, 4)).toBe(15);
    expect(ditherDots(3, 4)).toBe(1);
    expect(ditherDots(0, 1)).toBe(8);
  });

  it("keeps the sparsest step off the page in either theme", () => {
    // 0.24 of the ink still reads against a near-black background; the old
    // 0.14 did not.
    for (const n of [2, 3, 4, 6, 10]) {
      expect(rampStrength(n - 1, n)).toBeGreaterThanOrEqual(0.24);
    }
    expect(rampStrength(3, 4, 0.1)).toBeCloseTo(0.1);
  });

  it("sets as many Bayer cells as dots", () => {
    expect(ditherCells(0)).toHaveLength(0);
    expect(ditherCells(4)).toHaveLength(4);
    expect(ditherCells(16)).toHaveLength(16);
    expect(ditherCells(1)).toEqual([{ x: 0, y: 0 }]);
  });
});

describe("formatShare", () => {
  it("prints whole percents and marks a sliver", () => {
    expect(formatShare(0.4249)).toBe("42%");
    expect(formatShare(0.005)).toBe("<1%");
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(1)).toBe("100%");
  });
});
