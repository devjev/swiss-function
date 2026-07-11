import { describe, expect, it } from "vitest";
import { snapEdges, snapFraction, snapHairline } from "./pixelSnap";

describe("snapHairline", () => {
  it("centers odd stroke widths on half-pixels", () => {
    expect(snapHairline(10)).toBe(10.5);
    expect(snapHairline(10.3)).toBe(10.5);
    expect(snapHairline(10.6, 1)).toBe(10.5);
    expect(snapHairline(11.2, 3)).toBe(11.5);
  });

  it("centers even stroke widths on integers", () => {
    expect(snapHairline(10.3, 2)).toBe(10);
    expect(snapHairline(10.6, 2)).toBe(11);
    expect(snapHairline(-3.4, 4)).toBe(-3);
  });

  it("defaults to a 1px stroke", () => {
    expect(snapHairline(7.1)).toBe(snapHairline(7.1, 1));
  });

  it("is idempotent for both parities", () => {
    for (const px of [0, 0.4, 10.3, 10.5, 10.6, -2.7, 1234.49]) {
      for (const width of [1, 2, 3, 4]) {
        const once = snapHairline(px, width);
        expect(snapHairline(once, width)).toBe(once);
      }
    }
  });

  it("passes NaN through instead of throwing", () => {
    expect(snapHairline(Number.NaN)).toBeNaN();
    expect(snapHairline(Number.NaN, 2)).toBeNaN();
  });
});

describe("snapFraction", () => {
  it("rounds to the nearest integer pixel of the length", () => {
    expect(snapFraction(0.333, 100)).toBe(0.33);
    expect(snapFraction(0.336, 100)).toBe(0.34);
    expect(snapFraction(0.5, 100)).toBe(0.5);
  });

  it("round-trips: snapping a snapped fraction is a no-op", () => {
    for (const lengthPx of [3, 7, 100, 641]) {
      for (const fraction of [0, 0.1, 1 / 3, 0.5, 0.999, 1]) {
        const once = snapFraction(fraction, lengthPx);
        expect(snapFraction(once, lengthPx)).toBe(once);
      }
    }
  });

  it("clamps the fraction to [0,1] before snapping", () => {
    expect(snapFraction(-0.2, 100)).toBe(0);
    expect(snapFraction(1.4, 100)).toBe(1);
  });

  it("returns the input unchanged when there is no positive length", () => {
    expect(snapFraction(0.337, 0)).toBe(0.337);
    expect(snapFraction(1.4, -50)).toBe(1.4);
    expect(snapFraction(0.5, Number.NaN)).toBe(0.5);
  });

  it("passes a NaN fraction through", () => {
    expect(snapFraction(Number.NaN, 100)).toBeNaN();
  });
});

describe("snapEdges", () => {
  it("rounds both edges to integers", () => {
    expect(snapEdges(3.6, 10.4)).toEqual({ start: 4, end: 10 });
  });

  it("gives adjacent cells the exact same shared edge", () => {
    // Cell A ends where cell B starts — both must snap that coordinate
    // identically, or the seam gaps / double-covers.
    const shared = 10.4;
    const a = snapEdges(3.6, shared);
    const b = snapEdges(shared, 20.2);
    expect(a.end).toBe(b.start);
    expect(a.end).toBe(10);
  });

  it("enforces a minimum 1px extent by extending end", () => {
    expect(snapEdges(5.2, 5.4)).toEqual({ start: 5, end: 6 });
    expect(snapEdges(7, 7)).toEqual({ start: 7, end: 8 });
    // Inverted input collapses to the 1px floor too.
    expect(snapEdges(9.6, 8.2)).toEqual({ start: 10, end: 11 });
  });

  it("is idempotent", () => {
    for (const [start, end] of [
      [3.6, 10.4],
      [5.2, 5.4],
      [-2.7, -1.9],
    ] as const) {
      const once = snapEdges(start, end);
      expect(snapEdges(once.start, once.end)).toEqual(once);
    }
  });

  it("passes NaN edges through", () => {
    const snapped = snapEdges(Number.NaN, 5.4);
    expect(snapped.start).toBeNaN();
    // The finite edge still snaps; the NaN width can't trigger the 1px floor.
    expect(snapped.end).toBe(5);
    expect(snapEdges(Number.NaN, Number.NaN).end).toBeNaN();
  });
});
