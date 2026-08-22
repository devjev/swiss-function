import type Graphology from "graphology";
import { circlepack, circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
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
import { drawDiscNodeLabel, EdgeLineProgram, type NodeHoverDrawingFunction } from "sigma/rendering";
import type { NodeDisplayData, PartialButFor } from "sigma/types";
import { animateNodes } from "sigma/utils";
import { cx } from "../../lib/cx";
import {
  ARROW_MAX_EDGES,
  applyVisuals,
  buildGraph,
  type EdgeVisual,
  edgeTypeFor,
  type NodeVisual,
  nodeColor,
  type RenderHooks,
  reconcile,
  token,
} from "../../lib/graph/build";
import { applyCardAttributes } from "../../lib/graph/cardMetrics";
import { NodeCardHoverProgram, NodeCardProgram } from "../../lib/graph/cardProgram";
import { EdgeElbowProgram } from "../../lib/graph/elbowEdgeProgram";
import { applyPositions, detachForLayout, forceIterations } from "../../lib/graph/forceLayout";
import { orgLayout } from "../../lib/graph/orgLayout";
import {
  type EdgeStyle,
  EdgeStyledArrowProgram,
  EdgeStyledProgram,
} from "../../lib/graph/styledEdgeProgram";
import type {
  GraphData,
  GraphEdge,
  GraphLayoutOptions,
  GraphNode,
  LayoutKind,
} from "../../lib/graph/types";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
import { StackingProvider, useStackCeiling, useStackLayer, Z_LAYER } from "../../lib/stacking";
import { useFullscreen } from "../../lib/useFullscreen";
import { useThemeEpoch } from "../../lib/useThemeEpoch";
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
export type { EdgeStyle, EdgeVisual, NodeVisual };

/** Per-state edge visual overrides (see the `edgeStateVisuals` prop). */
export interface EdgeStateVisuals {
  /** The selected edge. Defaults: accent color, doubled thickness. */
  selected?: EdgeVisual;
  /** Edges incident to the hovered node. Defaults: accent color, doubled
   *  thickness. */
  incident?: EdgeVisual;
  /** The rest of the graph while a node is hovered. Default: faded color. */
  faded?: EdgeVisual;
}

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
  /** Per-layout tuning (only the active layout's block is read). Each field is
   *  optional and defaults to the size-derived value, so omitting it keeps
   *  today's behaviour. Changing it re-runs the current layout. */
  layoutOptions?: GraphLayoutOptions;
  /** Fired whenever the layout changes — from the prop, `Graph.Controls`, or a
   *  keyboard switch. Required to observe switches when `layout` is controlled. */
  onLayoutChange?: (next: LayoutKind) => void;
  /** Node rendering style: `"disc"` (default, WebGL discs with labels beside
   *  them) or `"card"` (rectangular org-chart cards with the name and an
   *  optional `sublabel` drawn inside, a kind-coloured accent stripe on the
   *  leading edge). Independent of `layout`, but designed for `layout="org"`.
   *  Card labels bypass the ≤300-node hard label gate — Sigma's density and
   *  on-screen-size culling still bound the per-frame text cost. */
  nodeStyle?: "disc" | "card";
  /** Fired with the node `id` when a node is clicked. */
  onNodeClick?: (id: string) => void;
  /** Fired with the edge `id` when an edge is clicked. */
  onEdgeClick?: (id: string) => void;
  /** Fired with the currently selected node `id` (or `null` when cleared). */
  onSelectionChange?: (id: string | null) => void;
  /** The selected node `id`, controlled. When set, that node carries a
   *  persistent emphasis (accent fill + ring), the node analogue of the
   *  selected-edge double stroke. Omit it for uncontrolled selection: a node
   *  click selects that node and a stage click clears it, both still reported
   *  through `onSelectionChange`. `null` selects nothing. */
  selected?: string | null;
  /** Override the built-in selected-node emphasis. Any `NodeVisual` field you
   *  return replaces that field of the default (accent `color`, the node's own
   *  `size`); omitted fields keep the default. `renderNode` still supplies the
   *  base attributes underneath. */
  selectedNodeVisual?: NodeVisual;
  /** Override the built-in per-state edge treatments (`selected` edge,
   *  hover-`incident` edges, the `faded` rest during hover). Each field is an
   *  `EdgeVisual` merged over that state's default — e.g.
   *  `{ selected: { style: "dashed", color: "..." } }`. `renderEdge` supplies
   *  the base attributes underneath. */
  edgeStateVisuals?: EdgeStateVisuals;
  /** On node hover, emphasize its incident edges (both directions) and its
   *  neighbours while fading the rest of the graph, so a node's connections read
   *  at a glance. Default `true`; set `false` to keep hover to just the label
   *  box. */
  highlightConnectionsOnHover?: boolean;
  /** Fired with a node `id` when the pointer enters it, and `null` when it
   *  leaves. Independent of `highlightConnectionsOnHover`. */
  onNodeHover?: (id: string | null) => void;
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
  /** Fill the parent's height instead of the default fixed height. The parent
   *  must establish a height (e.g. a grid/flex track). Default `false`. */
  fill?: boolean;
  /** Draw the component's own border + corner. Default `true`. Set `false` when
   *  the graph sits inside a framed container, to avoid a double border. */
  frame?: boolean;
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
/** Above this many edges, skip edge rasterization while the camera is moving
 *  (Sigma's `hideEdgesOnMove`) — the same size-gating idiom as the ≤300-node
 *  `renderLabels` threshold. Pan/zoom repaints the full scene every frame and
 *  edges dominate that cost; they reappear the moment the camera rests. */
const HIDE_EDGES_ON_MOVE_MIN_EDGES = 5000;

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

/** Theme-aware replacement for Sigma's default node-hover renderer, INVERTED
 *  for prominence: the label box fills with `--sf-color-fg` and the label text
 *  paints in `--sf-color-bg` (via the per-node `labelColor` attribute the
 *  label renderer reads) — the terminal-selection read, in both themes.
 *  Geometry mirrors Sigma's `drawDiscNodeHover`. */
function makeNodeHoverRenderer(el: Element | null): NodeHoverDrawingFunction {
  return (
    context,
    data: PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color">,
    settings,
  ) => {
    context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
    context.fillStyle = token("--sf-color-fg", "#0a0a0a", el);

    // Sigma's stock pill path (box outline + junction chord + cap arc in one
    // self-intersecting path) leaves an unfilled seam at the cap/box junction
    // — invisible white-on-white, glaring on the inverted fill (edges below
    // showed through it). Fill the union as two overlapping primitives
    // instead: seamless by construction. The inverted mass needs no stroke.
    const PADDING = 2;
    if (typeof data.label === "string") {
      const textWidth = context.measureText(data.label).width;
      const boxWidth = Math.round(textWidth + 5);
      const boxHeight = Math.round(settings.labelSize + 2 * PADDING);
      const radius = Math.max(data.size, settings.labelSize / 2) + PADDING;
      context.beginPath();
      context.arc(data.x, data.y, radius, 0, Math.PI * 2);
      context.fill();
      context.fillRect(data.x, data.y - boxHeight / 2, radius + boxWidth, boxHeight);
    } else {
      context.beginPath();
      context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
      context.fill();
    }

    // Text in the background colour on the inverted box; the label renderer
    // reads the per-node `labelColor` attribute (see the Sigma settings).
    drawDiscNodeLabel(
      context,
      { ...data, labelColor: token("--sf-color-bg", "#ffffff", el) },
      settings,
    );
  };
}

/** Hierarchical / tree layout: a layered top-down pass. Roots (smallest
 *  in-degree, falling back to the first node) seed a BFS; each node is placed
 *  on the row of its BFS depth and spread evenly across its row. No external
 *  layout engine (elkjs/dagre both blew the bundle + scale budgets — see §9).
 *  Scaled to roughly match the force layout's coordinate range. */
function treeLayout(g: Graphology, options?: GraphLayoutOptions["tree"]): LayoutMapping {
  const depth = new Map<string, number>();
  const order = g.nodes();
  const queue: string[] = [];
  const rootId = options?.rootId;
  if (rootId !== undefined && g.hasNode(rootId)) {
    // Explicit root: layer outward from it; everything else by BFS distance.
    depth.set(rootId, 0);
    queue.push(rootId);
  } else {
    // Seed roots: nodes with no incoming neighbor (treat undirected as in=out).
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
  const levelGap = options?.levelGap ?? 1;
  const horizontal = options?.direction === "right";
  const levelStep = (span / Math.max(1, orphanRow + 1)) * levelGap;
  const mapping: LayoutMapping = {};
  for (const [d, row] of rows) {
    const step = row.length > 1 ? span / (row.length - 1) : 0;
    const offset = row.length > 1 ? span / 2 : 0;
    row.forEach((n, idx) => {
      const along = idx * step - offset; // position within the level
      const across = d * levelStep; // distance from the root by level
      mapping[n] = horizontal ? { x: across, y: along } : { x: along, y: -across };
    });
  }
  return mapping;
}

/** Grid layout: place nodes on a `columns`-wide lattice (default √n), row-major. */
function gridLayout(g: Graphology, options?: GraphLayoutOptions["grid"]): LayoutMapping {
  const order = g.nodes();
  const cols = Math.max(1, Math.floor(options?.columns ?? Math.ceil(Math.sqrt(order.length))));
  const rows = Math.max(1, Math.ceil(order.length / cols));
  const span = Math.max(1, Math.sqrt(order.length));
  // One uniform cell pitch from the larger axis, so a single row (or a forced
  // 1-column grid) still stacks. For the default √n grid cols ≥ rows, so this is
  // `span / (cols - 1)` — identical to before.
  const step = span / Math.max(1, Math.max(cols, rows) - 1);
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
/** The FA2 setting fields of `layoutOptions.force` (everything but `iterations`,
 *  which is a run budget, not an FA2 setting). */
const FORCE_SETTING_KEYS = [
  "gravity",
  "scalingRatio",
  "strongGravityMode",
  "linLogMode",
  "outboundAttractionDistribution",
  "adjustSizes",
  "edgeWeightInfluence",
  "slowDown",
  "barnesHutOptimize",
  "barnesHutTheta",
] as const;

/** FA2 settings for a graph, with any consumer-supplied fields overriding the
 *  auto-inferred defaults. Shared by the sync block and the worker settle so
 *  both paths use the same tuning. */
function forceSettings(g: Graphology, force: GraphLayoutOptions["force"]) {
  const settings = forceAtlas2.inferSettings(g);
  for (const key of FORCE_SETTING_KEYS) {
    const value = force?.[key];
    if (value !== undefined) (settings as Record<string, unknown>)[key] = value;
  }
  return settings;
}

function computeLayout(
  g: Graphology,
  layout: LayoutKind,
  options?: GraphLayoutOptions,
  env?: { dimensions?: { width: number; height: number } },
): LayoutMapping {
  switch (layout) {
    case "org": {
      // Space by the stamped card boxes; the disc fallback keeps
      // `layout="org"` + `nodeStyle="disc"` laying out sanely.
      const measure = (id: string) => {
        if (g.getNodeAttribute(id, "type") === "card") {
          const w = g.getNodeAttribute(id, "cardWidth") as number | undefined;
          const h = g.getNodeAttribute(id, "cardHeight") as number | undefined;
          if (typeof w === "number" && typeof h === "number") return { width: w, height: h };
        }
        const size = (g.getNodeAttribute(id, "size") as number | undefined) ?? 4;
        return { width: size * 2 + 8, height: size * 2 + 8 };
      };
      let stacks: Map<string, number> | undefined;
      const mapping = orgLayout(g, options?.org, {
        measure,
        container: env?.dimensions,
        reportStacks: (m) => {
          stacks = m;
        },
      });
      // Stamp spine offsets so the elbow program draws file-tree side-entry
      // connectors into stacked members (cleared on non-members).
      g.forEachNode((n) => {
        g.setNodeAttribute(n, "orgStacked", stacks?.get(n));
      });
      return mapping;
    }
    case "radial":
      return circular(g, {
        scale: options?.radial?.scale ?? Math.max(1, Math.sqrt(g.order)),
      }) as LayoutMapping;
    case "concentric":
      return circlepack(g, {
        scale: options?.concentric?.scale ?? Math.max(1, Math.sqrt(g.order)),
      }) as LayoutMapping;
    case "tree":
      return treeLayout(g, options?.tree);
    case "grid":
      return gridLayout(g, options?.grid);
    default: {
      // forceAtlas2 has no pure (non-assign) form; snapshot, run, restore.
      const before: LayoutMapping = {};
      g.forEachNode((n, attr) => {
        before[n] = { x: attr.x as number, y: attr.y as number };
      });
      forceAtlas2.assign(g, {
        // Iterations time-box the SYNCHRONOUS main-thread FA2 block (~30ms per
        // iteration at 10k nodes in Node, roughly double in dev-mode Chromium).
        // Force layouts normally settle in the worker instead (startForceSettle,
        // mount + layout-switch); this block is the fallback for when the
        // worker can't spawn, or for the non-force layouts computed here too.
        iterations: options?.force?.iterations ?? forceIterations(g.order),
        settings: forceSettings(g, options?.force),
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

/** True when the force layout should settle in the FA2 worker instead of the
 *  synchronous block. Always prefer the worker when one can spawn: even a
 *  small graph's sync run blocks the main thread and renders as a single
 *  freeze-then-snap, while the worker settle animates in over
 *  `requestAnimationFrame` and keeps the page interactive. Worker-less
 *  environments (no `Worker` global) are the only case left on the sync
 *  path. */
function shouldSettleAsync(): boolean {
  return typeof Worker !== "undefined";
}

const GraphRoot = forwardRef<HTMLDivElement, GraphProps>(function Graph(
  {
    data,
    layout: controlledLayout,
    defaultLayout = "force",
    layoutOptions,
    onLayoutChange,
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    selected,
    selectedNodeVisual,
    edgeStateVisuals,
    highlightConnectionsOnHover = true,
    onNodeHover,
    renderNode,
    renderEdge,
    onNodeContextMenu,
    contextMenuItems,
    nodeStyle = "disc",
    editable = false,
    onEdgeCreate,
    onEdgeDelete,
    generateEdgeId,
    className,
    children,
    fullscreen = true,
    defaultFullscreen,
    onFullscreenChange,
    fill = false,
    frame = true,
    ...rest
  },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { expanded: isFullscreen, toggle: toggleFullscreen } = useFullscreen({
    defaultExpanded: defaultFullscreen,
    onExpandedChange: onFullscreenChange,
  });
  // Cross-portal stacking (issue #82): while fullscreen the root is a modal-band
  // overlay, so seed that band — the right-click Menu then climbs above it. When
  // not fullscreen, re-publish the inherited ceiling so the Menu still clears a
  // Dialog the graph sits in.
  const inheritedCeiling = useStackCeiling();
  const graphLayer = useStackLayer(Z_LAYER.modal, true);
  const provideCeiling = isFullscreen ? graphLayer.ceiling : inheritedCeiling;
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
  // re-positions when it (or its options) actually change (not every render).
  const appliedLayoutRef = useRef<LayoutKind | null>(null);
  // Latest layout options, read by the layout effects + the force settle
  // (wired once) without re-subscribing. The serialized key drives re-layout on
  // an options change; `appliedLayoutOptionsRef` gates that in the switch effect.
  const layoutOptionsRef = useRef(layoutOptions);
  layoutOptionsRef.current = layoutOptions;
  // Latest node style, read by the effects that re-stamp visuals (wired once).
  const nodeStyleRef = useRef(nodeStyle);
  nodeStyleRef.current = nodeStyle;
  // Org-chart mode (org layout + cards): edges render as orthogonal elbow
  // connectors instead of straight center-to-center lines.
  const orgCardsRef = useRef(false);
  orgCardsRef.current = layout === "org" && nodeStyle === "card";
  // Latest per-state edge visual overrides, read by the edge reducer.
  const edgeStateVisualsRef = useRef(edgeStateVisuals);
  edgeStateVisualsRef.current = edgeStateVisuals;
  const layoutOptionsKey = JSON.stringify(layoutOptions ?? {});
  const appliedLayoutOptionsRef = useRef(layoutOptionsKey);
  // Cancels an in-flight `animateNodes` transition when a new one starts.
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  // Cancels the in-flight background force settle (kills the FA2 worker).
  // Shared by the mount + layout effects; also called from unmount cleanup.
  const stopForceRef = useRef<(() => void) | null>(null);
  // Latest callbacks, read inside Sigma listeners without re-subscribing.
  const handlersRef = useRef({
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    onNodeHover,
    onEdgeCreate,
    onEdgeDelete,
  });
  handlersRef.current = {
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    onNodeHover,
    onEdgeCreate,
    onEdgeDelete,
  };

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
  // Node selection: the ref the once-wired reducer reads to emphasize the
  // selected node. Controlled by the `selected` prop when it is provided (the
  // effect below syncs it), otherwise set by a node click / cleared by a stage
  // click. `null` = nothing selected.
  const selectedNodeRef = useRef<string | null>(selected ?? null);
  // Whether selection is controlled — read inside the mount-wired click
  // handlers so they only self-update the ref in the uncontrolled case.
  const selectedControlledRef = useRef(selected !== undefined);
  selectedControlledRef.current = selected !== undefined;
  const selectedPropRef = useRef(selected);
  selectedPropRef.current = selected;
  // Latest selected-node emphasis override, read live by the reducer.
  const selectedNodeVisualRef = useRef(selectedNodeVisual);
  selectedNodeVisualRef.current = selectedNodeVisual;
  const generateEdgeIdRef = useRef(generateEdgeId);
  generateEdgeIdRef.current = generateEdgeId;
  // Drag bookkeeping: whether a draw is in progress and its source/target nodes.
  const connectDrawingRef = useRef(false);
  const connectSourceRef = useRef<string | null>(null);
  const connectTargetRef = useRef<string | null>(null);
  // Emphasis color for the selected edge + connect endpoints (resolved at mount).
  const selectColorRef = useRef("#2563eb");
  // Hover highlight: the hovered node plus its incident edges + neighbour ids,
  // precomputed on enter so the reducers stay O(1) per element (no graph query
  // per edge per frame at 10k+ nodes). The fade colours de-emphasize the rest;
  // resolved at mount and re-read on theme change alongside `selectColorRef`.
  const highlightHoverRef = useRef(highlightConnectionsOnHover);
  highlightHoverRef.current = highlightConnectionsOnHover;
  const hoveredNodeRef = useRef<string | null>(null);
  const incidentEdgesRef = useRef<Set<string>>(new Set());
  const neighborsRef = useRef<Set<string>>(new Set());
  const edgeFadeRef = useRef("#e5e7eb");
  const nodeFadeRef = useRef("#6b7280");

  // Bumped whenever the graph is (re)built or a layout finishes applying, so the
  // minimap overlay knows to recompute its cached node geometry.
  const [epoch, setEpoch] = useState(0);
  const bumpEpoch = useCallback(() => setEpoch((e) => e + 1), []);

  // Sigma paints to WebGL, so — unlike a pure-CSS component — it can't auto-
  // respond to a `[data-theme]` change; the token colors were baked in at
  // construction. Observe the theme and re-tint in place (effect below).
  const themeEpoch = useThemeEpoch(surfaceRef);

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

  // Background force settle: run FA2 in the dependency's worker supervisor on
  // a DETACHED copy of the live graph (see `detachForLayout` for why the copy
  // is load-bearing), streaming positions back at most once per animation
  // frame. Under reduced motion the settle runs invisibly and snaps once at
  // the end. `[data-graph-settled]` marks completion (the perf harness's
  // settle signal); the caller has already marked `[data-graph-ready]` at the
  // seed-position paint.
  const startForceSettle = useCallback(
    (animate: boolean) => {
      const g = graphRef.current;
      const renderer = sigmaRef.current;
      const container = surfaceRef.current;
      if (!g || !renderer || !container) return;
      stopForceRef.current?.();
      container.removeAttribute("data-graph-settled");

      const force = layoutOptionsRef.current?.force;
      const copy = detachForLayout(g);
      let supervisor: FA2Layout;
      try {
        supervisor = new FA2Layout(copy, { settings: forceSettings(copy, force) });
      } catch {
        // Worker creation can be refused (e.g. a CSP without blob: in
        // worker-src) — fall back to the synchronous block.
        assignPositions(g, computeLayout(g, "force", layoutOptionsRef.current));
        renderer.refresh();
        container.setAttribute("data-graph-settled", "");
        bumpEpoch();
        return;
      }

      // The supervisor has no stop policy of its own: 1 worker message = 1 FA2
      // iteration = exactly one batched write onto the copy — count those to
      // stop at the budget (the consumer's override, else the size-derived one).
      const budget = force?.iterations ?? forceIterations(g.order);
      let iterations = 0;
      let dirty = false;
      let raf = 0;
      let done = false;

      const teardown = () => {
        done = true;
        cancelAnimationFrame(raf);
        copy.removeListener("eachNodeAttributesUpdated", onIteration);
        supervisor.kill();
        if (stopForceRef.current === cancel) stopForceRef.current = null;
      };
      const cancel = () => {
        if (!done) teardown();
      };
      const finish = () => {
        if (done) return;
        teardown();
        if (sigmaRef.current !== renderer) return;
        applyPositions(copy, g);
        renderer.refresh();
        container.setAttribute("data-graph-settled", "");
        bumpEpoch();
      };
      const onIteration = () => {
        iterations += 1;
        dirty = true;
        if (iterations >= budget) {
          // stop() now, kill() next tick: the supervisor's own message handler
          // still touches its matrices after this event fires.
          supervisor.stop();
          setTimeout(finish, 0);
        }
      };
      const tick = () => {
        // One batched x/y apply per frame at most; Sigma coalesces it into a
        // single scheduled render, so settle progress paints without flooding
        // slow (software-GL) frames with per-iteration full-scene renders.
        if (dirty) {
          dirty = false;
          applyPositions(copy, g);
        }
        raf = requestAnimationFrame(tick);
      };

      copy.on("eachNodeAttributesUpdated", onIteration);
      if (animate) raf = requestAnimationFrame(tick);
      stopForceRef.current = cancel;
      supervisor.start();
    },
    [bumpEpoch],
  );

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
    applyCardAttributes(g, initialData, container, nodeStyleRef.current === "card");
    appliedLayoutRef.current = initialLayout;
    selectColorRef.current = token("--sf-color-primary", "#2563eb", container);
    edgeFadeRef.current = token("--sf-color-border", "#e5e7eb", container);
    nodeFadeRef.current = token("--sf-color-muted", "#6b7280", container);

    // Show edge labels only when at least one edge carries one — otherwise the
    // renderer pays for label layout it would never draw.
    const hasEdgeLabels = g.someEdge((_e, attr) => attr.label != null);
    const edgesInteractive = editableRef.current || handlersRef.current.onEdgeClick != null;
    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary", container),
      // Directed arrowheads — until the graph is big enough that arrowheads
      // are sub-pixel and their extra GL program only burns raster time. Above
      // that: thickness-preserving quads ("line" = EdgeRectangleProgram) while
      // edges are interactive (drawn pixels ARE the hit target), else 1-device-
      // pixel GL_LINES ("thinline" below — ~45% cheaper full-scene raster under
      // software GL). No edge carries its own `type`, so this default governs
      // them all; retyped on reconcile + interactivity toggles (see
      // edgeTypeFor).
      defaultEdgeType: orgCardsRef.current ? "elbow" : edgeTypeFor(g.size, edgesInteractive),
      // The GL_LINES program behind "thinline" for big read-only graphs;
      // "arrow"/"line" are Sigma built-ins (merged, not replaced, by this).
      edgeProgramClasses: {
        thinline: EdgeLineProgram,
        elbow: EdgeElbowProgram,
        // Dash-capable programs; edges route to them per-edge via the reducer
        // when they carry a non-solid `edgeStyle`.
        styled: EdgeStyledProgram,
        styledArrow: EdgeStyledArrowProgram,
      },
      // The org-chart card rect (merged over the built-ins; nodes opt in via
      // `type: "card"`, stamped by applyCardAttributes). The hover variant is
      // a no-op WebGL render: hovered cards re-paint fully in 2D so their
      // in-card text isn't buried under the hoverNodes canvas.
      nodeProgramClasses: { card: NodeCardProgram },
      nodeHoverProgramClasses: { card: NodeCardHoverProgram },
      // Per-node override with a themed fallback: the hover-fade reducer mutes
      // de-emphasized nodes' text via a `labelColor` attribute instead of
      // hiding it (a text-less card reads as a glitch, and vanishing labels
      // are jumpier than a contrast drop for discs too).
      labelColor: { attribute: "labelColor", color: token("--sf-color-fg", "#0a0a0a", container) },
      labelFont: token("--sf-font-sans", "system-ui", container),
      // Theme-aware hover box; Sigma's default hard-codes a white background that
      // hides white dark-mode label text.
      defaultDrawNodeHover: makeNodeHoverRenderer(container),
      edgeLabelColor: { color: token("--sf-color-fg-subtle", "#737373", container) },
      edgeLabelFont: token("--sf-font-sans", "system-ui", container),
      // Cards bypass the hard gate (a card without text is pointless); Sigma's
      // label-grid density + on-screen-size culling still bound per-frame cost.
      renderLabels: nodeStyleRef.current === "card" || g.order <= 300,
      // Cards carry their text inside, so the default grid dedup (one label
      // per 100px cell) blanks closely stacked cards. A denser grid lets every
      // on-screen card keep its text; `labelRenderedSizeThreshold` still culls
      // when cards shrink below legibility on zoom-out.
      ...(nodeStyleRef.current === "card" ? { labelDensity: 8, labelGridCellSize: 40 } : {}),
      renderEdgeLabels: hasEdgeLabels && g.order <= 300,
      hideEdgesOnMove: g.size > HIDE_EDGES_ON_MOVE_MIN_EDGES,
      // Edge events (click/right-click/hover) only fire when enabled; needed for
      // edge selection + the edge context menu. Off for big read-only graphs.
      enableEdgeEvents: edgesInteractive,
      // Sigma hit-tests edges by color-picking their RENDERED pixels, so the
      // clickable area equals the drawn thickness. The 1.7px default is fiddly to
      // hit; give editable graphs a thicker floor so edges are easy to select /
      // right-click (and a touch more visible). Read-only graphs keep the default.
      minEdgeThickness: editableRef.current ? EDITABLE_MIN_EDGE_THICKNESS : 1.7,
      // Emphasize the selected edge; brighten the connect-drag endpoints; on
      // hover, light up the hovered node's incident edges + neighbours and fade
      // the rest. Selection wins over hover; both key on refs so this reducer is
      // wired once but always reads the latest state.
      edgeReducer: (edge, attr) => {
        // Per-state treatment: the built-in defaults (accent + double
        // thickness for selected/incident, fade for the rest during hover),
        // each overridable field-by-field via `edgeStateVisuals`.
        const visuals = edgeStateVisualsRef.current;
        const applyState = (v: EdgeVisual | undefined, color: string, size?: number) => ({
          ...attr,
          color: v?.color ?? color,
          ...(v?.size !== undefined || size !== undefined ? { size: v?.size ?? size } : {}),
          ...(v?.label !== undefined ? { label: v.label } : {}),
          ...(v?.style !== undefined ? { edgeStyle: v.style } : {}),
        });
        let out = attr;
        if (selectedEdgeRef.current === edge) {
          out = applyState(
            visuals?.selected,
            selectColorRef.current,
            ((attr.size as number) ?? 1) * 2,
          );
        } else if (hoveredNodeRef.current !== null) {
          out = incidentEdgesRef.current.has(edge)
            ? applyState(
                visuals?.incident,
                selectColorRef.current,
                ((attr.size as number) ?? 1) * 2,
              )
            : applyState(visuals?.faded, edgeFadeRef.current);
        }
        // A non-solid style routes the edge to a dash-capable program. In
        // org+card mode the elbow program reads `edgeStyle` directly, so the
        // type stays the elbow default.
        const style = (out as { edgeStyle?: EdgeStyle }).edgeStyle;
        if (style !== undefined && style !== "solid" && !orgCardsRef.current) {
          const arrows = (graphRef.current?.size ?? 0) <= ARROW_MAX_EDGES;
          return { ...out, type: arrows ? "styledArrow" : "styled" };
        }
        return out;
      },
      nodeReducer: (node, attr) => {
        if (
          connectDrawingRef.current &&
          (node === connectSourceRef.current || node === connectTargetRef.current)
        )
          return { ...attr, color: selectColorRef.current, highlighted: true };
        // Selection wins over the hover fade (a selected node stays emphasized
        // even while another node is hovered), the node analogue of the
        // selected-edge branch above. `highlighted` draws Sigma's ring + label
        // box; `selectedNodeVisual` overrides the accent colour / size.
        if (selectedNodeRef.current === node) {
          const v = selectedNodeVisualRef.current;
          return {
            ...attr,
            highlighted: true,
            color: v?.color ?? selectColorRef.current,
            ...(v?.size !== undefined ? { size: v.size } : {}),
            ...(v?.label !== undefined ? { label: v.label } : {}),
          };
        }
        if (
          hoveredNodeRef.current !== null &&
          node !== hoveredNodeRef.current &&
          !neighborsRef.current.has(node)
        )
          // De-emphasize by contrast: fade the fill/stripe and mute the text
          // rather than hiding it — structure stays readable under the fade.
          return { ...attr, color: nodeFadeRef.current, labelColor: nodeFadeRef.current };
        return attr;
      },
      allowInvalidContainer: true,
    });
    sigmaRef.current = renderer;

    renderer.on("clickNode", ({ node }) => {
      handlersRef.current.onNodeClick?.(node);
      handlersRef.current.onSelectionChange?.(node);
      // Uncontrolled: reflect the selection so it highlights without the
      // consumer round-tripping it through `selected`. Controlled: the prop is
      // the source of truth (the effect below repaints on its change).
      if (!selectedControlledRef.current) selectedNodeRef.current = node;
      selectedEdgeRef.current = null;
      renderer.refresh();
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
      if (!selectedControlledRef.current) selectedNodeRef.current = null;
      selectedEdgeRef.current = null;
      renderer.refresh();
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
      live.addEdgeWithKey(id, source, target);
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
      // Drop any hover highlight so the connect drag reads cleanly.
      hoveredNodeRef.current = null;
      incidentEdgesRef.current = new Set();
      neighborsRef.current = new Set();
      renderer.setSetting("enableCameraPanning", false);
      setLineTo(event.x, event.y);
      document.addEventListener("pointermove", onDocPointerMove);
      document.addEventListener("pointerup", onDocPointerUp);
      document.addEventListener("keydown", onDocKeyDown);
      renderer.refresh(); // highlight the source endpoint
    });
    renderer.on("enterNode", ({ node }) => {
      // Connect-mode drag targeting takes precedence over hover highlight.
      if (connectDrawingRef.current) {
        if (node !== connectSourceRef.current) {
          connectTargetRef.current = node;
          renderer.refresh();
        }
        return;
      }
      handlersRef.current.onNodeHover?.(node);
      if (!highlightHoverRef.current) return;
      hoveredNodeRef.current = node;
      incidentEdgesRef.current = new Set(g.edges(node));
      neighborsRef.current = new Set(g.neighbors(node));
      renderer.refresh();
    });
    renderer.on("leaveNode", ({ node }) => {
      if (connectDrawingRef.current) {
        if (connectTargetRef.current === node) {
          connectTargetRef.current = null;
          renderer.refresh();
        }
        return;
      }
      handlersRef.current.onNodeHover?.(null);
      if (hoveredNodeRef.current === null) return;
      hoveredNodeRef.current = null;
      incidentEdgesRef.current = new Set();
      neighborsRef.current = new Set();
      renderer.refresh();
    });

    // Re-fit the WebGL canvas to its CONTAINER, not just the window: Sigma only
    // re-measures on window `resize`, so a graph that fills a pane/tab whose size
    // changes via layout (drag, tab show, flex reflow) would otherwise stay at its
    // stale size. `resize()` re-reads the container box; `refresh()` repaints.
    const resizeObserver = new ResizeObserver(() => {
      if (sigmaRef.current !== renderer) return;
      renderer.resize();
      renderer.refresh();
      bumpEpoch();
    });
    resizeObserver.observe(container);

    // Signal overlays (minimap) that a fresh graph + display data exist (seed
    // positions; refreshed again once the stable layout lands below).
    bumpEpoch();

    // Defer the initial layout behind the first paint. Sigma has already painted
    // the seed positions, so the layout runs after first paint instead of
    // blocking it. Non-force layouts (and force layouts with no Worker
    // available) compute synchronously and snap; `data-graph-ready` +
    // `data-graph-settled` land together. Force layouts normally hand off to
    // the worker settle: `data-graph-ready` fires at the seed-position paint
    // (the graph is already interactive) and `data-graph-settled` when the
    // background settle finishes — the harness's two readiness signals.
    container.removeAttribute("data-graph-ready");
    container.removeAttribute("data-graph-settled");
    let initialRaf = requestAnimationFrame(() => {
      initialRaf = requestAnimationFrame(() => {
        if (sigmaRef.current !== renderer) return;
        if (initialLayout === "force" && shouldSettleAsync()) {
          container.setAttribute("data-graph-ready", "");
          startForceSettle(!prefersReducedMotion());
          return;
        }
        assignPositions(
          g,
          computeLayout(g, initialLayout, layoutOptionsRef.current, {
            dimensions: renderer.getDimensions(),
          }),
        );
        renderer.refresh();
        container.setAttribute("data-graph-ready", "");
        container.setAttribute("data-graph-settled", "");
        bumpEpoch();
      });
    });

    return () => {
      cancelAnimationFrame(initialRaf);
      resizeObserver.disconnect();
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("keydown", onDocKeyDown);
      container.removeAttribute("data-graph-ready");
      container.removeAttribute("data-graph-settled");
      cancelAnimationRef.current?.();
      cancelAnimationRef.current = null;
      // Kill any in-flight worker settle with the renderer it was feeding.
      stopForceRef.current?.();
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      appliedLayoutRef.current = null;
      connectDrawingRef.current = false;
      // Drop any menu / rubber-band pinned to the now-destroyed graph.
      setContextMenu(null);
      setConnectLine(null);
    };
  }, [bumpEpoch, startForceSettle]);

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
    // Keep the node selection valid across the update. Controlled: re-derive
    // from the prop (handles a selected node removed then re-added). Uncontrolled:
    // drop a selection whose node is gone, and report the clear so a consumer
    // tracking selection via `onSelectionChange` doesn't keep a stale id.
    if (selectedControlledRef.current) {
      selectedNodeRef.current = selectedPropRef.current ?? null;
    } else if (selectedNodeRef.current !== null && !g.hasNode(selectedNodeRef.current)) {
      selectedNodeRef.current = null;
      handlersRef.current.onSelectionChange?.(null);
    }
    applyCardAttributes(g, data, surfaceRef.current, nodeStyleRef.current === "card");
    // Label rendering tracks the (possibly changed) graph size / edge labels.
    renderer.setSetting("renderLabels", nodeStyleRef.current === "card" || g.order <= 300);
    renderer.setSetting(
      "renderEdgeLabels",
      g.someEdge((_e, attr) => attr.label != null) && g.order <= 300,
    );
    // The edge-count gates track threshold crossings too (the renderer is built
    // once; a `data` update can grow or shrink past them). Retyping through
    // `defaultEdgeType` is atomic: no edge carries its own `type`, and the
    // refresh below re-applies the default to every edge.
    renderer.setSetting("hideEdgesOnMove", g.size > HIDE_EDGES_ON_MOVE_MIN_EDGES);
    renderer.setSetting(
      "defaultEdgeType",
      orgCardsRef.current
        ? "elbow"
        : edgeTypeFor(g.size, editable || handlersRef.current.onEdgeClick != null),
    );
    renderer.refresh();
    if (changed) bumpEpoch();
  }, [data, editable, bumpEpoch]);

  // Controlled selection: repaint when the `selected` prop changes. Uncontrolled
  // (prop omitted) is a no-op here — the click handlers drive the ref directly.
  useEffect(() => {
    if (selected === undefined) return;
    selectedNodeRef.current = selected;
    sigmaRef.current?.refresh();
  }, [selected]);

  // Re-emphasize when the selected-node visual override changes (the reducer
  // reads it through a ref, so a repaint is all that's needed).
  useEffect(() => {
    if (selectedNodeRef.current !== null) sigmaRef.current?.refresh();
  }, [selectedNodeVisual]);

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
    applyCardAttributes(g, dataRef.current, surfaceRef.current, nodeStyleRef.current === "card");
    renderer.refresh();
  }, [renderNode, renderEdge, editable]);

  // Under org + cards, node sizes reference graph POSITIONS (not screen px):
  // cards then scale 1:1 with the layout gaps at every zoom, so they can never
  // overlap on zoom-out and fitView frames the whole chart. Other layouts keep
  // Sigma's screen-referenced defaults.
  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const positionsRef = nodeStyle === "card" && layout === "org";
    renderer.setSetting("itemSizesReference", positionsRef ? "positions" : "screen");
    renderer.setSetting("zoomToSizeRatioFunction", positionsRef ? (r: number) => r : Math.sqrt);
    // Org-chart wiring: orthogonal elbow connectors; other modes restore the
    // size/interactivity-gated straight edge type.
    const g = graphRef.current;
    if (g) {
      renderer.setSetting(
        "defaultEdgeType",
        positionsRef
          ? "elbow"
          : edgeTypeFor(g.size, editableRef.current || handlersRef.current.onEdgeClick != null),
      );
    }
    renderer.refresh();
  }, [nodeStyle, layout]);

  // Runtime `nodeStyle` flips: re-stamp node types/sizes and rescope the label
  // gate. `applyVisuals` first restores the disc size baseline that card
  // stamping overrides (or that a card→disc flip must return to).
  useEffect(() => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer) return;
    applyVisuals(
      g,
      dataRef.current,
      renderHooksRef.current,
      surfaceRef.current,
      editableRef.current ? EDITABLE_NODE_SIZE_BOOST : 0,
    );
    applyCardAttributes(g, dataRef.current, surfaceRef.current, nodeStyle === "card");
    renderer.setSetting("renderLabels", nodeStyle === "card" || g.order <= 300);
    renderer.setSetting("labelDensity", nodeStyle === "card" ? 8 : 1);
    renderer.setSetting("labelGridCellSize", nodeStyle === "card" ? 40 : 100);
    renderer.refresh();
  }, [nodeStyle]);

  // Re-theme on a live light↔dark switch. Node/edge fills re-tint via
  // applyVisuals; the label + default-node colors were captured into Sigma
  // settings at construction, so update those explicitly. Skip the initial
  // value — the mount effect already themed against the current tokens.
  useEffect(() => {
    if (themeEpoch === 0) return;
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    const container = surfaceRef.current;
    if (!g || !renderer) return;
    applyVisuals(
      g,
      dataRef.current,
      renderHooksRef.current,
      container,
      editableRef.current ? EDITABLE_NODE_SIZE_BOOST : 0,
    );
    applyCardAttributes(g, dataRef.current, container, nodeStyleRef.current === "card");
    selectColorRef.current = token("--sf-color-primary", "#2563eb", container);
    edgeFadeRef.current = token("--sf-color-border", "#e5e7eb", container);
    nodeFadeRef.current = token("--sf-color-muted", "#6b7280", container);
    renderer.setSetting("defaultNodeColor", nodeColor("primary", container));
    renderer.setSetting("labelColor", {
      attribute: "labelColor",
      color: token("--sf-color-fg", "#0a0a0a", container),
    });
    renderer.setSetting("edgeLabelColor", {
      color: token("--sf-color-fg-subtle", "#737373", container),
    });
    renderer.refresh();
    bumpEpoch();
  }, [themeEpoch, bumpEpoch]);

  // Keep edge-event hit-testing in sync when `editable`/`onEdgeClick` toggle at
  // runtime (the renderer is built once), and force Connect mode off whenever
  // editing is disabled so a stale toggle can't keep drawing edges.
  useEffect(() => {
    const renderer = sigmaRef.current;
    const g = graphRef.current;
    const edgesInteractive = editable || onEdgeClick != null;
    renderer?.setSetting("enableEdgeEvents", edgesInteractive);
    renderer?.setSetting("minEdgeThickness", editable ? EDITABLE_MIN_EDGE_THICKNESS : 1.7);
    // Interactivity also picks the >ARROW_MAX_EDGES edge program: quads keep a
    // grabbable thickness, GL_LINES are ~1px and unclickable — retype when the
    // flag flips at runtime (`setSetting` schedules the repaint).
    if (renderer && g) {
      renderer.setSetting(
        "defaultEdgeType",
        orgCardsRef.current ? "elbow" : edgeTypeFor(g.size, edgesInteractive),
      );
    }
    if (!editable && connectMode) setConnectMode(false);
  }, [editable, onEdgeClick, connectMode]);

  // Re-position on layout switch. Big force graphs re-settle in the worker
  // (the per-frame position stream is the transition); everything else
  // computes the target coordinates, then either snaps (prefers-reduced-motion)
  // or animates smoothly to them.
  useEffect(() => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer) return;
    // Re-run when the layout changes OR its options change (by value, so an
    // inline `layoutOptions={{…}}` doesn't churn every render).
    if (appliedLayoutRef.current === layout && appliedLayoutOptionsRef.current === layoutOptionsKey)
      return;
    appliedLayoutRef.current = layout;
    appliedLayoutOptionsRef.current = layoutOptionsKey;

    cancelAnimationRef.current?.();
    cancelAnimationRef.current = null;
    stopForceRef.current?.();

    if (layout === "force" && shouldSettleAsync()) {
      startForceSettle(!prefersReducedMotion());
      return;
    }

    const targets = computeLayout(g, layout, layoutOptionsRef.current, {
      dimensions: renderer.getDimensions(),
    });
    const surface = surfaceRef.current;

    if (prefersReducedMotion()) {
      assignPositions(g, targets);
      renderer.refresh();
      surface?.setAttribute("data-graph-settled", "");
      bumpEpoch();
      return;
    }

    surface?.removeAttribute("data-graph-settled");
    cancelAnimationRef.current = animateNodes(
      g,
      targets,
      { duration: 600, easing: "quadraticInOut" },
      () => {
        cancelAnimationRef.current = null;
        // Layout settled — refresh the minimap's cached node geometry.
        surfaceRef.current?.setAttribute("data-graph-settled", "");
        bumpEpoch();
      },
    );
  }, [layout, layoutOptionsKey, bumpEpoch, startForceSettle]);

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
          data-graph-root
          data-fullscreen={isFullscreen || undefined}
          className={cx(
            styles.root,
            fill && styles.fill,
            !frame && styles.frameless,
            isFullscreen && styles.fullscreen,
            className,
          )}
          style={
            isFullscreen && graphLayer.zIndex != null
              ? { ...rest.style, zIndex: graphLayer.zIndex }
              : rest.style
          }
        >
          <StackingProvider ceiling={provideCeiling}>
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
              {edgeCount === 1 ? "" : "s"}, {layout} layout. Use the arrow keys to pan, plus and
              minus to zoom, and 0 to fit the view.
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
          </StackingProvider>
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
