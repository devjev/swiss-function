import { describe, expect, it } from "vitest";
import {
  allFixed,
  buildColumnTemplate,
  frozenLeftOffsets,
  frozenPinned,
  frozenTotalWidth,
} from "./columnWidths";

// A track's minimum: its floors, and its preferred width where the columns
// hold (the private property is 0 or 1, see lib/columns/columnHold).
const HOLD = "var(--sf-column-hold)";
const min = (preferred: string, units = 3, floorPx?: number) =>
  `max(calc(var(--sf-unit) * ${units}), ${floorPx != null ? `${floorPx}px, ` : ""}calc(${preferred} * ${HOLD}))`;
const UNITS_8 = "calc(var(--sf-unit) * 8)";
// The last, stretching track of a column with the default width.
const LAST = `minmax(${min(UNITS_8)}, 1fr)`;
// A non-last track: minmax(min, preferred). Default min is 3 units.
const track = (preferred: string, units = 3) => `minmax(${min(preferred, units)}, ${preferred})`;

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
    ).toBe(`${track("calc(var(--sf-unit) * 8)")} minmax(${min("240px")}, 1fr)`);
  });

  it("emits the hold expression in full: floor, then preferred times the hold property", () => {
    expect(buildColumnTemplate([{ id: "a", width: 6 }, { id: "z" }], {})).toBe(
      "minmax(max(calc(var(--sf-unit) * 3), calc(calc(var(--sf-unit) * 6) * var(--sf-column-hold))), calc(var(--sf-unit) * 6)) " +
        "minmax(max(calc(var(--sf-unit) * 3), calc(calc(var(--sf-unit) * 8) * var(--sf-column-hold))), 1fr)",
    );
  });

  it("holds a px override: the user's width is the preferred width", () => {
    expect(buildColumnTemplate([{ id: "a" }, { id: "z" }], { a: 96 })).toBe(
      `minmax(max(calc(var(--sf-unit) * 3), calc(96px * ${HOLD})), 96px) ${LAST}`,
    );
  });

  it("holds the last column at its own width while it keeps the 1fr maximum", () => {
    expect(buildColumnTemplate([{ id: "a" }, { id: "z", width: 12 }], {})).toBe(
      `${track(UNITS_8)} minmax(${min("calc(var(--sf-unit) * 12)")}, 1fr)`,
    );
  });

  it("holds every track once the last column is fixed too (stretchLast off)", () => {
    expect(
      buildColumnTemplate([{ id: "a" }, { id: "z" }], { z: 200 }, { stretchLast: false }),
    ).toBe(`${track(UNITS_8)} ${track("200px")}`);
  });

  it("holds at the default width a table declares", () => {
    expect(buildColumnTemplate([{ id: "a" }, { id: "z" }], {}, { defaultWidth: 5 })).toBe(
      `${track("calc(var(--sf-unit) * 5)")} minmax(${min("calc(var(--sf-unit) * 5)")}, 1fr)`,
    );
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
    expect(buildColumnTemplate([{ id: "a", width: 8 }], { a: 100 })).toBe(
      `minmax(${min("100px")}, 1fr)`,
    );
  });

  it("raises a track's minimum to its measured header floor (issue #102)", () => {
    expect(
      buildColumnTemplate(
        [{ id: "a", width: 8, minWidth: 6 }, { id: "z" }],
        {},
        { floors: { a: 137 } },
      ),
    ).toBe(`minmax(${min(UNITS_8, 6, 137)}, calc(var(--sf-unit) * 8)) ${LAST}`);
  });

  it("the last, stretching column keeps its floor as the minimum too", () => {
    expect(buildColumnTemplate([{ id: "a" }, { id: "z" }], {}, { floors: { z: 90 } })).toBe(
      `${track("calc(var(--sf-unit) * 8)")} minmax(${min(UNITS_8, 3, 90)}, 1fr)`,
    );
  });

  it("a frozen track is fixed at its preferred width raised to its floor", () => {
    expect(
      buildColumnTemplate(
        [{ id: "a", width: 4 }, { id: "b" }, { id: "z" }],
        { b: 100 },
        {
          frozenCount: 2,
          floors: { a: 120, b: 80 },
        },
      ),
    ).toBe(`max(calc(var(--sf-unit) * 4), 120px) max(100px, 80px) ${LAST}`);
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

describe("frozenPinned", () => {
  it("pins frozen columns that take half the viewport or less", () => {
    expect(frozenPinned(160, 640)).toBe(true);
    expect(frozenPinned(320, 640)).toBe(true);
  });

  it("releases them while they take more than half", () => {
    expect(frozenPinned(321, 640)).toBe(false);
    expect(frozenPinned(200, 326)).toBe(false);
  });

  it("pins again when the viewport grows", () => {
    expect(frozenPinned(200, 326)).toBe(false);
    expect(frozenPinned(200, 400)).toBe(true);
  });

  it("keeps them pinned with nothing frozen or nothing measured", () => {
    expect(frozenPinned(0, 326)).toBe(true);
    expect(frozenPinned(200, 0)).toBe(true);
    expect(frozenPinned(200, Number.NaN)).toBe(true);
  });
});

describe("allFixed", () => {
  it("is true only when every leaf carries a px override", () => {
    const leaves = [{ id: "a" }, { id: "b" }];
    expect(allFixed(leaves, { a: 100, b: 80 })).toBe(true);
    expect(allFixed(leaves, { a: 100 })).toBe(false);
    expect(allFixed([], {})).toBe(false);
  });
});
