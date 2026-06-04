/** Tick generation for the time axis. Pure — no React, no DOM. */

export type TickUnit = "year" | "month" | "week" | "day" | "hour";

export interface Tick {
  date: Date;
  label: string;
  major: boolean;
}

/** Auto-pick a tick unit so neighboring ticks sit roughly 80–200 px apart.
 *  Thresholds derived from (px between ticks) = pxPerDay × daysPerUnit:
 *   - year   (365 days/tick)  needs pxPerDay  <= ~0.5  for ≤ ~180 px between
 *   - month  (~30 days/tick)  needs pxPerDay  <= ~8    for ≤ ~240 px between
 *   - week   (7 days/tick)    needs pxPerDay  <= ~32   for ≤ ~225 px between
 *   - day    (1 day/tick)     needs pxPerDay  <= ~200
 *   - hour   (1/24 day/tick)  applies above ~200 px/day
 */
function pickUnit(pxPerDay: number): TickUnit {
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

function formatTick(date: Date, unit: TickUnit): string {
  switch (unit) {
    case "year":
      return date.getFullYear().toString();
    case "month":
      // Major month (January) gets the year appended so the user always knows
      // where they are when scrolling across a year boundary.
      return date.getMonth() === 0
        ? date.toLocaleString(undefined, { month: "short", year: "numeric" })
        : date.toLocaleString(undefined, { month: "short" });
    case "week":
      return date.getDate().toString();
    case "day":
      return date.toLocaleString(undefined, { day: "numeric", month: "short" });
    case "hour":
      return date.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
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

/** Compute all tick marks in [start, end]. */
export function computeTicks(start: Date, end: Date, pxPerDay: number): Tick[] {
  if (end.getTime() <= start.getTime()) return [];
  const unit = pickUnit(pxPerDay);
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
