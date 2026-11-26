import type { ReactElement, ReactNode } from "react";
import { Children, Fragment, isValidElement } from "react";

/** Ordered strip structure derived from the declarative children. All keyboard
 *  adjacency, drop projection, and `WindowMove` index math run against this
 *  plain model so the logic stays unit-testable without a DOM. */
export interface StripModel {
  columns: { id: string; windowIds: string[] }[];
}

/** A rearrangement request reported to the consumer (the component never
 *  mutates order itself). Every `to` index is relative to the state AFTER the
 *  window has been removed from its source column and AFTER an emptied source
 *  column has been dropped — so applying a move is two plain splices. */
export interface WindowMove {
  windowId: string;
  from: { columnId: string; index: number };
  to: { type: "cell"; columnId: string; index: number } | { type: "column"; index: number };
}

/** Raw drop slot in pre-removal terms: `cell.index` is an insertion slot
 *  (0..len) in an existing column; `column.index` is a gap position (0..N)
 *  counted with the source column still present. `projectMove` converts this
 *  to the post-removal `WindowMove` convention and nulls out no-ops. */
export type DropSlot =
  | { kind: "cell"; columnId: string; index: number }
  | { kind: "column"; index: number };

export type NavDirection = "up" | "down" | "left" | "right";

/** Swap the axes of a visual arrow direction. In the vertical (transposed)
 *  layout, columns run top-to-bottom and their windows run left-to-right, so a
 *  visual arrow maps to the model direction with its axes swapped — the model
 *  itself stays column-major in both orientations. */
export function transposeDir(dir: NavDirection): NavDirection {
  switch (dir) {
    case "up":
      return "left";
    case "down":
      return "right";
    case "left":
      return "up";
    case "right":
      return "down";
  }
}

/** Structural equality for drop slots — used to skip state updates (and the
 *  full-strip re-render they cause) while a drag stays within one slot. */
export function slotsEqual(a: DropSlot | null, b: DropSlot | null): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.kind !== b.kind || a.index !== b.index) return false;
  return a.kind !== "cell" || b.kind !== "cell" || a.columnId === b.columnId;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Collect direct children of the given element type, transparently flattening
 *  fragments (same contract as Reflow's `collectColumns`: consumers may group
 *  or `.map` children, but wrapper components are invisible to collection). */
export function collectElements<P>(children: ReactNode, type: unknown): ReactElement<P>[] {
  const out: ReactElement<P>[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(...collectElements<P>((child.props as { children?: ReactNode }).children, type));
    } else if (child.type === type) {
      out.push(child as ReactElement<P>);
    }
  });
  return out;
}

/** Ids that appear more than once (across columns and windows). Used for a
 *  one-shot dev warning — duplicate ids break moves and the roving focus. */
export function duplicateIds(model: StripModel): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const col of model.columns) {
    if (seen.has(col.id)) dupes.add(col.id);
    seen.add(col.id);
    for (const id of col.windowIds) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
  }
  return [...dupes];
}

export function findWindow(model: StripModel, id: string): { col: number; row: number } | null {
  for (let col = 0; col < model.columns.length; col++) {
    const row = model.columns[col]?.windowIds.indexOf(id) ?? -1;
    if (row >= 0) return { col, row };
  }
  return null;
}

/** Adjacent window for arrow navigation. Up/down stay in the column; left/right
 *  land in the neighbouring column at the same row, clamped to its stack. */
export function neighbor(model: StripModel, id: string, dir: NavDirection): string | null {
  const pos = findWindow(model, id);
  if (!pos) return null;
  const col = model.columns[pos.col];
  if (!col) return null;
  if (dir === "up") return pos.row > 0 ? (col.windowIds[pos.row - 1] ?? null) : null;
  if (dir === "down") {
    return pos.row < col.windowIds.length - 1 ? (col.windowIds[pos.row + 1] ?? null) : null;
  }
  const targetCol = dir === "left" ? pos.col - 1 : pos.col + 1;
  const target = model.columns[targetCol];
  if (!target || target.windowIds.length === 0) return null;
  return target.windowIds[clamp(pos.row, 0, target.windowIds.length - 1)] ?? null;
}

