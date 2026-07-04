import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  daysInMonth,
  formatISODate,
  formatISOMonth,
  isoWeek,
  mondayIndex,
  monthGrid,
} from "./dateMath";

describe("monthGrid", () => {
  it("is a fixed 6×7 Monday-start grid", () => {
    // June 2026 starts on a Monday.
    const grid = monthGrid(2026, 5);
    expect(grid).toHaveLength(42);
    expect(grid[0]?.date.getDay()).toBe(1); // Monday
    expect(grid[0]?.date.getDate()).toBe(1);
    expect(grid[0]?.inMonth).toBe(true);
    // 30 in-month days.
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
    // Trailing pad belongs to July.
    expect(grid[41]?.inMonth).toBe(false);
  });

  it("pads a Sunday-starting month with six leading foreign days", () => {
    // March 2026 starts on a Sunday — Monday-start grids lead with Feb 23–28.
    const grid = monthGrid(2026, 2);
    const leading = grid.filter((c) => !c.inMonth && c.date.getMonth() === 1);
    expect(leading).toHaveLength(6);
    expect(grid[6]?.date.getDate()).toBe(1);
    expect(grid[6]?.inMonth).toBe(true);
  });
});

describe("addMonthsClamped", () => {
  it("keeps the day when it fits and clamps when it doesn't", () => {
    expect(formatISODate(addMonthsClamped(new Date(2026, 0, 15), 1))).toBe("2026-02-15");
    expect(formatISODate(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(formatISODate(addMonthsClamped(new Date(2024, 0, 31), 1))).toBe("2024-02-29");
    expect(formatISODate(addMonthsClamped(new Date(2026, 0, 31), -2))).toBe("2025-11-30");
  });
});

describe("isoWeek", () => {
  it("matches known ISO week numbers", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // Thu Jan 1 2026 → week 1
    expect(isoWeek(new Date(2026, 0, 5))).toBe(2); // Mon Jan 5
    expect(isoWeek(new Date(2016, 0, 1))).toBe(53); // Fri Jan 1 2016 → week 53 of 2015
    expect(isoWeek(new Date(2020, 11, 31))).toBe(53); // Thu Dec 31 2020 → week 53
    expect(isoWeek(new Date(2026, 6, 4))).toBe(27); // Sat Jul 4 2026
  });
});

describe("formatting and helpers", () => {
  it("formats local ISO dates (no UTC day drift)", () => {
    expect(formatISODate(new Date(2026, 6, 4))).toBe("2026-07-04");
    expect(formatISODate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(formatISOMonth(2026, 0)).toBe("2026-01");
  });

  it("mondayIndex maps Mon…Sun to 0…6", () => {
    expect(mondayIndex(new Date(2026, 5, 1))).toBe(0); // Monday
    expect(mondayIndex(new Date(2026, 5, 7))).toBe(6); // Sunday
  });

  it("daysInMonth handles leap years", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
    expect(daysInMonth(2026, 6)).toBe(31);
  });
});
