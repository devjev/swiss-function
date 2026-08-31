import type { ExplorerNode } from "./types";
import { isFolder } from "./types";

/** Flat row representation used by the table + dnd resolution. */
export interface FlatRow<M = unknown> {
  node: ExplorerNode<M>;
  depth: number;
  /** id of the parent node, or null if this row is at the root. */
  parentId: string | null;
  /** ids of every ancestor, root-first. Used for cycle prevention. */
  ancestorIds: string[];
}

/** Flatten visible (expanded) rows in display order. */
export function flatten<M>(
  nodes: ExplorerNode<M>[],
  expandedIds: Set<string>,
  depth = 0,
  parentId: string | null = null,
  ancestorIds: string[] = [],
): FlatRow<M>[] {
  const out: FlatRow<M>[] = [];
  for (const node of nodes) {
    out.push({ node, depth, parentId, ancestorIds });
    if (isFolder(node) && expandedIds.has(node.id) && node.children) {
      out.push(
        ...flatten(node.children, expandedIds, depth + 1, node.id, [...ancestorIds, node.id]),
      );
    }
  }
  return out;
}

/** All descendant ids of `node`, NOT including `node.id` itself. */
export function descendantIds<M>(node: ExplorerNode<M>): Set<string> {
  const out = new Set<string>();
  function walk(n: ExplorerNode<M>) {
    if (!n.children) return;
    for (const c of n.children) {
      out.add(c.id);
      walk(c);
    }
  }
  walk(node);
  return out;
}

/** True if `targetId` is the node itself or a descendant — meaning a move would cycle. */
export function wouldCycle<M>(dragged: ExplorerNode<M>, targetId: string | null): boolean {
  if (targetId == null) return false;
  if (dragged.id === targetId) return true;
  return descendantIds(dragged).has(targetId);
}

/** Find a node by id by walking the forest. */
export function findNode<M>(nodes: ExplorerNode<M>[], id: string): ExplorerNode<M> | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Where a dragged row would land. `after-all` = append to the root (only
 *  produced by Explorer when the drop is over the viewport below the rows). */
export type DropZone =
  | { kind: "into"; folderId: string }
  | { kind: "before"; flatIndex: number }
  | { kind: "after-all" };

/**
 * Resolve where `draggedNode` would land when hovered over row `rowIndex` at
 * `yWithinRow` px into it (the shipping logic behind Explorer's drop
 * indicators and `onMove`):
 *
 * - Top quarter:    "before" this row (insert above, at the row's depth)
 * - Bottom quarter: "before" the next row (insert below)
 * - Middle (folder): "into"   (nest as last child)
 * - Middle (file):  "before"  (files have no body to drop into)
 *
 * Returns `null` when the drop is invalid: no such row, or the prospective
 * parent is the dragged node itself / one of its descendants (a cycle).
 * Pure over `FlatRow[]`, so it is unit-tested and benched directly.
 */
export function computeDropZone<M>(args: {
  draggedNode: ExplorerNode<M>;
  flatRows: FlatRow<M>[];
  rowIndex: number;
  yWithinRow: number;
  rowHeight: number;
}): DropZone | null {
  const { draggedNode, flatRows, rowIndex, yWithinRow, rowHeight } = args;
  const targetRow = flatRows[rowIndex];
  if (!targetRow) return null;

  const quarter = rowHeight / 4;
  let zone: DropZone;
  if (yWithinRow < quarter) {
    zone = { kind: "before", flatIndex: rowIndex };
  } else if (yWithinRow > rowHeight - quarter) {
    zone = { kind: "before", flatIndex: rowIndex + 1 };
  } else if (isFolder(targetRow.node)) {
    zone = { kind: "into", folderId: targetRow.node.id };
  } else {
    zone = { kind: "before", flatIndex: rowIndex };
  }

  // Cycle prevention: reject if the prospective parent is the dragged node
  // itself or any of its descendants.
  let prospectiveParent: string | null = null;
  if (zone.kind === "into") prospectiveParent = zone.folderId;
  else {
    const tgt = flatRows[zone.flatIndex];
    prospectiveParent = tgt ? tgt.parentId : null;
  }
  if (wouldCycle(draggedNode, prospectiveParent)) return null;
  return zone;
}

/** Structural equality for drop zones, so a per-pointermove recompute can bail
 *  out of a state write (and a re-render) when the zone didn't change. */
export function dropZoneEqual(a: DropZone | null, b: DropZone | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind === "into" && b.kind === "into") return a.folderId === b.folderId;
  if (a.kind === "before" && b.kind === "before") return a.flatIndex === b.flatIndex;
  return a.kind === "after-all" && b.kind === "after-all";
}
