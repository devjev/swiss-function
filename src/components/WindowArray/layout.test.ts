import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import type { StripModel } from "./layout";
import {
  clampWidth,
  collectElements,
  duplicateIds,
  edgeWindow,
  findWindow,
  moveByKey,
  neighbor,
  projectMove,
  rowTrack,
  subrowCount,
  successor,
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
