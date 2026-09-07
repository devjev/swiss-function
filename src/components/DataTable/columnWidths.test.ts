import { describe, expect, it } from "vitest";
import { allFixed, buildColumnTemplate, frozenLeftOffsets, frozenTotalWidth } from "./columnWidths";

const LAST = "minmax(calc(var(--sf-unit) * 3), 1fr)";
// A non-last track: minmax(min, preferred). Default min is 3 units.
const track = (preferred: string, min = 3) => `minmax(calc(var(--sf-unit) * ${min}), ${preferred})`;

describe("buildColumnTemplate", () => {
  it("makes the last column a 1fr filler regardless of width/override (stretchLast, the resting state)", () => {
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

describe("allFixed", () => {
  it("is true only when every leaf carries a px override", () => {
    const leaves = [{ id: "a" }, { id: "b" }];
    expect(allFixed(leaves, { a: 100, b: 80 })).toBe(true);
    expect(allFixed(leaves, { a: 100 })).toBe(false);
    expect(allFixed([], {})).toBe(false);
  });
});
