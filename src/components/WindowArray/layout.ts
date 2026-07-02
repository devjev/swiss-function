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
