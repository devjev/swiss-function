/** Force-layout plumbing shared by the Graph component's synchronous FA2 block
 *  and its background worker settle (graphology-layout-forceatlas2's
 *  `FA2LayoutSupervisor`). Pure — no React, no DOM — so the budget math and the
 *  detach/apply graph transforms stay unit-testable. */

import Graphology from "graphology";

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

/** Per-node target coordinates, as the layout functions produce them. */
export type PositionMap = Record<string, { x: number; y: number }>;

/** Write `positions` onto the live graph as ONE batched update. Two
 *  `setNodeAttribute` calls per node fire two events per node, and Sigma
 *  answers each with its own refresh (20k for a 10k-node layout). Nodes not
 *  in the graph are skipped. */
export function assignPositions(g: Graphology, positions: PositionMap): void {
  g.updateEachNodeAttributes(
    (node, attr) => {
      const to = positions[node];
      if (to) {
        attr.x = to.x;
        attr.y = to.y;
      }
      return attr;
    },
    { attributes: ["x", "y"] },
  );
}

/** Sigma's `animateNodes` (same timing: wall clock, `duration`, `easing`, the
 *  exact targets on the last frame, a cancel function back), writing each
 *  frame as one batched update. Sigma's version sets `x` and `y` per node,
 *  so a 10k-node transition fired 20k graph events per frame, each answered
 *  with a refresh, and ran at 12 fps. */
export function animatePositions(
  g: Graphology,
  targets: PositionMap,
  { duration, easing }: { duration: number; easing: (t: number) => number },
  done?: () => void,
): () => void {
  const start = Date.now();
  const from = new Map<string, { x: number; y: number }>();
  for (const node of Object.keys(targets)) {
    if (!g.hasNode(node)) continue;
    from.set(node, {
      x: g.getNodeAttribute(node, "x") as number,
      y: g.getNodeAttribute(node, "y") as number,
    });
  }
  let frame: number | null = null;
  const write = (p: number) =>
    g.updateEachNodeAttributes(
      (node, attr) => {
        const to = targets[node];
        const s = from.get(node);
        if (to && s) {
          attr.x = p === 1 ? to.x : to.x * p + s.x * (1 - p);
          attr.y = p === 1 ? to.y : to.y * p + s.y * (1 - p);
        }
        return attr;
      },
      { attributes: ["x", "y"] },
    );
  const step = () => {
    frame = null;
    const t = (Date.now() - start) / duration;
    if (t >= 1) {
      write(1);
      done?.();
      return;
    }
    write(easing(t));
    frame = requestAnimationFrame(step);
  };
  step();
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
  };
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
