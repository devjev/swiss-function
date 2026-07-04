/** Scale factories for chart components. Pure — no React, no DOM. */

/** Linear interpolation from a numeric domain to a numeric (pixel) range. */
export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const dSpan = d1 - d0;
  return (value: number): number => {
    if (dSpan === 0) return r0;
    return r0 + ((value - d0) / dSpan) * (r1 - r0);
  };
}

/** Inverse of {@link linearScale}: pixel → data value. Handles inverted
 *  (y-style `[height, 0]`) ranges. Zero-span ranges return the domain start. */
export function invertLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const rSpan = r1 - r0;
  return (px: number): number => {
    if (rSpan === 0) return d0;
    return d0 + ((px - r0) / rSpan) * (d1 - d0);
  };
}

/** Date analog of linearScale — maps Date → pixel via epoch ms. */
export function timeScale(domain: [Date, Date], range: [number, number]) {
  const linear = linearScale([domain[0].getTime(), domain[1].getTime()], range);
  return (value: Date): number => linear(value.getTime());
}

export interface BandScale {
  /** Distance between the START of one band and the next. */
  step: number;
  /** Width of one band (step minus outer/inner padding share). */
  bandwidth: number;
  /** Returns the LEFT edge of the band for the given category, or null if unknown. */
  position(category: string): number | null;
}

/**
 * Discrete categorical scale: maps each category to a band (left edge + width)
 * inside [range[0], range[1]]. `padding` is the fraction of `step` reserved as
 * gap between bands (0 = no gaps, 0.5 = gaps half the width of bands). 0.2 is
 * a sensible default for bar charts.
 */
export function bandScale(categories: string[], range: [number, number], padding = 0.2): BandScale {
  const [r0, r1] = range;
  const n = categories.length;
  const span = r1 - r0;
  if (n === 0 || span <= 0) {
    return { step: 0, bandwidth: 0, position: () => null };
  }
  const step = span / n;
  const bandwidth = step * (1 - padding);
  const offset = (step - bandwidth) / 2;
  const index = new Map<string, number>();
  for (let i = 0; i < n; i++) index.set(categories[i] as string, i);
  return {
    step,
    bandwidth,
    position(category: string) {
      const i = index.get(category);
      if (i == null) return null;
      return r0 + i * step + offset;
    },
  };
}
