/** The layout arithmetic of a small-multiples grid: how many columns fit,
 *  where each panel sits, which panels carry the outer axes, and the shared
 *  ticks those axes draw. Pure: no React, no DOM. */

import { adaptiveTicks } from "../../lib/chart/numericTicks";
import { timeTicks } from "../../lib/chart/timeTicks";

/** A shared x domain: numbers, or dates on a time axis. */
export type MultiplesDomain = [number, number] | [Date, Date];

export interface ColumnCountOptions {
  /** Measured container width in px (`0` before the first measure). */
  width: number;
  /** Smallest panel width in px that the auto layout accepts. */
  minPanelWidth: number;
  /** Column gap in px. */
  gap: number;
  /** Number of panels. */
  count: number;
  /** A fixed column count, or `"auto"` (default) from the width. */
  columns?: number | "auto";
  /** A fixed row count; wins over the auto layout when `columns` is not a number. */
  rows?: number;
}

/** How many columns the grid gets. A fixed `columns` wins, then a fixed `rows`,
 *  then the container width: as many panels of at least `minPanelWidth` as
 *  fit with `gap` between them. Never below 1, never above the panel count. */
export function columnCount({
  width,
  minPanelWidth,
  gap,
  count,
  columns = "auto",
  rows,
}: ColumnCountOptions): number {
  const max = Math.max(1, Math.floor(count));
  if (typeof columns === "number" && Number.isFinite(columns)) {
    return clampInt(Math.round(columns), 1, max);
  }
  if (typeof rows === "number" && Number.isFinite(rows) && rows >= 1) {
    return clampInt(Math.ceil(max / Math.round(rows)), 1, max);
  }
  if (!(width > 0)) return 1;
  const unit = Math.max(1, minPanelWidth) + Math.max(0, gap);
  return clampInt(Math.floor((width + Math.max(0, gap)) / unit), 1, max);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface GridCell {
  index: number;
  row: number;
  col: number;
  /** The leftmost panel of its row: it carries the row's outer y axis. */
  firstInRow: boolean;
  /** No panel below it: it carries the column's outer x axis. */
  lastInColumn: boolean;
}

/** Row-major placement of `count` panels in `columns` columns. */
export function gridPlacement(count: number, columns: number): { rows: number; cells: GridCell[] } {
  const cols = Math.max(1, Math.floor(columns));
  const n = Math.max(0, Math.floor(count));
  const rows = Math.ceil(n / cols);
  const cells: GridCell[] = [];
  for (let index = 0; index < n; index++) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    cells.push({ index, row, col, firstInRow: col === 0, lastInColumn: index + cols >= n });
  }
  return { rows, cells };
}

export function isDateDomain(domain: MultiplesDomain): domain is [Date, Date] {
  return domain[0] instanceof Date;
}

function toNumber(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value;
}

/** The smallest domain covering every given one (nulls skipped). Dates stay
 *  dates when any input is dated. `undefined` when nothing was given. */
export function unionDomain(
  domains: readonly (MultiplesDomain | null | undefined)[],
): MultiplesDomain | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let dated = false;
  for (const d of domains) {
    if (!d) continue;
    if (isDateDomain(d)) dated = true;
    min = Math.min(min, toNumber(d[0]));
    max = Math.max(max, toNumber(d[1]));
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  return dated ? [new Date(min), new Date(max)] : [min, max];
}

export interface SharedAxisTick {
  label: string;
  /** `0..1` along the axis (left to right, bottom to top). */
  position: number;
  major: boolean;
}

/** Ticks for an outer axis over a shared domain: the calendar ladder for a
 *  dated x axis, adaptive nice steps for numbers. Ticks stay inside the domain
 *  (the domain is the window), so a zoomed grid never labels off-plot. */
export function axisTicksFor(
  domain: MultiplesDomain,
  lengthPx: number,
  orientation: "x" | "y",
): SharedAxisTick[] {
  const start = toNumber(domain[0]);
  const end = toNumber(domain[1]);
  const span = end - start;
  if (!(span > 0) || !(lengthPx > 0)) return [];
  if (orientation === "x" && isDateDomain(domain)) {
    return timeTicks(start, end, lengthPx).map((t) => ({
      label: t.label,
      position: (t.date.getTime() - start) / span,
      major: t.major,
    }));
  }
  const spacing = orientation === "x" ? 80 : 50;
  return adaptiveTicks(start, end, lengthPx, spacing).ticks.map((t) => ({
    label: t.label,
    position: (t.value - start) / span,
    major: t.major,
  }));
}
