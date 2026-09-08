import { describe, expect, it } from "vitest";
import { axisTicksFor, columnCount, gridPlacement, unionDomain } from "./Multiples.math";

describe("columnCount", () => {
  it("fits as many panels of the minimum width as the container allows", () => {
    expect(columnCount({ width: 900, minPanelWidth: 200, gap: 24, count: 12 })).toBe(4);
    expect(columnCount({ width: 300, minPanelWidth: 200, gap: 24, count: 12 })).toBe(1);
    expect(columnCount({ width: 424, minPanelWidth: 200, gap: 24, count: 12 })).toBe(2);
  });

  it("never exceeds the panel count and never drops below one", () => {
    expect(columnCount({ width: 2000, minPanelWidth: 100, gap: 0, count: 3 })).toBe(3);
    expect(columnCount({ width: 50, minPanelWidth: 100, gap: 0, count: 3 })).toBe(1);
    expect(columnCount({ width: 50, minPanelWidth: 100, gap: 0, count: 0 })).toBe(1);
  });

  it("is one column before the first measure", () => {
    expect(columnCount({ width: 0, minPanelWidth: 200, gap: 24, count: 8 })).toBe(1);
  });

  it("a fixed column count wins, clamped to the panel count", () => {
    expect(columnCount({ width: 100, minPanelWidth: 200, gap: 24, count: 8, columns: 3 })).toBe(3);
    expect(columnCount({ width: 100, minPanelWidth: 200, gap: 24, count: 2, columns: 5 })).toBe(2);
  });

  it("a fixed row count derives the columns", () => {
    expect(columnCount({ width: 100, minPanelWidth: 200, gap: 24, count: 12, rows: 3 })).toBe(4);
    expect(columnCount({ width: 100, minPanelWidth: 200, gap: 24, count: 10, rows: 3 })).toBe(4);
  });
});

describe("gridPlacement", () => {
  it("places panels row-major and marks the outer-axis carriers", () => {
    const { rows, cells } = gridPlacement(5, 3);
    expect(rows).toBe(2);
    expect(cells.map((c) => [c.row, c.col])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ]);
    expect(cells.filter((c) => c.firstInRow).map((c) => c.index)).toEqual([0, 3]);
    // Column 2 has nothing below its first panel, so that panel carries the x axis.
    expect(cells.filter((c) => c.lastInColumn).map((c) => c.index)).toEqual([2, 3, 4]);
  });

  it("handles an empty grid and a single column", () => {
    expect(gridPlacement(0, 3)).toEqual({ rows: 0, cells: [] });
    const single = gridPlacement(3, 1);
    expect(single.rows).toBe(3);
    expect(single.cells.every((c) => c.firstInRow)).toBe(true);
    expect(single.cells.map((c) => c.lastInColumn)).toEqual([false, false, true]);
  });
});

describe("unionDomain", () => {
  it("covers every numeric domain and skips nulls", () => {
    expect(unionDomain([[2, 5], null, [0, 3], undefined])).toEqual([0, 5]);
  });

  it("returns dates when any input is dated", () => {
    const a: [Date, Date] = [new Date(2026, 0, 1), new Date(2026, 5, 1)];
    const b: [number, number] = [new Date(2025, 11, 1).getTime(), new Date(2026, 2, 1).getTime()];
    const u = unionDomain([a, b]);
    expect(u?.[0]).toBeInstanceOf(Date);
    expect((u?.[0] as Date).getTime()).toBe(b[0]);
    expect((u?.[1] as Date).getTime()).toBe(a[1].getTime());
  });

  it("is undefined with nothing to cover", () => {
    expect(unionDomain([null, undefined])).toBeUndefined();
  });
});

describe("axisTicksFor", () => {
  it("draws nice numeric ticks inside the domain, positioned 0..1", () => {
    const ticks = axisTicksFor([0, 100], 400, "x");
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]?.position).toBeGreaterThanOrEqual(0);
    expect(ticks[ticks.length - 1]?.position).toBeLessThanOrEqual(1);
    expect(ticks.map((t) => t.label)).toContain("0");
  });

  it("uses the calendar ladder for a dated x axis", () => {
    const ticks = axisTicksFor([new Date(2026, 0, 1), new Date(2026, 11, 31)], 800, "x");
    expect(ticks.length).toBeGreaterThan(4);
    expect(ticks.every((t) => t.position >= 0 && t.position <= 1)).toBe(true);
  });

  it("is empty for a degenerate domain or no room", () => {
    expect(axisTicksFor([5, 5], 400, "x")).toEqual([]);
    expect(axisTicksFor([0, 10], 0, "y")).toEqual([]);
  });
});
