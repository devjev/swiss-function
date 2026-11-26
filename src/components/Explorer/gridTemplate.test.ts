import { describe, expect, it } from "vitest";
import { buildGridTemplate } from "./gridTemplate";

// A track's minimum: its floor, and its preferred width where the columns
// hold (the private property is 0 or 1, see lib/columns/columnHold).
const min = (floorPx: number, preferred: string) =>
  `max(${floorPx}px, calc(${preferred} * var(--sf-column-hold)))`;

describe("buildGridTemplate, without resizing", () => {
  const build = (
    columns: Parameters<typeof buildGridTemplate>[0],
    floors: Record<string, number> = {},
    overrides: Record<string, number> = {},
  ) => buildGridTemplate(columns, overrides, false, false, false, floors);

  it("keeps a numeric width fixed, which holds by itself", () => {
    expect(build([{ id: "size", width: 90 }])).toBe("90px");
  });

  it("raises a fixed width to its header floor", () => {
    expect(build([{ id: "size", width: 90 }], { size: 104 })).toBe("104px");
  });

  it("passes a string width through untouched", () => {
    expect(build([{ id: "a", width: "2fr" }])).toBe("2fr");
  });

  it("holds a stretching first column (the tree column) at its own, wider width", () => {
    expect(build([{ id: "name" }, { id: "size", width: 90 }], { name: 61 })).toBe(
      "minmax(max(61px, calc(200px * var(--sf-column-hold))), 1fr) 90px",
    );
  });

  it("holds a later stretching column at the default width", () => {
    expect(build([{ id: "name", width: 90 }, { id: "note" }], {})).toBe(
      `90px minmax(${min(0, "120px")}, 1fr)`,
    );
  });

  it("gives a stretching column with no measured floor a zero floor", () => {
    expect(build([{ id: "name" }])).toBe(`minmax(${min(0, "200px")}, 1fr)`);
  });
});

describe("buildGridTemplate, with resizing", () => {
  const build = (
    columns: Parameters<typeof buildGridTemplate>[0],
    options: {
      overrides?: Record<string, number>;
      fill?: boolean;
      fixed?: boolean;
      floors?: Record<string, number>;
    } = {},
  ) =>
    buildGridTemplate(
      columns,
      options.overrides ?? {},
      true,
      options.fill ?? false,
      options.fixed ?? false,
      options.floors ?? {},
    );

  it("emits minmax(max(floor, preferred * hold), preferred), the last track stretching", () => {
    expect(build([{ id: "name", width: 200 }, { id: "size" }])).toBe(
      "minmax(max(48px, calc(200px * var(--sf-column-hold))), 200px) " +
        "minmax(max(48px, calc(120px * var(--sf-column-hold))), 1fr)",
    );
  });

  it("uses the declared minimum raised to the header floor", () => {
    expect(
      build([{ id: "name", width: 200, minWidth: 80 }, { id: "size" }], {
        floors: { name: 64, size: 71 },
      }),
    ).toBe(`minmax(${min(80, "200px")}, 200px) minmax(${min(71, "120px")}, 1fr)`);
  });

  it("holds a px override: the user's width is the preferred width", () => {
    expect(build([{ id: "name", width: 200 }, { id: "size" }], { overrides: { name: 96 } })).toBe(
      `minmax(${min(48, "96px")}, 96px) minmax(${min(48, "120px")}, 1fr)`,
    );
  });

  it("fixes the last track too once every column carries a width, or in fill mode", () => {
    const columns = [{ id: "name" }, { id: "size" }];
    const fixed = `minmax(${min(48, "150px")}, 150px) minmax(${min(48, "70px")}, 70px)`;
    expect(build(columns, { overrides: { name: 150, size: 70 }, fixed: true })).toBe(fixed);
    expect(build(columns, { overrides: { name: 150, size: 70 }, fill: true })).toBe(fixed);
  });

  it("holds a string width that is a length", () => {
    expect(build([{ id: "name", width: "12rem" }, { id: "size" }])).toBe(
      `minmax(${min(48, "12rem")}, 12rem) minmax(${min(48, "120px")}, 1fr)`,
    );
  });

  it("leaves a flexible string width at its floor: it has no length to hold", () => {
    expect(
      build([
        { id: "name", width: "2fr" },
        { id: "size", width: 90 },
      ]),
    ).toBe(`minmax(48px, 2fr) minmax(${min(48, "90px")}, 1fr)`);
  });
});
