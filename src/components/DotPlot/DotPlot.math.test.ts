import { describe, expect, it } from "vitest";
import { fitDomain, orderRows, rangeDirection, resolveRange, rowLayout } from "./DotPlot.math";

const SERIES = [
  { name: "Plan", values: [10, 30, 20, null] },
  { name: "Actual", values: [40, 5, 20, 1] },
];

describe("orderRows", () => {
  it("keeps the given order by default", () => {
    expect(orderRows(4, SERIES, undefined)).toEqual([0, 1, 2, 3]);
    expect(orderRows(4, SERIES, "none")).toEqual([0, 1, 2, 3]);
  });

  it("sorts by the first series, missing values last", () => {
    expect(orderRows(4, SERIES, "desc")).toEqual([1, 2, 0, 3]);
    expect(orderRows(4, SERIES, "asc")).toEqual([0, 2, 1, 3]);
  });

  it("sorts descending by a named series and is stable on ties", () => {
    expect(orderRows(4, SERIES, "Actual")).toEqual([0, 2, 1, 3]);
    const tied = [{ name: "S", values: [5, 5, 5] }];
    expect(orderRows(3, tied, "desc")).toEqual([0, 1, 2]);
  });

  it("leaves the order alone for an unknown series or no series", () => {
    expect(orderRows(4, SERIES, "Forecast")).toEqual([0, 1, 2, 3]);
    expect(orderRows(3, [], "desc")).toEqual([0, 1, 2]);
  });
});

describe("resolveRange", () => {
  it("pairs exactly two series for `true`", () => {
    expect(resolveRange(true, SERIES)).toEqual([0, 1]);
    expect(resolveRange(true, [...SERIES, { name: "Third" }])).toBeNull();
    expect(resolveRange(true, [SERIES[0] as { name: string }])).toBeNull();
  });

  it("pairs by name and rejects unknown or identical names", () => {
    expect(resolveRange(["Actual", "Plan"], SERIES)).toEqual([1, 0]);
    expect(resolveRange(["Actual", "Nope"], SERIES)).toBeNull();
    expect(resolveRange(["Plan", "Plan"], SERIES)).toBeNull();
    expect(resolveRange(undefined, SERIES)).toBeNull();
    expect(resolveRange(false, SERIES)).toBeNull();
  });
});

describe("rangeDirection", () => {
  it("reads the move from the first value to the second", () => {
    expect(rangeDirection(10, 20)).toBe("up");
    expect(rangeDirection(20, 10)).toBe("down");
    expect(rangeDirection(7, 7)).toBe("flat");
  });
});

describe("rowLayout", () => {
  it("centres rows in equal bands", () => {
    const layout = rowLayout(4, 200);
    expect(layout.step).toBe(50);
    expect(layout.centers).toEqual([25, 75, 125, 175]);
  });

  it("is empty for no rows or no length", () => {
    expect(rowLayout(0, 200)).toEqual({ step: 0, centers: [] });
    expect(rowLayout(3, 0)).toEqual({ step: 0, centers: [] });
  });
});

describe("fitDomain", () => {
  it("extends the data to round tick bounds without pulling in zero", () => {
    const [lo, hi] = fitDomain([82, 91, 97], false);
    expect(lo).toBeLessThanOrEqual(82);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThanOrEqual(97);
  });

  it("includes zero when asked, for lollipop stems", () => {
    expect(fitDomain([82, 91, 97], true)[0]).toBe(0);
    expect(fitDomain([-30, -12], true)[1]).toBe(0);
  });

  it("ignores missing values and pads flat data", () => {
    expect(fitDomain([null, undefined, 5, 5], false)).toEqual([4, 6]);
    expect(fitDomain([], false)).toEqual([0, 1]);
  });
});
