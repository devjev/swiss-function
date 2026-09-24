import { describe, expect, it } from "vitest";
import { stackAll, stackCategory, stackExtent, stackTotal } from "./BarChart.math";

describe("stackCategory", () => {
  it("piles the parts up from zero in value units", () => {
    expect(stackCategory([10, 20, 5], false)).toEqual([
      { start: 0, end: 10, value: 10, share: 10 / 35 },
      { start: 10, end: 30, value: 20, share: 20 / 35 },
      { start: 30, end: 35, value: 5, share: 5 / 35 },
    ]);
  });

  it("hangs negatives below the baseline instead of piling them in one run", () => {
    const stack = stackCategory([10, -4, -6], false);
    expect(stack[0]).toMatchObject({ start: 0, end: 10 });
    expect(stack[1]).toMatchObject({ start: -4, end: 0 });
    expect(stack[2]).toMatchObject({ start: -10, end: -4 });
  });

  it("runs a normalized stack from zero to one", () => {
    const stack = stackCategory([30, 10, 10], true);
    expect(stack.map((s) => s.end)).toEqual([0.6, 0.8, 1]);
    expect(stack[0]?.share).toBeCloseTo(0.6);
    expect(stack[2]?.end).toBeCloseTo(1);
  });

  it("keeps a part's own value when the geometry is a share", () => {
    const stack = stackCategory([30, 10], true);
    expect(stack.map((s) => s.value)).toEqual([30, 10]);
  });

  it("counts a negative as nothing in a normalized stack, value kept", () => {
    const stack = stackCategory([30, -10], true);
    expect(stack[1]).toEqual({ start: 1, end: 1, value: -10, share: 0 });
  });

  it("treats a missing or broken part as zero", () => {
    const stack = stackCategory([10, undefined, Number.NaN], false);
    expect(stack[1]).toMatchObject({ start: 10, end: 10, value: 0 });
    expect(stack[2]).toMatchObject({ start: 10, end: 10, value: 0 });
  });

  it("leaves an empty category flat rather than dividing by zero", () => {
    expect(stackCategory([0, 0], true)).toEqual([
      { start: 0, end: 0, value: 0, share: 0 },
      { start: 0, end: 0, value: 0, share: 0 },
    ]);
  });
});

describe("stackAll", () => {
  it("stacks each category across the series", () => {
    const stacks = stackAll([{ values: [1, 2] }, { values: [3, 4] }], 2, false);
    expect(stacks).toHaveLength(2);
    expect(stacks[0]?.map((s) => s.end)).toEqual([1, 4]);
    expect(stacks[1]?.map((s) => s.end)).toEqual([2, 6]);
  });

  it("fills a series that is short of a category with nothing", () => {
    const stacks = stackAll([{ values: [1] }, { values: [3, 4] }], 2, false);
    expect(stacks[1]?.map((s) => s.value)).toEqual([0, 4]);
  });
});

describe("stackExtent / stackTotal", () => {
  it("spans the lowest bottom to the highest top, zero always in", () => {
    expect(stackExtent(stackAll([{ values: [1, 2] }, { values: [3, 4] }], 2, false))).toEqual([
      0, 6,
    ]);
    expect(stackExtent(stackAll([{ values: [-5] }, { values: [2] }], 1, false))).toEqual([-5, 2]);
  });

  it("is a flat zero range with nothing to draw", () => {
    expect(stackExtent([])).toEqual([0, 0]);
  });

  it("totals a stack in value units, negatives included", () => {
    expect(stackTotal(stackCategory([10, -4, 6], false))).toBe(12);
  });
});
