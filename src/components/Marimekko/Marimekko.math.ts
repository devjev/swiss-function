/** The layout of a Marimekko: column widths from one measure, segment stacks
 *  from another, the label-fit test and the shares the tooltip reports. Pure
 *  functions in px and data space, shared by the component and its tests. */

/** One column's (or row's) extent along the width axis, snapped to px. */
export interface Band {
  start: number;
  size: number;
}

/** One segment of a stack: its start and end in the column's value space
 *  (cumulative), its raw value and its share of the column. */
export interface Segment {
  start: number;
  end: number;
  value: number;
  /** Fraction of the column's total, `0` when the column is empty. */
  share: number;
}

/** A category label placed on the width axis after the fit test. */
export interface FittedLabel {
  index: number;
  label: string;
  /** Full text when `label` was truncated. */
  title?: string;
  /** Centre as a 0..1 fraction of the axis. */
  position: number;
}

/** A value that is not a finite non-negative number counts as zero: a stack
 *  cannot carry a negative or missing part. */
export function cleanValue(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Column totals: the sum of every series' value per category. */
export function columnTotals(values: readonly (readonly number[])[], count: number): number[] {
  const totals = new Array<number>(count).fill(0);
  for (const row of values) {
    for (let i = 0; i < count; i++) totals[i] = (totals[i] ?? 0) + cleanValue(row[i]);
  }
  return totals;
}

/** The width measure per column: the column's total (the default) or an
 *  explicit measure. A measure that is missing or not positive gives the
 *  column zero width. */
export function widthMeasures(
  totals: readonly number[],
  widthBy: "total" | readonly number[] | undefined,
): number[] {
  if (widthBy === undefined || widthBy === "total") return totals.map((t) => cleanValue(t));
  return totals.map((_, i) => cleanValue(widthBy[i]));
}

/** Lay the columns along an axis of `lengthPx`: each takes its share of the
 *  length left after the gaps, edges snapped to whole px so the hairlines
 *  between them stay crisp. Every column gets at least one px when the axis
 *  has room, so a tiny column still reads as present. When every measure is
 *  zero the columns share the axis equally. */
export function layoutBands(measures: readonly number[], lengthPx: number, gapPx: number): Band[] {
  const n = measures.length;
  if (n === 0 || lengthPx <= 0) return [];
  const gap = Math.max(0, gapPx);
  const available = Math.max(0, lengthPx - gap * (n - 1));
  let total = 0;
  for (const m of measures) total += m;
  const shares = total > 0 ? measures.map((m) => m / total) : measures.map(() => 1 / n);
  const bands: Band[] = [];
  let cursor = 0;
  let prevEnd = 0;
  for (let i = 0; i < n; i++) {
    const size = available * (shares[i] ?? 0);
    const start = Math.max(prevEnd, Math.round(cursor));
    let end = Math.round(cursor + size);
    if (end <= start && available >= n) end = start + 1;
    if (end < start) end = start;
    bands.push({ start, size: end - start });
    prevEnd = end + gap;
    cursor += size + gap;
  }
  return bands;
}

/** Stack one column's values from zero. With `normalize` the stack runs
 *  0..1 (each segment its share of the column); otherwise it runs in the
 *  values' own units. */
export function stackColumn(values: readonly number[], normalize: boolean): Segment[] {
  const clean = values.map(cleanValue);
  let total = 0;
  for (const v of clean) total += v;
  const out: Segment[] = [];
  let cursor = 0;
  for (const v of clean) {
    const share = total > 0 ? v / total : 0;
    const size = normalize ? share : v;
    out.push({ start: cursor, end: cursor + size, value: v, share });
    cursor += size;
  }
  return out;
}

/** A printed label fits its segment when its measured width leaves `padPx`
 *  on either side and the segment is at least `minHeightPx` tall. */
export function labelFits(
  textPx: number,
  widthPx: number,
  heightPx: number,
  padPx = 6,
  minHeightPx = 14,
): boolean {
  return heightPx >= minHeightPx && textPx + padPx * 2 <= widthPx;
}

/** Percent text for a share: whole percents, `<1%` for a sliver, `0%` for an
 *  empty part. */
export function formatShare(share: number): string {
  if (!(share > 0)) return "0%";
  const pct = share * 100;
  if (pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

/** Fit category labels to bands of varying size. Each label is confined to
 *  its own band (minus a gap), so kept labels can never collide: a label that
 *  fits is kept whole, one that does not is ellipsized when at least `minCh`
 *  characters survive, and dropped otherwise. The first and last labels keep
 *  whatever ellipsis fits, so the axis range stays readable. An optional
 *  `suffix` per label (the column's share) is kept whole and only the head is
 *  ellipsized; when not even the suffix fits the label is dropped. `measure`
 *  returns a text's width in px; `ellipsize` is the shared truncation. */
export function fitBandLabels(
  labels: readonly string[],
  bands: readonly Band[],
  axisLengthPx: number,
  measure: (text: string) => number,
  ellipsize: (text: string, maxPx: number, measure: (t: string) => number) => string,
  opts?: { gapPx?: number; minCh?: number; suffixes?: readonly string[] },
): FittedLabel[] {
  const gap = opts?.gapPx ?? 6;
  const minCh = opts?.minCh ?? 3;
  const out: FittedLabel[] = [];
  if (axisLengthPx <= 0) return out;
  labels.forEach((head, index) => {
    const band = bands[index];
    if (!band || band.size <= 0) return;
    const suffix = opts?.suffixes?.[index] ?? "";
    const full = head + suffix;
    const budget = band.size - gap;
    const position = (band.start + band.size / 2) / axisLengthPx;
    if (budget <= 0) return;
    if (measure(full) <= budget) {
      out.push({ index, label: full, position });
      return;
    }
    const headBudget = budget - (suffix ? measure(suffix) : 0);
    if (headBudget <= 0) return;
    const short = ellipsize(head, headBudget, measure);
    const content = short.endsWith("…") ? short.length - 1 : short.length;
    const endpoint = index === 0 || index === labels.length - 1;
    if (short.length === 0) return;
    if (content >= minCh || endpoint) {
      out.push({ index, label: short + suffix, title: full, position });
    }
  });
  return out;
}

/** The strength of the neutral ramp for series `i` of `n`: the first (bottom)
 *  series the darkest, stepping lighter, never below a readable floor. */
export function rampStrength(i: number, n: number): number {
  if (n <= 1) return 0.7;
  const t = i / (n - 1);
  return 0.88 - t * 0.74;
}

/** Dots per 4x4 halftone cell for series `i` of `n` (1..15): the first series
 *  the densest, the last the sparsest. */
export function ditherDots(i: number, n: number): number {
  if (n <= 1) return 8;
  const t = i / (n - 1);
  return Math.round(15 - t * 14);
}

/** The 4x4 Bayer matrix: a cell `(x, y)` is set when its threshold is below
 *  the dot count, which spreads the dots evenly at every density. */
export const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** The cells set for a halftone of `dots` per 16. */
export function ditherCells(dots: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const threshold = BAYER_4[y]?.[x] ?? 0;
      if (threshold < dots) out.push({ x, y });
    }
  }
  return out;
}

/** Map a fractional band index to px along the width axis, piecewise linear
 *  over the bands (an annotation's `x` in a column chart). */
export function indexToPx(index: number, bands: readonly Band[], lengthPx: number): number {
  const n = bands.length;
  if (n === 0) return 0;
  if (index <= 0) return bands[0]?.start ?? 0;
  if (index >= n) {
    const last = bands[n - 1];
    return last ? last.start + last.size : lengthPx;
  }
  const i = Math.floor(index);
  const band = bands[i];
  if (!band) return 0;
  return band.start + (index - i) * band.size;
}

/** The inverse of {@link indexToPx}: px along the width axis to a fractional
 *  band index; a px in a gap resolves to the boundary. */
export function pxToIndex(px: number, bands: readonly Band[]): number {
  const n = bands.length;
  if (n === 0) return 0;
  for (let i = 0; i < n; i++) {
    const band = bands[i];
    if (!band) continue;
    if (px < band.start) return i;
    if (px <= band.start + band.size) return band.size > 0 ? i + (px - band.start) / band.size : i;
  }
  return n;
}
