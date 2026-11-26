import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import type { StripModel } from "./layout";
import {
  bandLines,
  bandTracks,
  clampWidth,
  collectElements,
  duplicateIds,
  edgeWindow,
  findWindow,
  lineSlot,
  moveByKey,
  neighbor,
  projectMove,
  rowTrack,
  slotsEqual,
  subrowCount,
  successor,
  transposeDir,
  windowsPerLine,
} from "./layout";

// [ col-a: [a1, a2] | col-b: [b1] | col-c: [c1, c2, c3] ]
const model: StripModel = {
  columns: [
    { id: "col-a", windowIds: ["a1", "a2"] },
    { id: "col-b", windowIds: ["b1"] },
    { id: "col-c", windowIds: ["c1", "c2", "c3"] },
  ],
};

const empty: StripModel = { columns: [] };

describe("collectElements", () => {
  function Wanted(_props: { id: string }): null {
    return null;
  }
  function Other(): null {
    return null;
  }

  it("collects matching children in order, skipping other types and non-elements", () => {
    const out = collectElements<{ id: string }>(
      [
        createElement(Wanted, { id: "1", key: "1" }),
        createElement(Other, { key: "x" }),
        "text",
        null,
        createElement(Wanted, { id: "2", key: "2" }),
      ],
      Wanted,
    );
    expect(out.map((el) => el.props.id)).toEqual(["1", "2"]);
  });

  it("flattens fragments (so consumers can group or .map children)", () => {
    const out = collectElements<{ id: string }>(
      createElement(Fragment, null, [
        createElement(Wanted, { id: "1", key: "1" }),
        createElement(Fragment, { key: "f" }, createElement(Wanted, { id: "2" })),
      ]),
      Wanted,
    );
    expect(out.map((el) => el.props.id)).toEqual(["1", "2"]);
  });
});

describe("duplicateIds", () => {
  it("finds ids used more than once across columns and windows", () => {
    expect(
      duplicateIds({
        columns: [
          { id: "a", windowIds: ["w1", "w2"] },
          { id: "b", windowIds: ["w1", "a"] },
        ],
      }),
    ).toEqual(["w1", "a"]);
  });

  it("is empty for unique ids", () => {
    expect(duplicateIds(model)).toEqual([]);
  });
});

describe("findWindow / edgeWindow", () => {
  it("locates windows by column and row", () => {
    expect(findWindow(model, "a1")).toEqual({ col: 0, row: 0 });
    expect(findWindow(model, "c3")).toEqual({ col: 2, row: 2 });
    expect(findWindow(model, "nope")).toBeNull();
  });

  it("finds the strip's first/last windows, skipping empty columns", () => {
    expect(edgeWindow(model, "first")).toBe("a1");
    expect(edgeWindow(model, "last")).toBe("c1");
    const withEmpty: StripModel = {
      columns: [{ id: "e", windowIds: [] }, ...model.columns],
    };
    expect(edgeWindow(withEmpty, "first")).toBe("a1");
    expect(edgeWindow(empty, "first")).toBeNull();
  });
});

describe("neighbor", () => {
  it("moves up/down within a column and stops at the edges", () => {
    expect(neighbor(model, "a1", "down")).toBe("a2");
    expect(neighbor(model, "a2", "up")).toBe("a1");
    expect(neighbor(model, "a1", "up")).toBeNull();
    expect(neighbor(model, "a2", "down")).toBeNull();
  });

  it("moves left/right with the row clamped to the target column", () => {
    expect(neighbor(model, "c3", "left")).toBe("b1"); // row 2 → clamped to 0
    expect(neighbor(model, "a2", "right")).toBe("b1");
    expect(neighbor(model, "b1", "right")).toBe("c1");
    expect(neighbor(model, "a1", "left")).toBeNull();
    expect(neighbor(model, "c1", "right")).toBeNull();
  });

  it("returns null on an empty strip or unknown id", () => {
    expect(neighbor(empty, "a1", "down")).toBeNull();
    expect(neighbor(model, "nope", "down")).toBeNull();
  });
});

