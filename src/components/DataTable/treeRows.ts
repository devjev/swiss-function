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
 */

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
