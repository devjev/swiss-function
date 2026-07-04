/** Bar-index ↔ data-x conversion for index-spaced charts (CandlestickChart's
 *  "logical range" model — bars evenly spaced, time gaps collapsed). Pure —
 *  no React, no DOM. */

/** A bar that carries its data-x (timestamp as Date, or a number). */
export interface IndexedBar {
  x: number | Date;
}

/** Map a data-x (timestamp or number) to a fractional bar index, interpolating
 *  between neighbors — so annotations anchored at real times land correctly on
 *  the gap-free bar axis. Clamps outside the data. */
export function xToIndex(bars: readonly IndexedBar[], x: number | Date): number {
  const t = Number(x);
  let lo = 0;
  let hi = bars.length - 1;
  if (hi < 0) return 0;
  const at = (i: number) => Number((bars[i] as IndexedBar).x);
  if (t <= at(0)) return 0;
  if (t >= at(hi)) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at(mid) <= t) lo = mid;
    else hi = mid;
  }
  const span = at(hi) - at(lo);
  return span > 0 ? lo + (t - at(lo)) / span : lo;
}

/** Inverse of {@link xToIndex}: a fractional bar index back to a data-x,
 *  interpolating between the neighboring bars' x values. Returns a `Date`
 *  when the bars carry Dates. Clamps outside [0, bars.length - 1]. */
export function indexToX(bars: readonly IndexedBar[], index: number): number | Date {
  const n = bars.length;
  if (n === 0) return 0;
  const first = bars[0] as IndexedBar;
  const isDate = first.x instanceof Date;
  const clamped = Math.min(Math.max(index, 0), n - 1);
  const lo = Math.floor(clamped);
  const hi = Math.min(lo + 1, n - 1);
  const frac = clamped - lo;
  const a = Number((bars[lo] as IndexedBar).x);
  const b = Number((bars[hi] as IndexedBar).x);
  const t = a + (b - a) * frac;
  return isDate ? new Date(t) : t;
}
