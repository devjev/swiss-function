/** Tree-mode pruning for collapsed subtrees (issue #18).
 *
 * A tree table materializes a TanStack Row object (~2.6KB) for every node
 * reachable through `getSubRows` — including collapsed descendants that can
 * never render (50k collapsed nodes ≈ +132MB heap). `buildTreeMeta` walks the
 * tree gated on the expanded-state record, reproducing table-core's default
 * row-id scheme (child index paths joined with "."), and returns a
 * `getSubRows` that withholds children of collapsed rows, so hidden subtrees
 * are never materialized. Visible-row parity with a stock table-core instance
 * (ids, order, depth, index, originals) is pinned by treeRows.test.ts.
 *
 * With a column filter active, `filterTreeRows` walks the whole tree instead
 * (issue #108) and `filteredTreeMeta` hands table-core the kept rows under
 * the same pruning and the same ids.
 */

import { filterForest, type KeptNode } from "../../lib/filter/tree";

export interface TreeNodeInfo {
  id: string;
  hasChildren: boolean;
}

export interface TreeMeta<T> {
  /** Per reachable node: TanStack row id + whether it has children. A pruned
   *  Row can't answer `getCanExpand()` itself — its subRows are withheld
   *  while collapsed — so the chevron reads `hasChildren` from here. */
  info: Map<T, TreeNodeInfo>;
  /** Pruning `getSubRows` to hand to TanStack in place of the consumer's. */
  getSubRows: (row: T) => T[] | undefined;
}

export function buildTreeMeta<T>(
  data: T[],
  getSubRows: (row: T) => T[] | undefined,
  expanded: Record<string, boolean>,
): TreeMeta<T> {
  const info = new Map<T, TreeNodeInfo>();
  const walk = (nodes: T[], prefix: string) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as T;
      // Table-core's default getRowId: `${parent.id}.${index}`, index being
      // the child's position in the parent's original subRows array.
      const id = prefix === "" ? String(i) : `${prefix}.${i}`;
      const children = getSubRows(node);
      const hasChildren = children != null && children.length > 0;
      info.set(node, { id, hasChildren });
      if (hasChildren && expanded[id]) walk(children as T[], id);
    }
  };
  walk(data, "");
  return {
    info,
    getSubRows: (row) => {
      const meta = info.get(row);
      return meta && expanded[meta.id] ? (getSubRows(row) ?? undefined) : undefined;
    },
  };
}

// --- Filtered trees (issue #108) ---------------------------------------------

/** A kept node of a filtered tree: its row id in the unfiltered tree, so the
 *  expanded state keeps its meaning, and its kept children. */
export interface FilteredNodeInfo<T> extends TreeNodeInfo {
  children: T[];
}

export interface FilteredTree<T> {
  /** The kept roots, in their original order. */
  roots: T[];
  /** Every kept node. `hasChildren` counts kept children only. */
  nodes: Map<T, FilteredNodeInfo<T>>;
  /** Ids of the kept rows that fail the filter themselves: the path to a
   *  match, shown expanded while the filter is active. */
  paths: Set<string>;
}

/** Filter a tree table's data on every level: a row stays when it matches or
 *  a descendant does, and a matching row's children are filtered too. Walks
 *  the whole tree, collapsed subtrees included, so a match under a collapsed
 *  parent is found. Runs only while a filter is active. */
export function filterTreeRows<T>(
  data: T[],
  getSubRows: (row: T) => T[] | undefined,
  matches: (row: T) => boolean,
): FilteredTree<T> {
  const nodes = new Map<T, FilteredNodeInfo<T>>();
  const paths = new Set<string>();
  const index = (kept: KeptNode<T>[], prefix: string): T[] =>
    kept.map(({ node, index: i, match, children }) => {
      // The unfiltered tree's id (see buildTreeMeta), from the original index.
      const id = prefix === "" ? String(i) : `${prefix}.${i}`;
      const keptChildren = children ? index(children, id) : [];
      nodes.set(node, { id, hasChildren: keptChildren.length > 0, children: keptChildren });
      if (!match) paths.add(id);
      return node;
    });
  return { roots: index(filterForest(data, getSubRows, matches), ""), nodes, paths };
}

/** The row-model inputs for a filtered tree under an expanded state. Hands
 *  table-core the kept rows alone, withholds the children of collapsed rows
 *  (as buildTreeMeta does), and names each row by its unfiltered id. */
export function filteredTreeMeta<T>(
  tree: FilteredTree<T>,
  expanded: true | Record<string, boolean>,
) {
  const open = (id: string) => expanded === true || !!expanded[id];
  return {
    info: tree.nodes as Map<T, TreeNodeInfo>,
    // A fresh array: the core row model memoizes on data identity.
    data: tree.roots.slice(),
    getSubRows: (row: T): T[] | undefined => {
      const node = tree.nodes.get(row);
      return node?.hasChildren && open(node.id) ? node.children : undefined;
    },
    getRowId: (row: T, index: number, parent?: { id: string }): string =>
      tree.nodes.get(row)?.id ?? (parent ? `${parent.id}.${index}` : String(index)),
  };
}

/** A tree row's position among its siblings in the consumer's data: the last
 *  step of its id. TanStack's own `row.index` counts the rows it was handed,
 *  which under a filter are the kept siblings only. */
export function sourceIndex(row: { id: string; index: number }): number {
  const dot = row.id.lastIndexOf(".");
  const n = Number(dot < 0 ? row.id : row.id.slice(dot + 1));
  return Number.isInteger(n) ? n : row.index;
}
