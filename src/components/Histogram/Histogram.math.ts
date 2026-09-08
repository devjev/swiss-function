/** The binning and density math behind `Histogram`. Pure functions, shared by
 *  the component and its tests: nice thresholds aligned with the numeric tick
 *  algorithm, O(n) binning, normalization, the ECDF, a Gaussian kernel density
 *  estimate on a grid, and the rules of thumb that pick a bin count and a
 *  bandwidth when the consumer does not. */

import { niceTicks } from "../../lib/chart";

/** One bin: the half-open range `[x0, x1)`, except the last bin, which is closed
 *  so the maximum lands inside it (d3's `bin` contract). */
export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

export type HistogramNormalize = "count" | "density" | "percent";

/** Hard cap on the automatic bin count: past this a histogram is noise. */
export const MAX_AUTO_BINS = 200;

/** `[min, max]` of the finite values, or `null` when there are none. */
export function extent(values: readonly number[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
}

/** The p-quantile (0..1) of an ascending array by linear interpolation. */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0] as number;
  const pos = Math.min(Math.max(p, 0), 1) * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n - 1);
  const t = pos - lo;
  return (sorted[lo] as number) * (1 - t) + (sorted[hi] as number) * t;
}

function sortedFinite(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of values) if (Number.isFinite(v)) out.push(v);
  out.sort((a, b) => a - b);
  return out;
}

/** The bin count for a sample: the Freedman-Diaconis rule (bin width
 *  `2 IQR n^(-1/3)`), falling back to Sturges (`log2 n + 1`) when the IQR is
 *  zero, clamped to `[1, MAX_AUTO_BINS]`. */
export function autoBinCount(values: readonly number[]): number {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n < 2) return 1;
  const range = (sorted[n - 1] as number) - (sorted[0] as number);
  if (!(range > 0)) return 1;
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  const width = 2 * iqr * n ** (-1 / 3);
  const count = width > 0 ? Math.ceil(range / width) : Math.ceil(Math.log2(n) + 1);
  return Math.min(MAX_AUTO_BINS, Math.max(1, count));
}

/** About `count` bin edges on round numbers spanning `[min, max]`: the same
 *  nice-step ladder the axis ticks use, so bin edges and tick labels coincide.
 *  Always returns at least two edges. */
export function niceThresholds(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max <= min) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.05 : 0.5;
    return niceTicks(min - pad, max + pad, 3).map((t) => t.value);
  }
  const edges = niceTicks(min, max, Math.max(2, Math.floor(count)) + 1).map((t) => t.value);
  return edges.length >= 2 ? edges : [min, max];
}

/** Clean an explicit threshold list: finite, ascending, unique. */
export function normalizeThresholds(thresholds: readonly number[]): number[] {
  const sorted = sortedFinite(thresholds);
  const out: number[] = [];
  for (const t of sorted) if (out.length === 0 || t > (out[out.length - 1] as number)) out.push(t);
  return out;
}

/** True when the edges are evenly spaced (within float noise), which lets
 *  binning index in O(1) per value. */
export function isUniform(thresholds: readonly number[]): boolean {
  if (thresholds.length < 3) return true;
  const step = (thresholds[1] as number) - (thresholds[0] as number);
  if (!(step > 0)) return false;
  const tol = step * 1e-9;
  for (let i = 2; i < thresholds.length; i++) {
    const d = (thresholds[i] as number) - (thresholds[i - 1] as number);
    if (Math.abs(d - step) > tol) return false;
  }
  return true;
}

/** Bin `values` by the ascending `thresholds` (k + 1 edges make k bins). Values
 *  below the first edge or above the last are dropped; the last bin is closed
 *  so the maximum counts. Uniform edges index in O(1) per value; explicit
 *  irregular edges fall back to a binary search. */
export function binValues(
  values: readonly number[],
  thresholds: readonly number[],
): HistogramBin[] {
  const k = thresholds.length - 1;
  if (k < 1) return [];
  const counts = new Uint32Array(k);
  const t0 = thresholds[0] as number;
  const tk = thresholds[k] as number;
  if (isUniform(thresholds)) {
    const step = (tk - t0) / k;
    for (const v of values) {
      if (!(v >= t0 && v <= tk)) continue;
      const i = v === tk ? k - 1 : Math.min(k - 1, Math.floor((v - t0) / step));
      counts[i] = (counts[i] as number) + 1;
    }
  } else {
    for (const v of values) {
      if (!(v >= t0 && v <= tk)) continue;
      // Largest edge index i with thresholds[i] <= v, capped at the last bin.
      let lo = 0;
      let hi = k;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((thresholds[mid] as number) <= v) lo = mid;
        else hi = mid - 1;
      }
      const i = Math.min(lo, k - 1);
      counts[i] = (counts[i] as number) + 1;
    }
  }
  const bins: HistogramBin[] = [];
  for (let i = 0; i < k; i++) {
    bins.push({
      x0: thresholds[i] as number,
      x1: thresholds[i + 1] as number,
      count: counts[i] as number,
    });
  }
  return bins;
}

