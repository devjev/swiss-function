/** Pure statistics and layout helpers for `BoxPlot`: quantiles, Tukey fences,
 *  a Gaussian kernel density estimate for the violin shape, and the resolution
 *  of raw samples or precomputed stats into one per-cell shape. */

/** The five-number summary of one sample, plus what the whisker rule adds. */
export interface BoxStats {
  /** Lower whisker end: the sample minimum (`minmax`) or the smallest value
   *  inside the lower Tukey fence. */
  min: number;
  q1: number;
  median: number;
  q3: number;
  /** Upper whisker end, the mirror of `min`. */
  max: number;
  /** Values beyond the whiskers (Tukey rule only). */
  outliers?: number[];
  /** Sample size, when known. */
  n?: number;
}

export type BoxWhiskers = "tukey" | "minmax";

/** Linear-interpolation quantile (R type 7, the spreadsheet default) of an
 *  ascending sample. `p` in `[0, 1]`. An empty sample yields `NaN`. */
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0] as number;
  const h = (n - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (h - lo);
}

/** The five-number summary of a sample under the given whisker rule. Tukey
 *  whiskers stop at the last value inside `q1 - 1.5 IQR` / `q3 + 1.5 IQR` and
 *  list what lies beyond as outliers; `minmax` whiskers run to the extremes. */
export function boxStats(values: readonly number[], whiskers: BoxWhiskers = "tukey"): BoxStats {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return {
      min: Number.NaN,
      q1: Number.NaN,
      median: Number.NaN,
      q3: Number.NaN,
      max: Number.NaN,
      n: 0,
    };
  }
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  if (whiskers === "minmax") {
    return { min: sorted[0] as number, q1, median, q3, max: sorted[n - 1] as number, n };
  }
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const outliers: number[] = [];
  for (const v of sorted) {
    if (v < lowFence || v > highFence) outliers.push(v);
    else {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  // Every value can be an outlier only when IQR is 0 and the sample is flat,
  // in which case the whiskers collapse onto the median.
  if (!Number.isFinite(min)) min = median;
  if (!Number.isFinite(max)) max = median;
  return { min, q1, median, q3, max, outliers, n };
}

/** The lowest and highest value a set of stats touches (whiskers and outliers),
 *  or `null` when nothing is finite. */
export function statsExtent(stats: readonly BoxStats[]): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const s of stats) {
    for (const v of [s.min, s.max, s.q1, s.q3, s.median, ...(s.outliers ?? [])]) {
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** A value domain with a little air around the extent so whisker ends and
 *  outlier dots never sit on the plot edge. A flat extent opens to one unit. */
export function paddedDomain(extent: [number, number], pad = 0.05): [number, number] {
  const [lo, hi] = extent;
  const span = hi - lo;
  if (span <= 0) return [lo - 1, hi + 1];
  return [lo - span * pad, hi + span * pad];
}

/** Silverman's rule-of-thumb bandwidth for a Gaussian kernel: `0.9 * min(sd,
 *  IQR / 1.34) * n^(-1/5)`. Falls back to a tenth of the range for a sample
 *  with no spread. */
export function silvermanBandwidth(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n < 2) return 1;
  let mean = 0;
  for (const v of sorted) mean += v;
  mean /= n;
  let ss = 0;
  for (const v of sorted) ss += (v - mean) ** 2;
  const sd = Math.sqrt(ss / (n - 1));
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const spread = Math.min(sd, iqr / 1.34) || sd || iqr;
  if (spread > 0) return 0.9 * spread * n ** -0.2;
  const range = (sorted[n - 1] as number) - (sorted[0] as number);
  return range > 0 ? range / 10 : 1;
}

/** One point of a density curve: the value and the estimated density there. */
export interface DensityPoint {
  x: number;
  y: number;
}

/** A Gaussian kernel density estimate sampled at `samples` evenly spaced
 *  values across `extent` (the sample's range widened by one bandwidth when
 *  omitted). Densities integrate to about 1 over the real line. */
export function gaussianKde(
  values: readonly number[],
  opts: { bandwidth?: number; samples?: number; extent?: [number, number] } = {},
): DensityPoint[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];
  const bw = opts.bandwidth ?? silvermanBandwidth(sorted);
  const samples = Math.max(2, opts.samples ?? 48);
  const [lo, hi] = opts.extent ?? [(sorted[0] as number) - bw, (sorted[n - 1] as number) + bw];
  const out: DensityPoint[] = [];
  const norm = 1 / (n * bw * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < samples; i++) {
    const x = lo + ((hi - lo) * i) / (samples - 1);
    let sum = 0;
    for (const v of sorted) {
      const z = (x - v) / bw;
      sum += Math.exp(-0.5 * z * z);
    }
    out.push({ x, y: sum * norm });
  }
  return out;
}

/** The violin's density curve: estimated from every value, drawn between the
 *  whisker ends widened by one bandwidth, so the Tukey outliers stay dots
 *  outside the body instead of pulling a thin stalk out of it. */
export function violinCurve(values: readonly number[], stats: BoxStats): DensityPoint[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const bw = silvermanBandwidth(sorted);
  return gaussianKde(sorted, { bandwidth: bw, extent: [stats.min - bw, stats.max + bw] });
}

/** One series' input: raw samples per category, precomputed stats per category,
 *  or both (stats win for the summary, samples still feed the violin). */
export interface BoxSeriesInput {
  name: string;
  values?: readonly (readonly number[])[];
  stats?: readonly BoxStats[];
}

/** A resolved cell: what the chart draws for one series in one category. */
export interface BoxCell {
  stats: BoxStats;
  /** The raw sample, when given, for the density shape. */
  values?: readonly number[];
}

/** Resolve every (series, category) cell to its stats: precomputed stats win,
 *  raw samples are summarised under the whisker rule, a missing cell is `null`. */
export function resolveCells(
  series: readonly BoxSeriesInput[],
  categoryCount: number,
  whiskers: BoxWhiskers,
): (BoxCell | null)[][] {
  return series.map((s) => {
    const row: (BoxCell | null)[] = [];
    for (let ci = 0; ci < categoryCount; ci++) {
      const stats = s.stats?.[ci];
      const values = s.values?.[ci];
      if (stats) row.push({ stats, values });
      else if (values && values.length > 0) row.push({ stats: boxStats(values, whiskers), values });
      else row.push(null);
    }
    return row;
  });
}

/** Thin a stack of row labels (a categorical axis running vertically) so no
 *  two overlap: keep every `stride`-th label where the stride is the number of
 *  rows one label's height covers, always keeping the first and the last. */
export function thinRows(count: number, stepPx: number, labelPx = 16): boolean[] {
  if (count === 0) return [];
  const stride = stepPx >= labelPx ? 1 : Math.ceil(labelPx / Math.max(stepPx, 1e-6));
  const keep = new Array<boolean>(count).fill(false);
  for (let i = 0; i < count; i += stride) keep[i] = true;
  // The last label must survive; drop its predecessor if that would collide.
  if (!keep[count - 1]) {
    keep[count - 1] = true;
    for (let i = count - 2; i > count - 1 - stride && i >= 0; i--) keep[i] = false;
    keep[0] = true;
  }
  return keep;
}
