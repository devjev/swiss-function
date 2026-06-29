import { describe, expect, it } from "vitest";
import {
  buildColumnTemplate,
  frozenLeftOffsets,
  frozenTotalWidth,
  resizeBoundary,
} from "./columnWidths";

const LAST = "minmax(calc(var(--sf-unit) * 3), 1fr)";
// A non-last track: minmax(min, preferred). Default min is 3 units.
const track = (preferred: string, min = 3) => `minmax(calc(var(--sf-unit) * ${min}), ${preferred})`;

describe("buildColumnTemplate", () => {
  it("makes the last column a 1fr filler regardless of width/override", () => {
    expect(
      buildColumnTemplate(
        [
          { id: "a", width: 8 },
          { id: "z", width: 10 },
        ],
        { z: 240 },
      ),
    ).toBe(`${track("calc(var(--sf-unit) * 8)")} ${LAST}`);
  });

  it("wraps a non-last static width as the minmax preferred", () => {
    expect(buildColumnTemplate([{ id: "a", width: 8 }, { id: "z" }], {})).toBe(
      `${track("calc(var(--sf-unit) * 8)")} ${LAST}`,
    );
  });

  it("defaults a non-last auto column's preferred to a fixed width", () => {
    expect(buildColumnTemplate([{ id: "a" }, { id: "z" }], {})).toBe(
      `${track("calc(var(--sf-unit) * 8)")} ${LAST}`,
    );
  });

  it("uses a px override as the preferred when present", () => {
    expect(buildColumnTemplate([{ id: "a", width: 8 }, { id: "z" }], { a: 240 })).toBe(
      `${track("240px")} ${LAST}`,
    );
  });

  it("honours a per-column minWidth in the track minimum", () => {
    expect(buildColumnTemplate([{ id: "a", width: 8, minWidth: 6 }, { id: "z" }], {})).toBe(
      `${track("calc(var(--sf-unit) * 8)", 6)} ${LAST}`,
    );
  });

  it("a lone column is just the filler", () => {
    expect(buildColumnTemplate([{ id: "a", width: 8 }], { a: 100 })).toBe(LAST);
  });

  it("emits the first frozenCount tracks as fixed (non-shrinkable) widths", () => {
    expect(
      buildColumnTemplate(
        [{ id: "a", width: 8 }, { id: "b", width: 10 }, { id: "c" }, { id: "z" }],
        { b: 200 },
        { frozenCount: 2 },
      ),
    ).toBe(`calc(var(--sf-unit) * 8) 200px ${track("calc(var(--sf-unit) * 8)")} ${LAST}`);
  });
});

describe("frozenLeftOffsets", () => {
  it("returns cumulative left offsets, starting at 0px", () => {
    expect(
      frozenLeftOffsets([{ id: "a", width: 8 }, { id: "b", width: 10 }, { id: "z" }], {}, 2),
    ).toEqual(["0px", "calc(calc(var(--sf-unit) * 8))"]);
  });

  it("uses px overrides in the cumulative sum", () => {
    expect(
      frozenLeftOffsets(
        [{ id: "a", width: 8 }, { id: "b" }, { id: "c" }, { id: "z" }],
        { a: 120 },
        3,
      ),
    ).toEqual(["0px", "calc(120px)", "calc(120px + calc(var(--sf-unit) * 8))"]);
  });

  it("is empty when nothing is frozen", () => {
    expect(frozenLeftOffsets([{ id: "a" }, { id: "z" }], {}, 0)).toEqual([]);
  });
});

describe("frozenTotalWidth", () => {
  it("sums the frozen columns' widths", () => {
    expect(frozenTotalWidth([{ id: "a", width: 8 }, { id: "b" }, { id: "z" }], { b: 200 }, 2)).toBe(
      "calc(calc(var(--sf-unit) * 8) + 200px)",
    );
  });

  it("is 0px when nothing is frozen", () => {
    expect(frozenTotalWidth([{ id: "a" }], {}, 0)).toBe("0px");
  });
});

const ALL = [true, true, true, true];
const MIN = 20;
const sum = (a: number[]) => a.reduce((t, n) => t + n, 0);

describe("resizeBoundary", () => {
  it("grows a column by shrinking its immediate right neighbour", () => {
    const out = resizeBoundary([100, 100, 100, 100], ALL, 0, 30, MIN);
    expect(out).toEqual([130, 70, 100, 100]);
    expect(sum(out)).toBe(400); // total preserved
  });

  it("cascades the shrink to the next column once the neighbour hits min", () => {
    const out = resizeBoundary([100, 100, 100, 100], ALL, 0, 90, MIN);
    // col1 gives its full 80 (100→20), col2 gives the remaining 10.
    expect(out).toEqual([190, 20, 90, 100]);
    expect(sum(out)).toBe(400);
  });

  it("stops growing when no column to the right can give more", () => {
    const out = resizeBoundary([100, 20, 20, 20], ALL, 0, 50, MIN);
    expect(out).toEqual([100, 20, 20, 20]); // all at min already → no change
  });

  it("skips locked columns when cascading the shrink", () => {
    const out = resizeBoundary([100, 100, 100, 100], [true, false, true, true], 0, 30, MIN);
    expect(out).toEqual([130, 100, 70, 100]); // col1 locked, col2 absorbs
    expect(sum(out)).toBe(400);
  });

  it("the last column absorbs even when intermediates are locked", () => {
    const out = resizeBoundary([100, 100, 100, 100], [true, false, false, false], 0, 30, MIN);
    expect(out).toEqual([130, 100, 100, 70]);
    expect(sum(out)).toBe(400);
  });

  it("shrinks a column to its min and hands the space to the right", () => {
    const out = resizeBoundary([100, 100, 100, 100], ALL, 0, -30, MIN);
    expect(out).toEqual([70, 130, 100, 100]);
    expect(sum(out)).toBe(400);
  });

  it("clamps shrink at the column's own minimum", () => {
    const out = resizeBoundary([30, 100, 100, 100], ALL, 0, -50, MIN);
    expect(out).toEqual([20, 110, 100, 100]); // col0 can only give 10
    expect(sum(out)).toBe(330); // total preserved (input summed to 330)
  });

  it("hands freed space to the nearest resizable column past a locked neighbour", () => {
    const out = resizeBoundary([100, 100, 100, 100], [true, false, true, true], 0, -30, MIN);
    expect(out).toEqual([70, 100, 130, 100]);
    expect(sum(out)).toBe(400);
  });

  it("is a no-op on the last column (it has no trailing handle)", () => {
    expect(resizeBoundary([100, 100, 100, 100], ALL, 3, 30, MIN)).toEqual([100, 100, 100, 100]);
  });
});
