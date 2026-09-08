/** Pure geometry of the horizon chart: baselines, band folding, the band
 *  ramp and the crosshair lookup. No React, no DOM. */

export type HorizonX = Date | number;

export interface HorizonDatum {
  x: HorizonX;
  y: number;
}

export type HorizonBaseline = number | "mean" | "first";

export type HorizonMode = "mirror" | "offset";

export function toNumber(x: HorizonX): number {
  return x instanceof Date ? x.getTime() : x;
}

/** The value a row folds around: a fixed number, the row's mean, or its first
 *  value. An empty row folds around 0. */
export function resolveBaseline(data: readonly HorizonDatum[], baseline: HorizonBaseline): number {
  if (typeof baseline === "number") return baseline;
  const first = data[0];
  if (!first) return 0;
  if (baseline === "first") return first.y;
  let sum = 0;
  for (const d of data) sum += d.y;
  return sum / data.length;
}

/** The largest deviation from the baseline in a row (0 for an empty row). */
export function rowMaxAbs(data: readonly HorizonDatum[], baseline: number): number {
  let max = 0;
  for (const d of data) {
    const v = Math.abs(d.y - baseline);
    if (v > max) max = v;
  }
  return max;
}

/** The band range every row folds into. A shared scale takes the largest
 *  deviation across rows (or the explicit `domain`, read as the larger
 *  magnitude of its two edges); an independent scale gives each row its own.
 *  A row with no deviation gets `1` so it draws flat instead of dividing by
 *  zero. */
export function resolveBandRanges(
  rowMaxes: readonly number[],
  shared: boolean,
  domain?: [number, number],
): number[] {
  if (domain) {
    const span = Math.max(Math.abs(domain[0]), Math.abs(domain[1])) || 1;
    return rowMaxes.map(() => span);
  }
  if (shared) {
    let max = 0;
    for (const m of rowMaxes) if (m > max) max = m;
    const span = max || 1;
    return rowMaxes.map(() => span);
  }
  return rowMaxes.map((m) => m || 1);
}

/** The filled height of band `k` (0-based) for a deviation of `abs`, as a
 *  0..1 fraction of the row: the part of the value that falls inside that
 *  band, clamped. */
export function bandLevel(abs: number, k: number, bandSpan: number): number {
  if (!(bandSpan > 0)) return 0;
  const level = (abs - k * bandSpan) / bandSpan;
  return level <= 0 ? 0 : level >= 1 ? 1 : level;
}

const px = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * The SVG area for one band of one sign in one row, or `""` when no value
 * reaches that band. `xs` are pixel x positions, `vs` the signed deviations
 * (both in x order). Positive bands, and negative bands in `mirror` mode,
 * rise from the row's bottom edge; negative bands in `offset` mode hang from
 * its top edge (Saito's original two-tone form).
 */
export function bandPath(
  xs: readonly number[],
  vs: readonly number[],
  sign: 1 | -1,
  k: number,
  bandSpan: number,
  rowTop: number,
  rowHeight: number,
  mode: HorizonMode,
): string {
  const n = Math.min(xs.length, vs.length);
  if (n === 0 || !(bandSpan > 0)) return "";
  let reaches = false;
  for (let i = 0; i < n; i++) {
    const v = vs[i] as number;
    if ((sign > 0 ? v : -v) > k * bandSpan) {
      reaches = true;
      break;
    }
  }
  if (!reaches) return "";
  const hangs = sign < 0 && mode === "offset";
  const base = hangs ? rowTop : rowTop + rowHeight;
  const parts: string[] = [];
  const x0 = xs[0] as number;
  parts.push(`M${px(x0)} ${px(base)}`);
  for (let i = 0; i < n; i++) {
    const v = vs[i] as number;
    const abs = sign > 0 ? v : -v;
    const level = abs > 0 ? bandLevel(abs, k, bandSpan) : 0;
    const y = hangs ? rowTop + level * rowHeight : rowTop + rowHeight - level * rowHeight;
    parts.push(`L${px(xs[i] as number)} ${px(y)}`);
  }
  parts.push(`L${px(xs[n - 1] as number)} ${px(base)}Z`);
  return parts.join("");
}

/** The colour of band `k` of `bands`: the sign's hue mixed toward the page
 *  background, from 55% for the first band (the floor at which a pale band
 *  still reads on a white page) up to the full hue for the last, so the ramp
 *  reads as intensity in both themes and stays single-hue. One band uses the
 *  full hue. */
export const BAND_FLOOR_PCT = 55;

export function bandColor(hue: string, k: number, bands: number): string {
  if (bands <= 1) return hue;
  const pct = Math.round(BAND_FLOOR_PCT + ((100 - BAND_FLOOR_PCT) * k) / (bands - 1));
  return pct >= 100 ? hue : `color-mix(in srgb, ${hue} ${pct}%, var(--sf-color-bg))`;
}

/** Index of the datum nearest to `xNum` in a row sorted by x (binary search),
 *  or -1 for an empty row. */
export function nearestIndex(data: readonly HorizonDatum[], xNum: number): number {
  const n = data.length;
  if (n === 0) return -1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (toNumber((data[mid] as HorizonDatum).x) < xNum) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const before = toNumber((data[lo - 1] as HorizonDatum).x);
    const at = toNumber((data[lo] as HorizonDatum).x);
    if (Math.abs(xNum - before) <= Math.abs(at - xNum)) return lo - 1;
  }
  return lo;
}

/** True when the row's x values are non-decreasing. */
export function isSortedByX(data: readonly HorizonDatum[]): boolean {
  for (let i = 1; i < data.length; i++) {
    if (toNumber((data[i] as HorizonDatum).x) < toNumber((data[i - 1] as HorizonDatum).x)) {
      return false;
    }
  }
  return true;
}
