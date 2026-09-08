import { describe, expect, it } from "vitest";
import {
  bandColor,
  bandLevel,
  bandPath,
  isSortedByX,
  nearestIndex,
  resolveBandRanges,
  resolveBaseline,
  rowMaxAbs,
} from "./HorizonChart.math";

const row = (ys: number[]) => ys.map((y, i) => ({ x: i, y }));

describe("resolveBaseline", () => {
  it("returns a fixed number, the mean, or the first value", () => {
    const data = row([2, 4, 6]);
    expect(resolveBaseline(data, 1.5)).toBe(1.5);
    expect(resolveBaseline(data, "mean")).toBe(4);
    expect(resolveBaseline(data, "first")).toBe(2);
  });

  it("folds an empty row around 0", () => {
    expect(resolveBaseline([], "mean")).toBe(0);
    expect(resolveBaseline([], "first")).toBe(0);
  });
});

describe("rowMaxAbs / resolveBandRanges", () => {
  it("measures the largest deviation from the baseline", () => {
    expect(rowMaxAbs(row([1, -3, 2]), 0)).toBe(3);
    expect(rowMaxAbs(row([1, -3, 2]), 2)).toBe(5);
    expect(rowMaxAbs([], 0)).toBe(0);
  });

  it("shares the largest row range, or keeps each row's own", () => {
    expect(resolveBandRanges([1, 3, 2], true)).toEqual([3, 3, 3]);
    expect(resolveBandRanges([1, 3, 2], false)).toEqual([1, 3, 2]);
  });

  it("reads an explicit domain as its larger magnitude", () => {
    expect(resolveBandRanges([1, 3], true, [-5, 2])).toEqual([5, 5]);
    expect(resolveBandRanges([1, 3], false, [-1, 4])).toEqual([4, 4]);
  });

  it("never divides by zero", () => {
    expect(resolveBandRanges([0, 0], true)).toEqual([1, 1]);
    expect(resolveBandRanges([0, 2], false)).toEqual([1, 2]);
    expect(resolveBandRanges([2], true, [0, 0])).toEqual([1]);
  });
});

describe("bandLevel", () => {
  it("fills each band with the slice of the value inside it, clamped", () => {
    expect(bandLevel(0.5, 0, 1)).toBe(0.5);
    expect(bandLevel(1.5, 0, 1)).toBe(1);
    expect(bandLevel(1.5, 1, 1)).toBe(0.5);
    expect(bandLevel(1.5, 2, 1)).toBe(0);
    expect(bandLevel(3, 2, 1)).toBe(1);
  });

  it("is 0 for a non-positive span", () => {
    expect(bandLevel(2, 0, 0)).toBe(0);
  });
});

describe("bandPath", () => {
  const xs = [0, 10, 20];

  it("rises from the row bottom for positive values", () => {
    // Row 100..120, band span 2: 1 fills half of band 0, 3 fills band 0 fully.
    expect(bandPath(xs, [0, 1, 3], 1, 0, 2, 100, 20, "mirror")).toBe(
      "M0 120L0 120L10 110L20 100L20 120Z",
    );
  });

  it("returns an empty path when no value reaches the band", () => {
    expect(bandPath(xs, [0, 1, 1.5], 1, 1, 2, 100, 20, "mirror")).toBe("");
    expect(bandPath(xs, [0, 1, 3], -1, 0, 2, 100, 20, "mirror")).toBe("");
    expect(bandPath([], [], 1, 0, 2, 0, 20, "mirror")).toBe("");
  });

  it("mirrors negative values upward from the bottom, or hangs them from the top", () => {
    expect(bandPath(xs, [0, -1, -3], -1, 0, 2, 100, 20, "mirror")).toBe(
      "M0 120L0 120L10 110L20 100L20 120Z",
    );
    expect(bandPath(xs, [0, -1, -3], -1, 0, 2, 100, 20, "offset")).toBe(
      "M0 100L0 100L10 110L20 120L20 100Z",
    );
  });

  it("only draws the slice above the band's floor", () => {
    expect(bandPath(xs, [0, 3, 4], 1, 1, 2, 0, 20, "mirror")).toBe("M0 20L0 20L10 10L20 0L20 20Z");
  });
});

describe("bandColor", () => {
  it("ramps from a pale mix to the full hue", () => {
    expect(bandColor("red", 0, 1)).toBe("red");
    expect(bandColor("red", 0, 3)).toBe("color-mix(in srgb, red 55%, var(--sf-color-bg))");
    expect(bandColor("red", 1, 3)).toBe("color-mix(in srgb, red 78%, var(--sf-color-bg))");
    expect(bandColor("red", 2, 3)).toBe("red");
  });
});

describe("nearestIndex", () => {
  const data = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ];

  it("finds the nearest datum, rounding ties down", () => {
    expect(nearestIndex(data, -5)).toBe(0);
    expect(nearestIndex(data, 4)).toBe(0);
    expect(nearestIndex(data, 5)).toBe(0);
    expect(nearestIndex(data, 6)).toBe(1);
    expect(nearestIndex(data, 16)).toBe(2);
    expect(nearestIndex(data, 99)).toBe(2);
  });

  it("works on dates and returns -1 for an empty row", () => {
    const dated = [
      { x: new Date(2026, 0, 1), y: 0 },
      { x: new Date(2026, 0, 3), y: 0 },
    ];
    expect(nearestIndex(dated, new Date(2026, 0, 2, 20).getTime())).toBe(1);
    expect(nearestIndex([], 0)).toBe(-1);
  });
});

describe("isSortedByX", () => {
  it("accepts non-decreasing x and rejects a step back", () => {
    expect(isSortedByX(row([1, 2, 3]))).toBe(true);
    expect(
      isSortedByX([
        { x: 2, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe(false);
    expect(isSortedByX([])).toBe(true);
  });
});
