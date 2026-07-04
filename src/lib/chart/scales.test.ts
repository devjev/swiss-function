import { describe, expect, it } from "vitest";
import { invertLinear, linearScale } from "./scales";

describe("invertLinear", () => {
  it("round-trips linearScale", () => {
    const scale = linearScale([10, 110], [0, 640]);
    const invert = invertLinear([10, 110], [0, 640]);
    for (const v of [10, 42.5, 110]) {
      expect(invert(scale(v))).toBeCloseTo(v, 9);
    }
  });

  it("handles inverted (y-style) ranges", () => {
    const scale = linearScale([0, 100], [480, 0]);
    const invert = invertLinear([0, 100], [480, 0]);
    expect(invert(480)).toBeCloseTo(0);
    expect(invert(0)).toBeCloseTo(100);
    expect(invert(scale(37))).toBeCloseTo(37, 9);
  });

  it("returns the domain start for a zero-span range", () => {
    expect(invertLinear([5, 15], [100, 100])(123)).toBe(5);
  });
});