/** First/last window of the strip (Home/End). */
export function edgeWindow(model: StripModel, which: "first" | "last"): string | null {
  const cols = which === "first" ? model.columns : [...model.columns].reverse();
  for (const col of cols) {
    if (col.windowIds.length > 0) return col.windowIds[0] ?? null;
  }
  return null;
}

/** Convert a raw drop slot into a `WindowMove`, or `null` when the drop would
 *  change nothing. Same-column cell indexes are shifted down past the removed
 *  window; a new-column index is shifted down past a source column that the
 *  move empties (the consumer removes it — see `WindowMove`). */
export function projectMove(
  model: StripModel,
  windowId: string,
  slot: DropSlot,
): WindowMove | null {
  const pos = findWindow(model, windowId);
  if (!pos) return null;
  const fromColumn = model.columns[pos.col];
  if (!fromColumn) return null;
  const from = { columnId: fromColumn.id, index: pos.row };

  if (slot.kind === "cell") {
    const targetCol = model.columns.findIndex((c) => c.id === slot.columnId);
    if (targetCol < 0) return null;
    if (targetCol === pos.col) {
      const post = slot.index > pos.row ? slot.index - 1 : slot.index;
      const index = clamp(post, 0, fromColumn.windowIds.length - 1);
      if (index === pos.row) return null;
      return { windowId, from, to: { type: "cell", columnId: slot.columnId, index } };
    }
    const len = model.columns[targetCol]?.windowIds.length ?? 0;
    return {
      windowId,
      from,
      to: { type: "cell", columnId: slot.columnId, index: clamp(slot.index, 0, len) },
    };
  }

  // New-column drop. If the move empties its source column, the consumer
  // removes that column, so shift the insertion index past it — and a
  // single-window column dropped into either of its own flanking gaps is a
  // no-op.
  const sourceEmpties = fromColumn.windowIds.length === 1;
  let index = clamp(slot.index, 0, model.columns.length);
  if (sourceEmpties) {
    index = index > pos.col ? index - 1 : index;
    if (index === pos.col) return null;
  }
  return { windowId, from, to: { type: "column", index } };
}

/** Keyboard move (Shift+Arrow): the raw slot for "one step in this direction",
 *  projected through `projectMove` so edges and no-ops resolve identically to
 *  pointer drops. At the strip's ends left/right break out into a new column. */
export function moveByKey(model: StripModel, id: string, dir: NavDirection): WindowMove | null {
  const pos = findWindow(model, id);
  if (!pos) return null;
  const col = model.columns[pos.col];
  if (!col) return null;

  if (dir === "up") {
    if (pos.row === 0) return null;
    return projectMove(model, id, { kind: "cell", columnId: col.id, index: pos.row - 1 });
  }
  if (dir === "down") {
    if (pos.row >= col.windowIds.length - 1) return null;
    return projectMove(model, id, { kind: "cell", columnId: col.id, index: pos.row + 2 });
  }
  const targetCol = dir === "left" ? pos.col - 1 : pos.col + 1;
  const target = model.columns[targetCol];
  if (!target) {
    // Off the end of the strip: split out into a new column.
    return projectMove(model, id, {
      kind: "column",
      index: dir === "left" ? 0 : model.columns.length,
    });
  }
  return projectMove(model, id, {
    kind: "cell",
    columnId: target.id,
    index: clamp(pos.row, 0, target.windowIds.length),
  });
}

/** Focus successor when a window disappears: next in its column, else previous,
 *  else the clamped row of the nearest non-empty column (left first). Computed
 *  against the model that still contained the window. */
export function successor(model: StripModel, removedId: string): string | null {
  const pos = findWindow(model, removedId);
  if (!pos) return null;
  const col = model.columns[pos.col];
  if (!col) return null;
  if (pos.row + 1 < col.windowIds.length) return col.windowIds[pos.row + 1] ?? null;
  if (pos.row > 0) return col.windowIds[pos.row - 1] ?? null;
  for (let d = 1; d < model.columns.length; d++) {
    for (const ci of [pos.col - d, pos.col + d]) {
      const c = model.columns[ci];
      if (c && c.windowIds.length > 0) {
        return c.windowIds[clamp(pos.row, 0, c.windowIds.length - 1)] ?? null;
      }
    }
  }
  return null;
}

