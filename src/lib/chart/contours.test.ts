import { describe, expect, it } from "vitest";
import { contourLevels, marchingSquares } from "./contours";

describe("contourLevels", () => {
  it("spaces N levels strictly inside the range", () => {
    expect(contourLevels(0, 10, 1)).toEqual([5]);
    expect(contourLevels(0, 4, 3)).toEqual([1, 2, 3]);
  });
  it("filters an explicit list to the open range", () => {
    expect(contourLevels(0, 10, [-1, 0, 5, 10, 12])).toEqual([5]);
  });
});

describe("marchingSquares", () => {
  it("returns no segments when the level is outside the data", () => {
    const z = [
      [0, 0],
      [0, 0],
    ];
    expect(marchingSquares(z, 5)).toEqual([]);
  });

  it("cuts a single cell where one corner is above the level", () => {
    // Only the top-left corner is high → one segment across the L and T edges.
    const z = [
      [10, 0],
      [0, 0],
    ];
    const segs = marchingSquares(z, 5);
    expect(segs).toHaveLength(1);
    const s = segs[0];
    if (!s) throw new Error("expected a segment");
    // Crossing at the midpoint of the top edge (i=0..1) and left edge (j=0..1).
    const pts = [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ].sort();
    expect(pts).toEqual([
      [0, 0.5],
      [0.5, 0],
    ]);
  });

  it("draws a straight iso-line across a left/right split", () => {
    // Left column high, right column low → vertical contour through both cells.
    const z = [
      [10, 0],
      [10, 0],
    ];
    const segs = marchingSquares(z, 5);
    expect(segs).toHaveLength(1);
    const s = segs[0];
    if (!s) throw new Error("expected a segment");
    // Case 3 (tl,bl high → L,R... here tl,tr? ) crosses top and bottom at x=0.5.
    expect(Math.min(s.x1, s.x2)).toBeCloseTo(0.5);
    expect(Math.max(s.x1, s.x2)).toBeCloseTo(0.5);
  });
});
