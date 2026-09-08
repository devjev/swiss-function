/** Pure layout and ordering math for `DotPlot`: row order, range pairing,
 *  the row layout along the categorical axis and the value extent. No React,
 *  no DOM. */

import { niceTicks } from "../../lib/chart";

/** Row order: as given, ascending / descending by the first series, or by a
 *  named series (descending, the ranked reading). */
export type DotPlotSort = "none" | "asc" | "desc" | (string & {});

export interface DotSeriesLike {
  name: string;
  values: readonly (number | null | undefined)[];
}

function isValue(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

/**
 * The display order of the rows as indices into `categories`. Sorting is
 * stable, missing values sink to the end, and an unknown series name leaves
 * the order untouched.
 */
export function orderRows(
  count: number,
  series: readonly DotSeriesLike[],
  sort: DotPlotSort | undefined,
): number[] {
  const idx = Array.from({ length: Math.max(0, count) }, (_, i) => i);
  if (!sort || sort === "none" || series.length === 0) return idx;
  let key: DotSeriesLike | undefined;
  let direction: 1 | -1 = -1;
  if (sort === "asc") {
    key = series[0];
    direction = 1;
  } else if (sort === "desc") {
    key = series[0];
  } else {
    key = series.find((s) => s.name === sort);
  }
  if (!key) return idx;
  const values = key.values;
  return idx.sort((a, b) => {
    const va = values[a];
    const vb = values[b];
    const ma = !isValue(va);
    const mb = !isValue(vb);
    if (ma && mb) return a - b;
    if (ma) return 1;
    if (mb) return -1;
    if (va === vb) return a - b;
    return ((va as number) - (vb as number)) * direction;
  });
}

/**
 * The pair of series indices a `range` connects: `true` pairs the first two
 * series (and nothing else, so an accidental third series never draws a bar),
 * a `[from, to]` names them. `null` when there is no valid pair.
 */
export function resolveRange(
  range: boolean | readonly [string, string] | undefined,
  series: readonly { name: string }[],
): [number, number] | null {
  if (!range) return null;
  if (range === true) return series.length === 2 ? [0, 1] : null;
  const a = series.findIndex((s) => s.name === range[0]);
  const b = series.findIndex((s) => s.name === range[1]);
  return a >= 0 && b >= 0 && a !== b ? [a, b] : null;
}

export type RangeDirection = "up" | "down" | "flat";

/** Which way a `[from, to]` pair moved. */
export function rangeDirection(from: number, to: number): RangeDirection {
  if (to > from) return "up";
  if (to < from) return "down";
  return "flat";
}

export interface RowLayout {
  /** Distance between consecutive row centres (the row height). */
  step: number;
  /** Row centres along the categorical axis, first row first. */
  centers: number[];
}

/** `count` equal rows over `lengthPx`, centres at the middle of each row. */
export function rowLayout(count: number, lengthPx: number): RowLayout {
  if (count <= 0 || !(lengthPx > 0)) return { step: 0, centers: [] };
  const step = lengthPx / count;
  const centers: number[] = [];
  for (let i = 0; i < count; i++) centers.push((i + 0.5) * step);
  return { step, centers };
}

/**
 * The value extent for a set of dots: the data's min..max, padded by `pad`
 * of the span and extended outward to round tick values. Unlike a bar chart the baseline carries no meaning, so
 * zero is pulled in only when `includeZero` asks for it (a lollipop's stems
 * grow from it).
 */
export function fitDomain(
  values: readonly (number | null | undefined)[],
  includeZero: boolean,
  target = 5,
  pad = 0.03,
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (!isValue(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Number.POSITIVE_INFINITY) return includeZero ? [0, 1] : [0, 1];
  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) return [min - 1, max + 1];
  // Pad before rounding so a datum on a round tick still lands strictly
  // inside the extent (a dot on the plot edge would be half clipped). A zero
  // baseline pulled in by `includeZero` stays exactly at zero.
  const span = max - min;
  const lo = includeZero && min === 0 ? 0 : min - span * pad;
  const hi = includeZero && max === 0 ? 0 : max + span * pad;
  const ticks = niceTicks(lo, hi, target);
  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  if (!first || !last) return [lo, hi];
  return [Math.min(first.value, lo), Math.max(last.value, hi)];
}
