import Graphology from "graphology";
import { circlepack, circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { HTMLAttributes } from "react";
import { forwardRef, useEffect, useRef } from "react";
import Sigma from "sigma";
import { animateNodes } from "sigma/utils";
import { cx } from "../../lib/cx";
import type { GraphData, LayoutKind } from "../../lib/graph/types";
import styles from "./Graph.module.css";

/** Per-node target coordinates, as produced by the layout functions and
 *  consumed by Sigma's `animateNodes`. */
type LayoutMapping = Record<string, { x: number; y: number }>;

export interface GraphProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Nodes + edges to render. Each carries arbitrary structured `data`. */
  data: GraphData;
  /** Active layout. Switching it re-positions nodes with a smooth animated
   *  transition (or an instant snap under `prefers-reduced-motion`).
   *  Defaults to `"force"`. */
  layout?: LayoutKind;
  /** Fired with the node `id` when a node is clicked. */
  onNodeClick?: (id: string) => void;
  /** Fired with the edge `id` when an edge is clicked. */
  onEdgeClick?: (id: string) => void;
  /** Fired with the currently selected node `id` (or `null` when cleared). */
  onSelectionChange?: (id: string | null) => void;
}

const KIND_TOKEN: Record<string, string> = {
  primary: "--sf-color-primary",
  secondary: "--sf-color-fg-subtle",
  tertiary: "--sf-color-success",
  quaternary: "--sf-color-warning",
};

/** Read a `--sf-*` token off the live document so colors are themed, never
 *  hard-coded. Falls back to a sane value before first paint. */
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function nodeColor(kind: string | undefined): string {
  return token(KIND_TOKEN[kind ?? "primary"] ?? "--sf-color-primary", "#2563eb");
}

/** Build a graphology graph from the shared data model, seeding positions and
 *  themed colors. Pre-computed `x`/`y` on a node are honored; otherwise a
 *  layout pass assigns coordinates. */
function buildGraph(data: GraphData): Graphology {
  const g = new Graphology();
  for (const n of data.nodes) {
    g.addNode(n.id, {
      label: n.label ?? n.id,
      kind: n.kind,
      size: 3,
      x: n.x ?? Math.random(),
      y: n.y ?? Math.random(),
      color: nodeColor(n.kind),
      payload: n.data,
    });
  }
  for (const e of data.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.id)) {
      g.addEdgeWithKey(e.id, e.source, e.target, {
        size: Math.max(0.4, (e.weight ?? 0.5) * 1.5),
        color: token("--sf-color-border-subtle", "#e5e7eb"),
        payload: e.data,
      });
    }
  }
  return g;
}

/** Hierarchical / tree layout: a layered top-down pass. Roots (smallest
 *  in-degree, falling back to the first node) seed a BFS; each node is placed
 *  on the row of its BFS depth and spread evenly across its row. No external
 *  layout engine (elkjs/dagre both blew the bundle + scale budgets — see §9).
 *  Scaled to roughly match the force layout's coordinate range. */
function treeLayout(g: Graphology): LayoutMapping {
  const depth = new Map<string, number>();
  const order = g.nodes();
  // Seed roots: nodes with no incoming neighbor (treat undirected as in=out).
  const queue: string[] = [];
  for (const n of order) {
    if (g.inDegree(n) === 0) {
      depth.set(n, 0);
      queue.push(n);
    }
  }
  const root = order[0];
  if (queue.length === 0 && root !== undefined) {
    depth.set(root, 0);
    queue.push(root);
  }
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (node === undefined) continue;
    const d = depth.get(node) ?? 0;
    g.forEachNeighbor(node, (nbr) => {
      if (!depth.has(nbr)) {
        depth.set(nbr, d + 1);
        queue.push(nbr);
      }
    });
  }
  // Any node not reached (disconnected component) is parked on a trailing row.
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  const orphanRow = maxDepth + 1;
  const rows = new Map<number, string[]>();
  for (const n of order) {
    const d = depth.get(n) ?? orphanRow;
    const row = rows.get(d) ?? [];
    row.push(n);
    rows.set(d, row);
  }
  const span = Math.max(1, Math.sqrt(order.length));
  const mapping: LayoutMapping = {};
  for (const [d, row] of rows) {
    const step = row.length > 1 ? span / (row.length - 1) : 0;
    const offset = row.length > 1 ? span / 2 : 0;
    row.forEach((n, idx) => {
      mapping[n] = { x: idx * step - offset, y: -d * (span / Math.max(1, orphanRow + 1)) };
    });
  }
  return mapping;
}

/** Grid layout: place nodes on a √n × √n lattice, row-major. */
function gridLayout(g: Graphology): LayoutMapping {
  const order = g.nodes();
  const cols = Math.max(1, Math.ceil(Math.sqrt(order.length)));
  const span = Math.max(1, Math.sqrt(order.length));
  const step = cols > 1 ? span / (cols - 1) : 0;
  const half = span / 2;
  const mapping: LayoutMapping = {};
  order.forEach((n, i) => {
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    mapping[n] = { x: col * step - half, y: half - rowIdx * step };
  });
  return mapping;
}

