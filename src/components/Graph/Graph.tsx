import Graphology from "graphology";
import { circlepack, circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import { animateNodes } from "sigma/utils";
import { Tooltip } from "../../lib/chart";
import { cx } from "../../lib/cx";
import type { GraphData, GraphEdge, GraphNode, LayoutKind } from "../../lib/graph/types";
import { GraphControlsBar } from "./Controls";
import { GraphContext, type GraphControls } from "./context";
import styles from "./Graph.module.css";

/** Per-node target coordinates, as produced by the layout functions and
 *  consumed by Sigma's `animateNodes`. */
type LayoutMapping = Record<string, { x: number; y: number }>;

/** Visual overrides a `renderNode` callback may return. Sigma paints to WebGL
 *  (no per-node DOM, see §9), so "arbitrary content" is expressed as themed
 *  visual attributes — label, color, size — rather than nested elements. Any
 *  omitted field keeps its color-by-`kind` default. */
export interface NodeVisual {
  /** Text drawn beside the node; defaults to the node `label` or `id`. */
  label?: string;
  /** Fill color; should be a `--sf-*`-derived value. Defaults to color-by-`kind`. */
  color?: string;
  /** Node radius in graph units; defaults to a `kind`-derived size. */
  size?: number;
}

/** Visual overrides a `renderEdge` callback may return. */
export interface EdgeVisual {
  /** Text drawn along the edge; defaults to the edge `label` (if any). */
  label?: string;
  /** Stroke color; should be a `--sf-*`-derived value. */
  color?: string;
  /** Stroke thickness in graph units; defaults to a `weight`-derived size. */
  size?: number;
}

export interface GraphProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Nodes + edges to render. Each carries arbitrary structured `data`. */
  data: GraphData;
  /** Active layout (controlled). Switching it re-positions nodes with a smooth
   *  animated transition (or an instant snap under `prefers-reduced-motion`). */
  layout?: LayoutKind;
  /** Initial layout when `layout` is left uncontrolled. Defaults to `"force"`. */
  defaultLayout?: LayoutKind;
  /** Fired whenever the layout changes — from the prop, `Graph.Controls`, or a
   *  keyboard switch. Required to observe switches when `layout` is controlled. */
  onLayoutChange?: (next: LayoutKind) => void;
  /** Fired with the node `id` when a node is clicked. */
  onNodeClick?: (id: string) => void;
  /** Fired with the edge `id` when an edge is clicked. */
  onEdgeClick?: (id: string) => void;
  /** Fired with the currently selected node `id` (or `null` when cleared). */
  onSelectionChange?: (id: string | null) => void;
  /** Escape hatch to override a node's visual attributes (label / color / size)
   *  from its data. Returned fields override the color-by-`kind` defaults; an
   *  omitted field (or a `falsy` return) keeps the default. */
  renderNode?: (node: GraphNode) => NodeVisual | undefined;
  /** Escape hatch to override an edge's visual attributes (label / color /
   *  size). Returned fields override the weight-derived defaults. */
  renderEdge?: (edge: GraphEdge) => EdgeVisual | undefined;
  /** Overlay content — typically a `<Graph.Controls />` toolbar. */
  children?: ReactNode;
}

/** How far an arrow-key press nudges the camera, in screen pixels. */
const PAN_STEP_PX = 60;
/** Camera zoom factor per zoom-in / zoom-out step. */
const ZOOM_FACTOR = 1.5;

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

/** Default node radius (graph units). `primary` nodes read as the emphasized
 *  hubs; the rest are slightly smaller, so `kind` is legible as a size badge. */
function nodeSize(kind: string | undefined): number {
  return kind === undefined || kind === "primary" ? 4 : 3;
}

/** Map an edge `weight` (0–1) to a stroke thickness in graph units, clamped so
 *  even weightless edges stay visible. */
function edgeSize(weight: number | undefined): number {
  return Math.max(0.5, (weight ?? 0.5) * 2);
}

/** The visual hooks `buildGraph` applies on top of the color-by-`kind`
 *  defaults. Both are optional; a missing field keeps the default. */
interface RenderHooks {
  renderNode?: (node: GraphNode) => NodeVisual | undefined;
  renderEdge?: (edge: GraphEdge) => EdgeVisual | undefined;
}

