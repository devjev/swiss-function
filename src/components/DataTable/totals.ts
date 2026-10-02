import { formatNumber } from "../../lib/format";
import type { TotalAggregate } from "./types";

/** Aggregation for the totals row, kept pure and streaming so a 100k-row table
 *  never materializes a values array per column. `startTotal`
 *  returns an accumulator the caller feeds one value at a time; `text()` renders
 *  the result in Swiss typography (`1'284'500`), the house number format.
 *
 *  Only the named aggregates live here. A column whose `total` is a function
 *  gets the rows and the values and formats the result itself. */

/** Above this, a fraction count is noise rather than precision. */
const MAX_DIGITS = 10;

/** Fraction digits in a number as written: `2.5` → 1, `12` → 0, `1e-7` → 7.
 *  A sum of the inputs' digits is how an accountant reads it, and it is what
 *  keeps float noise (`0.1 + 0.2` → `0.30000000000000004`) off the screen. */
export function fractionDigits(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const s = String(Math.abs(value));
  const e = s.indexOf("e");
  if (e >= 0) {
    const exponent = Number(s.slice(e + 1));
    const mantissa = s.slice(0, e).split(".")[1]?.length ?? 0;
    return Math.min(MAX_DIGITS, Math.max(0, mantissa - exponent));
  }
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : Math.min(MAX_DIGITS, s.length - dot - 1);
}

/** The magnitude in a cell value, or null when there is none to aggregate.
 *  Numeric strings count (an edited cell can hold one); booleans and dates do
 *  not, since neither is a quantity to add up. */
export function toNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface TotalAccumulator {
  /** Feed one cell value. Values the aggregate cannot use are skipped. */
  add(value: unknown): void;
  /** The number the aggregate produced, or null when no value qualified. */
  value(): number | null;
  /** The result in Swiss typography, or `""` when no value qualified.
   *  `decimals` pins the fraction digits (a column's declared precision). */
  text(decimals?: number): string;
}

export function startTotal(kind: TotalAggregate): TotalAccumulator {
  let count = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let digits = 0;
  const seen = kind === "countUnique" ? new Set<string>() : null;
  const counting = kind === "count" || kind === "countUnique";

  const value = (): number | null => {
    if (counting) return seen ? seen.size : count;
    if (count === 0) return null;
    switch (kind) {
      case "sum":
        return sum;
      case "avg":
        return sum / count;
      case "min":
        return min;
      default:
        return max;
    }
  };

  return {
    add(raw) {
      // Counting is about presence, so it takes any non-empty value — a name,
      // a date, a flag — the way a spreadsheet's COUNTA does.
      if (counting) {
        if (raw == null || raw === "") return;
        count += 1;
        seen?.add(typeof raw === "string" ? raw : String(raw));
        return;
      }
      const n = toNumeric(raw);
      if (n == null) return;
      count += 1;
      sum += n;
      if (n < min) min = n;
      if (n > max) max = n;
      const d = fractionDigits(n);
      if (d > digits) digits = d;
    },
    value,
    text(decimals) {
      const v = value();
      if (v == null) return "";
      if (counting) return formatNumber(v, { decimals: 0 });
      // An average lands between the inputs, so it keeps two decimals at the
      // least; the other aggregates stay at the precision they were fed.
      if (kind === "avg") {
        return decimals != null
          ? formatNumber(v, { decimals: Math.max(decimals, 2) })
          : formatNumber(v, { maximumFractionDigits: Math.max(digits, 2) });
      }
      return formatNumber(v, { decimals: decimals ?? digits });
    },
  };
}
