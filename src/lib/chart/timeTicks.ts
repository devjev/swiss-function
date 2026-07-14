/** Adaptive time-axis tick generation for zoomable charts. Pure — no React,
 *  no DOM.
 *
 *  Ticks always land on real calendar boundaries (midnight, the 1st, Jan 1),
 *  so the axis morphs cleanly between units as the domain zooms: 15-minute
 *  ticks become hourly, daily, monthly — never an arbitrary timestamp like
 *  10:07. Labels use *boundary promotion*: each tick is labeled by the
 *  largest calendar unit that changes at it (a midnight tick reads "Mar 5",
 *  the 1st reads "Mar", Jan 1 reads "2024"), and promoted ticks carry
 *  `major: true` so the axis emphasizes them by weight.
 *
 *  The step ladder mirrors d3-time's: 1/5/15/30 s, 1/5/15/30 min,
 *  1/3/6/12 h, 1/2 d, 1 w, 1/3 mo, 1 y, then 1/2/5×10ⁿ years. Calendar math
 *  uses local-time Date setters, which absorb DST shifts and month-length
 *  irregularity (see Timeline/ticks.ts for the fixed-unit ancestor of this
 *  module — Timeline keeps its own because its scrub/snap semantics are tuned
 *  to whole days).
 */

export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

export interface TimeTick {
  date: Date;
  label: string;
  /** Promoted tick — a larger unit than the tick step starts here. */
  major: boolean;
}

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 30.44 * MS_DAY;
const MS_YEAR = 365.25 * MS_DAY;

interface Rung {
  unit: TimeUnit;
  step: number;
  ms: number;
}

const LADDER: Rung[] = [
  { unit: "second", step: 1, ms: MS_SECOND },
  { unit: "second", step: 5, ms: 5 * MS_SECOND },
  { unit: "second", step: 15, ms: 15 * MS_SECOND },
  { unit: "second", step: 30, ms: 30 * MS_SECOND },
  { unit: "minute", step: 1, ms: MS_MINUTE },
  { unit: "minute", step: 5, ms: 5 * MS_MINUTE },
  { unit: "minute", step: 15, ms: 15 * MS_MINUTE },
  { unit: "minute", step: 30, ms: 30 * MS_MINUTE },
  { unit: "hour", step: 1, ms: MS_HOUR },
  { unit: "hour", step: 3, ms: 3 * MS_HOUR },
  { unit: "hour", step: 6, ms: 6 * MS_HOUR },
  { unit: "hour", step: 12, ms: 12 * MS_HOUR },
  { unit: "day", step: 1, ms: MS_DAY },
  { unit: "day", step: 2, ms: 2 * MS_DAY },
  { unit: "week", step: 1, ms: MS_WEEK },
  { unit: "month", step: 1, ms: MS_MONTH },
  { unit: "month", step: 3, ms: 3 * MS_MONTH },
  { unit: "year", step: 1, ms: MS_YEAR },
];

/** Rank for "which unit is larger" comparisons (week sits between day and
 *  month even though it is not a promotion level). Exposed as `unitRank` for
 *  charts that promote ticks on irregular grids (CandlestickChart labels
 *  bar-index ticks by calendar boundary). */
const UNIT_RANK: Record<TimeUnit, number> = {
  second: 0,
  minute: 1,
  hour: 2,
  day: 3,
  week: 4,
  month: 5,
  year: 6,
};

export function unitRank(unit: TimeUnit): number {
  return UNIT_RANK[unit];
}

/** Pick the ladder rung whose step best matches one tick per ~`targetSpacingPx`
 *  of plot width. Above the ladder the step becomes 1/2/5×10ⁿ years. */
export function pickTimeUnit(
  spanMs: number,
  widthPx: number,
  targetSpacingPx = 80,
): { unit: TimeUnit; step: number } {
  const count = Math.max(1, widthPx / targetSpacingPx);
  const target = spanMs / count;
  const top = LADDER[LADDER.length - 1] as Rung;
  if (target > top.ms) {
    return { unit: "year", step: niceYearStep(target / MS_YEAR) };
  }
  let i = 0;
  while (i < LADDER.length && (LADDER[i] as Rung).ms < target) i++;
  if (i === 0) return { unit: "second", step: 1 };
  const lower = LADDER[i - 1] as Rung;
  const upper = LADDER[i] as Rung;
  // Geometric midpoint choice (steps are log-spaced, so compare ratios).
  return target / lower.ms < upper.ms / target
    ? { unit: lower.unit, step: lower.step }
    : { unit: upper.unit, step: upper.step };
}

/** Round a year count up to 1/2/5 × 10ⁿ (the numeric nice-step ladder). */
function niceYearStep(rawYears: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawYears));
  const normalized = rawYears / magnitude;
  let factor: number;
  if (normalized <= 1) factor = 1;
  else if (normalized <= 2) factor = 2;
  else if (normalized <= 5) factor = 5;
  else factor = 10;
  return Math.max(1, factor * magnitude);
}

/** Round a date DOWN to the start of its unit (second → zero ms, …, year →
 *  Jan 1 midnight). Weeks start on Sunday, matching Timeline. */