/** Build a graphology graph from the shared data model, seeding positions and
 *  themed colors. Pre-computed `x`/`y` on a node are honored; otherwise a
 *  layout pass assigns coordinates. Edges are drawn directed (arrowheads) with
 *  a weight-derived thickness; `renderNode`/`renderEdge` override the visuals. */
function buildGraph(data: GraphData, hooks: RenderHooks): Graphology {
  const g = new Graphology();
  const edgeColor = token("--sf-color-border-subtle", "#e5e7eb");
  for (const n of data.nodes) {
    const custom = hooks.renderNode?.(n);
    g.addNode(n.id, {
      label: custom?.label ?? n.label ?? n.id,
      kind: n.kind,
      size: custom?.size ?? nodeSize(n.kind),
      x: n.x ?? Math.random(),
      y: n.y ?? Math.random(),
      color: custom?.color ?? nodeColor(n.kind),
      payload: n.data,
    });
  }
  for (const e of data.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.id)) {
      const custom = hooks.renderEdge?.(e);
      g.addEdgeWithKey(e.id, e.source, e.target, {
        // Directed: render an arrowhead toward the target.
        type: "arrow",
        label: custom?.label ?? e.label,
        size: custom?.size ?? edgeSize(e.weight),
        color: custom?.color ?? edgeColor,
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

/** The element an inspector tooltip describes: a node, or an edge. */
type InspectTarget = "node" | "edge";

/** Resolved inspector content + the viewport rect it anchors to. Sigma paints
 *  to a single canvas (no per-node DOM), so the anchor rect is synthesized from
 *  the surface's bounding rect plus the element's viewport coordinates. */
interface Inspection {
  target: InspectTarget;
  /** Heading line — the element's label (falling back to its id). */
  title: string;
  /** Secondary line — node `kind`, or "edge". */
  subtitle: string | undefined;
  /** `data` entries, stringified for display. */
  rows: Array<[string, string]>;
  /** Viewport-relative anchor box for the floating tooltip. */
  rect: DOMRect;
}

/** Flatten a `data` record into displayable key/value rows. Values are
 *  stringified shallowly; nested objects show as compact JSON. */
function dataRows(data: Record<string, unknown> | undefined): Array<[string, string]> {
  if (!data) return [];
  return Object.entries(data).map(([key, value]) => {
    const text =
      value === null || value === undefined
        ? "—"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    return [key, text];
  });
}

/** True when the user asked for reduced motion (layout switches snap instead
 *  of animating). Defaults to `false` outside the browser. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const GraphRoot = forwardRef<HTMLDivElement, GraphProps>(function Graph(
  {
    data,
    layout: controlledLayout,
    defaultLayout = "force",
    onLayoutChange,
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    renderNode,
    renderEdge,
    className,
    children,
    ...rest
  },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graphology | null>(null);
  // Uncontrolled layout state. When `layout` is provided the prop wins; the
  // setter still fires `onLayoutChange` so a controlled parent can react.
  const [uncontrolledLayout, setUncontrolledLayout] = useState<LayoutKind>(defaultLayout);
  const layout = controlledLayout ?? uncontrolledLayout;
  const setLayout = useCallback(
    (next: LayoutKind) => {
      if (controlledLayout === undefined) setUncontrolledLayout(next);
      onLayoutChange?.(next);
    },
    [controlledLayout, onLayoutChange],
  );
  // The layout currently applied to the graph, so the layout effect only
  // re-positions when it actually changes (not on every render).
  const appliedLayoutRef = useRef<LayoutKind | null>(null);
  // Cancels an in-flight `animateNodes` transition when a new one starts.
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  // Latest callbacks, read inside Sigma listeners without re-subscribing.
  const handlersRef = useRef({ onNodeClick, onEdgeClick, onSelectionChange });
  handlersRef.current = { onNodeClick, onEdgeClick, onSelectionChange };

  // Inspector tooltip: the node/edge under the cursor (hover) or the last
  // clicked node (select). Hover wins while it is set; on hover-out the
  // selected node's inspection is shown until the selection is cleared.
  const [hovered, setHovered] = useState<Inspection | null>(null);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const inspection = hovered ?? selected;

  // A small viewport box centered on (x,y) — the anchor the floating Tooltip
  // positions itself above. `getNodeDisplayData` is surface-relative, so add
  // the surface's viewport offset.
  const anchorAt = useCallback((x: number, y: number): DOMRect => {
    const box = surfaceRef.current?.getBoundingClientRect();
    const ox = box?.left ?? 0;
    const oy = box?.top ?? 0;
    return new DOMRect(ox + x - 4, oy + y - 4, 8, 8);
  }, []);

  // Build the inspection for a node: its label/kind + flattened `data`.
  const inspectNode = useCallback(
    (id: string): Inspection | null => {
      const g = graphRef.current;
      const renderer = sigmaRef.current;
      if (!g || !renderer || !g.hasNode(id)) return null;
      const pos = renderer.getNodeDisplayData(id);
      if (!pos) return null;
      const kind = g.getNodeAttribute(id, "kind") as string | undefined;
      const payload = g.getNodeAttribute(id, "payload") as Record<string, unknown> | undefined;
      return {
        target: "node",
        title: (g.getNodeAttribute(id, "label") as string | undefined) ?? id,
        subtitle: kind,
        rows: dataRows(payload),
        rect: anchorAt(pos.x, pos.y),
      };
    },
    [anchorAt],
  );

  // Build the inspection for an edge: its label + flattened `data`, anchored at
  // the midpoint of its endpoints' display positions.
  const inspectEdge = useCallback(
    (id: string): Inspection | null => {
      const g = graphRef.current;
      const renderer = sigmaRef.current;
      if (!g || !renderer || !g.hasEdge(id)) return null;
      const a = renderer.getNodeDisplayData(g.source(id));
      const b = renderer.getNodeDisplayData(g.target(id));
      if (!a || !b) return null;
      const payload = g.getEdgeAttribute(id, "payload") as Record<string, unknown> | undefined;
      return {
        target: "edge",
        title: (g.getEdgeAttribute(id, "label") as string | undefined) ?? "Edge",
        subtitle: `${g.source(id)} → ${g.target(id)}`,
        rows: dataRows(payload),
        rect: anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    },
    [anchorAt],
  );
  // Latest inspection builders, read inside Sigma listeners without re-subscribe.
  const inspectRef = useRef({ inspectNode, inspectEdge });
  inspectRef.current = { inspectNode, inspectEdge };

  // Build + render once per data identity. Layout changes are handled by the
  // layout effect below so swapping the layout never retears the renderer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: layout seeds the initial positions on (re)build; the separate layout effect owns subsequent changes.
  useEffect(() => {
    const container = surfaceRef.current;
    if (!container) return;

    const g = buildGraph(data, { renderNode, renderEdge });
    assignPositions(g, computeLayout(g, layout));
    graphRef.current = g;
    appliedLayoutRef.current = layout;

    // Show edge labels only when at least one edge carries one — otherwise the
    // renderer pays for label layout it would never draw.
    const hasEdgeLabels = g.someEdge((_e, attr) => attr.label != null);
    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary"),
      // Directed arrowheads for every edge unless an edge sets its own `type`.
      defaultEdgeType: "arrow",
      labelColor: { color: token("--sf-color-fg", "#0a0a0a") },
      labelFont: token("--sf-font-sans", "system-ui"),
      edgeLabelColor: { color: token("--sf-color-fg-subtle", "#737373") },
      edgeLabelFont: token("--sf-font-sans", "system-ui"),
      renderLabels: g.order <= 300,
      renderEdgeLabels: hasEdgeLabels && g.order <= 300,
      allowInvalidContainer: true,
    });
    sigmaRef.current = renderer;

    renderer.on("clickNode", ({ node }) => {
      handlersRef.current.onNodeClick?.(node);
      handlersRef.current.onSelectionChange?.(node);
      setSelected(inspectRef.current.inspectNode(node));
    });
    renderer.on("clickEdge", ({ edge }) => {
      handlersRef.current.onEdgeClick?.(edge);
    });
    renderer.on("clickStage", () => {
      handlersRef.current.onSelectionChange?.(null);
      setSelected(null);
    });

    // Hover inspector: show node/edge `data` while the cursor is over it.
    renderer.on("enterNode", ({ node }) => setHovered(inspectRef.current.inspectNode(node)));
    renderer.on("leaveNode", () => setHovered(null));
    renderer.on("enterEdge", ({ edge }) => setHovered(inspectRef.current.inspectEdge(edge)));
    renderer.on("leaveEdge", () => setHovered(null));

    return () => {
      cancelAnimationRef.current?.();
      cancelAnimationRef.current = null;
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      appliedLayoutRef.current = null;
      // Drop any inspector pinned to the now-destroyed graph.
      setHovered(null);
      setSelected(null);
    };
    // `layout` intentionally omitted — see the layout effect below.
  }, [data, renderNode, renderEdge]);

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

  // Camera controls. All animate, but collapse to an instant snap (duration 0)
  // under prefers-reduced-motion. Each is a no-op until Sigma has mounted.
  const camOpts = useCallback(() => ({ duration: prefersReducedMotion() ? 0 : 200 }), []);
  const zoomIn = useCallback(() => {
    sigmaRef.current?.getCamera().animatedZoom({ factor: ZOOM_FACTOR, ...camOpts() });
  }, [camOpts]);
  const zoomOut = useCallback(() => {
    sigmaRef.current?.getCamera().animatedUnzoom({ factor: ZOOM_FACTOR, ...camOpts() });
  }, [camOpts]);
  const reset = useCallback(() => {
    sigmaRef.current?.getCamera().animatedReset(camOpts());
  }, [camOpts]);
  // Fit-to-view: the graph is normalized into the camera's unit space, so
  // resetting the camera frames the whole graph. (Distinct from `reset` only
  // semantically — kept separate so 4.7's minimap/viewport work can refine
  // fit independently of reset.)
  const fitView = useCallback(() => {
    reset();
  }, [reset]);
  const pan = useCallback((dx: number, dy: number) => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const camera = renderer.getCamera();
    const state = camera.getState();
    // Convert a screen-pixel nudge into camera (graph) units: a full viewport
    // height spans `ratio` graph units, so px / dimension × ratio.
    const { width, height } = renderer.getDimensions();
    camera.setState({
      x: state.x + (dx / width) * state.ratio,
      y: state.y - (dy / height) * state.ratio,
    });
  }, []);

  const controls = useMemo<GraphControls>(
    () => ({ zoomIn, zoomOut, fitView, reset, pan, layout, setLayout }),
    [zoomIn, zoomOut, fitView, reset, pan, layout, setLayout],
  );

  // Keyboard navigation on the focused surface: +/- zoom, 0 fit, arrows pan.
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "+":
        case "=":
          zoomIn();
          break;
        case "-":
        case "_":
          zoomOut();
          break;
        case "0":
          fitView();
          break;
        case "ArrowUp":
          pan(0, -PAN_STEP_PX);
          break;
        case "ArrowDown":
          pan(0, PAN_STEP_PX);
          break;
        case "ArrowLeft":
          pan(-PAN_STEP_PX, 0);
          break;
        case "ArrowRight":
          pan(PAN_STEP_PX, 0);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [zoomIn, zoomOut, fitView, pan],
  );

  return (
    <GraphContext.Provider value={controls}>
      <div {...rest} ref={ref} className={cx(styles.root, className)}>
        {/* Sigma renders its WebGL canvas here. `role="application"` + tabIndex
            make the surface a keyboard target for pan/zoom; a fuller a11y pass
            (node-to-node navigation, screen-reader summary) lands in Task 5.3. */}
        <div
          ref={surfaceRef}
          className={styles.surface}
          role="application"
          aria-label="Graph view"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the surface IS interactive — it owns the pan/zoom canvas and handles +/-/0/arrow keyboard navigation, so it must be focusable.
          tabIndex={0}
          onKeyDown={onKeyDown}
        />
        {children}
        {/* Inspector: node/edge `data` on hover (and the last clicked node on
            select). Reuses the chart Tooltip — a fixed, viewport-clamped box
            that flips above/below its anchor. */}
        <Tooltip open={inspection !== null} anchorRect={inspection?.rect ?? null}>
          {inspection && (
            <div className={styles.inspector} data-graph-tooltip>
              <span className={styles.inspectorTitle}>{inspection.title}</span>
              {inspection.subtitle && (
                <span className={styles.inspectorSubtitle}>{inspection.subtitle}</span>
              )}
              {inspection.rows.length > 0 && (
                <dl className={styles.inspectorData}>
                  {inspection.rows.map(([key, value]) => (
                    <div className={styles.inspectorRow} key={key}>
                      <dt className={styles.inspectorKey}>{key}</dt>
                      <dd className={styles.inspectorValue}>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </Tooltip>
      </div>
    </GraphContext.Provider>
  );
});

/** `Graph` with the `Controls` toolbar attached as a compound member, matching
 *  the house `Object.assign(Root, { ... })` convention (Pane, Field, …). */
export const Graph = Object.assign(GraphRoot, { Controls: GraphControlsBar });
