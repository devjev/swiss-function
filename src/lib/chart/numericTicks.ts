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
  if (abs >= 1_000_000_000) return `${trimZero(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimZero(value / 1_000)}k`;
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
