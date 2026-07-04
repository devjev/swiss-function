/** Force-layout plumbing shared by the Graph component's synchronous FA2 block
 *  and its background worker settle (graphology-layout-forceatlas2's
 *  `FA2LayoutSupervisor`). Pure — no React, no DOM — so the budget math and the
 *  detach/apply graph transforms stay unit-testable. */

import Graphology from "graphology";

/** Above this many nodes the force layout runs in the FA2 worker supervisor
 *  instead of the synchronous `forceAtlas2.assign` block: at 10k nodes the sync
 *  block freezes the main thread for ~1.4s, while below this the whole run is
 *  a few tens of milliseconds and a worker round-trip is pure overhead. */
export const FORCE_ASYNC_MIN_ORDER = 2000;

/** FA2 iteration budget for a graph of `order` nodes. One source of truth for
 *  the sync block AND the worker settle (1 worker message = 1 iteration), so
 *  both paths converge on the same layout quality per size tier. */
export function forceIterations(order: number): number {
  return order > 5000 ? 30 : order > 2000 ? 80 : 200;
}

/** Detached structure+position copy of a live graph for the FA2 worker. The
 *  copy is load-bearing: the supervisor terminates + respawns its worker on any
 *  structural event on ITS graph, so running it on the live graph would let
 *  `reconcile`/Connect-mode edge adds restart the settle mid-run — and its
 *  per-iteration position writes would land on the live graph, forcing Sigma
 *  into a full render per worker message. Only `x`/`y` are copied: FA2 reads
 *  node `size` solely under `adjustSizes` (never set by the inferred settings)
 *  and edge `weight` (absent on both graphs → 1, matching the sync path). */
export function detachForLayout(g: Graphology): Graphology {
  const copy = new Graphology();
  g.forEachNode((node, attr) => {
    copy.addNode(node, { x: attr.x as number, y: attr.y as number });
  });
  // Keys are irrelevant to FA2 (it consumes topology + weight); mergeEdge keeps
  // the copy valid regardless of the live graph's multi/self-loop guards.
  g.forEachEdge((_edge, _attr, source, target) => {
    copy.mergeEdge(source, target);
  });
  return copy;
}

/** Write the layout copy's `x`/`y` back onto the live graph as ONE batched
 *  update (`updateEachNodeAttributes` emits a single event, so Sigma coalesces
 *  the apply into one scheduled render — the throttle that keeps a streaming
 *  settle from flooding software-GL frames). Nodes added to the live graph
 *  mid-settle keep their seeded positions; nodes dropped are skipped. */
export function applyPositions(from: Graphology, to: Graphology): void {
  to.updateEachNodeAttributes(
    (node, attr) => {
      if (from.hasNode(node)) {
        attr.x = from.getNodeAttribute(node, "x") as number;
        attr.y = from.getNodeAttribute(node, "y") as number;
      }
      return attr;
    },
    { attributes: ["x", "y"] },
  );
}