describe("projectMove", () => {
  it("adjusts same-column indexes for the removal", () => {
    // c1 dropped below c2 (raw slot 2) lands at post-removal index 1.
    expect(projectMove(model, "c1", { kind: "cell", columnId: "col-c", index: 2 })).toEqual({
      windowId: "c1",
      from: { columnId: "col-c", index: 0 },
      to: { type: "cell", columnId: "col-c", index: 1 },
    });
  });

  it("nulls out identity drops (both flanking slots)", () => {
    expect(projectMove(model, "c2", { kind: "cell", columnId: "col-c", index: 1 })).toBeNull();
    expect(projectMove(model, "c2", { kind: "cell", columnId: "col-c", index: 2 })).toBeNull();
  });

  it("keeps cross-column indexes as-is, clamped to the target stack", () => {
    expect(projectMove(model, "a1", { kind: "cell", columnId: "col-c", index: 3 })).toEqual({
      windowId: "a1",
      from: { columnId: "col-a", index: 0 },
      to: { type: "cell", columnId: "col-c", index: 3 },
    });
    expect(projectMove(model, "a1", { kind: "cell", columnId: "col-c", index: 9 })).toEqual(
      expect.objectContaining({ to: { type: "cell", columnId: "col-c", index: 3 } }),
    );
  });

  it("shifts a new-column index past a source column the move empties", () => {
    // b1 is alone in column 1; gap 3 (after col-c) becomes index 2 once col-b is gone.
    expect(projectMove(model, "b1", { kind: "column", index: 3 })).toEqual({
      windowId: "b1",
      from: { columnId: "col-b", index: 0 },
      to: { type: "column", index: 2 },
    });
  });

  it("nulls out a single-window column dropped into its own flanking gaps", () => {
    expect(projectMove(model, "b1", { kind: "column", index: 1 })).toBeNull();
    expect(projectMove(model, "b1", { kind: "column", index: 2 })).toBeNull();
  });

  it("does not shift when the source column keeps other windows", () => {
    expect(projectMove(model, "a1", { kind: "column", index: 3 })).toEqual(
      expect.objectContaining({ to: { type: "column", index: 3 } }),
    );
  });

  it("returns null for unknown windows or target columns", () => {
    expect(projectMove(model, "nope", { kind: "column", index: 0 })).toBeNull();
    expect(projectMove(model, "a1", { kind: "cell", columnId: "nope", index: 0 })).toBeNull();
  });
});

describe("moveByKey", () => {
  it("reorders within the column and stops at the edges", () => {
    expect(moveByKey(model, "c2", "up")).toEqual(
      expect.objectContaining({ to: { type: "cell", columnId: "col-c", index: 0 } }),
    );
    expect(moveByKey(model, "c2", "down")).toEqual(
      expect.objectContaining({ to: { type: "cell", columnId: "col-c", index: 2 } }),
    );
    expect(moveByKey(model, "c1", "up")).toBeNull();
    expect(moveByKey(model, "c3", "down")).toBeNull();
  });

  it("moves into the adjacent column at the clamped row", () => {
    expect(moveByKey(model, "c3", "left")).toEqual(
      expect.objectContaining({ to: { type: "cell", columnId: "col-b", index: 1 } }),
    );
    expect(moveByKey(model, "a1", "right")).toEqual(
      expect.objectContaining({ to: { type: "cell", columnId: "col-b", index: 0 } }),
    );
  });

  it("breaks out into a new column at the strip's ends", () => {
    expect(moveByKey(model, "a1", "left")).toEqual(
      expect.objectContaining({ to: { type: "column", index: 0 } }),
    );
    // c-windows: source column keeps two others, so no index shift.
    expect(moveByKey(model, "c1", "right")).toEqual(
      expect.objectContaining({ to: { type: "column", index: 3 } }),
    );
    // b1 alone: breaking out to its own flanking gap is a no-op.
    expect(moveByKey(model, "b1", "left")).toEqual(
      expect.objectContaining({ to: { type: "cell", columnId: "col-a", index: 0 } }),
    );
  });
});

describe("successor", () => {
  it("prefers the next window in the column, then the previous", () => {
    expect(successor(model, "c1")).toBe("c2");
    expect(successor(model, "c3")).toBe("c2");
    expect(successor(model, "a1")).toBe("a2");
  });

  it("falls back to the nearest non-empty column at the clamped row", () => {
    expect(successor(model, "b1")).toBe("a1");
    const single: StripModel = { columns: [{ id: "only", windowIds: ["w"] }] };
    expect(successor(single, "w")).toBeNull();
  });
});

describe("slotsEqual", () => {
  it("matches structurally identical slots and nulls", () => {
    expect(slotsEqual(null, null)).toBe(true);
    expect(
      slotsEqual(
        { kind: "cell", columnId: "a", index: 1 },
        { kind: "cell", columnId: "a", index: 1 },
      ),
    ).toBe(true);
    expect(slotsEqual({ kind: "column", index: 2 }, { kind: "column", index: 2 })).toBe(true);
  });

  it("distinguishes null, kind, columnId, and index", () => {
    expect(slotsEqual(null, { kind: "column", index: 0 })).toBe(false);
    expect(slotsEqual({ kind: "column", index: 0 }, null)).toBe(false);
    expect(
      slotsEqual({ kind: "column", index: 1 }, { kind: "cell", columnId: "a", index: 1 }),
    ).toBe(false);
    expect(
      slotsEqual(
        { kind: "cell", columnId: "a", index: 1 },
        { kind: "cell", columnId: "b", index: 1 },
      ),
    ).toBe(false);
    expect(
      slotsEqual(
        { kind: "cell", columnId: "a", index: 1 },
        { kind: "cell", columnId: "a", index: 2 },
      ),
    ).toBe(false);
  });
});

