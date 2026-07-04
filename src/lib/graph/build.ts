/** Graph construction + visual layering for the `Graph` component.
 *
 *  Mostly pure (operates on a graphology graph and the `GraphData` model), with
 *  one DOM touch point: `token()` reads `--sf-*` custom properties off a passed
 *  element so colors track the active theme. That read is guarded for non-browser
 *  environments (returns the literal fallback), so this module stays importable —
 *  and `reconcile` stays unit-testable — without a DOM. */

import Graphology from "graphology";
import type { GraphData, GraphNode } from "./types";

/** Visual overrides a `renderNode` callback may return. Sigma paints to WebGL
 *  (no per-node DOM), so "arbitrary content" is expressed as themed visual
 *  attributes — label, color, size — rather than nested elements. Any omitted
 *  field keeps its color-by-`kind` default. */
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

/** The visual hooks `buildGraph`/`reconcile` apply on top of the color-by-`kind`
 *  defaults. Both are optional; a missing field keeps the default. */
export interface RenderHooks {
  renderNode?: (node: GraphNode) => NodeVisual | undefined;
  renderEdge?: (edge: GraphData["edges"][number]) => EdgeVisual | undefined;
}

const KIND_TOKEN: Record<string, string> = {
  primary: "--sf-color-primary",
  secondary: "--sf-color-fg-subtle",
  tertiary: "--sf-color-success",
  quaternary: "--sf-color-warning",
};

/** Read a `--sf-*` token off a themed element so colors track the active theme,
 *  never hard-coded. Reads from `el` (the graph's own subtree) so it resolves
 *  whatever `data-theme` an ancestor sets — not just one on `<html>`; falls back
 *  to `document.documentElement`, then to a sane literal before first paint (or
 *  outside the browser). */
export function token(name: string, fallback: string, el?: Element | null): string {
  if (typeof document === "undefined") return fallback;
  const source = el ?? document.documentElement;
  const value = getComputedStyle(source).getPropertyValue(name).trim();
  return value || fallback;
}

/** Resolve a node's fill color from its `kind` (theme-tracking). */
export function nodeColor(kind: string | undefined, el?: Element | null): string {
  return token(KIND_TOKEN[kind ?? "primary"] ?? "--sf-color-primary", "#2563eb", el);
}

/** Default node radius (graph units). `primary` nodes read as the emphasized
 *  hubs; the rest are slightly smaller, so `kind` is legible as a size badge. */
export function nodeSize(kind: string | undefined): number {
  return kind === undefined || kind === "primary" ? 4 : 3;
}

/** Map an edge `weight` (0–1) to a stroke thickness in graph units, clamped so
 *  even weightless edges stay visible. */
export function edgeSize(weight: number | undefined): number {
  return Math.max(0.5, (weight ?? 0.5) * 2);
}

/** Resolve the default (unselected) edge stroke color. Reads `--sf-color-muted`,
 *  not `--sf-color-border-subtle`: the latter is a `color-mix()` value Sigma's
 *  WebGL color parser can't evaluate (it falls back to black — invisible on a
 *  dark background) and is too low-contrast in dark mode anyway. `--sf-color-muted`
 *  is a plain hex with adequate contrast on both canvas backgrounds. */
export function edgeColorToken(el?: Element | null): string {
  return token("--sf-color-muted", "#6b7280", el);
}

/** Above this many edges, arrowheads render as plain edges: at that density
 *  they are sub-pixel, and the extra instanced-arrowhead GL program costs
 *  roughly +50% raster time on every full-scene frame. */
export const ARROW_MAX_EDGES = 5000;

/** Sigma edge type for a graph with `edgeCount` edges (see `ARROW_MAX_EDGES`).
 *  Fed to Sigma's `defaultEdgeType` rather than stamped on each edge, so a
 *  reconcile that crosses the threshold retypes every edge atomically on the
 *  next refresh — no mixed arrow/line states. */
export function edgeTypeFor(edgeCount: number): "arrow" | "line" {
  return edgeCount > ARROW_MAX_EDGES ? "line" : "arrow";
}

/** (Re)apply node/edge VISUAL attributes (label / size / color) from the render
 *  hooks onto an already-built graph, layering over the color-by-`kind` defaults.
 *  Kept separate from structure so changing `renderNode`/`renderEdge` re-themes in
 *  place without tearing down + rebuilding the renderer.
 *
 *  `nodeSizeBoost` is added to the kind-derived default node size (editable graphs
 *  use it so nodes don't look puny next to their thicker, easier-to-grab edges).
 *  It layers under `renderNode` — a consumer-supplied size always wins. */
export function applyVisuals(
  g: Graphology,
  data: GraphData,
  hooks: RenderHooks,
  el?: Element | null,
  nodeSizeBoost = 0,
): void {
  const edgeColor = edgeColorToken(el);
  for (const n of data.nodes) {
    if (!g.hasNode(n.id)) continue;
    const custom = hooks.renderNode?.(n);
    g.mergeNodeAttributes(n.id, {
      label: custom?.label ?? n.label ?? n.id,
      size: custom?.size ?? nodeSize(n.kind) + Math.max(0, nodeSizeBoost),
      color: custom?.color ?? nodeColor(n.kind, el),
    });
  }
  for (const e of data.edges) {
    if (!g.hasEdge(e.id)) continue;
    const custom = hooks.renderEdge?.(e);
    g.mergeEdgeAttributes(e.id, {
      label: custom?.label ?? e.label,
      size: custom?.size ?? edgeSize(e.weight),
      color: custom?.color ?? edgeColor,
    });
  }
}

