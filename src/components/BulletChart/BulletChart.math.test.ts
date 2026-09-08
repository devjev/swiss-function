import { describe, expect, it } from "vitest";
import {
  measureExtent,
  resolveDomain,
  rowGeometry,
  scalePosition,
  targetDelta,
  tierDensity,
  tierIndexOf,
  tierSegments,
  unionDomain,
} from "./BulletChart.math";

describe("resolveDomain", () => {
  it("prefers the shared domain, then the row's own", () => {
    const item = { label: "a", value: 5, domain: [0, 10] as [number, number] };
    expect(resolveDomain(item, [0, 50])).toEqual([0, 50]);
    expect(resolveDomain(item)).toEqual([0, 10]);
  });

  it("auto-fits a zero-anchored nice domain over value, target, ranges and comparatives", () => {
    const [d0, d1] = resolveDomain({
      label: "a",
      value: 72,
      target: 80,
      ranges: [50, 75, 100],
      comparative: [68],
    });
    expect(d0).toBe(0);
    expect(d1).toBeGreaterThanOrEqual(100);
  });

  it("never returns an empty span", () => {
    const [d0, d1] = resolveDomain({ label: "a", value: 0 });
    expect(d1).toBeGreaterThan(d0);
  });
});

describe("unionDomain", () => {
  it("covers every row", () => {
    const [d0, d1] = unionDomain([
      { label: "a", value: 12, target: 20 },
      { label: "b", value: 95, ranges: [40, 80, 120] },
    ]);
    expect(d0).toBe(0);
    expect(d1).toBeGreaterThanOrEqual(120);
  });
});

describe("tierSegments", () => {
  it("cuts the scale at the bounds and adds a final tier up to the end", () => {
    const tiers = tierSegments([50, 75], [0, 100]);
    expect(tiers.map((t) => [t.from, t.to])).toEqual([
      [0, 50],
      [50, 75],
      [75, 100],
    ]);
    expect(tiers.map((t) => t.rank)).toEqual([0, 1, 2]);
  });

  it("stops at the scale's end when the last bound is the end", () => {
    const tiers = tierSegments([50, 100], [0, 100]);
    expect(tiers).toHaveLength(2);
  });

  it("clamps and sorts bounds, drops empty segments and caps the count", () => {
    const tiers = tierSegments([120, 30, 30, 60], [0, 100]);
    expect(tiers.map((t) => [t.from, t.to])).toEqual([
      [0, 30],
      [30, 60],
      [60, 100],
    ]);
    expect(tierSegments([1, 2, 3, 4, 5, 6, 7], [0, 10]).length).toBeLessThanOrEqual(6);
  });

  it("reverses the ink ranking when down is good", () => {
    const tiers = tierSegments([1, 2, 4], [0, 5], "down");
    expect(tiers.map((t) => t.rank)).toEqual([3, 2, 1, 0]);
  });

  it("gives no tiers without bounds", () => {
    expect(tierSegments(undefined, [0, 1])).toEqual([]);
    expect(tierSegments([], [0, 1])).toEqual([]);
  });
});

describe("tierIndexOf / tierDensity", () => {
  it("finds the tier containing the value, inclusive of its upper bound", () => {
    const tiers = tierSegments([50, 75], [0, 100]);
    expect(tierIndexOf(10, tiers)).toBe(0);
    expect(tierIndexOf(50, tiers)).toBe(0);
    expect(tierIndexOf(60, tiers)).toBe(1);
    expect(tierIndexOf(100, tiers)).toBe(2);
    expect(tierIndexOf(1, [])).toBeNull();
  });

  it("puts the most ink on rank 0 and none on the fifth", () => {
    expect(tierDensity(0)).toBe(0.5);
    expect(tierDensity(4)).toBe(0);
    expect(tierDensity(9)).toBe(0);
  });
});

describe("measureExtent / scalePosition", () => {
  it("grows from zero when the scale crosses it, else from the scale's start", () => {
    expect(measureExtent(40, [0, 100])).toEqual([0, 40]);
    expect(measureExtent(-20, [-50, 50])).toEqual([-20, 0]);
    expect(measureExtent(120, [100, 200])).toEqual([100, 120]);
  });

  it("clamps the value into the scale", () => {
    expect(measureExtent(140, [0, 100])).toEqual([0, 100]);
  });

  it("maps linearly along the length and reports off-scale positions", () => {
    expect(scalePosition(25, [0, 100], 400)).toBe(100);
    expect(scalePosition(125, [0, 100], 400)).toBe(500);
    expect(scalePosition(5, [5, 5], 400)).toBe(0);
  });
});

describe("targetDelta", () => {
  it("reports the absolute and percentage gap to the target", () => {
    expect(targetDelta(90, 100)).toEqual({ abs: -10, pct: -10 });
    expect(targetDelta(120, 100)).toEqual({ abs: 20, pct: 20 });
  });

  it("has no percentage against a zero target and nothing without one", () => {
    expect(targetDelta(5, 0)).toEqual({ abs: 5, pct: null });
    expect(targetDelta(5, undefined)).toBeNull();
  });
});

describe("rowGeometry", () => {
  it("splits the length into rows, the band half a row, the measure a third of it", () => {
    const g = rowGeometry(180, 5);
    expect(g.step).toBe(36);
    expect(g.band).toBe(18);
    expect(g.measure).toBe(6);
  });

  it("keeps a floor on very short rows", () => {
    const g = rowGeometry(20, 10);
    expect(g.band).toBe(4);
    expect(g.measure).toBe(2);
  });
});
