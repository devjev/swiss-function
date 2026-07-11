/** Pixel snapping for chart *chrome* — gridlines, tick marks, wicks, cell
 *  edges — so hairlines fill whole CSS pixels instead of smearing across two.
 *  Never snap data marks (points, line paths, bar tops): snapping quantizes
 *  positions and visibly jitters data under zoom/pan. And never reach for
 *  `shape-rendering: crispEdges` instead — it degrades diagonals/curves and
 *  makes strokes jitter during resize; snap coordinates, keep anti-aliasing.
 *  Pure — no React, no DOM. */

/** Snap a stroke's center coordinate so the stroke covers whole pixels:
 *  odd stroke widths center on half-pixels (`x.5`), even widths on integers.
 *  The offset is subtracted before rounding (not added after) so the result
 *  is the *nearest* valid center and the function is idempotent —
 *  `Math.round(px) + 0.5` would re-snap an already-snapped `10.5` to `11.5`.
 *  NaN passes through as NaN: callers may map through empty domains and the
 *  resulting no-op render is theirs to handle — never throw here. */
export function snapHairline(px: number, strokeWidth = 1): number {
  const offset = strokeWidth % 2 === 1 ? 0.5 : 0;
  return Math.round(px - offset) + offset;
}

/** Snap a [0,1] fraction of a pixel length onto the pixel grid: clamps the
 *  fraction to [0,1], rounds `fraction * lengthPx` to the nearest integer
 *  pixel, and returns that back as a fraction of the same length. With no
 *  positive length there is no grid to snap to, so the input is returned
 *  unchanged (also covers NaN lengths). */
export function snapFraction(fraction: number, lengthPx: number): number {
  if (!(lengthPx > 0)) return fraction;
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return Math.round(clamped * lengthPx) / lengthPx;
}

/** Snap a cell's two edges to integer pixels, rounding each edge
 *  *independently* so adjacent cells whose coordinates touch get the exact
 *  same shared integer edge (no gaps, no double-covered seams), then enforce
 *  a minimum 1px extent by extending `end`. */
export function snapEdges(start: number, end: number): { start: number; end: number } {
  const snappedStart = Math.round(start);
  const snappedEnd = Math.round(end);
  return {
    start: snappedStart,
    end: snappedEnd - snappedStart < 1 ? snappedStart + 1 : snappedEnd,
  };
}
