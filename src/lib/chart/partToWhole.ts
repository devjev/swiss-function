/** What the part-to-whole charts (Marimekko, PieChart, a stacked BarChart)
 *  share: how a part is painted when the consumer gives it no colour (a neutral
 *  ramp of the ink, or the house 4x4 halftone), and how its share of the total
 *  is printed. Kept in one place so a reader moving between those charts reads
 *  the same ladder and the same percentages. Pure: no React, no DOM. */

/** The strength of the neutral ramp for part `i` of `n`: the first part carries
 *  the most ink and each one after it carries less.
 *
 *  The floor is what keeps the sparsest part readable. A step mixed at 0.14 of
 *  the ink is a pale grey on a white page but a near-black on a dark one, where
 *  it sinks into the background and the mark reads as a hole; 0.24 still
 *  separates from the page in both themes, and the steps between stay far
 *  enough apart to tell six parts from one another. */
export function rampStrength(i: number, n: number, floor = 0.24): number {
  if (n <= 1) return 0.7;
  const t = i / (n - 1);
  return 0.88 - t * (0.88 - floor);
}

/** Dots per 4x4 halftone cell for series `i` of `n` (1..15): the first series
 *  the densest, the last the sparsest. */
export function ditherDots(i: number, n: number): number {
  if (n <= 1) return 8;
  const t = i / (n - 1);
  return Math.round(15 - t * 14);
}

/** The 4x4 Bayer matrix: a cell `(x, y)` is set when its threshold is below the
 *  dot count, which spreads the dots evenly at every density. */
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

/** A part's share of its total, in whole percents. A part too small to round to
 *  one percent prints as `<1%` rather than `0%`, so a sliver never reads as
 *  absent; an empty part is a true `0%`. */
export function formatShare(share: number): string {
  if (!(share > 0)) return "0%";
  const pct = share * 100;
  if (pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}
