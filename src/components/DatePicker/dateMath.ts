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
