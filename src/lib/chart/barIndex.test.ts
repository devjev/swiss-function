import { describe, expect, it } from "vitest";
import { indexToX, xToIndex } from "./barIndex";

// Irregular timestamps (a weekend gap) — the whole point of bar-index space.
const BARS = [
  { x: new Date(2026, 6, 2) }, // Thu, index 0
  { x: new Date(2026, 6, 3) }, // Fri, index 1
  { x: new Date(2026, 6, 6) }, // Mon (gap), index 2
  { x: new Date(2026, 6, 7) }, // Tue, index 3
];

describe("xToIndex", () => {
  it("maps bar timestamps to their exact indices", () => {
    expect(xToIndex(BARS, new Date(2026, 6, 2))).toBe(0);
    expect(xToIndex(BARS, new Date(2026, 6, 6))).toBe(2);
  });

  it("interpolates inside gaps", () => {
    // Sat Jul 4 is 1/3 of the way from Fri to Mon.
    expect(xToIndex(BARS, new Date(2026, 6, 4))).toBeCloseTo(1 + 1 / 3, 5);
  });

  it("clamps outside the data", () => {
    expect(xToIndex(BARS, new Date(2026, 5, 1))).toBe(0);
    expect(xToIndex(BARS, new Date(2026, 7, 1))).toBe(3);
  });

  it("handles empty and single-bar inputs", () => {
    expect(xToIndex([], 5)).toBe(0);
    expect(xToIndex([{ x: 10 }], 99)).toBe(0);
  });
});

describe("indexToX", () => {
  it("round-trips with xToIndex on irregular timestamps", () => {
    for (const d of [new Date(2026, 6, 3), new Date(2026, 6, 4, 12), new Date(2026, 6, 6, 6)]) {
      const back = indexToX(BARS, xToIndex(BARS, d)) as Date;
      expect(back.getTime()).toBeCloseTo(d.getTime(), -3);
    }
  });

  it("returns Dates for dated bars and numbers for numeric bars", () => {
    expect(indexToX(BARS, 1.5)).toBeInstanceOf(Date);
    expect(indexToX([{ x: 10 }, { x: 20 }], 0.5)).toBe(15);
  });

  it("clamps at both ends", () => {
    expect((indexToX(BARS, -3) as Date).getTime()).toBe(new Date(2026, 6, 2).getTime());
    expect((indexToX(BARS, 99) as Date).getTime()).toBe(new Date(2026, 6, 7).getTime());
    expect(indexToX([], 5)).toBe(0);
  });

  it("zero-span neighbors (duplicate x) stay stable", () => {
    const dup = [{ x: 10 }, { x: 10 }, { x: 20 }];
    expect(indexToX(dup, 0.5)).toBe(10);
    expect(xToIndex(dup, 10)).toBe(0);
  });
});
