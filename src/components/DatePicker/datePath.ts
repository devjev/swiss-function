import type { DateLevel } from "../../lib/date";
import {
  addDays,
  dateFromISOWeek,
  daysInMonth,
  formatISODate,
  formatISOYear,
  isoWeek,
  isoWeeksInYear,
  isoWeekYear,
  quarterOf,
  startOfISOWeek,
  yearPageStart,
} from "../../lib/date";

/** The drill-down path (`DatePicker path={…}`): the levels a value is picked
 *  through, one step at a time. Kept pure and separate from the component so
 *  the chain rules, the options at each step and the labels test without a DOM.
 */

/** Which level each step may narrow. A step always narrows the one before it,
 *  so the chain is fixed: an ISO week straddles month ends, so a week narrows
 *  a year and never a month or a quarter, and a day narrows a month or a week
 *  (a year of 365 options is not a step, it is a scroll). */
const PARENTS: Record<DateLevel, readonly DateLevel[]> = {
  year: [],
  quarter: ["year"],
  month: ["year", "quarter"],
  week: ["year"],
  day: ["month", "week"],
};

/** Years per page at the year step. */
export const YEAR_PAGE = 12;

/** The path with every step that cannot narrow the one before it dropped. The
 *  first step is always kept: it carries its own context (a path of
 *  `["month", "day"]` picks within the current year). */
export function normalizePath(path: readonly DateLevel[]): DateLevel[] {
  const out: DateLevel[] = [];
  for (const level of path) {
    const prev = out[out.length - 1];
    if (prev === undefined || PARENTS[level].includes(prev)) out.push(level);
  }
  return out;
}

/** The unit the header's ‹ › paddles step at `index`: the step above it when
 *  the path has one, else the context that step sits in (a year over a
 *  quarter, month or week; a month over a day). At the year step there is no
 *  context, so they page the years. */
export function stepUnit(path: readonly DateLevel[], index: number): DateLevel | "yearPage" {
  const level = path[index];
  if (level === undefined || level === "year") return "yearPage";
  const prev = path[index - 1];
  if (prev !== undefined) return prev;
  return level === "day" ? "month" : "year";
}

/** The options at a step, as period starts in display order. `parent` is the
 *  step above it, which narrows two of them: months inside a quarter are that
 *  quarter's three, and days inside a week are that week's seven. */
export function levelOptions(cursor: Date, level: DateLevel, parent?: DateLevel): Date[] {
  switch (level) {
    case "year": {
      const first = yearPageStart(cursor.getFullYear(), YEAR_PAGE);
      return Array.from({ length: YEAR_PAGE }, (_, i) => new Date(first + i, 0, 1));
    }
    case "quarter":
      return Array.from({ length: 4 }, (_, i) => new Date(cursor.getFullYear(), i * 3, 1));
    case "month": {
      if (parent === "quarter") {
        const first = quarterOf(cursor) * 3;
        return Array.from({ length: 3 }, (_, i) => new Date(cursor.getFullYear(), first + i, 1));
      }
      return Array.from({ length: 12 }, (_, i) => new Date(cursor.getFullYear(), i, 1));
    }
    case "week": {
      // The weeks of the ISO week-numbering year, which is what a week belongs
      // to: 2026-W01 starts on 2025-12-29.
      const year = isoWeekYear(cursor);
      return Array.from({ length: isoWeeksInYear(year) }, (_, i) => dateFromISOWeek(year, i + 1));
    }
    case "day": {
      if (parent === "week") {
        const monday = startOfISOWeek(cursor);
        return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      }
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      return Array.from(
        { length: daysInMonth(year, month) },
        (_, i) => new Date(year, month, i + 1),
      );
    }
  }
}

/** Columns the step's grid is laid out in, so the arrow keys and the CSS agree
 *  on where up and down land. */
export function levelColumns(level: DateLevel): number {
  switch (level) {
    case "quarter":
    case "week":
      return 2;
    case "day":
      return 7;
    default:
      return 3;
  }
}

/** What a picked value reads as in the header's trail: `2026`, `Q3`, `Jul`,
 *  `W29`, `14`. */
export function levelLabel(d: Date, level: DateLevel): string {
  switch (level) {
    case "year":
      return formatISOYear(d.getFullYear());
    case "quarter":
      return `Q${quarterOf(d) + 1}`;
    case "month":
      return d.toLocaleDateString(undefined, { month: "short" });
    case "week":
      return `W${String(isoWeek(d)).padStart(2, "0")}`;
    case "day":
      return String(d.getDate());
  }
}

/** What an option reads as in the grid. A week carries the date it starts on,
 *  since nobody knows week 29 by its number alone. */
export function optionLabel(d: Date, level: DateLevel): string {
  if (level !== "week") return levelLabel(d, level);
  return `${levelLabel(d, level)} ${d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })}`;
}

/** The option's accessible name: spelled out, since the grid's text is clipped
 *  to a cell. */
export function optionAriaLabel(d: Date, level: DateLevel): string {
  switch (level) {
    case "year":
      return formatISOYear(d.getFullYear());
    case "quarter":
      return `Q${quarterOf(d) + 1} ${d.getFullYear()}`;
    case "month":
      return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    case "week":
      return `Week ${isoWeek(d)}, ${isoWeekYear(d)}, from ${d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
      })}`;
    case "day":
      return formatISODate(d);
  }
}