export function clampWidth(raw: number, min: number): number {
  return Math.max(min, Math.round(raw));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Fractional row count for the flat strip grid: the LCM of the stack sizes,
 *  so every column's windows divide the height exactly. Capped — beyond the
 *  cap `rowTrack` rounds, off by under 1% of the column height. */
export function subrowCount(counts: number[]): number {
  let lcm = 1;
  for (const count of counts) {
    if (count <= 1) continue;
    lcm = (lcm * count) / gcd(lcm, count);
    if (lcm >= 360) return 360;
  }
  return lcm;
}

/** Grid-row placement (1-based line + span) for stack position `index` of
 *  `count` windows over `subrows` fractional rows. Exact when `count` divides
 *  `subrows` (which `subrowCount` guarantees below its cap). */
export function rowTrack(
  index: number,
  count: number,
  subrows: number,
): { start: number; span: number } {
  const from = Math.min(Math.round((index * subrows) / count), subrows - 1);
  const to = Math.max(from + 1, Math.round(((index + 1) * subrows) / count));
  return { start: from + 1, span: Math.min(to, subrows) - from };
}

// --- Vertical bands: wrapping onto lines --------------------------------------
// In the vertical orientation a column is a full-width band and its windows
// sit side by side. A band holds only as many windows per line as keep each
// one at least `windowMinWidth` wide; the rest wrap onto further lines of the
// same band, in order. The horizontal strip never wraps (`perLine` is
// Infinity there), so every function below returns the single-line layout.

/** Windows per line of a vertical band: as many as keep each window at least
 *  `minWidth` wide, and at least one. `available` is the band's inner width
 *  (px) and `gap` the inline margin every window carries, so one window needs
 *  `minWidth + gap` of it. Infinity (no wrapping) without a positive minimum
 *  or a measured width. */
export function windowsPerLine(available: number, minWidth: number, gap = 0): number {
  const cell = minWidth + Math.max(0, gap);
  if (!(minWidth > 0) || !Number.isFinite(cell) || !Number.isFinite(available)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(1, Math.floor(available / cell));
}

/** Window count on each line of a band of `count` windows wrapped at
 *  `perLine`: full lines hold `perLine`, the last line holds the remainder
 *  (and its windows share the line's width evenly). A band that fits is one
 *  line, and so is an empty band. */
export function bandLines(count: number, perLine: number): number[] {
  if (!(perLine >= 1) || count <= perLine) return [Math.max(0, count)];
  const per = Math.floor(perLine);
  const lines: number[] = [];
  for (let left = count; left > 0; left -= per) lines.push(Math.min(per, left));
  return lines;
}

/** Where window `index` of a band of `count` sits once wrapped at `perLine`:
 *  its 0-based line, its position on that line, and the line's window count
 *  (the `index` and `count` to hand to `rowTrack`). */
export function lineSlot(
  index: number,
  count: number,
  perLine: number,
): { line: number; index: number; count: number } {
  if (!(perLine >= 1) || count <= perLine) return { line: 0, index, count };
  const per = Math.floor(perLine);
  const line = Math.floor(index / per);
  return { line, index: index - line * per, count: Math.min(per, count - line * per) };
}

/** Main-axis grid tracks of the strip (1-based) for bands of the given line
 *  counts. Each band is a leading gutter track followed by its line tracks,
 *  with a spacer track between two lines of the same band, so line `l` of a
 *  band sits on track `start + 2 * l` and the band spans `span` tracks. `end`
 *  is the trailing gutter after the last band. With one line per band this is
 *  the plain alternation: gutter `2i + 1`, band `2i + 2`. */
export function bandTracks(lines: number[]): {
  bands: { gutter: number; start: number; span: number }[];
  end: number;
} {
  let track = 1;
  const bands = lines.map((count) => {
    const n = Math.max(1, Math.floor(count));
    const band = { gutter: track, start: track + 1, span: 2 * n - 1 };
    track += 2 * n;
    return band;
  });
  return { bands, end: track };
}
