import { describe, expect, it } from "vitest";
import {
  angleToValue,
  arcPath,
  clampToSweep,
  pointerAngle,
  polar,
  snapToStep,
  valueToAngle,
} from "./Knob.math";

describe("snapToStep", () => {
  it("rounds to the step grid anchored at min and clamps", () => {
    expect(snapToStep(41.4, 0, 100, 1)).toBe(41);
    expect(snapToStep(41.5, 0, 100, 1)).toBe(42);
    expect(snapToStep(7, 0, 10, 5)).toBe(5);
    expect(snapToStep(-3, 0, 10, 1)).toBe(0);
    expect(snapToStep(14, 0, 10, 1)).toBe(10);
  });

  it("anchors at a non-zero min", () => {
    expect(snapToStep(2.4, 1, 10, 2)).toBe(3);
    expect(snapToStep(-49.6, -50, 50, 1)).toBe(-50);
  });

  it("rounds float noise away for fractional steps", () => {
    expect(snapToStep(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(0.7, 0, 1, 0.25)).toBe(0.75);
  });

  it("only clamps when the step is not positive", () => {
    expect(snapToStep(41.4, 0, 100, 0)).toBe(41.4);
  });
});

describe("valueToAngle / angleToValue", () => {
  it("maps min to the left stop, max to the right stop, the middle to the top", () => {
    expect(valueToAngle(0, 0, 100, 270)).toBe(-135);
    expect(valueToAngle(100, 0, 100, 270)).toBe(135);
    expect(valueToAngle(50, 0, 100, 270)).toBe(0);
  });

  it("clamps values outside the range and tolerates an empty range", () => {
    expect(valueToAngle(150, 0, 100, 270)).toBe(135);
    expect(valueToAngle(5, 5, 5, 270)).toBe(-135);
  });

  it("round-trips through the sweep", () => {
    for (const v of [0, 1, 25, 50, 73, 100]) {
      expect(angleToValue(valueToAngle(v, 0, 100, 270), 0, 100, 270, 1)).toBe(v);
    }
  });

  it("snaps to the step on the way back", () => {
    expect(angleToValue(0, 0, 10, 270, 5)).toBe(5);
    expect(angleToValue(20, 0, 10, 270, 5)).toBe(5);
    expect(angleToValue(70, 0, 10, 270, 5)).toBe(10);
  });
});

describe("clampToSweep", () => {
  it("passes angles inside the sweep through", () => {
    expect(clampToSweep(0, 270)).toBe(0);
    expect(clampToSweep(-135, 270)).toBe(-135);
    expect(clampToSweep(135, 270)).toBe(135);
  });

  it("holds at the nearer stop across the dead zone, split at the bottom", () => {
    expect(clampToSweep(150, 270)).toBe(135);
    expect(clampToSweep(179, 270)).toBe(135);
    expect(clampToSweep(-179, 270)).toBe(-135);
    expect(clampToSweep(-150, 270)).toBe(-135);
  });
});

describe("pointerAngle", () => {
  it("reads 0 up, 90 right, 180 down, -90 left", () => {
    expect(pointerAngle(0, -1)).toBe(0);
    expect(pointerAngle(1, 0)).toBe(90);
    expect(Math.abs(pointerAngle(0, 1))).toBe(180);
    expect(pointerAngle(-1, 0)).toBe(-90);
  });

  it("is 45 at the top-right diagonal", () => {
    expect(pointerAngle(1, -1)).toBeCloseTo(45);
  });
});

describe("polar / arcPath", () => {
  it("places 0 degrees straight up and 90 to the right", () => {
    expect(polar(50, 50, 10, 0)).toEqual({ x: 50, y: 40 });
    const right = polar(50, 50, 10, 90);
    expect(right.x).toBeCloseTo(60);
    expect(right.y).toBeCloseTo(50);
  });

  it("draws a clockwise arc with the large-arc flag past 180 degrees", () => {
    expect(arcPath(50, 50, 10, 0, 90)).toBe("M 50 40 A 10 10 0 0 1 60 50");
    expect(arcPath(50, 50, 10, -135, 135)).toMatch(/A 10 10 0 1 1 /);
  });

  it("is empty for a zero-length arc and a full turn is two half arcs", () => {
    expect(arcPath(50, 50, 10, 30, 30)).toBe("");
    expect(arcPath(50, 50, 10, 30, 10)).toBe("");
    expect(arcPath(50, 50, 10, 0, 360).match(/A /g)).toHaveLength(2);
  });
});