/** True for an edge that may be added: not a self-loop, both endpoints present,
 *  no existing edge for the same `id`, and (the graph is non-multi) no existing
 *  edge already connecting the same directed pair. */
function canAddEdge(g: Graphology, id: string, source: string, target: string): boolean {
  if (source === target) return false;
  if (!g.hasNode(source) || !g.hasNode(target)) return false;
  if (g.hasEdge(id)) return false;
  if (g.hasEdge(source, target)) return false;
  return true;
}

/** Build a graphology graph from the shared data model: structure (nodes,
 *  directed edges), seed positions (pre-computed `x`/`y` honored, else
 *  random — a layout pass assigns final coordinates), and `payload`. Visual
 *  attributes are layered on by `applyVisuals`. Edges carry no per-edge `type`:
 *  arrow-vs-line rendering is the renderer's size-gated `defaultEdgeType`
 *  (see `edgeTypeFor`). */
export function buildGraph(
  data: GraphData,
  hooks: RenderHooks,
  el?: Element | null,
  nodeSizeBoost = 0,
): Graphology {
  const g = new Graphology();
  for (const n of data.nodes) {
    g.addNode(n.id, {
      kind: n.kind,
      x: n.x ?? Math.random(),
      y: n.y ?? Math.random(),
      payload: n.data,
    });
  }
  for (const e of data.edges) {
    if (canAddEdge(g, e.id, e.source, e.target)) {
      g.addEdgeWithKey(e.id, e.source, e.target, { payload: e.data });
    }
  }
  applyVisuals(g, data, hooks, el, nodeSizeBoost);
  return g;
}

/** Seed coordinates for a node being added to an already-laid-out graph: the
 *  centroid of its already-present neighbors (so a new node lands near what it
 *  connects to), else a random point. A tiny jitter avoids exact overlap. */
function seedPosition(g: Graphology, data: GraphData, nodeId: string): { x: number; y: number } {
  const neighbors: string[] = [];
  for (const e of data.edges) {
    const other = e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
    if (other !== null && g.hasNode(other)) neighbors.push(other);
  }
  if (neighbors.length === 0) return { x: Math.random(), y: Math.random() };
  let x = 0;
  let y = 0;
  for (const id of neighbors) {
    x += g.getNodeAttribute(id, "x") as number;
    y += g.getNodeAttribute(id, "y") as number;
  }
  const jitter = () => (Math.random() - 0.5) * 0.01;
  return { x: x / neighbors.length + jitter(), y: y / neighbors.length + jitter() };
}

/** Reconcile a live graphology graph to match `data` IN PLACE — add/remove nodes
 *  and edges and refresh attributes — without rebuilding the renderer. Existing
 *  node positions and the camera are preserved (new nodes are seeded near their
 *  neighbors; nothing is re-laid-out). This is what lets a consumer add/remove an
 *  edge (or edit a label/metadata) via the `data` prop with no jarring relayout.
 *
 *  Returns `true` when the structure (node/edge set) changed, so the caller can
 *  decide whether to bump dependent overlays. */
export function reconcile(
  g: Graphology,
  data: GraphData,
  hooks: RenderHooks,
  el?: Element | null,
  nodeSizeBoost = 0,
): boolean {
  let structureChanged = false;
  const nodeIds = new Set(data.nodes.map((n) => n.id));
  const edgeIds = new Set(data.edges.map((e) => e.id));

  // Drop removed edges, then removed nodes (dropping a node also drops its
  // incident edges, so edges first keeps the bookkeeping simple). `.edges()` /
  // `.nodes()` return snapshot arrays, so mutating during iteration is safe.
  for (const id of g.edges()) {
    if (!edgeIds.has(id)) {
      g.dropEdge(id);
      structureChanged = true;
    }
  }
  for (const id of g.nodes()) {
    if (!nodeIds.has(id)) {
      g.dropNode(id);
      structureChanged = true;
    }
  }

  // Add new nodes, seeded near their (already-present) neighbors.
  for (const n of data.nodes) {
    if (g.hasNode(n.id)) continue;
    const pos = seedPosition(g, data, n.id);
    g.addNode(n.id, {
      kind: n.kind,
      x: n.x ?? pos.x,
      y: n.y ?? pos.y,
      payload: n.data,
    });
    structureChanged = true;
  }

  // Add new edges (guarded against self-loops / duplicates / dangling).
  for (const e of data.edges) {
    if (g.hasEdge(e.id)) continue;
    if (canAddEdge(g, e.id, e.source, e.target)) {
      g.addEdgeWithKey(e.id, e.source, e.target, { payload: e.data });
      structureChanged = true;
    }
  }

  // Refresh structural attributes that may have changed in place (kind drives
  // color; payload feeds inspectors). Visuals (label/size/color) come next.
  for (const n of data.nodes) {
    if (g.hasNode(n.id)) g.mergeNodeAttributes(n.id, { kind: n.kind, payload: n.data });
  }
  for (const e of data.edges) {
    if (g.hasEdge(e.id)) g.mergeEdgeAttributes(e.id, { payload: e.data });
  }

  applyVisuals(g, data, hooks, el, nodeSizeBoost);
  return structureChanged;
}