describe("transposeDir", () => {
  it("swaps the axes both ways (its own inverse)", () => {
    expect(transposeDir("up")).toBe("left");
    expect(transposeDir("down")).toBe("right");
    expect(transposeDir("left")).toBe("up");
    expect(transposeDir("right")).toBe("down");
    for (const dir of ["up", "down", "left", "right"] as const) {
      expect(transposeDir(transposeDir(dir))).toBe(dir);
    }
  });
});

describe("clampWidth", () => {
  it("floors at the minimum and rounds", () => {
    expect(clampWidth(100.6, 120)).toBe(120);
    expect(clampWidth(300.4, 120)).toBe(300);
  });
});

describe("subrowCount / rowTrack", () => {
  it("takes the LCM of the stack sizes, ignoring empty/single stacks", () => {
    expect(subrowCount([])).toBe(1);
    expect(subrowCount([0, 1, 1])).toBe(1);
    expect(subrowCount([2, 3])).toBe(6);
    expect(subrowCount([2, 3, 4])).toBe(12);
  });

  it("caps the LCM (rowTrack rounds beyond it)", () => {
    expect(subrowCount([5, 7, 9, 11])).toBe(360);
  });

  it("splits subrows exactly when the count divides them", () => {
    expect(rowTrack(0, 3, 6)).toEqual({ start: 1, span: 2 });
    expect(rowTrack(1, 3, 6)).toEqual({ start: 3, span: 2 });
    expect(rowTrack(2, 3, 6)).toEqual({ start: 5, span: 2 });
    expect(rowTrack(0, 1, 6)).toEqual({ start: 1, span: 6 });
  });

  it("rounds to contiguous full-coverage spans when the count does not divide", () => {
    const subrows = 360;
    for (const count of [7, 11, 13]) {
      let line = 1;
      let total = 0;
      for (let i = 0; i < count; i++) {
        const { start, span } = rowTrack(i, count, subrows);
        expect(start).toBe(line);
        expect(span).toBeGreaterThanOrEqual(1);
        line = start + span;
        total += span;
      }
      expect(total).toBe(subrows);
    }
  });
});

