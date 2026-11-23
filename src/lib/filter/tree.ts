/** Filtering a forest, shared by DataTable and Explorer (issue #108).
 *
 * A filtered tree keeps every match and the path down to it: a node that
 * fails the filter stays when a descendant matches, so a match never loses
 * its ancestors. The two components differ in what a match does to the rows
 * below it. DataTable filters every level (a parent that matches still drops
 * its children that do not); Explorer keeps a matching folder's whole
 * subtree (`keepMatchSubtree`), as a file tree shows a found folder's
 * contents.
 */

/** One kept node of a filtered forest. */
export interface KeptNode<N> {
  node: N;
  /** The node's position among its siblings in the unfiltered forest. */
  index: number;
  /** Whether the node passes the filter itself. A kept node that fails it
   *  stays as the path to a match below it. */
  match: boolean;
  /** The kept children in their original order. Null for a match that keeps
   *  its subtree whole (`keepMatchSubtree`); its children are then the
   *  node's own, unfiltered. */
  children: KeptNode<N>[] | null;
}

/** Prune a forest to its matches and the paths to them. Walks every node
 *  (collapsed or not) once, except below a match under `keepMatchSubtree`. */
export function filterForest<N>(
  roots: readonly N[],
  getChildren: (node: N) => readonly N[] | null | undefined,
  matches: (node: N) => boolean,
  { keepMatchSubtree = false }: { keepMatchSubtree?: boolean } = {},
): KeptNode<N>[] {
  const walk = (nodes: readonly N[]): KeptNode<N>[] => {
    const out: KeptNode<N>[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as N;
      const match = matches(node);
      if (match && keepMatchSubtree) {
        out.push({ node, index: i, match, children: null });
        continue;
      }
      const sub = getChildren(node);
      const children = sub && sub.length > 0 ? walk(sub) : [];
      if (match || children.length > 0) out.push({ node, index: i, match, children });
    }
    return out;
  };
  return walk(roots);
}
