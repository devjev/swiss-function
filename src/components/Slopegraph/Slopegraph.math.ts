/** Pure layout math for `Slopegraph`: rank computation, direction
 *  classification, and the one-dimensional label dodge that stacks ties. No
 *  React, no DOM; text widths come in through a `measure` callback where
 *  needed (see the component). */

export type SlopeDirection = "up" | "down" | "flat";

/** Competition ranks ("1, 2, 2, 4") of one column, highest value first. A
 *  null value has no rank. */
export function rankColumn(values: readonly (number | null)[]): (number | null)[] {
  const sorted = values
    .map((v, i) => ({ v, i }))
    .filter((d): d is { v: number; i: number } => d.v != null && Number.isFinite(d.v))
    .sort((a, b) => b.v - a.v);
  const ranks: (number | null)[] = values.map(() => null);
  let rank = 0;
  for (let k = 0; k < sorted.length; k++) {
    const d = sorted[k];
    if (!d) continue;
    const prev = sorted[k - 1];
    if (k === 0 || (prev && prev.v !== d.v)) rank = k + 1;
    ranks[d.i] = rank;
  }
  return ranks;
}

/** Ranks for every column of the table: `series[i].values[c]` becomes
 *  `ranks[i][c]`. */
export function rankTable(
  series: readonly { values: readonly (number | null)[] }[],
): (number | null)[][] {
  const nCols = series.reduce((m, s) => Math.max(m, s.values.length), 0);
  const out: (number | null)[][] = series.map(() => []);
  for (let c = 0; c < nCols; c++) {
    const col = rankColumn(series.map((s) => s.values[c] ?? null));
    col.forEach((r, i) => {
      const row = out[i];
      if (row) row[c] = r;
    });
  }
  return out;
}

/** Whether an entity rises, falls or holds between its first and last known
 *  values. `null` when fewer than two values are known. For ranks, pass
 *  `invert` so a smaller rank number reads as rising. */
export function direction(
  values: readonly (number | null)[],
  invert = false,
): SlopeDirection | null {
  const known = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (known.length < 2) return null;
  const first = known[0] as number;
  const last = known[known.length - 1] as number;
  if (first === last) return "flat";
  const up = last > first;
  return up !== invert ? "up" : "down";
}

/** The `[min, max]` of every known value, widened to a non-empty span. */
export function valueExtent(
  series: readonly { values: readonly (number | null)[] }[],
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of series) {
    for (const v of s.values) {
      if (v == null || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

export interface DodgeResult {
  /** Resolved centre positions, parallel to `targets`. */
  positions: number[];
  /** False when the labels cannot all fit between `min` and `max` at
   *  `height` each; the positions are still order-preserving and packed from
   *  the top, so the caller can thin and retry. */
  fits: boolean;
}

/** Push overlapping labels apart along one axis while keeping their order:
 *  every position moves the least it must so that neighbours are at least
 *  `height` apart, within `[min, max]`. Ties (equal targets) stack in input
 *  order. */
export function dodgeLabels(
  targets: readonly number[],
  height: number,
  min: number,
  max: number,
): DodgeResult {
  const n = targets.length;
  const positions = targets.slice();
  if (n === 0) return { positions, fits: true };
  const order = targets
    .map((_, i) => i)
    .sort((a, b) => (targets[a] as number) - (targets[b] as number));
  const y = order.map((i) => targets[i] as number);
  // Forward: nothing above the top, nothing closer than a label height.
  y[0] = Math.max(y[0] as number, min);
  for (let k = 1; k < n; k++) y[k] = Math.max(y[k] as number, (y[k - 1] as number) + height);
  // Backward: nothing below the bottom.
  let fits = true;
  if ((y[n - 1] as number) > max) {
    y[n - 1] = max;
    for (let k = n - 2; k >= 0; k--) y[k] = Math.min(y[k] as number, (y[k + 1] as number) - height);
    if ((y[0] as number) < min) {
      // Cannot fit: pack from the top so the overflow is at the bottom.
      fits = false;
      y[0] = min;
      for (let k = 1; k < n; k++) y[k] = Math.max(y[k] as number, (y[k - 1] as number) + height);
    }
  }
  order.forEach((i, k) => {
    positions[i] = y[k] as number;
  });
  return { positions, fits };
}

/** Which of `count` labels (ordered top to bottom) to keep when only
 *  `capacity` fit: every `mustKeep` index first, then an even stride through
 *  the rest. Returns the kept indices in order. */
export function thinLabels(count: number, capacity: number, mustKeep: readonly number[]): number[] {
  if (capacity >= count) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set<number>();
  for (const i of mustKeep) if (i >= 0 && i < count) keep.add(i);
  const room = Math.max(0, capacity - keep.size);
  if (room > 0) {
    const rest: number[] = [];
    for (let i = 0; i < count; i++) if (!keep.has(i)) rest.push(i);
    const stride = rest.length / room;
    for (let k = 0; k < room; k++) {
      const idx = rest[Math.min(rest.length - 1, Math.floor(k * stride + stride / 2))];
      if (idx != null) keep.add(idx);
    }
  }
  return [...keep].sort((a, b) => a - b);
}

/** Interpolate `count` column x positions between two edges. */
export function columnPositions(count: number, x0: number, x1: number): number[] {
  if (count <= 1) return [x0];
  const step = (x1 - x0) / (count - 1);
  return Array.from({ length: count }, (_, i) => x0 + i * step);
}

/** The pixel size of a CSS font shorthand such as `400 13px sans-serif`. */
export function fontSizePx(font: string, fallback = 13): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m ? Number(m[1]) : fallback;
}
