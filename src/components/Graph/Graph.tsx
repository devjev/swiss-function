import type Graphology from "graphology";
import { circlepack, circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Sigma from "sigma";
import { drawDiscNodeLabel, type NodeHoverDrawingFunction } from "sigma/rendering";
import type { NodeDisplayData, PartialButFor } from "sigma/types";
import { animateNodes } from "sigma/utils";
import { cx } from "../../lib/cx";
import {
  applyVisuals,
  buildGraph,
  type EdgeVisual,
  type NodeVisual,
  nodeColor,
  type RenderHooks,
  reconcile,
  token,
} from "../../lib/graph/build";
import type { GraphData, GraphEdge, GraphNode, LayoutKind } from "../../lib/graph/types";
import { useFullscreen } from "../../lib/useFullscreen";
import { FullscreenToggle } from "../Fullscreen";
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

// `NodeVisual` / `EdgeVisual` (the `renderNode`/`renderEdge` return shapes) live
// in `lib/graph/build` alongside the graph construction they feed; re-exported
// here so they remain part of the component's public surface.
export type { EdgeVisual, NodeVisual };

/** What a right-click landed on: a node, an edge, or the empty stage. */
export interface GraphMenuTarget {
  /** `"node"` / `"edge"` for an item right-click; `"stage"` for empty canvas. */
  kind: "node" | "edge" | "stage";
  /** The node/edge `id` for an item target; `null` for the stage. */
  id: string | null;
}

/** One entry in the right-click context menu. */
export interface GraphMenuItem {
  /** Visible label. */
  label: string;
  /** Invoked when the item is chosen; receives the right-clicked node/edge `id`
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
   *  (node, edge, or stage); return `[]` to suppress the menu for that target.
   *  When omitted, a default node menu (focus / expand / pin / hide) is shown, an
   *  edge shows "Delete" when `editable` + `onEdgeDelete`, and the stage has no
   *  menu. Use the `edge` target as the entry point for your own edit UI. */
  contextMenuItems?: (target: GraphMenuTarget) => GraphMenuItem[];
  /** Enable interactive relationship editing: a Connect toggle in
   *  `Graph.Controls` (drag node→node to add an edge), edge selection, and the
   *  delete affordances (right-click "Delete" + Delete/Backspace on a selected
   *  edge). Off by default — purely declarative graphs are unaffected. */
  editable?: boolean;
  /** Fired when the user draws a new edge (Connect-mode drag) with a freshly
   *  generated `id`. The edge is added to the live view immediately; persist it to
   *  your `data` so it survives the next reconcile. */
  onEdgeCreate?: (edge: { id: string; source: string; target: string }) => void;
  /** Fired with the edge `id` when the user deletes an edge (menu or keyboard).
   *  Removed from the live view immediately; mirror the change in your `data`. */
  onEdgeDelete?: (id: string) => void;
  /** Generate the `id` for an edge created via Connect-mode drag. Defaults to a
   *  unique `edge-…` id. */
  generateEdgeId?: () => string;
  /** Overlay content — typically a `<Graph.Controls />` toolbar. */
  children?: ReactNode;
  /** Show a corner button that maximizes the graph to the full viewport.
   *  Default `true`. Escape exits. */
  fullscreen?: boolean;
  /** Initial maximized state (uncontrolled). Default `false`. */
  defaultFullscreen?: boolean;
  /** Notified when the graph is maximized / restored. */
  onFullscreenChange?: (expanded: boolean) => void;
}

/** How far an arrow-key press nudges the camera, in screen pixels. */
const PAN_STEP_PX = 60;
/** Camera zoom factor per zoom-in / zoom-out step. */
const ZOOM_FACTOR = 1.5;
/** Minimum rendered edge thickness (px) for `editable` graphs. Sigma hit-tests
 *  edges by their drawn pixels, so this doubles as the click/right-click target
 *  size — the 1.7px default is too thin to grab comfortably. */
const EDITABLE_MIN_EDGE_THICKNESS = 5;
/** Added to the kind-derived default node size in `editable` graphs so nodes stay
 *  visually weightier than the thicker editable edges. Consumer `renderNode`
 *  sizes are unaffected. */
const EDITABLE_NODE_SIZE_BOOST = 4;

/** Fallback unique id for an edge drawn via Connect mode, when the consumer
 *  doesn't supply `generateEdgeId`. Prefers `crypto.randomUUID`, else a counter. */
let edgeIdSeq = 0;
function defaultEdgeId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `edge-${uuid ?? `${(edgeIdSeq++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`}`;
}

/** Viewport-pixel endpoints of the Connect-mode rubber-band line. */
interface ConnectLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Theme-aware replacement for Sigma's default node-hover renderer. The built-in
 *  one hard-codes a white (`#FFF`) label-background box, so in dark mode the white
 *  label text (`labelColor` = `--sf-color-fg`) lands on a white box and vanishes.
 *  This paints the box with `--sf-color-bg` plus a `--sf-color-border` hairline —
 *  legible in both themes — then defers to Sigma to draw the label text itself.
 *  Geometry mirrors Sigma's `drawDiscNodeHover`. */
function makeNodeHoverRenderer(el: Element | null): NodeHoverDrawingFunction {
  return (
    context,
    data: PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color">,
    settings,
  ) => {
    context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
    context.fillStyle = token("--sf-color-bg", "#ffffff", el);
    context.strokeStyle = token("--sf-color-border", "#303030", el);
    context.lineWidth = 1;

    const PADDING = 2;
    if (typeof data.label === "string") {
      const textWidth = context.measureText(data.label).width;
      const boxWidth = Math.round(textWidth + 5);
      const boxHeight = Math.round(settings.labelSize + 2 * PADDING);
      const radius = Math.max(data.size, settings.labelSize / 2) + PADDING;
      const angleRadian = Math.asin(boxHeight / 2 / radius);
      const xDeltaCoord = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));
      context.beginPath();
      context.moveTo(data.x + xDeltaCoord, data.y + boxHeight / 2);
      context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
      context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
      context.lineTo(data.x + xDeltaCoord, data.y - boxHeight / 2);
      context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
      context.closePath();
    } else {
      context.beginPath();
      context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
      context.closePath();
    }
    context.fill();
    context.stroke();

    drawDiscNodeLabel(context, data, settings);
  };
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
    editable = false,
    onEdgeCreate,
    onEdgeDelete,
    generateEdgeId,
    className,
    children,
    fullscreen = true,
    defaultFullscreen,
    onFullscreenChange,
    ...rest
  },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { expanded: isFullscreen, toggle: toggleFullscreen } = useFullscreen({
    defaultExpanded: defaultFullscreen,
    onExpandedChange: onFullscreenChange,
  });
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
  const handlersRef = useRef({
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    onEdgeCreate,
    onEdgeDelete,
  });
  handlersRef.current = { onNodeClick, onEdgeClick, onSelectionChange, onEdgeCreate, onEdgeDelete };

  // Right-click context menu: where it opened + what it acted on. `null` closed.
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // --- Relationship editing state ------------------------------------------
  // Connect mode: while on (and `editable`), a node→node drag draws an edge.
  const [connectMode, setConnectMode] = useState(false);
  // Live rubber-band line shown during a Connect-mode drag, in surface pixels.
  const [connectLine, setConnectLine] = useState<ConnectLine | null>(null);
  // Refs the Sigma listeners + reducers (wired once at mount) read for the
  // latest values without re-subscribing.
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const connectModeRef = useRef(connectMode);
  connectModeRef.current = connectMode;
  const selectedEdgeRef = useRef<string | null>(null);
  const generateEdgeIdRef = useRef(generateEdgeId);
  generateEdgeIdRef.current = generateEdgeId;
  // Drag bookkeeping: whether a draw is in progress and its source/target nodes.
  const connectDrawingRef = useRef(false);
  const connectSourceRef = useRef<string | null>(null);
  const connectTargetRef = useRef<string | null>(null);
  // Emphasis color for the selected edge + connect endpoints (resolved at mount).
  const selectColorRef = useRef("#2563eb");

  // Bumped whenever the graph is (re)built or a layout finishes applying, so the
  // minimap overlay knows to recompute its cached node geometry.
  const [epoch, setEpoch] = useState(0);
  const bumpEpoch = useCallback(() => setEpoch((e) => e + 1), []);

  // Accessibility: a screen reader can't traverse a WebGL canvas, so the surface
  // carries a text summary (counts + active layout + key hints) via
  // `aria-describedby`, and a polite live region announces layout changes.
  const summaryId = useId();
  const nodeCount = data.nodes.length;
  const edgeCount = data.edges.length;

  // Latest render hooks, read by the build effect WITHOUT keying on their
  // identity — an inline `renderNode={n => …}` changes identity every parent
  // render, and rebuilding the whole Sigma renderer on each would wipe
  // selection/camera and trash LARGE perf. The visuals effect below re-themes in
  // place when they actually change.
  const renderHooksRef = useRef<RenderHooks>({ renderNode, renderEdge });
  renderHooksRef.current = { renderNode, renderEdge };

  // Latest `data`/`layout`, read by the mount effect (which runs once) to build
  // the initial graph + seed the first layout without re-running on every change.
  const dataRef = useRef(data);
  dataRef.current = data;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Build the graph + Sigma renderer and wire every listener ONCE, on mount
  // (`bumpEpoch` is stable; `data`/`layout` and all callbacks are read through
  // refs). `data` changes flow through the reconcile effect below — applied in
  // place so the camera + layout are preserved — rather than rebuilding.
  useEffect(() => {
    const container = surfaceRef.current;
    if (!container) return;
    const initialData = dataRef.current;
    const initialLayout = layoutRef.current;

    // Seed positions come from buildGraph (pre-set node x/y, else random). The
    // potentially expensive initial layout is deferred below so it runs AFTER the
    // first paint rather than blocking it.
    const g = buildGraph(
      initialData,
      renderHooksRef.current,
      container,
      editableRef.current ? EDITABLE_NODE_SIZE_BOOST : 0,
    );
    graphRef.current = g;
    appliedLayoutRef.current = initialLayout;
    selectColorRef.current = token("--sf-color-primary", "#2563eb", container);

    // Show edge labels only when at least one edge carries one — otherwise the
    // renderer pays for label layout it would never draw.
    const hasEdgeLabels = g.someEdge((_e, attr) => attr.label != null);
    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary", container),
      // Directed arrowheads for every edge unless an edge sets its own `type`.
      defaultEdgeType: "arrow",
      labelColor: { color: token("--sf-color-fg", "#0a0a0a", container) },
      labelFont: token("--sf-font-sans", "system-ui", container),
      // Theme-aware hover box; Sigma's default hard-codes a white background that
      // hides white dark-mode label text.
      defaultDrawNodeHover: makeNodeHoverRenderer(container),
      edgeLabelColor: { color: token("--sf-color-fg-subtle", "#737373", container) },
      edgeLabelFont: token("--sf-font-sans", "system-ui", container),
      renderLabels: g.order <= 300,
      renderEdgeLabels: hasEdgeLabels && g.order <= 300,
      // Edge events (click/right-click/hover) only fire when enabled; needed for
      // edge selection + the edge context menu. Off for big read-only graphs.
      enableEdgeEvents: editableRef.current || handlersRef.current.onEdgeClick != null,
      // Sigma hit-tests edges by color-picking their RENDERED pixels, so the
      // clickable area equals the drawn thickness. The 1.7px default is fiddly to
      // hit; give editable graphs a thicker floor so edges are easy to select /
      // right-click (and a touch more visible). Read-only graphs keep the default.
      minEdgeThickness: editableRef.current ? EDITABLE_MIN_EDGE_THICKNESS : 1.7,
      // Emphasize the selected edge; brighten the connect-drag endpoints.
      edgeReducer: (edge, attr) =>
        selectedEdgeRef.current === edge
          ? { ...attr, color: selectColorRef.current, size: ((attr.size as number) ?? 1) * 2 }
          : attr,
      nodeReducer: (node, attr) =>
        connectDrawingRef.current &&
        (node === connectSourceRef.current || node === connectTargetRef.current)
          ? { ...attr, color: selectColorRef.current, highlighted: true }
          : attr,
      allowInvalidContainer: true,
    });
    sigmaRef.current = renderer;

    // Clear any edge selection (on a node/stage click). The reducer repaints the
    // de-emphasis on refresh.
    const clearEdgeSelection = () => {
      if (selectedEdgeRef.current === null) return;
      selectedEdgeRef.current = null;
      renderer.refresh();
    };

    renderer.on("clickNode", ({ node }) => {
      handlersRef.current.onNodeClick?.(node);
      handlersRef.current.onSelectionChange?.(node);
      clearEdgeSelection();
    });
    renderer.on("clickEdge", ({ edge }) => {
      handlersRef.current.onEdgeClick?.(edge);
      // Select the edge (for delete) only when editing is enabled.
      if (editableRef.current) {
        selectedEdgeRef.current = edge;
        renderer.refresh();
      }
    });
    renderer.on("clickStage", () => {
      handlersRef.current.onSelectionChange?.(null);
      clearEdgeSelection();
    });

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
    renderer.on("rightClickEdge", ({ edge, event }) => {
      event.preventSigmaDefault();
      openMenu({ kind: "edge", id: edge }, event);
    });
    renderer.on("rightClickStage", ({ event }) => {
      event.preventSigmaDefault();
      openMenu({ kind: "stage", id: null }, event);
    });

    // --- Connect mode: drag from a source node to a target to draw an edge ---
    // Source/target tracked in refs; a rubber-band line follows the cursor; the
    // camera is pinned during the draw so the gesture doesn't pan. Endpoints are
    // in surface-local pixels (Sigma node-event `x`/`y` and `graphToViewport`
    // share that space; document pointer coords are offset by the surface rect).
    const setLineTo = (vx: number, vy: number) => {
      const source = connectSourceRef.current;
      const live = graphRef.current;
      if (source === null || live === null || !live.hasNode(source)) return;
      const sp = renderer.graphToViewport({
        x: live.getNodeAttribute(source, "x") as number,
        y: live.getNodeAttribute(source, "y") as number,
      });
      setConnectLine({ x1: sp.x, y1: sp.y, x2: vx, y2: vy });
    };
    const onDocPointerMove = (ev: PointerEvent) => {
      if (!connectDrawingRef.current) return;
      const rect = container.getBoundingClientRect();
      setLineTo(ev.clientX - rect.left, ev.clientY - rect.top);
    };
    const finishDraw = (commit: boolean) => {
      if (!connectDrawingRef.current) return;
      connectDrawingRef.current = false;
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("keydown", onDocKeyDown);
      renderer.setSetting("enableCameraPanning", true);
      setConnectLine(null);
      const source = connectSourceRef.current;
      const target = connectTargetRef.current;
      connectSourceRef.current = null;
      connectTargetRef.current = null;
      renderer.refresh(); // drop the endpoint highlight
      if (!commit) return;
      const live = graphRef.current;
      if (live === null || source === null || target === null || source === target) return;
      if (live.hasEdge(source, target)) return; // non-multi: no parallel edge
      const id = (generateEdgeIdRef.current ?? defaultEdgeId)();
      live.addEdgeWithKey(id, source, target, { type: "arrow" });
      applyVisuals(
        live,
        { nodes: [], edges: [{ id, source, target }] },
        renderHooksRef.current,
        container,
      );
      renderer.refresh();
      handlersRef.current.onEdgeCreate?.({ id, source, target });
    };
    const onDocPointerUp = () => finishDraw(true);
    const onDocKeyDown = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape") finishDraw(false);
    };

    renderer.on("downNode", ({ node, event }) => {
      if (!editableRef.current || !connectModeRef.current) return;
      connectDrawingRef.current = true;
      connectSourceRef.current = node;
      connectTargetRef.current = null;
      renderer.setSetting("enableCameraPanning", false);
      setLineTo(event.x, event.y);
      document.addEventListener("pointermove", onDocPointerMove);
      document.addEventListener("pointerup", onDocPointerUp);
      document.addEventListener("keydown", onDocKeyDown);
      renderer.refresh(); // highlight the source endpoint
    });
    renderer.on("enterNode", ({ node }) => {
      if (connectDrawingRef.current && node !== connectSourceRef.current) {
        connectTargetRef.current = node;
        renderer.refresh();
      }
    });
    renderer.on("leaveNode", ({ node }) => {
      if (connectDrawingRef.current && connectTargetRef.current === node) {
        connectTargetRef.current = null;
        renderer.refresh();
      }
    });

    // Signal overlays (minimap) that a fresh graph + display data exist (seed
    // positions; refreshed again once the stable layout lands below).
    bumpEpoch();

    // Defer the initial layout behind the first paint. Sigma has already painted
    // the seed positions, so the layout (a multi-second forceAtlas2 on LARGE)
    // runs across the next frames instead of freezing first paint. Snap to it (no
    // animation from the random seed — subsequent layout *switches* animate via
    // the layout effect). `data-graph-ready` is set only once the stable layout
    // has painted: the harness's "first stable layout paint" signal.
    container.removeAttribute("data-graph-ready");
    let initialRaf = requestAnimationFrame(() => {
      initialRaf = requestAnimationFrame(() => {
        if (sigmaRef.current !== renderer) return;
        assignPositions(g, computeLayout(g, initialLayout));
        renderer.refresh();
        container.setAttribute("data-graph-ready", "");
        bumpEpoch();
      });
    });

    return () => {
      cancelAnimationFrame(initialRaf);
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("keydown", onDocKeyDown);
      container.removeAttribute("data-graph-ready");
      cancelAnimationRef.current?.();
      cancelAnimationRef.current = null;
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      appliedLayoutRef.current = null;
      connectDrawingRef.current = false;
      // Drop any menu / rubber-band pinned to the now-destroyed graph.
      setContextMenu(null);
      setConnectLine(null);
    };
  }, [bumpEpoch]);

  // Reconcile the live graph IN PLACE when `data` changes: add/remove nodes &
  // edges and refresh attributes without rebuilding the renderer, so the camera
  // and existing node positions survive (see `reconcile` in lib/graph/build).
  // No-op on first run — the mount effect already built this exact `data`.
  useEffect(() => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer) return;
    const changed = reconcile(
      g,
      data,
      renderHooksRef.current,
      surfaceRef.current,
      editable ? EDITABLE_NODE_SIZE_BOOST : 0,
    );
    // The selected edge may have been removed by the update.
    if (selectedEdgeRef.current !== null && !g.hasEdge(selectedEdgeRef.current)) {
      selectedEdgeRef.current = null;
    }
    // Label rendering tracks the (possibly changed) graph size / edge labels.
    renderer.setSetting("renderLabels", g.order <= 300);
    renderer.setSetting(
      "renderEdgeLabels",
      g.someEdge((_e, attr) => attr.label != null) && g.order <= 300,
    );
    renderer.refresh();
    if (changed) bumpEpoch();
  }, [data, editable, bumpEpoch]);

  // Re-theme in place when `renderNode`/`renderEdge` (or the editable node-size
  // boost) change, without rebuilding the renderer. `data` changes go through the
  // reconcile effect above, which also re-applies visuals.
  useEffect(() => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer) return;
    applyVisuals(
      g,
      dataRef.current,
      { renderNode, renderEdge },
      surfaceRef.current,
      editable ? EDITABLE_NODE_SIZE_BOOST : 0,
    );
    renderer.refresh();
  }, [renderNode, renderEdge, editable]);

  // Keep edge-event hit-testing in sync when `editable`/`onEdgeClick` toggle at
  // runtime (the renderer is built once), and force Connect mode off whenever
  // editing is disabled so a stale toggle can't keep drawing edges.
  useEffect(() => {
    const renderer = sigmaRef.current;
    renderer?.setSetting("enableEdgeEvents", editable || onEdgeClick != null);
    renderer?.setSetting("minEdgeThickness", editable ? EDITABLE_MIN_EDGE_THICKNESS : 1.7);
    if (!editable && connectMode) setConnectMode(false);
  }, [editable, onEdgeClick, connectMode]);

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

  // Toggle Connect mode (only meaningful while `editable`). Exposed through
  // `GraphControls` so `Graph.Controls` (or a custom toolbar) can drive it.
  const toggleConnect = useCallback(() => setConnectMode((on) => !on), []);

  const controls = useMemo<GraphControls>(
    () => ({
      zoomIn,
      zoomOut,
      fitView,
      reset,
      pan,
      layout,
      setLayout,
      connectable: editable,
      connectMode,
      toggleConnect,
    }),
    [zoomIn, zoomOut, fitView, reset, pan, layout, setLayout, editable, connectMode, toggleConnect],
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

  // Delete an edge from the live view + notify the consumer (who mirrors it in
  // `data`). Drives the right-click "Delete" item and the Delete/Backspace key.
  const deleteEdge = useCallback((id: string | null) => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer || id === null || !g.hasEdge(id)) return;
    g.dropEdge(id);
    if (selectedEdgeRef.current === id) selectedEdgeRef.current = null;
    renderer.refresh();
    handlersRef.current.onEdgeDelete?.(id);
  }, []);

  // The menu items for a given target: the consumer's `contextMenuItems` when
  // provided, else the built-in node menu (focus / expand / pin / hide). The
  // stage has no default menu.
  const itemsFor = useCallback(
    (target: GraphMenuTarget): GraphMenuItem[] => {
      if (contextMenuItems) return contextMenuItems(target);
      if (target.kind === "edge") {
        // Default edge menu: a single "Delete" when editing is enabled.
        return editable && onEdgeDelete ? [{ label: "Delete", onSelect: deleteEdge }] : [];
      }
      if (target.kind !== "node") return [];
      return [
        { label: "Focus", onSelect: (id) => focusNode(id, 0.5) },
        { label: "Expand", onSelect: (id) => focusNode(id, 0.2) },
        { label: "Pin label", onSelect: togglePin },
        { label: "Hide", separatorBefore: true, onSelect: toggleHidden },
      ];
    },
    [contextMenuItems, editable, onEdgeDelete, deleteEdge, focusNode, togglePin, toggleHidden],
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
        case "Delete":
        case "Backspace":
          // Delete the selected edge (editing only). No selection → fall through.
          if (editable && selectedEdgeRef.current !== null) {
            deleteEdge(selectedEdgeRef.current);
            break;
          }
          return;
        default:
          return;
      }
      event.preventDefault();
    },
    [zoomIn, zoomOut, fitView, pan, editable, deleteEdge],
  );

  return (
    <GraphContext.Provider value={controls}>
      <GraphInternalContext.Provider value={internals}>
        <div
          {...rest}
          ref={ref}
          data-fullscreen={isFullscreen || undefined}
          className={cx(styles.root, isFullscreen && styles.fullscreen, className)}
        >
          {/* Sigma renders its WebGL canvas here. `role="application"` + tabIndex
            make the surface a keyboard target for pan/zoom; `aria-describedby`
            points at the screen-reader summary below. Per-node traversal isn't
            offered — a WebGL canvas has no per-node DOM at 10k scale (see §9). */}
          <div
            ref={surfaceRef}
            className={styles.surface}
            role="application"
            aria-label="Graph view"
            aria-describedby={summaryId}
            data-graph-surface
            data-connect={connectMode || undefined}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the surface IS interactive — it owns the pan/zoom canvas and handles +/-/0/arrow keyboard navigation, so it must be focusable.
            tabIndex={0}
            onKeyDown={onKeyDown}
          />
          {/* Connect-mode rubber-band: a line from the drag's source node to the
            cursor, in surface pixels. Non-interactive overlay over the canvas. */}
          {connectLine && (
            <svg className={styles.connectOverlay} aria-hidden="true" data-graph-connect-line>
              <line
                x1={connectLine.x1}
                y1={connectLine.y1}
                x2={connectLine.x2}
                y2={connectLine.y2}
              />
            </svg>
          )}
          {/* Screen-reader summary (visually hidden). `aria-describedby` reads it
            on focus; the polite live region announces layout switches. */}
          <p id={summaryId} className={styles.srOnly} data-graph-summary>
            Network graph with {nodeCount} node{nodeCount === 1 ? "" : "s"} and {edgeCount} edge
            {edgeCount === 1 ? "" : "s"}, {layout} layout. Use the arrow keys to pan, plus and minus
            to zoom, and 0 to fit the view.
          </p>
          <div className={styles.srOnly} aria-live="polite" data-graph-status>
            {layout} layout
          </div>
          {children}
          {fullscreen && <FullscreenToggle expanded={isFullscreen} onToggle={toggleFullscreen} />}
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
