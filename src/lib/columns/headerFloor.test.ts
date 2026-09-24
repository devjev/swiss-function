import { describe, expect, it } from "vitest";
import {
  cellLines,
  combineFloor,
  groupFloorFor,
  narrowestWidthForLines,
  raiseForGroups,
} from "./headerFloor";

describe("combineFloor", () => {
  it("keeps the declared minimum when nothing is measured", () => {
    expect(combineFloor(72, undefined)).toBe(72);
    expect(combineFloor(72, Number.NaN)).toBe(72);
  });
  it("raises the floor to a larger measured need, never lowers it", () => {
    expect(combineFloor(72, 137)).toBe(137);
    expect(combineFloor(240, 137)).toBe(240);
  });
});

describe("narrowestWidthForLines", () => {
  // A word-wrap model: words of the given widths, one space of 4px between
  // them, greedy line breaking. Monotone in the width, like a real layout.
  const words = [40, 30, 55, 20, 35]; // "Quarterly revenue by region" style
  const space = 4;
  const countLines = (width: number): number => {
    let lines = 1;
    let line = 0;
    for (const w of words) {
      const next = line === 0 ? w : line + space + w;
      if (next <= width || line === 0) line = next;
      else {
        lines += 1;
        line = w;
      }
    }
    return lines;
  };
  const lo = Math.max(...words); // min-content: the longest word
  const hi = words.reduce((a, b) => a + b) + space * (words.length - 1); // max-content

  it("returns the one-line width for a single line, without searching", () => {
    let calls = 0;
    expect(
      narrowestWidthForLines(
        (w) => {
          calls += 1;
          return countLines(w);
        },
        lo,
        hi,
        1,
      ),
    ).toBe(Math.ceil(hi));
    expect(calls).toBe(0);
  });

  it("finds the narrowest width that still fits in N lines", () => {
    for (const n of [2, 3, 4]) {
      const w = narrowestWidthForLines(countLines, lo, hi, n);
      expect(countLines(w)).toBeLessThanOrEqual(n);
      expect(countLines(w - 1)).toBeGreaterThan(n);
    }
  });

  it("never goes below the longest word when it already fits in N lines", () => {
    // Five words, ten lines allowed: the longest word alone is the answer.
    expect(narrowestWidthForLines(countLines, lo, hi, 10)).toBe(lo);
  });

  it("rounds a fractional longest word up, so the box is never a hair too narrow", () => {
    expect(narrowestWidthForLines(countLines, 55.4, hi, 10)).toBe(56);
  });

  it("rounds a fractional one-line width up so nothing clips", () => {
    expect(narrowestWidthForLines(() => 1, 10.2, 137.4, 1)).toBe(138);
  });
});

describe("cellLines", () => {
  const unit = 24;
  it("derives the row's line count from its height and the leading", () => {
    expect(cellLines(36, 24, unit / 2)).toBe(1);
    expect(cellLines(48, 24, unit / 2)).toBe(1);
    expect(cellLines(60, 24, unit / 2)).toBe(2);
    expect(cellLines(84, 24, unit / 2)).toBe(3);
  });
  it("never reports fewer than one line", () => {
    expect(cellLines(10, 24, unit / 2)).toBe(1);
    expect(cellLines(36, 0, unit / 2)).toBe(1);
  });
});

describe("groupFloorFor", () => {
  const groups = [
    { leafIndices: [0, 1], need: 300 }, // a group over the first two leaves
    { leafIndices: [0, 1, 2, 3], need: 500 }, // its parent over four
  ];
  const widths = [150, 150, 100, 100];
  it("is zero for a leaf no group constrains", () => {
    expect(groupFloorFor([2], widths, [{ leafIndices: [0, 1], need: 300 }])).toBe(0);
  });
  it("gives one leaf the group's need minus its siblings", () => {
    // Inner group: 300 - 150 = 150; outer: 500 - 350 = 150.
    expect(groupFloorFor([0], widths, groups)).toBe(150);
    // Widen a sibling and the floor drops.
    expect(groupFloorFor([0], [150, 200, 100, 100], groups)).toBe(100);
  });
  it("shares the need among several targets and takes the binding group", () => {
    // Both inner leaves move: 300 / 2 = 150; outer: (500 - 200) / 2 = 150.
    expect(groupFloorFor([0, 1], widths, groups)).toBe(150);
    // Outer binds when the inner group is roomy.
    expect(groupFloorFor([0, 1], widths, [{ leafIndices: [0, 1, 2, 3], need: 600 }])).toBe(200);
  });
});

describe("raiseForGroups", () => {
  it("shares a group's deficit among the fitted leaves it holds", () => {
    const widths = [60, 60, 100];
    raiseForGroups(widths, new Set([0, 1]), [{ leafIndices: [0, 1], need: 150 }]);
    expect(widths).toEqual([75, 75, 100]);
  });
  it("leaves a satisfied group and unfitted leaves alone", () => {
    const widths = [60, 60, 100];
    raiseForGroups(widths, new Set([2]), [{ leafIndices: [0, 1], need: 150 }]);
    expect(widths).toEqual([60, 60, 100]);
  });
});
