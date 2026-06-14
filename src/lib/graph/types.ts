/** Shared graph data model for the `Graph` component. Pure — no React, no DOM. */

/** A single node in a graph. Carries arbitrary structured `data`. */
export interface GraphNode {
  /** Stable, unique identifier. */
  id: string;
  /** Human-readable label; falls back to `id` when absent. */
  label?: string;
  /** Optional category used for color/shape grouping (color-by-`kind`). */
  kind?: string;
  /** Arbitrary structured payload shown in tooltips/inspectors. */
  data?: Record<string, unknown>;
  /** Optional pre-computed layout position (x). */
  x?: number;
  /** Optional pre-computed layout position (y). */
  y?: number;
}

/** A directed edge connecting two nodes by id. Carries arbitrary `data`. */
export interface GraphEdge {
  /** Stable, unique identifier. */
  id: string;
  /** `id` of the source (`from`) node. */
  source: string;
  /** `id` of the target (`to`) node. */
  target: string;
  /** Human-readable label. */
  label?: string;
  /** Relative strength; may drive edge thickness. */
  weight?: number;
  /** Arbitrary structured payload shown in tooltips/inspectors. */
  data?: Record<string, unknown>;
}

/** A complete graph: a set of nodes and the edges between them. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** The layout algorithms the `Graph` component can switch between. */
export type LayoutKind = "force" | "tree" | "radial" | "concentric" | "grid";
