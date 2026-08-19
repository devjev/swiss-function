/** Pure geometry for the `Stat` sparkline. No React, no DOM: maps a series of
 *  numbers to coordinates inside a `width`x`height` box using the SVG top-left
 *  origin, so larger values sit higher. Directly unit-tested. */

const round = (n: number) => Math.round(n * 100) / 100;

/** Polyline points for a line sparkline. Empty input yields `[]`; a flat series
 *  (all equal) draws along the vertical middle. Non-finite values (`NaN`,
 *  `Infinity`) are dropped so one bad point can't blank the whole line. */
export function sparklinePoints(
  values: number[],
  width = 100,
  height = 30,
  pad = 2,
): Array<[number, number]> {
  const finite = values.filter(Number.isFinite);
  const n = finite.length;
  if (n === 0) return [];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const innerH = height - pad * 2;
  const innerW = width - pad * 2;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  return finite.map((v, i) => {
    const x = n > 1 ? pad + i * stepX : width / 2;
    // A flat series (span defaulted to 1) centers on the middle.
    const norm = max === min ? 0.5 : (v - min) / span;
    const y = pad + innerH * (1 - norm);
    return [round(x), round(y)];
  });
}

/** Space-separated `x,y` pairs for an SVG `<polyline points>` / `<polygon>`. */
export function sparklinePointsAttr(values: number[], width = 100, height = 30, pad = 2): string {
  return sparklinePoints(values, width, height, pad)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export interface SparkBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rectangles for a bar sparkline. Bars share the width evenly with `gap` between
 *  them. Bar length encodes magnitude from a **zero baseline** for a non-negative
 *  series (so `[100, 101, 102]` reads as three near-equal tall bars, not a
 *  truncated ramp); a series that dips below zero grows from its own minimum
 *  instead. A genuine zero-height bar is floored to `minBar` so it stays a
 *  visible baseline tick. Non-finite values are dropped. */
export function sparklineBars(
  values: number[],
  width = 100,
  height = 30,
  gap = 1,
  minBar = 1,
): SparkBar[] {
  const clean = values.filter(Number.isFinite);
  const n = clean.length;
  if (n === 0) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  // Non-negative series measure from 0 (honest magnitude); a series with
  // negatives measures from its own floor.
  const baseline = Math.min(0, min);
  const span = max - baseline || 1;
  const slot = width / n;
  const barW = Math.max(0, slot - gap);
  return clean.map((v, i) => {
    const h = Math.max(minBar, round(((v - baseline) / span) * height));
    return {
      x: round(i * slot + gap / 2),
      y: round(height - h),
      width: round(barW),
      height: h,
    };
  });
}
