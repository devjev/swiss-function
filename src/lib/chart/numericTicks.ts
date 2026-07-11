/** Numeric "nice" tick generation. Pure — no React, no DOM. */

export interface NumericTick {
  value: number;
  label: string;
  /** True at zero — gives the axis a visual baseline anchor when 0 is in range. */
  major: boolean;
}

/** Round a step up to the nearest 1/2/5 × 10ⁿ value. The canonical nice-tick
 *  algorithm — picks human-readable intervals (1, 2, 5, 10, 20, 50, …). */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  let factor: number;
  if (normalized <= 1) factor = 1;
  else if (normalized <= 2) factor = 2;
  else if (normalized <= 5) factor = 5;
  else factor = 10;
  return factor * magnitude;
}

/** Compact-format a number for an axis label (1.2k, 3.4M, etc.) — only above
 *  1000, so small ranges (0..100, 0..1) read literally. Exported so chart
 *  components can label per-datum values with the same convention. */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  // Suffixed forms cap at 4 significant digits: an at-a-glance axis label
  // ("1.522M") must not carry float tails ("1.521884M"); exact values belong
  // to tooltips.
  if (abs >= 1_000_000_000) return `${trimZero(Number((value / 1_000_000_000).toPrecision(4)))}B`;
  if (abs >= 1_000_000) return `${trimZero(Number((value / 1_000_000).toPrecision(4)))}M`;
  if (abs >= 1_000) return `${trimZero(Number((value / 1_000).toPrecision(4)))}k`;
  // Fractional values: cap at 3 sig digits to avoid float-jitter labels.
  if (abs > 0 && abs < 1) return trimZero(Number(value.toPrecision(3)));
  return trimZero(value);
}

function trimZero(n: number): string {
  // 1.20 → "1.2", 3.0 → "3", but "0" stays "0".
  const s = String(n);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/**
 * Pick "nice" ticks within [min, max]. The visible ticks may extend slightly
 * past the input range (so the axis ends on a round number).
 *
 * `target` is the desired tick count — actual count is typically target±2.
 */
export function niceTicks(min: number, max: number, target = 6): NumericTick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const step = niceStep((max - min) / Math.max(1, target - 1));
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: NumericTick[] = [];
  // Float-error guard so the loop terminates cleanly at niceMax.
  const epsilon = step / 1000;
  for (let v = niceMin; v <= niceMax + epsilon; v += step) {
    // Normalize -0 to 0 and trim float noise that creeps in from repeated +=.
    const rounded = Math.abs(v) < epsilon ? 0 : Number(v.toPrecision(12));
    ticks.push({
      value: rounded,
      label: formatNumber(rounded),
      major: rounded === 0,
    });
  }
  return ticks;
}

/** Decimal places needed so labels one `step` apart are always distinct
 *  (step 0.05 → 2 decimals, step 5 → 0). The d3 tickFormat contract:
 *  precision is a function of the step, never a constant. */
function stepDecimals(step: number): number {
  if (step <= 0 || !Number.isFinite(step)) return 0;
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
}

/** Format a tick value with exactly the precision its step requires. Compact
 *  suffixes (k/M/B) engage only while they can still keep adjacent ticks
 *  distinct within two decimals — a zoomed axis must never round distinct
 *  ticks into identical (or unwieldy "1.501k") labels. */
export function formatTickValue(value: number, step: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const divisor = abs >= 1_000_000_000 ? 1_000_000_000 : abs >= 1_000_000 ? 1_000_000 : 1_000;
    const suffix = divisor === 1_000_000_000 ? "B" : divisor === 1_000_000 ? "M" : "k";
    const decimals = stepDecimals(step / divisor);
    if (decimals <= 2) {
      return `${trimZero(Number((value / divisor).toFixed(decimals)))}${suffix}`;
    }
  }
  return trimZero(Number(value.toFixed(stepDecimals(step))));
}

