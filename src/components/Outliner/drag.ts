/**
 * Where a dragged block lands.
 *
 * A drop is named by two things the pointer gives: the gap between two visible
 * rows, and a depth (how far right the pointer is). The same gap can mean
 * several places: under the last child of a block, the line can be that
 * child's sibling, its child, or a sibling of any ancestor that ends there.
 * `dropTarget` limits the depth to what the gap allows and names the place as
 * a parent and the sibling to follow.
 */

import type { BulletId } from "./types";

/** A visible row, as the projection needs it. The rows being dragged are left
 *  out of the list. */
export interface DragRow {
  id: BulletId;
  depth: number;
  /** The row has children that are folded away. */
  folded: boolean;
}

export interface DropTarget {
  /** The new parent; null for the top level. */
  parentId: BulletId | null;
  /** The sibling the blocks go after; null puts them first. */
  afterId: BulletId | null;
  /** The depth the blocks take. */
  depth: number;
  /** The row the line is drawn under; -1 for above the first row. */
  after: number;
}

/**
 * @param rows   the visible rows without the dragged ones
 * @param after  index of the row above the gap, -1 for the gap above the first row
 * @param depth  the depth the pointer asks for
 * @param floor  the lowest depth a block may take: 0, or 1 when the first row
 *               is the zoomed block (nothing may become its sibling)
 */
export function dropTarget(
  rows: DragRow[],
  after: number,
  depth: number,
  floor = 0,
): DropTarget | null {
  if (rows.length === 0) {
    return floor === 0 ? { parentId: null, afterId: null, depth: 0, after: -1 } : null;
  }
  const at = Math.max(floor === 0 ? -1 : 0, Math.min(after, rows.length - 1));
  const prev = rows[at];
  const next = rows[at + 1];
  if (!prev) return { parentId: null, afterId: null, depth: 0, after: -1 };

  // As deep as a child of the row above (its folded children would hide the
  // block, so a folded row takes none), as shallow as the row below.
  const max = prev.folded ? prev.depth : prev.depth + 1;
  const min = Math.max(floor, Math.min(next ? next.depth : floor, max));
  const d = Math.max(min, Math.min(depth, max));

  if (d === prev.depth + 1) return { parentId: prev.id, afterId: null, depth: d, after: at };

  // The row above, or the ancestor of it at this depth: the block follows it.
  let sibling = at;
  while (sibling >= 0 && (rows[sibling] as DragRow).depth !== d) sibling--;
  let parent = sibling;
  while (parent >= 0 && (rows[parent] as DragRow).depth !== d - 1) parent--;
  const afterRow = rows[sibling];
  if (!afterRow) return null;
  return { parentId: rows[parent]?.id ?? null, afterId: afterRow.id, depth: d, after: at };
}