/** Compute the target coordinates for a layout WITHOUT mutating the graph, so
 *  the result can be animated (or snapped) from the current positions.
 *  - `force`   → forceAtlas2 (organic, the default)
 *  - `radial`  → single ring (`circular`)
 *  - `concentric` → nested circles (`circlepack`)
 *  - `tree`    → layered BFS pass (manual — no elkjs/dagre, see §9)
 *  - `grid`    → √n lattice (manual) */
function computeLayout(g: Graphology, layout: LayoutKind): LayoutMapping {
  switch (layout) {
    case "radial":
      return circular(g, { scale: Math.max(1, Math.sqrt(g.order)) }) as LayoutMapping;
    case "concentric":
      return circlepack(g, { scale: Math.max(1, Math.sqrt(g.order)) }) as LayoutMapping;
    case "tree":
      return treeLayout(g);
    case "grid":
      return gridLayout(g);
    default: {
      // forceAtlas2 has no pure (non-assign) form; snapshot, run, restore.
      const before: LayoutMapping = {};
      g.forEachNode((n, attr) => {
        before[n] = { x: attr.x as number, y: attr.y as number };
      });
      forceAtlas2.assign(g, {
        iterations: g.order > 2000 ? 80 : 200,
        settings: forceAtlas2.inferSettings(g),
      });
      const after: LayoutMapping = {};
      g.forEachNode((n, attr) => {
        after[n] = { x: attr.x as number, y: attr.y as number };
        const prev = before[n];
        if (prev) {
          g.setNodeAttribute(n, "x", prev.x);
          g.setNodeAttribute(n, "y", prev.y);
        }
      });
      return after;
    }
  }
}

/** Write a layout mapping's coordinates onto the graph in place. */
function assignPositions(g: Graphology, mapping: LayoutMapping): void {
  for (const [id, pos] of Object.entries(mapping)) {
    g.setNodeAttribute(id, "x", pos.x);
    g.setNodeAttribute(id, "y", pos.y);
  }
}

/** True when the user asked for reduced motion (layout switches snap instead
 *  of animating). Defaults to `false` outside the browser. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const Graph = forwardRef<HTMLDivElement, GraphProps>(function Graph(
  { data, layout = "force", onNodeClick, onEdgeClick, onSelectionChange, className, ...rest },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graphology | null>(null);
  // The layout currently applied to the graph, so the layout effect only
  // re-positions when it actually changes (not on every render).
  const appliedLayoutRef = useRef<LayoutKind | null>(null);
  // Cancels an in-flight `animateNodes` transition when a new one starts.
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  // Latest callbacks, read inside Sigma listeners without re-subscribing.
  const handlersRef = useRef({ onNodeClick, onEdgeClick, onSelectionChange });
  handlersRef.current = { onNodeClick, onEdgeClick, onSelectionChange };

  // Build + render once per data identity. Layout changes are handled by the
  // layout effect below so swapping the layout never retears the renderer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: layout seeds the initial positions on (re)build; the separate layout effect owns subsequent changes.
  useEffect(() => {
    const container = surfaceRef.current;
    if (!container) return;

    const g = buildGraph(data);
    assignPositions(g, computeLayout(g, layout));
    graphRef.current = g;
    appliedLayoutRef.current = layout;

    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary"),
      labelColor: { color: token("--sf-color-fg", "#0a0a0a") },
      labelFont: token("--sf-font-sans", "system-ui"),
      renderLabels: g.order <= 300,
      allowInvalidContainer: true,
    });
    sigmaRef.current = renderer;

    renderer.on("clickNode", ({ node }) => {
      handlersRef.current.onNodeClick?.(node);
      handlersRef.current.onSelectionChange?.(node);
    });
    renderer.on("clickEdge", ({ edge }) => {
      handlersRef.current.onEdgeClick?.(edge);
    });
    renderer.on("clickStage", () => {
      handlersRef.current.onSelectionChange?.(null);
    });

    return () => {
      cancelAnimationRef.current?.();
      cancelAnimationRef.current = null;
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      appliedLayoutRef.current = null;
    };
    // `layout` intentionally omitted — see the layout effect below.
  }, [data]);

  // Re-position on layout switch. Compute the target coordinates, then either
  // snap (prefers-reduced-motion) or animate smoothly to them.
  useEffect(() => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer) return;
    if (appliedLayoutRef.current === layout) return;
    appliedLayoutRef.current = layout;

    const targets = computeLayout(g, layout);
    cancelAnimationRef.current?.();
    cancelAnimationRef.current = null;

    if (prefersReducedMotion()) {
      assignPositions(g, targets);
      renderer.refresh();
      return;
    }

    cancelAnimationRef.current = animateNodes(
      g,
      targets,
      { duration: 600, easing: "quadraticInOut" },
      () => {
        cancelAnimationRef.current = null;
      },
    );
  }, [layout]);

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      {/* Sigma renders its WebGL canvas into this surface. Container role,
          focus order and keyboard navigation are added in the a11y task. */}
      <div ref={surfaceRef} className={styles.surface} />
    </div>
  );
});