export interface AdaptiveTicks {
  ticks: NumericTick[];
  /** Shared offset factored out of the labels (0 when none). When nonzero,
   *  labels read `value − offset` and the chart shows `offsetLabel` once at
   *  the axis corner — matplotlib's answer to zooming into a tiny span at a
   *  large magnitude ([1 234 100, 1 234 900] must not print nine digits per
   *  tick). */
  offset: number;
  /** Ready-to-render corner readout for the offset, e.g. `"+1.234M"`. */
  offsetLabel: string;
}

/** How many leading digits the domain edges share before an offset is worth
 *  factoring out — matplotlib's default offset threshold. */
const OFFSET_SHARED_DIGITS = 4;

/**
 * Ticks for a *zoomed* (arbitrary, non-nice) domain. Differs from `niceTicks`
 * in three ways, all forced by interactive zooming:
 *   1. ticks stay strictly inside [min, max] (the domain is the viewport —
 *      ticks outside it would render off-plot),
 *   2. tick count follows pixel width (~one per `targetSpacingPx`) instead of
 *      a fixed target,
 *   3. label precision follows the step, with a shared offset factored out
 *      when the span is orders of magnitude below the values.
 * Promotion: ticks where a higher-order digit rolls over (10× the step) are
 * `major` — the numeric analog of the time axis promoting midnight/Jan 1.
 */
export function adaptiveTicks(
  min: number,
  max: number,
  widthPx: number,
  targetSpacingPx = 80,
): AdaptiveTicks {
  const none: AdaptiveTicks = { ticks: [], offset: 0, offsetLabel: "" };
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || widthPx <= 0) return none;
  const span = max - min;
  const count = Math.max(1, widthPx / targetSpacingPx);
  const step = niceStep(span / count);

  // Offset kicks in when full labels would carry ≥ OFFSET_SHARED_DIGITS more
  // digits than the varying part needs (compare orders of magnitude, not a
  // ratio); the offset itself is round at one order above the span so the
  // varying labels start clean.
  let offset = 0;
  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  const sharedOrders = Math.floor(Math.log10(maxAbs)) - Math.floor(Math.log10(span));
  if (sharedOrders >= OFFSET_SHARED_DIGITS) {
    const pow = 10 ** (Math.floor(Math.log10(span)) + 1);
    offset = Math.floor(min / pow) * pow;
  }

  const ticks: NumericTick[] = [];
  const first = Math.ceil(min / step) * step;
  const epsilon = step / 1000;
  const rollover = step * 10;
  for (let v = first; v <= max + epsilon; v += step) {
    const rounded = Math.abs(v) < epsilon ? 0 : Number(v.toPrecision(12));
    const relative = rounded - offset;
    const remainder = Math.abs(relative % rollover);
    ticks.push({
      value: rounded,
      label: formatTickValue(relative, step),
      major: rounded === 0 || remainder < epsilon || rollover - remainder < epsilon,
    });
  }
  const sign = offset > 0 ? "+" : "";
  return {
    ticks,
    offset,
    offsetLabel: offset === 0 ? "" : `${sign}${formatNumber(offset)}`,
  };
}

/** Auto-fit a domain that
 *   1. always includes 0 when sensible (positives → [0, max]; negatives → [min, 0]),
 *   2. snaps its edges to the nearest nice-tick boundary so axis ticks land
 *      exactly at the plot edges (otherwise the topmost tick sits beyond the
 *      visible range and gets clipped — see numericTicks.spec for the case).
 *
 *  `target` is the desired number of ticks; pass the same value to `niceTicks`
 *  on the same domain to get a guaranteed-aligned set. */
export function niceDomain(values: number[], target = 5): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    // Flat data: pad by ±1 so the axis still draws something.
    return [Math.min(0, min - 1), Math.max(0, max + 1)];
  }
  // Anchor at 0 by convention before snapping to nice ticks.
  if (min >= 0) min = 0;
  else if (max <= 0) max = 0;
  const ticks = niceTicks(min, max, target);
  if (ticks.length === 0) return [min, max];
  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  return [first ? first.value : min, last ? last.value : max];
}
