import { describe, expect, it } from "vitest";
import { cellLines, combineFloor, narrowestWidthForLines } from "./headerFloor";

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
