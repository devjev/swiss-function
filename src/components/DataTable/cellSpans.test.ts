import { describe, expect, it } from "vitest";
import { computeMergeMap, spanKey } from "./cellSpans";

/** Build a getSpan from a sparse map of "r:c" → span. */
const fromMap =
  (m: Record<string, { rowSpan?: number; colSpan?: number }>) => (r: number, c: number) =>
    m[spanKey(r, c)];

describe("computeMergeMap", () => {
  it("returns empty sets when nothing spans", () => {
    const { covered, suppressRight, suppressBottom } = computeMergeMap({
      rowCount: 3,
      colCount: 3,
      getSpan: () => undefined,
    });
    expect(covered.size).toBe(0);
    expect(suppressRight.size).toBe(0);
    expect(suppressBottom.size).toBe(0);
  });

  it("a 2×2 lead covers the other three cells", () => {
    const { covered } = computeMergeMap({
      rowCount: 4,
      colCount: 4,
      getSpan: fromMap({ "1:1": { rowSpan: 2, colSpan: 2 } }),
    });
    expect([...covered].sort()).toEqual(["1:2", "2:1", "2:2"]);
    // The lead itself is never covered.
    expect(covered.has("1:1")).toBe(false);
  });

  it("suppresses only the internal seams of a 2×2 region", () => {
    const { suppressRight, suppressBottom } = computeMergeMap({
      rowCount: 4,
      colCount: 4,
      getSpan: fromMap({ "1:1": { rowSpan: 2, colSpan: 2 } }),
    });
    // Right edge dropped on the left column of each region row, not the right one.
    expect([...suppressRight].sort()).toEqual(["1:1", "2:1"]);
    // Bottom edge dropped on the top row of each region column, not the bottom.
    expect([...suppressBottom].sort()).toEqual(["1:1", "1:2"]);
  });

  it("a pure colspan only suppresses right edges", () => {
    const { covered, suppressRight, suppressBottom } = computeMergeMap({
      rowCount: 2,
      colCount: 3,
      getSpan: fromMap({ "0:0": { colSpan: 3 } }),
    });
    expect([...covered].sort()).toEqual(["0:1", "0:2"]);
    expect([...suppressRight].sort()).toEqual(["0:0", "0:1"]);
    expect(suppressBottom.size).toBe(0);
  });

  it("clamps spans that overrun the table bounds", () => {
    const { covered } = computeMergeMap({
      rowCount: 2,
      colCount: 2,
      // Asks for 5×5 from the last cell — clamps to a 1×1 (no-op).
      getSpan: fromMap({ "1:1": { rowSpan: 5, colSpan: 5 } }),
    });
    expect(covered.size).toBe(0);
  });

  it("ignores a span declared on an already-covered cell", () => {
    const { covered } = computeMergeMap({
      rowCount: 4,
      colCount: 4,
      getSpan: fromMap({
        "0:0": { rowSpan: 2, colSpan: 2 },
        // (1,1) is covered by the region above — its span must be ignored.
        "1:1": { rowSpan: 2, colSpan: 2 },
      }),
    });
    expect([...covered].sort()).toEqual(["0:1", "1:0", "1:1"]);
  });
});