export function startOfUnit(date: Date, unit: TimeUnit): Date {
  const d = new Date(date);
  switch (unit) {
    case "second":
      d.setMilliseconds(0);
      break;
    case "minute":
      d.setSeconds(0, 0);
      break;
    case "hour":
      d.setMinutes(0, 0, 0);
      break;
    case "day":
      d.setHours(0, 0, 0, 0);
      break;
    case "week":
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      break;
    case "month":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
    case "year":
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d;
}

/** Snap DOWN to a boundary aligned to `step` multiples of `unit` (minute 15 →
 *  :00/:15/:30/:45; month 3 → Jan/Apr/Jul/Oct; day 2 → odd days of month). */
function snapToStep(date: Date, unit: TimeUnit, step: number): Date {
  const d = startOfUnit(date, unit);
  if (step <= 1) return d;
  switch (unit) {
    case "second":
      d.setSeconds(d.getSeconds() - (d.getSeconds() % step));
      break;
    case "minute":
      d.setMinutes(d.getMinutes() - (d.getMinutes() % step));
      break;
    case "hour":
      d.setHours(d.getHours() - (d.getHours() % step));
      break;
    case "day":
      // Aligned within the month (1st, 3rd, 5th, …) so ticks stay calendar-
      // stable; realigns at each month start.
      d.setDate(d.getDate() - ((d.getDate() - 1) % step));
      break;
    case "month":
      d.setMonth(d.getMonth() - (d.getMonth() % step));
      break;
    case "year":
      d.setFullYear(d.getFullYear() - (d.getFullYear() % step));
      break;
    case "week":
      break;
  }
  return d;
}

/** The tick after `date` on the same step grid. Date setters normalize
 *  overflow, absorbing DST shifts and month lengths. */
function nextTick(date: Date, unit: TimeUnit, step: number): Date {
  const d = new Date(date);
  switch (unit) {
    case "second":
      d.setSeconds(d.getSeconds() + step);
      break;
    case "minute":
      d.setMinutes(d.getMinutes() + step);
      break;
    case "hour":
      d.setHours(d.getHours() + step);
      break;
    case "day":
      d.setDate(d.getDate() + step);
      break;
    case "week":
      d.setDate(d.getDate() + 7 * step);
      break;
    case "month":
      d.setMonth(d.getMonth() + step);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + step);
      break;
  }
  // Multi-step grids realign after normalization (a "+2 days" from the 31st
  // lands on the 2nd; snap back to the month-local grid).
  return step > 1 ? snapToStep(d, unit, step) : d;
}

/** Promotion levels, largest first. `week` is excluded — a week tick is
 *  labeled as the day it starts on. */
const PROMOTION_LEVELS: TimeUnit[] = ["year", "month", "day", "hour", "minute", "second"];

/** The largest calendar unit that starts exactly at `date` (Jan 1 midnight →
 *  "year", any other 1st → "month", any other midnight → "day", …). */
export function promotionLevel(date: Date): TimeUnit {
  for (const unit of PROMOTION_LEVELS) {
    if (startOfUnit(date, unit).getTime() === date.getTime()) return unit;
  }
  return "second";
}

// `toLocaleString(locale, options)` constructs a fresh `Intl.DateTimeFormat`
// per call; over a re-ticking axis (zoom/pan) that adds up. Reuse one formatter
// per option set, created lazily — identical output, far cheaper. Mirrors the
// fix in Timeline/ticks.ts (issue #72).
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, options: Intl.DateTimeFormatOptions, date: Date): string {
  let formatter = formatterCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(undefined, options);
    formatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

/** Format `date` at a given promotion level. Locale-default, ≤ 8 characters
 *  at every level so labels never crowd (the Lightweight Charts guideline). */
export function formatTimeTick(date: Date, level: TimeUnit): string {
  switch (level) {
    case "year":
      return String(date.getFullYear());
    case "month":
      return fmt("month", { month: "short" }, date);
    case "week":
    case "day":
      return fmt("monthDay", { month: "short", day: "numeric" }, date);
    case "hour":
    case "minute":
      return fmt("hourMinute", { hour: "2-digit", minute: "2-digit", hour12: false }, date);
    case "second":
      return fmt(
        "hourMinuteSecond",
        { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false },
        date,
      );
  }
}

/** Compute adaptive ticks for the (zoomed) domain [startMs, endMs] rendered
 *  at `widthPx`. Tick density targets one label per ~`targetSpacingPx`. */
export function timeTicks(
  startMs: number,
  endMs: number,
  widthPx: number,
  targetSpacingPx = 80,
): TimeTick[] {
  if (!(endMs > startMs) || widthPx <= 0) return [];
  const { unit, step } = pickTimeUnit(endMs - startMs, widthPx, targetSpacingPx);
  const ticks: TimeTick[] = [];
  let cur = snapToStep(new Date(startMs), unit, step);
  if (cur.getTime() < startMs) cur = nextTick(cur, unit, step);
  // Safety bound: at the chosen density a plot fits ~width/spacing ticks;
  // 10k covers any sane plot while guarding pathological domains.
  let safety = 10_000;
  while (cur.getTime() <= endMs && safety-- > 0) {
    const level = promotionLevel(cur);
    // Year ticks promote at decades-of-step; everything else promotes when a
    // unit larger than the tick step starts here.
    const major =
      unit === "year" ? cur.getFullYear() % (step * 5) === 0 : UNIT_RANK[level] > UNIT_RANK[unit];
    ticks.push({ date: cur, label: formatTimeTick(cur, level), major });
    cur = nextTick(cur, unit, step);
  }
  return ticks;
}
