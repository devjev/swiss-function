import { describe, expect, it } from "vitest";
import type { DateLevel } from "../../lib/date";
import { formatISODate } from "../../lib/date";
import {
  levelColumns,
  levelLabel,
  levelOptions,
  normalizePath,
  optionAriaLabel,
  optionLabel,
  stepUnit,
} from "./datePath";

const iso = (dates: Date[]) => dates.map(formatISODate);

describe("normalizePath", () => {
  it("keeps a chain where each step narrows the one before it", () => {
    expect(normalizePath(["year", "month", "day"])).toEqual(["year", "month", "day"]);
    expect(normalizePath(["year", "quarter", "month", "day"])).toEqual([
      "year",
      "quarter",
      "month",
      "day",
    ]);
    expect(normalizePath(["year", "week", "day"])).toEqual(["year", "week", "day"]);
  });

  it("keeps the first step whatever it is: it carries its own context", () => {
    expect(normalizePath(["month", "day"])).toEqual(["month", "day"]);
    expect(normalizePath(["week", "day"])).toEqual(["week", "day"]);
    expect(normalizePath(["day"])).toEqual(["day"]);
  });

  it("drops a step that cannot narrow the one before it", () => {
    // A week straddles month ends, so it never sits inside a month.
    expect(normalizePath(["year", "month", "week"])).toEqual(["year", "month"]);
    // A day is not a step away from a year or a quarter.
    expect(normalizePath(["year", "day"])).toEqual(["year"]);
    expect(normalizePath(["year", "quarter", "day"])).toEqual(["year", "quarter"]);
    // Backwards, and a repeat.
    expect(normalizePath(["month", "year"])).toEqual(["month"]);
    expect(normalizePath(["year", "year"])).toEqual(["year"]);
  });

  it("returns nothing for nothing", () => {
    expect(normalizePath([])).toEqual([]);
  });
});

describe("stepUnit", () => {
  it("pages the years at a year step", () => {
    expect(stepUnit(["year", "month"], 0)).toBe("yearPage");
  });

  it("steps the step above when the path has one", () => {
    expect(stepUnit(["year", "month"], 1)).toBe("year");
    expect(stepUnit(["year", "quarter", "month"], 2)).toBe("quarter");
    expect(stepUnit(["year", "week", "day"], 2)).toBe("week");
  });

  it("steps the context when the first step has no step above it", () => {
    expect(stepUnit(["month", "day"], 0)).toBe("year");
    expect(stepUnit(["week", "day"], 0)).toBe("year");
    expect(stepUnit(["day"], 0)).toBe("month");
  });
});

describe("levelOptions", () => {
  const cursor = new Date(2026, 6, 14); // 2026-07-14, a Tuesday in W29

  it("pages years in twelves, aligned to the page the cursor is in", () => {
    const years = levelOptions(cursor, "year").map((d) => d.getFullYear());
    expect(years).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  });

  it("gives the four quarters of the cursor's year", () => {
    expect(iso(levelOptions(cursor, "quarter"))).toEqual([
      "2026-01-01",
      "2026-04-01",
      "2026-07-01",
      "2026-10-01",
    ]);
  });

  it("gives twelve months of a year, or the three of a quarter", () => {
    expect(levelOptions(cursor, "month")).toHaveLength(12);
    expect(iso(levelOptions(cursor, "month", "quarter"))).toEqual([
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
    ]);
  });

  it("gives the ISO weeks of the week-numbering year, Mondays", () => {
    const weeks = levelOptions(cursor, "week");
    expect(weeks).toHaveLength(53); // 2026 is a 53-week year
    expect(formatISODate(weeks[0] as Date)).toBe("2025-12-29");
    expect(weeks.every((d) => d.getDay() === 1)).toBe(true);
  });

  it("gives a month's days, or a week's seven", () => {
    expect(levelOptions(cursor, "day", "month")).toHaveLength(31);
    expect(iso(levelOptions(cursor, "day", "week"))).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
  });

  it("counts February's days, leap year included", () => {
    expect(levelOptions(new Date(2024, 1, 10), "day", "month")).toHaveLength(29);
    expect(levelOptions(new Date(2026, 1, 10), "day", "month")).toHaveLength(28);
  });
});

describe("labels", () => {
  const d = new Date(2026, 6, 14);

  it("names a picked value for the header trail", () => {
    expect(levelLabel(d, "year")).toBe("2026");
    expect(levelLabel(d, "quarter")).toBe("Q3");
    expect(levelLabel(d, "day")).toBe("14");
    expect(levelLabel(new Date(2026, 6, 13), "week")).toBe("W29");
  });

  it("carries the date a week starts on into its option", () => {
    const monday = new Date(2026, 6, 13);
    expect(optionLabel(monday, "week")).toMatch(/^W29 /);
    expect(optionLabel(d, "year")).toBe(levelLabel(d, "year"));
  });

  it("spells an option out for a screen reader", () => {
    expect(optionAriaLabel(d, "day")).toBe("2026-07-14");
    expect(optionAriaLabel(d, "quarter")).toBe("Q3 2026");
    expect(optionAriaLabel(d, "year")).toBe("2026");
    expect(optionAriaLabel(new Date(2026, 6, 13), "week")).toMatch(/^Week 29, 2026, from /);
  });
});

describe("levelColumns", () => {
  it("lays a step out in the columns its options read best in", () => {
    const cols: Record<DateLevel, number> = {
      year: 3,
      quarter: 2,
      month: 3,
      week: 2,
      day: 7,
    };
    for (const [level, n] of Object.entries(cols)) {
      expect(levelColumns(level as DateLevel)).toBe(n);
    }
  });
});
