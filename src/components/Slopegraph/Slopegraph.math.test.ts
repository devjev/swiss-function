import { describe, expect, it } from "vitest";
import {
  columnPositions,
  direction,
  dodgeLabels,
  fontSizePx,
  rankColumn,
  rankTable,
  thinLabels,
  valueExtent,
} from "./Slopegraph.math";

describe("rankColumn", () => {
  it("ranks the highest value first and gives ties the same rank", () => {
    expect(rankColumn([10, 30, 20])).toEqual([3, 1, 2]);
    expect(rankColumn([5, 5, 3, 1])).toEqual([1, 1, 3, 4]);
  });

  it("leaves nulls unranked without shifting the others", () => {
    expect(rankColumn([null, 8, 4])).toEqual([null, 1, 2]);
    expect(rankColumn([])).toEqual([]);
  });
});

describe("rankTable", () => {
  it("ranks every column independently", () => {
    const ranks = rankTable([{ values: [1, 9] }, { values: [2, 8] }, { values: [3, null] }]);
    expect(ranks).toEqual([
      [3, 1],
      [2, 2],
      [1, null],
    ]);
  });
});

describe("direction", () => {
  it("classifies first-to-last known values", () => {
    expect(direction([1, 5])).toBe("up");
    expect(direction([5, 1])).toBe("down");
    expect(direction([3, 7, 3])).toBe("flat");
    expect(direction([null, 2, null, 4])).toBe("up");
  });

  it("is null with fewer than two known values", () => {
    expect(direction([4])).toBeNull();
    expect(direction([null, 4, null])).toBeNull();
  });

  it("inverts for ranks, where a smaller number is a rise", () => {
    expect(direction([3, 1], true)).toBe("up");
    expect(direction([1, 3], true)).toBe("down");
  });
});

describe("valueExtent", () => {
  it("spans all known values and widens a degenerate span", () => {
    expect(valueExtent([{ values: [2, 9] }, { values: [null, -1] }])).toEqual([-1, 9]);
    expect(valueExtent([{ values: [4, 4] }])).toEqual([3, 5]);
    expect(valueExtent([{ values: [null] }])).toEqual([0, 1]);
  });
});

describe("dodgeLabels", () => {
  it("leaves well-spaced labels where they are", () => {
    const r = dodgeLabels([10, 40, 70], 16, 0, 100);
    expect(r.positions).toEqual([10, 40, 70]);
    expect(r.fits).toBe(true);
  });

  it("stacks ties in input order, one label height apart", () => {
    const r = dodgeLabels([50, 50, 50], 16, 0, 100);
    expect(r.positions).toEqual([50, 66, 82]);
    expect(r.fits).toBe(true);
  });

  it("keeps order and stays inside the bounds by pushing up from the bottom", () => {
    const r = dodgeLabels([95, 98], 16, 0, 100);
    expect(r.positions).toEqual([84, 100]);
    expect(r.fits).toBe(true);
  });

  it("reports when the labels cannot fit and packs from the top", () => {
    const r = dodgeLabels([5, 6, 7, 8], 16, 0, 40);
    expect(r.fits).toBe(false);
    expect(r.positions).toEqual([0, 16, 32, 48]);
  });

  it("returns positions parallel to unsorted input", () => {
    const r = dodgeLabels([70, 10, 12], 16, 0, 100);
    expect(r.positions[1]).toBe(10);
    expect(r.positions[2]).toBe(26);
    expect(r.positions[0]).toBe(70);
  });
});

describe("thinLabels", () => {
  it("keeps everything when it fits", () => {
    expect(thinLabels(3, 5, [])).toEqual([0, 1, 2]);
  });

  it("keeps the must-keep indices and spreads the rest evenly", () => {
    const kept = thinLabels(10, 4, [0, 9]);
    expect(kept).toContain(0);
    expect(kept).toContain(9);
    expect(kept).toHaveLength(4);
  });

  it("never exceeds capacity except for must-keep entries", () => {
    expect(thinLabels(6, 2, [0, 2, 5])).toEqual([0, 2, 5]);
    expect(thinLabels(6, 1, [])).toHaveLength(1);
  });
});

describe("columnPositions / fontSizePx", () => {
  it("spreads columns evenly between the edges", () => {
    expect(columnPositions(3, 10, 110)).toEqual([10, 60, 110]);
    expect(columnPositions(1, 10, 110)).toEqual([10]);
  });

  it("reads the px size of a font shorthand", () => {
    expect(fontSizePx("400 13px sans-serif")).toBe(13);
    expect(fontSizePx("500 12.5px Inter")).toBe(12.5);
    expect(fontSizePx("bold 1em serif", 14)).toBe(14);
  });
});
