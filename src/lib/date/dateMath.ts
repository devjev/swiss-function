/** Calendar math for DatePicker. Pure — no React, no DOM. Local-time Date
 *  arithmetic throughout (setters absorb DST and month lengths), weeks start
 *  on MONDAY per ISO 8601 — the component's whole point (issue #30). */

export interface CalendarCell {
  date: Date;
  /** False for the leading/trailing days that pad the grid to full weeks. */
  inMonth: boolean;
}

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, delta: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + delta);
  return out;
}

/** Add months keeping the day-of-month when possible, clamping when the
 *  target month is shorter (Jan 31 + 1 → Feb 28/29, never Mar 3). */
export function addMonthsClamped(d: Date, delta: number): Date {
  const day = d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const lastDay = daysInMonth(first.getFullYear(), first.getMonth());
  first.setDate(Math.min(day, lastDay));
  return first;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month.
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based weekday index: Mon = 0 … Sun = 6. */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The month laid out as a fixed 6×7 grid (42 cells) starting on a Monday.
 *  Fixed height keeps the popup from jumping as the user pages through
 *  months; the padding days belong to the neighbor months (`inMonth: false`)
 *  and stay selectable. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = addDays(first, -mondayIndex(first));
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    cells.push({ date, inMonth: date.getMonth() === month && date.getFullYear() === year });
  }
  return cells;
}

/** ISO 8601 week number (week 1 contains the year's first Thursday —
 *  equivalently, always contains Jan 4). */
export function isoWeek(d: Date): number {
  const thursday = addDays(startOfDay(d), 3 - mondayIndex(d));
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week1Monday = addDays(startOfDay(jan4), -mondayIndex(jan4));
  // Round absorbs the ±1h DST wobble in the raw millisecond difference.
  return 1 + Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * 86_400_000));
}

/** Local-date ISO string, `YYYY-MM-DD` — never `toISOString()` (that's UTC
 *  and shifts the day across the date line). */
export function formatISODate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `YYYY-MM` view label for the calendar header. */
export function formatISOMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
}

// --- Period granularity (the `precision` prop) -------------------------------

/** The unit the picker commits: a day, an ISO week, a month, or a year. */
export type DatePickerPrecision = "day" | "week" | "month" | "year";

/** Monday 00:00 of the ISO week containing `d`. */
export function startOfISOWeek(d: Date): Date {
  return addDays(startOfDay(d), -mondayIndex(d));
}

/** ISO 8601 week-numbering year: the calendar year of the week's Thursday.
 *  Jan 1 2027 belongs to 2026-W53, so its week-year is 2026. */
export function isoWeekYear(d: Date): number {
  return addDays(startOfDay(d), 3 - mondayIndex(d)).getFullYear();
}

/** 52 or 53 — Dec 28 is always in the year's last ISO week. */
export function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(year, 11, 28));
}

/** Monday of the given ISO week (week 1 always contains Jan 4). */
export function dateFromISOWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  return addDays(startOfISOWeek(jan4), (week - 1) * 7);
}

/** `YYYY-Www` per ISO 8601, e.g. `2026-W29` — always the week-numbering
 *  year, never the calendar year of `d` itself. */
export function formatISOWeek(d: Date): string {
  const y = String(isoWeekYear(d)).padStart(4, "0");
  return `${y}-W${String(isoWeek(d)).padStart(2, "0")}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function addWeeks(d: Date, delta: number): Date {
  return addDays(d, delta * 7);
}

/** Add years keeping the month/day when possible (Feb 29 + 1y → Feb 28). */
export function addYearsClamped(d: Date, delta: number): Date {
  return addMonthsClamped(d, delta * 12);
}

export function formatISOYear(year: number): string {
  return String(year).padStart(4, "0");
}

/** First day (00:00) of the period containing `d`. */
export function startOfPeriod(d: Date, precision: DatePickerPrecision): Date {
  switch (precision) {
    case "day":
      return startOfDay(d);
    case "week":
      return startOfISOWeek(d);
    case "month":
      return startOfMonth(d);
    case "year":
      return startOfYear(d);
  }
}

/** Last day (00:00, not 23:59) of the period containing `d`. */
export function endOfPeriod(d: Date, precision: DatePickerPrecision): Date {
  switch (precision) {
    case "day":
      return startOfDay(d);
    case "week":
      return addDays(startOfISOWeek(d), 6);
    case "month":
      return new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()));
    case "year":
      return new Date(d.getFullYear(), 11, 31);
  }
}

export function isSamePeriod(a: Date, b: Date, precision: DatePickerPrecision): boolean {
  return isSameDay(startOfPeriod(a, precision), startOfPeriod(b, precision));
}

/** The period's ISO display string: `YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM` /
 *  `YYYY`. */
export function formatPeriod(d: Date, precision: DatePickerPrecision): string {
  switch (precision) {
    case "day":
      return formatISODate(d);
    case "week":
      return formatISOWeek(d);
    case "month":
      return formatISOMonth(d.getFullYear(), d.getMonth());
    case "year":
      return formatISOYear(d.getFullYear());
  }
}

/** Step by whole periods (day/week exact; month/year clamp the day). */
export function addPeriods(d: Date, delta: number, precision: DatePickerPrecision): Date {
  switch (precision) {
    case "day":
      return addDays(d, delta);
    case "week":
      return addWeeks(d, delta);
    case "month":
      return addMonthsClamped(d, delta);
    case "year":
      return addYearsClamped(d, delta);
  }
}

/** Min/max check by OVERLAP: the period is disabled only when it lies fully
 *  before `min` or fully after `max`, so a week straddling `min` stays
 *  pickable. At day precision this reduces to the plain day comparison. */
export function periodDisabled(
  d: Date,
  precision: DatePickerPrecision,
  min?: Date,
  max?: Date,
): boolean {
  if (min && endOfPeriod(d, precision).getTime() < startOfDay(min).getTime()) return true;
  if (max && startOfPeriod(d, precision).getTime() > startOfDay(max).getTime()) return true;
  return false;
}

/** First year of the fixed page containing `year` (12-year pages by default:
 *  2016-2027, 2028-2039, …). */
export function yearPageStart(year: number, size = 12): number {
  return Math.floor(year / size) * size;
}