describe("windowsPerLine", () => {
  it("fits as many windows as keep each one at least the minimum wide", () => {
    expect(windowsPerLine(588, 240)).toBe(2);
    expect(windowsPerLine(720, 240)).toBe(3);
    expect(windowsPerLine(719, 240)).toBe(2);
  });

  it("counts the gap every window carries as margin", () => {
    // 500px holds two 240px windows only when they need no margin.
    expect(windowsPerLine(500, 240, 0)).toBe(2);
    expect(windowsPerLine(500, 240, 10)).toBe(2);
    expect(windowsPerLine(499, 240, 10)).toBe(1);
    // A phone: 326px container, 1px borders, a 12px gap.
    expect(windowsPerLine(312, 240, 12)).toBe(1);
  });

  it("never drops under one window per line", () => {
    expect(windowsPerLine(100, 240, 12)).toBe(1);
    expect(windowsPerLine(0, 240)).toBe(1);
    expect(windowsPerLine(-20, 240)).toBe(1);
  });

  it("does not wrap without a positive minimum or a measured width", () => {
    expect(windowsPerLine(300, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(windowsPerLine(300, -1)).toBe(Number.POSITIVE_INFINITY);
    expect(windowsPerLine(Number.NaN, 240)).toBe(Number.POSITIVE_INFINITY);
    expect(windowsPerLine(300, Number.NaN)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("bandLines", () => {
  it("keeps a band that fits on one line", () => {
    expect(bandLines(1, 1)).toEqual([1]);
    expect(bandLines(2, 2)).toEqual([2]);
    expect(bandLines(3, 5)).toEqual([3]);
    expect(bandLines(4, Number.POSITIVE_INFINITY)).toEqual([4]);
  });

  it("wraps the rest onto further lines, the last one holding the remainder", () => {
    expect(bandLines(5, 1)).toEqual([1, 1, 1, 1, 1]);
    expect(bandLines(5, 2)).toEqual([2, 2, 1]);
    expect(bandLines(4, 2)).toEqual([2, 2]);
    expect(bandLines(7, 3)).toEqual([3, 3, 1]);
  });

  it("uses min(n, perLine) cells and ceil(n / perLine) lines", () => {
    for (let count = 1; count <= 12; count++) {
      for (let perLine = 1; perLine <= 6; perLine++) {
        const lines = bandLines(count, perLine);
        expect(lines.length).toBe(Math.ceil(count / perLine));
        expect(Math.max(...lines)).toBe(Math.min(count, perLine));
        expect(lines.reduce((sum, n) => sum + n, 0)).toBe(count);
      }
    }
  });

  it("gives an empty band one empty line, and ignores a count per line under one", () => {
    expect(bandLines(0, 2)).toEqual([0]);
    expect(bandLines(3, 0)).toEqual([3]);
    expect(bandLines(3, Number.NaN)).toEqual([3]);
  });
});

describe("lineSlot", () => {
  it("is the stack position itself while the band fits", () => {
    expect(lineSlot(0, 3, 3)).toEqual({ line: 0, index: 0, count: 3 });
    expect(lineSlot(2, 3, Number.POSITIVE_INFINITY)).toEqual({ line: 0, index: 2, count: 3 });
  });

  it("walks the lines in order, the last line sharing its width among fewer windows", () => {
    expect([0, 1, 2, 3, 4].map((i) => lineSlot(i, 5, 2))).toEqual([
      { line: 0, index: 0, count: 2 },
      { line: 0, index: 1, count: 2 },
      { line: 1, index: 0, count: 2 },
      { line: 1, index: 1, count: 2 },
      { line: 2, index: 0, count: 1 },
    ]);
  });

  it("puts every window on a line of its own at one per line", () => {
    expect([0, 1, 2].map((i) => lineSlot(i, 3, 1))).toEqual([
      { line: 0, index: 0, count: 1 },
      { line: 1, index: 0, count: 1 },
      { line: 2, index: 0, count: 1 },
    ]);
  });

  it("agrees with bandLines on every line's window count", () => {
    for (let count = 1; count <= 12; count++) {
      for (let perLine = 1; perLine <= 6; perLine++) {
        const lines = bandLines(count, perLine);
        const seen = lines.map(() => 0);
        for (let i = 0; i < count; i++) {
          const slot = lineSlot(i, count, perLine);
          expect(slot.count).toBe(lines[slot.line]);
          expect(slot.index).toBe(seen[slot.line]);
          seen[slot.line] = (seen[slot.line] ?? 0) + 1;
        }
        expect(seen).toEqual(lines);
      }
    }
  });
});

describe("bandTracks", () => {
  it("is the plain gutter / band alternation at one line per band", () => {
    expect(bandTracks([1, 1, 1])).toEqual({
      bands: [
        { gutter: 1, start: 2, span: 1 },
        { gutter: 3, start: 4, span: 1 },
        { gutter: 5, start: 6, span: 1 },
      ],
      end: 7,
    });
  });

  it("gives a wrapped band a track per line and a spacer track between two lines", () => {
    // Band 1: lines on tracks 2, 4, 6 (spacers 3 and 5). Band 2 follows its
    // gutter on 7.
    expect(bandTracks([3, 1, 2])).toEqual({
      bands: [
        { gutter: 1, start: 2, span: 5 },
        { gutter: 7, start: 8, span: 1 },
        { gutter: 9, start: 10, span: 3 },
      ],
      end: 13,
    });
  });

  it("has only the leading gutter for an empty strip, and treats no lines as one", () => {
    expect(bandTracks([])).toEqual({ bands: [], end: 1 });
    expect(bandTracks([0])).toEqual({ bands: [{ gutter: 1, start: 2, span: 1 }], end: 3 });
  });
});

describe("wrapped bands on the subrow grid", () => {
  it("shares each line's width evenly, a short last line included", () => {
    // Five windows at two per line: lines of 2, 2 and 1 over 2 subrows.
    const lines = bandLines(5, 2);
    const subrows = subrowCount(lines);
    expect(subrows).toBe(2);
    const placed = [0, 1, 2, 3, 4].map((i) => {
      const slot = lineSlot(i, 5, 2);
      return { line: slot.line, ...rowTrack(slot.index, slot.count, subrows) };
    });
    expect(placed).toEqual([
      { line: 0, start: 1, span: 1 },
      { line: 0, start: 2, span: 1 },
      { line: 1, start: 1, span: 1 },
      { line: 1, start: 2, span: 1 },
      { line: 2, start: 1, span: 2 },
    ]);
  });

  it("matches the unwrapped grid when every band fits", () => {
    const counts = [2, 1, 3];
    const lines = counts.map((count) => bandLines(count, 3));
    expect(lines.flat()).toEqual(counts);
    expect(subrowCount(lines.flat())).toBe(subrowCount(counts));
    expect(bandTracks(lines.map((l) => l.length))).toEqual(bandTracks([1, 1, 1]));
  });
});
