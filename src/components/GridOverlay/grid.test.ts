import { describe, expect, it } from "vitest";
import { cellAt, formatCell, formatRange, parseRange, rangeBox, rangeOf, rangeSize } from "./grid";

describe("cellAt", () => {
  it("counts from 1 at the top left, row first", () => {
    expect(cellAt(0, 0, 20)).toEqual({ row: 1, col: 1 });
    expect(cellAt(19.9, 19.9, 20)).toEqual({ row: 1, col: 1 });
    expect(cellAt(20, 0, 20)).toEqual({ row: 1, col: 2 });
    expect(cellAt(65, 41, 20)).toEqual({ row: 3, col: 4 });
  });

  it("follows the cell size", () => {
    expect(cellAt(65, 41, 40)).toEqual({ row: 2, col: 2 });
  });
});

describe("ranges", () => {
  it("orders two corners into top left and bottom right", () => {
    expect(rangeOf({ row: 5, col: 10 }, { row: 3, col: 2 })).toEqual({
      from: { row: 3, col: 2 },
      to: { row: 5, col: 10 },
    });
    expect(rangeOf({ row: 5, col: 2 }, { row: 3, col: 10 })).toEqual({
      from: { row: 3, col: 2 },
      to: { row: 5, col: 10 },
    });
  });

  it("formats one cell without a hyphen, more with one", () => {
    expect(formatCell({ row: 3, col: 2 })).toBe("3:2");
    expect(formatRange(rangeOf({ row: 3, col: 2 }, { row: 3, col: 2 }))).toBe("3:2");
    expect(formatRange(rangeOf({ row: 3, col: 2 }, { row: 5, col: 10 }))).toBe("3:2-5:10");
  });

  it("counts the rows and columns a range covers, both ends included", () => {
    expect(rangeSize(rangeOf({ row: 3, col: 2 }, { row: 5, col: 10 }))).toEqual({
      rows: 3,
      cols: 9,
    });
  });

  it("gives a range's box in px", () => {
    expect(rangeBox(rangeOf({ row: 3, col: 2 }, { row: 5, col: 10 }), 20)).toEqual({
      left: 20,
      top: 40,
      width: 180,
      height: 60,
    });
  });
});

describe("parseRange", () => {
  it("reads a cell and a range, with spaces and either corner first", () => {
    expect(parseRange("3:2")).toEqual(rangeOf({ row: 3, col: 2 }, { row: 3, col: 2 }));
    expect(parseRange(" 5:10 - 3:2 ")).toEqual(rangeOf({ row: 3, col: 2 }, { row: 5, col: 10 }));
  });

  it("reads back what it formats", () => {
    const r = rangeOf({ row: 12, col: 4 }, { row: 14, col: 20 });
    expect(parseRange(formatRange(r))).toEqual(r);
  });

  it("refuses anything else", () => {
    for (const bad of ["", "3", "3:", ":2", "0:1", "1:0", "a:b", "1:2-3", "1:2-3:4-5:6"]) {
      expect(parseRange(bad), bad).toBeNull();
    }
  });
});
