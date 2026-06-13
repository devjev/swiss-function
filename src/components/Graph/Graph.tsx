import Graphology from "graphology";
import { circlepack, circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Fragment, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import { animateNodes } from "sigma/utils";
import { Tooltip } from "../../lib/chart";
import { cx } from "../../lib/cx";
import type { GraphData, GraphEdge, GraphNode, LayoutKind } from "../../lib/graph/types";
import { Menu } from "../Menu";
import { GraphControlsBar } from "./Controls";
import {
  GraphContext,
  type GraphControls,
  GraphInternalContext,
  type GraphInternals,
} from "./context";
import styles from "./Graph.module.css";
import { GraphMinimap } from "./Minimap";

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

/** What a right-click landed on: a specific node, or the empty stage. */
export interface GraphMenuTarget {
  /** `"node"` when a node was right-clicked; `"stage"` for empty canvas. */
  kind: "node" | "stage";
  /** The node `id` for a `"node"` target; `null` for the stage. */
  id: string | null;
}

/** One entry in the right-click context menu. */
export interface GraphMenuItem {
  /** Visible label. */
  label: string;
  /** Invoked when the item is chosen; receives the right-clicked node `id`
   *  (`null` for a stage click). */
  onSelect: (id: string | null) => void;
  /** Greys the item out and ignores clicks. */
  disabled?: boolean;
  /** Draw a separator above this item (e.g. to group destructive actions). */
  separatorBefore?: boolean;
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
  /** Notified when a node is right-clicked, before the menu opens. Receives the
   *  node `id` and the originating mouse event (use it to inspect modifier keys
   *  or `preventDefault` further). The menu still opens unless `contextMenuItems`
   *  returns an empty list. */
  onNodeContextMenu?: (id: string, event: MouseEvent) => void;
  /** Replace the right-click menu's items. Receives the right-click target
   *  (node or stage); return `[]` to suppress the menu for that target. When
   *  omitted, a default node menu (focus / expand / pin / hide) is shown and
   *  the stage has no menu. */
  contextMenuItems?: (target: GraphMenuTarget) => GraphMenuItem[];
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

/** Read a `--sf-*` token off a themed element so colors track the active theme,
 *  never hard-coded. Reads from `el` (the graph's own subtree) so it resolves
 *  whatever `data-theme` an ancestor sets — not just one on `<html>`; falls back
 *  to `document.documentElement`, then to a sane literal before first paint. */
function token(name: string, fallback: string, el?: Element | null): string {
  if (typeof document === "undefined") return fallback;
  const source = el ?? document.documentElement;
  const value = getComputedStyle(source).getPropertyValue(name).trim();
  return value || fallback;
}

function nodeColor(kind: string | undefined, el?: Element | null): string {
  return token(KIND_TOKEN[kind ?? "primary"] ?? "--sf-color-primary", "#2563eb", el);
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
function buildGraph(data: GraphData, hooks: RenderHooks, el?: Element | null): Graphology {
  const g = new Graphology();
  const edgeColor = token("--sf-color-border-subtle", "#e5e7eb", el);
  for (const n of data.nodes) {
    const custom = hooks.renderNode?.(n);
    g.addNode(n.id, {
      label: custom?.label ?? n.label ?? n.id,
      kind: n.kind,
      size: custom?.size ?? nodeSize(n.kind),
      x: n.x ?? Math.random(),
      y: n.y ?? Math.random(),
      color: custom?.color ?? nodeColor(n.kind, el),
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

/** An open right-click menu: where it sits (viewport-fixed cursor coords) and
 *  what it acted on. */
interface ContextMenuState {
  x: number;
  y: number;
  target: GraphMenuTarget;
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
    onNodeContextMenu,
    contextMenuItems,
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

  // Right-click context menu: where it opened + what it acted on. `null` closed.
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Bumped whenever the graph is (re)built or a layout finishes applying, so the
  // minimap overlay knows to recompute its cached node geometry.
  const [epoch, setEpoch] = useState(0);
  const bumpEpoch = useCallback(() => setEpoch((e) => e + 1), []);

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

    const g = buildGraph(data, { renderNode, renderEdge }, container);
    assignPositions(g, computeLayout(g, layout));
    graphRef.current = g;
    appliedLayoutRef.current = layout;

    // Show edge labels only when at least one edge carries one — otherwise the
    // renderer pays for label layout it would never draw.
    const hasEdgeLabels = g.someEdge((_e, attr) => attr.label != null);
    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary", container),
      // Directed arrowheads for every edge unless an edge sets its own `type`.
      defaultEdgeType: "arrow",
      labelColor: { color: token("--sf-color-fg", "#0a0a0a", container) },
      labelFont: token("--sf-font-sans", "system-ui", container),
      edgeLabelColor: { color: token("--sf-color-fg-subtle", "#737373", container) },
      edgeLabelFont: token("--sf-font-sans", "system-ui", container),
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

    // Right-click context menu. Suppress Sigma's own handling + the browser
    // menu, anchor at the cursor (viewport-fixed clientX/Y), and only open when
    // the resolved item list is non-empty.
    const openMenu = (target: GraphMenuTarget, event: { original: MouseEvent | TouchEvent }) => {
      const original = event.original;
      const mouse = "clientX" in original ? original : original.touches[0];
      original.preventDefault();
      if (target.kind === "node" && target.id !== null) {
        menuRef.current.onNodeContextMenu?.(target.id, original as MouseEvent);
      }
      if (menuRef.current.itemsFor(target).length === 0) return;
      setContextMenu({ x: mouse?.clientX ?? 0, y: mouse?.clientY ?? 0, target });
    };
    renderer.on("rightClickNode", ({ node, event }) => {
      event.preventSigmaDefault();
      openMenu({ kind: "node", id: node }, event);
    });
    renderer.on("rightClickStage", ({ event }) => {
      event.preventSigmaDefault();
      openMenu({ kind: "stage", id: null }, event);
    });

    // Signal overlays (minimap) that a fresh graph + display data exist.
    bumpEpoch();

    // Automation/test signal: mark the surface ready after the first paint, so a
    // harness (probe-graph.mjs) can time navigation → first stable layout.
    // Sigma emits its first `afterRender` synchronously during construction —
    // before this listener attaches — so force one more render with `refresh()`
    // to guarantee `markReady` fires once.
    container.removeAttribute("data-graph-ready");
    const markReady = () => {
      container.setAttribute("data-graph-ready", "");
      renderer.off("afterRender", markReady);
    };
    renderer.on("afterRender", markReady);
    renderer.refresh();

    return () => {
      renderer.off("afterRender", markReady);
      container.removeAttribute("data-graph-ready");
      cancelAnimationRef.current?.();
      cancelAnimationRef.current = null;
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      appliedLayoutRef.current = null;
      // Drop any inspector / menu pinned to the now-destroyed graph.
      setHovered(null);
      setSelected(null);
      setContextMenu(null);
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
      bumpEpoch();
      return;
    }

    cancelAnimationRef.current = animateNodes(
      g,
      targets,
      { duration: 600, easing: "quadraticInOut" },
      () => {
        cancelAnimationRef.current = null;
        // Layout settled — refresh the minimap's cached node geometry.
        bumpEpoch();
      },
    );
  }, [layout, bumpEpoch]);

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

  // Internal renderer handle for the minimap overlay. `getRenderer`/`getGraph`
  // read refs (stable); `epoch` changes drive the minimap to rebuild geometry.
  const getRenderer = useCallback(() => sigmaRef.current, []);
  const getGraph = useCallback(() => graphRef.current, []);
  const internals = useMemo<GraphInternals>(
    () => ({ getRenderer, getGraph, epoch }),
    [getRenderer, getGraph, epoch],
  );

  // --- Context-menu built-in actions ---------------------------------------
  // Center the camera on a node, optionally zooming to `ratio` (smaller = more
  // zoomed in). `getNodeDisplayData` is in the camera's framed coordinate space,
  // which is the same space as `CameraState.x/y`, so it animates there directly.
  const focusNode = useCallback(
    (id: string | null, ratio: number) => {
      const renderer = sigmaRef.current;
      if (!renderer || id === null) return;
      const pos = renderer.getNodeDisplayData(id);
      if (!pos) return;
      renderer.getCamera().animate({ x: pos.x, y: pos.y, ratio }, camOpts());
    },
    [camOpts],
  );
  // Hide a node from the canvas (its incident edges follow). Toggles, so the
  // same menu entry un-hides a hidden node.
  const toggleHidden = useCallback((id: string | null) => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer || id === null || !g.hasNode(id)) return;
    g.setNodeAttribute(id, "hidden", !g.getNodeAttribute(id, "hidden"));
    renderer.refresh();
  }, []);
  // Pin a node's label so it stays drawn regardless of label-density culling.
  const togglePin = useCallback((id: string | null) => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer || id === null || !g.hasNode(id)) return;
    g.setNodeAttribute(id, "forceLabel", !g.getNodeAttribute(id, "forceLabel"));
    renderer.refresh();
  }, []);

  // The menu items for a given target: the consumer's `contextMenuItems` when
  // provided, else the built-in node menu (focus / expand / pin / hide). The
  // stage has no default menu.
  const itemsFor = useCallback(
    (target: GraphMenuTarget): GraphMenuItem[] => {
      if (contextMenuItems) return contextMenuItems(target);
      if (target.kind !== "node") return [];
      return [
        { label: "Focus", onSelect: (id) => focusNode(id, 0.5) },
        { label: "Expand", onSelect: (id) => focusNode(id, 0.2) },
        { label: "Pin label", onSelect: togglePin },
        { label: "Hide", separatorBefore: true, onSelect: toggleHidden },
      ];
    },
    [contextMenuItems, focusNode, togglePin, toggleHidden],
  );
  // Read the latest menu builders inside Sigma's right-click listeners without
  // re-subscribing them on every render.
  const menuRef = useRef({ itemsFor, onNodeContextMenu });
  menuRef.current = { itemsFor, onNodeContextMenu };

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
      <GraphInternalContext.Provider value={internals}>
        <div {...rest} ref={ref} className={cx(styles.root, className)}>
          {/* Sigma renders its WebGL canvas here. `role="application"` + tabIndex
            make the surface a keyboard target for pan/zoom; a fuller a11y pass
            (node-to-node navigation, screen-reader summary) lands in Task 5.3. */}
          <div
            ref={surfaceRef}
            className={styles.surface}
            role="application"
            aria-label="Graph view"
            data-graph-surface
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
          {/* Right-click context menu. Controlled `Menu` whose Positioner anchors
            to a fixed, invisible Trigger placed at the cursor (house Explorer
            pattern). Choosing an item runs its action against the target id. */}
          <Menu.Root
            open={contextMenu !== null}
            onOpenChange={(open) => !open && setContextMenu(null)}
          >
            <Menu.Trigger
              aria-hidden="true"
              tabIndex={-1}
              className={styles.contextAnchor}
              style={{ left: contextMenu?.x ?? 0, top: contextMenu?.y ?? 0 }}
            />
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="start">
                <Menu.Popup data-graph-context-menu>
                  {contextMenu &&
                    itemsFor(contextMenu.target).map((item) => (
                      <Fragment key={item.label}>
                        {item.separatorBefore && <Menu.Separator />}
                        <Menu.Item
                          disabled={item.disabled}
                          onClick={() => {
                            item.onSelect(contextMenu.target.id);
                            setContextMenu(null);
                          }}
                        >
                          {item.label}
                        </Menu.Item>
                      </Fragment>
                    ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </GraphInternalContext.Provider>
    </GraphContext.Provider>
  );
});

/** `Graph` with the `Controls` toolbar attached as a compound member, matching
 *  the house `Object.assign(Root, { ... })` convention (Pane, Field, …). */
export const Graph = Object.assign(GraphRoot, {
  Controls: GraphControlsBar,
  Minimap: GraphMinimap,
});
