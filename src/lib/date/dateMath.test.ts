import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  addPeriods,
  addYearsClamped,
  dateFromISOWeek,
  daysInMonth,
  endOfPeriod,
  formatISODate,
  formatISOMonth,
  formatISOWeek,
  formatPeriod,
  isoWeek,
  isoWeeksInYear,
  isoWeekYear,
  isSamePeriod,
  mondayIndex,
  monthGrid,
  periodDisabled,
  startOfISOWeek,
  startOfPeriod,
  yearPageStart,
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

describe("ISO weeks across year boundaries", () => {
  it("startOfISOWeek is the Monday, possibly in the prior year", () => {
    // Thu Jan 1 2026 → Monday Dec 29 2025.
    expect(formatISODate(startOfISOWeek(new Date(2026, 0, 1)))).toBe("2025-12-29");
    expect(formatISODate(startOfISOWeek(new Date(2026, 5, 1)))).toBe("2026-06-01");
  });

  it("isoWeekYear follows the week's Thursday", () => {
    expect(isoWeekYear(new Date(2026, 0, 1))).toBe(2026); // Thu Jan 1 2026
    expect(isoWeekYear(new Date(2016, 0, 1))).toBe(2015); // Fri Jan 1 2016 → 2015-W53
    expect(isoWeekYear(new Date(2024, 11, 30))).toBe(2025); // Mon Dec 30 2024 → 2025-W01
  });

  it("formatISOWeek always uses the week-numbering year", () => {
    expect(formatISOWeek(new Date(2026, 6, 4))).toBe("2026-W27");
    expect(formatISOWeek(new Date(2016, 0, 1))).toBe("2015-W53");
    expect(formatISOWeek(new Date(2026, 0, 5))).toBe("2026-W02");
  });

  it("isoWeeksInYear is 52 or 53", () => {
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeeksInYear(2026)).toBe(53);
  });

  it("dateFromISOWeek round-trips with isoWeek/isoWeekYear", () => {
    const monday = dateFromISOWeek(2026, 29);
    expect(formatISODate(monday)).toBe("2026-07-13");
    expect(isoWeek(monday)).toBe(29);
    expect(isoWeekYear(monday)).toBe(2026);
    expect(formatISODate(dateFromISOWeek(2015, 53))).toBe("2015-12-28");
  });
});

describe("periods", () => {
  const d = new Date(2026, 6, 15); // Wed Jul 15 2026

  it("startOfPeriod / endOfPeriod per precision", () => {
    expect(formatISODate(startOfPeriod(d, "day"))).toBe("2026-07-15");
    expect(formatISODate(startOfPeriod(d, "week"))).toBe("2026-07-13");
    expect(formatISODate(endOfPeriod(d, "week"))).toBe("2026-07-19");
    expect(formatISODate(startOfPeriod(d, "month"))).toBe("2026-07-01");
    expect(formatISODate(endOfPeriod(d, "month"))).toBe("2026-07-31");
    expect(formatISODate(startOfPeriod(d, "year"))).toBe("2026-01-01");
    expect(formatISODate(endOfPeriod(d, "year"))).toBe("2026-12-31");
  });

  it("isSamePeriod compares by period start", () => {
    expect(isSamePeriod(new Date(2026, 6, 13), new Date(2026, 6, 19), "week")).toBe(true);
    expect(isSamePeriod(new Date(2026, 6, 19), new Date(2026, 6, 20), "week")).toBe(false);
    expect(isSamePeriod(new Date(2026, 6, 1), new Date(2026, 6, 31), "month")).toBe(true);
    expect(isSamePeriod(new Date(2026, 0, 1), new Date(2026, 11, 31), "year")).toBe(true);
    expect(isSamePeriod(new Date(2026, 11, 31), new Date(2027, 0, 1), "year")).toBe(false);
  });

  it("formatPeriod dispatches per precision", () => {
    expect(formatPeriod(d, "day")).toBe("2026-07-15");
    expect(formatPeriod(d, "week")).toBe("2026-W29");
    expect(formatPeriod(d, "month")).toBe("2026-07");
    expect(formatPeriod(d, "year")).toBe("2026");
  });

  it("addPeriods steps by whole periods, clamping month/year", () => {
    expect(formatISODate(addPeriods(d, 2, "week"))).toBe("2026-07-29");
    expect(formatISODate(addPeriods(new Date(2026, 0, 31), 1, "month"))).toBe("2026-02-28");
    expect(formatISODate(addYearsClamped(new Date(2024, 1, 29), 1))).toBe("2025-02-28");
    expect(formatISODate(addPeriods(new Date(2024, 1, 29), 1, "year"))).toBe("2025-02-28");
  });

  it("periodDisabled uses overlap, not containment", () => {
    const min = new Date(2026, 6, 15); // Wednesday
    // The week containing Wednesday min stays pickable; the prior week not.
    expect(periodDisabled(new Date(2026, 6, 13), "week", min)).toBe(false);
    expect(periodDisabled(new Date(2026, 6, 6), "week", min)).toBe(true);
    // June is fully before min; July overlaps.
    expect(periodDisabled(new Date(2026, 5, 1), "month", min)).toBe(true);
    expect(periodDisabled(new Date(2026, 6, 1), "month", min)).toBe(false);
    // The year containing max stays pickable.
    expect(periodDisabled(new Date(2026, 0, 1), "year", undefined, new Date(2026, 0, 2))).toBe(
      false,
    );
    expect(periodDisabled(new Date(2027, 0, 1), "year", undefined, new Date(2026, 0, 2))).toBe(
      true,
    );
    // Day precision reduces to the plain comparison.
    expect(periodDisabled(new Date(2026, 6, 14), "day", min)).toBe(true);
    expect(periodDisabled(new Date(2026, 6, 15), "day", min)).toBe(false);
    // No bounds → never disabled.
    expect(periodDisabled(d, "week")).toBe(false);
  });

  it("yearPageStart pages in fixed dozens", () => {
    expect(yearPageStart(2026)).toBe(2016);
    expect(yearPageStart(2028)).toBe(2028);
    expect(yearPageStart(2016)).toBe(2016);
  });
});
