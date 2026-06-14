import { describe, expect, it } from "vitest";
import { dragDelta } from "./usePointerDrag";

describe("dragDelta", () => {
  it("reports zero delta at the origin", () => {
    expect(dragDelta({ x: 10, y: 20 }, { x: 10, y: 20 })).toEqual({
      dx: 0,
      dy: 0,
      x: 10,
      y: 20,
    });
  });

  it("reports positive deltas moving right/down", () => {
    expect(dragDelta({ x: 100, y: 100 }, { x: 130, y: 145 })).toEqual({
      dx: 30,
      dy: 45,
      x: 130,
      y: 145,
    });
  });

  it("reports negative deltas moving left/up", () => {
    expect(dragDelta({ x: 100, y: 100 }, { x: 80, y: 60 })).toEqual({
      dx: -20,
      dy: -40,
      x: 80,
      y: 60,
    });
  });

  it("always carries the absolute client coordinates of the current point", () => {
    const d = dragDelta({ x: 0, y: 0 }, { x: 12.5, y: -7.5 });
    expect(d.x).toBe(12.5);
    expect(d.y).toBe(-7.5);
  });
});
