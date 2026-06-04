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

export type DropZone =
  | { kind: "before"; rowId: string }
  | { kind: "after-last"; rowId: string }
  | { kind: "into"; folderId: string };

/**
 * Resolve a drop given the target row, the y-position within the row (0..rowHeight),
 * and whether the target is a folder.
 *
 * - Top quarter:    "before"   (insert above this row at the same depth)
 * - Bottom quarter: "after"    (insert below this row at the same depth — same as "before" the next row)
 * - Middle (folder only): "into" (nest as last child)
 * - Middle (file):  "before"   (files have no body to drop into; treat as adjacent)
 */
export function resolveDropZone(args: {
  rowId: string;
  isFolderTarget: boolean;
  yWithinRow: number;
  rowHeight: number;
  isLastVisibleRow: boolean;
}): DropZone {
  const { rowId, isFolderTarget, yWithinRow, rowHeight, isLastVisibleRow } = args;
  const quarter = rowHeight / 4;
  if (yWithinRow < quarter) return { kind: "before", rowId };
  if (yWithinRow > rowHeight - quarter) {
    return isLastVisibleRow ? { kind: "after-last", rowId } : { kind: "before", rowId: ":next:" };
  }
  if (isFolderTarget) return { kind: "into", folderId: rowId };
  return { kind: "before", rowId };
}