/** The bar height of a bin in the chosen unit: the raw count, the share of
 *  all binned values in percent, or a probability density (so the bar areas
 *  sum to 1 whatever the bin widths). */
export function normalizeBin(bin: HistogramBin, mode: HistogramNormalize, total: number): number {
  if (mode === "count" || total <= 0) return bin.count;
  if (mode === "percent") return (bin.count / total) * 100;
  const width = bin.x1 - bin.x0;
  return width > 0 ? bin.count / (total * width) : 0;
}

/** The running total at each bin's right edge, in the unit of `mode`: a count,
 *  a percent, or (for density) the cumulative probability 0..1. */
export function cumulative(
  bins: readonly HistogramBin[],
  mode: HistogramNormalize,
  total: number,
): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const b of bins) {
    acc += b.count;
    if (mode === "count" || total <= 0) out.push(acc);
    else if (mode === "percent") out.push((acc / total) * 100);
    else out.push(acc / total);
  }
  return out;
}

/** Silverman's rule of thumb for a Gaussian kernel:
 *  `0.9 min(sd, IQR / 1.34) n^(-1/5)`, with a range-based fallback when the
 *  sample has no spread. */
export function silvermanBandwidth(values: readonly number[]): number {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n < 2) return 1;
  let mean = 0;
  for (const v of sorted) mean += v;
  mean /= n;
  let ss = 0;
  for (const v of sorted) ss += (v - mean) * (v - mean);
  const sd = Math.sqrt(ss / (n - 1));
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  const spread = Math.min(sd, iqr / 1.34) || sd || iqr / 1.34;
  if (spread > 0) return 0.9 * spread * n ** (-1 / 5);
  const range = (sorted[n - 1] as number) - (sorted[0] as number);
  return range > 0 ? range / 10 : 1;
}

/** Above this many samples the density is estimated from a fine linear
 *  pre-binning instead of every point: the same curve to the pixel, at a cost
 *  that no longer grows with the sample. */
const KDE_EXACT_LIMIT = 4000;
const KDE_PREBINS = 1024;

/** A Gaussian kernel density estimate evaluated at every point of `grid`. The
 *  result is a probability density: it integrates to about 1 over the sample's
 *  support. Values outside `[min, max]` of the grid still contribute. */
export function gaussianKde(
  values: readonly number[],
  grid: readonly number[],
  bandwidth: number,
): number[] {
  const h = bandwidth > 0 ? bandwidth : 1;
  const norm = 1 / (Math.sqrt(2 * Math.PI) * h);
  const finite = sortedFinite(values);
  const n = finite.length;
  if (n === 0 || grid.length === 0) return grid.map(() => 0);
  // Sample points and their weights: every value, or pre-binned masses.
  let xs: number[];
  let ws: number[];
  if (n <= KDE_EXACT_LIMIT) {
    xs = finite;
    ws = finite.map(() => 1 / n);
  } else {
    const lo = finite[0] as number;
    const hi = finite[n - 1] as number;
    const span = hi - lo || 1;
    const mass = new Float64Array(KDE_PREBINS + 1);
    for (const v of finite) {
      const pos = ((v - lo) / span) * KDE_PREBINS;
      const i = Math.min(KDE_PREBINS - 1, Math.floor(pos));
      const t = pos - i;
      mass[i] = (mass[i] as number) + (1 - t);
      mass[i + 1] = (mass[i + 1] as number) + t;
    }
    xs = [];
    ws = [];
    for (let i = 0; i <= KDE_PREBINS; i++) {
      const m = mass[i] as number;
      if (m === 0) continue;
      xs.push(lo + (i / KDE_PREBINS) * span);
      ws.push(m / n);
    }
  }
  const cutoff = 4 * h;
  return grid.map((g) => {
    let sum = 0;
    for (let i = 0; i < xs.length; i++) {
      const d = (xs[i] as number) - g;
      if (d > cutoff || d < -cutoff) continue;
      const z = d / h;
      sum += (ws[i] as number) * Math.exp(-0.5 * z * z);
    }
    return sum * norm;
  });
}

/** `steps + 1` evenly spaced sample points from `x0` to `x1` inclusive. */
export function linspace(x0: number, x1: number, steps: number): number[] {
  const n = Math.max(1, Math.floor(steps));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(x0 + ((x1 - x0) * i) / n);
  return out;
}

/** The factor that lifts a probability density onto a histogram's y unit so the
 *  curve overlays the bars: `total · binWidth` for counts, `100 · binWidth` for
 *  percent, `1` for density. Irregular bins use their mean width. */
export function densityScale(
  bins: readonly HistogramBin[],
  mode: HistogramNormalize,
  total: number,
): number {
  if (mode === "density") return 1;
  if (bins.length === 0) return 1;
  let width = 0;
  for (const b of bins) width += b.x1 - b.x0;
  width /= bins.length;
  return (mode === "count" ? total : 100) * width;
}
