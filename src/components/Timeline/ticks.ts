/** Tick generation for the time axis. Pure — no React, no DOM. */

export type TickUnit = "year" | "month" | "week" | "day" | "hour";

export interface Tick {
  date: Date;
  label: string;
  major: boolean;
}

/** Approximate days spanned by one tick of each unit — used to convert a target
 *  pixel spacing into a unit choice (px between ticks = pxPerDay × daysPerUnit). */
const DAYS_PER_UNIT: Record<TickUnit, number> = {
  year: 365,
  month: 30.44,
  week: 7,
  day: 1,
  hour: 1 / 24,
};

/** Auto-pick a tick unit.
 *
 *  With `targetPx`, choose the finest unit whose adjacent ticks sit at least
 *  `targetPx` apart — so a larger value yields sparser ticks.
 *
 *  Without it, fall back to the tuned defaults (neighboring ticks roughly
 *  80–200 px apart). Thresholds derived from px between = pxPerDay × daysPerUnit:
 *   - year   (365 days/tick)  needs pxPerDay  <= ~0.5  for ≤ ~180 px between
 *   - month  (~30 days/tick)  needs pxPerDay  <= ~8    for ≤ ~240 px between
 *   - week   (7 days/tick)    needs pxPerDay  <= ~32   for ≤ ~225 px between
 *   - day    (1 day/tick)     needs pxPerDay  <= ~200
 *   - hour   (1/24 day/tick)  applies above ~200 px/day
 */
function pickUnit(pxPerDay: number, targetPx?: number): TickUnit {
  if (targetPx != null) {
    const finestToCoarsest: TickUnit[] = ["hour", "day", "week", "month", "year"];
    for (const unit of finestToCoarsest) {
      if (pxPerDay * DAYS_PER_UNIT[unit] >= targetPx) return unit;
    }
    return "year";
  }
  if (pxPerDay <= 0.5) return "year";
  if (pxPerDay <= 8) return "month";
  if (pxPerDay <= 32) return "week";
  if (pxPerDay <= 200) return "day";
  return "hour";
}

/** Round a date DOWN to the start of its unit (year start, month start, …). */
function snapToUnit(date: Date, unit: TickUnit): Date {
  const d = new Date(date);
  switch (unit) {
    case "year":
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      break;
    case "month":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
    case "week": {
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      break;
    }
    case "day":
      d.setHours(0, 0, 0, 0);
      break;
    case "hour":
      d.setMinutes(0, 0, 0);
      break;
  }
  return d;
}

function nextTick(date: Date, unit: TickUnit): Date {
  const d = new Date(date);
  switch (unit) {
    case "year":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "month":
      d.setMonth(d.getMonth() + 1);
      break;
    case "week":
      d.setDate(d.getDate() + 7);
      break;
    case "day":
      d.setDate(d.getDate() + 1);
      break;
    case "hour":
      d.setHours(d.getHours() + 1);
      break;
  }
  return d;
}

// `date.toLocaleString(locale, options)` builds a fresh `Intl.DateTimeFormat`
// on every call, which is expensive; over an axis full of ticks (re-run on each
// mount) it dominated the render (~120ms — issue #72). Reuse one formatter per
// distinct option set, created lazily on first use; the output is identical
// (`toLocaleString` just delegates to `Intl.DateTimeFormat.prototype.format`).
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, options: Intl.DateTimeFormatOptions, date: Date): string {
  let formatter = formatterCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(undefined, options);
    formatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

function formatTick(date: Date, unit: TickUnit): string {
  switch (unit) {
    case "year":
      return date.getFullYear().toString();
    case "month":
      // Major month (January) gets the year appended so the user always knows
      // where they are when scrolling across a year boundary.
      return date.getMonth() === 0
        ? fmt("monthYear", { month: "short", year: "numeric" }, date)
        : fmt("month", { month: "short" }, date);
    case "week":
      return date.getDate().toString();
    case "day":
      return fmt("dayMonth", { day: "numeric", month: "short" }, date);
    case "hour":
      return fmt("hourMinute", { hour: "2-digit", minute: "2-digit", hour12: false }, date);
  }
}

function isMajor(date: Date, unit: TickUnit): boolean {
  switch (unit) {
    case "year":
      return true;
    case "month":
      return date.getMonth() === 0;
    case "week":
      return date.getDate() <= 7;
    case "day":
      return date.getDay() === 1;
    case "hour":
      return date.getHours() === 0;
    default:
      return false;
  }
}

/** Compute all tick marks in [start, end]. `targetPx`, when given, sets the
 *  minimum pixel spacing between adjacent ticks (larger = sparser). */
export function computeTicks(start: Date, end: Date, pxPerDay: number, targetPx?: number): Tick[] {
  if (end.getTime() <= start.getTime()) return [];
  const unit = pickUnit(pxPerDay, targetPx);
  const ticks: Tick[] = [];
  let cur = snapToUnit(start, unit);
  if (cur.getTime() < start.getTime()) cur = nextTick(cur, unit);
  // Safety bound — a year of hourly ticks = 8760; cap at 10000 to prevent
  // pathological ranges from hanging the render.
  let safety = 10000;
  while (cur.getTime() <= end.getTime() && safety-- > 0) {
    ticks.push({
      date: new Date(cur),
      label: formatTick(cur, unit),
      major: isMajor(cur, unit),
    });
    cur = nextTick(cur, unit);
  }
  return ticks;
}
