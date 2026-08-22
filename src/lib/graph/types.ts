/** Shared graph data model for the `Graph` component. Pure — no React, no DOM. */

/** A single node in a graph. Carries arbitrary structured `data`. */
export interface GraphNode {
  /** Stable, unique identifier. */
  id: string;
  /** Human-readable label; falls back to `id` when absent. */
  label?: string;
  /** Secondary line (e.g. an org-chart job title) drawn inside card-style
   *  nodes, smaller and subtler than the name. Ignored by disc nodes. */
  sublabel?: string;
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
export type LayoutKind = "force" | "tree" | "radial" | "concentric" | "grid" | "org";

/** How the `org` layout compresses horizontal space.
 *  - `"none"`: pure tidy layout, every node a card in its rank.
 *  - `"leaves"`: leaf children collapse into an indented vertical list under
 *    their parent (the classic org-chart IC list).
 *  - `{ depth }`: every subtree hanging below that depth collapses into one
 *    nested, indented vertical list per parent (the file-tree read).
 *  - `"auto"`: the least stacking whose bounding box fits the container's
 *    aspect ratio (tries `"none"`, `"leaves"`, then decreasing depths). */
export type OrgStack = "none" | "leaves" | "auto" | { depth: number };

/** Optional per-layout tuning for `Graph`'s `layoutOptions` prop. Every field is
 *  optional and defaults to the component's size-derived value, so `{}` (or
 *  omitting the prop) reproduces the built-in behaviour. Only the block for the
 *  active layout is read. */
export interface GraphLayoutOptions {
  /** The organic `force` layout (ForceAtlas2). Every field is optional and
   *  overrides the auto-inferred value (`forceAtlas2.inferSettings`, which tunes
   *  `gravity` / `scalingRatio` / `barnesHutOptimize` by node count). */
  force?: {
    /** Iteration budget (the synchronous block and the background worker settle
     *  share it). Default scales with node count: 200 / 80 / 30 by size. Higher
     *  settles more, at more cost. */
    iterations?: number;
    /** Pull toward the centre; larger keeps the graph compact. */
    gravity?: number;
    /** Repulsion between nodes; larger spreads them apart. */
    scalingRatio?: number;
    /** Distance-independent gravity; keeps disconnected components from drifting
     *  off. */
    strongGravityMode?: boolean;
    /** Logarithmic attraction: tighter clusters, wider gaps between clusters. */
    linLogMode?: boolean;
    /** "Dissuade hubs": normalise attraction by degree so hubs move to the
     *  periphery. */
    outboundAttractionDistribution?: boolean;
    /** Anti-collision using each node's `size` (prevents overlap; needs sizes). */
    adjustSizes?: boolean;
    /** Exponent applied to edge `weight` in attraction (`0` ignores weight, `1`
     *  linear). Only meaningful when edges carry weights. */
    edgeWeightInfluence?: number;
    /** Global damping; larger converges more slowly but more steadily. */
    slowDown?: number;
    /** Barnes-Hut approximation for repulsion (`O(n log n)`). Auto-on for large
     *  graphs. */
    barnesHutOptimize?: boolean;
    /** Barnes-Hut speed/accuracy tradeoff (larger = faster, coarser). */
    barnesHutTheta?: number;
  };
  /** The single-ring `radial` layout (`circular`). */
  radial?: {
    /** Ring radius scale. Default `max(1, √n)`. */
    scale?: number;
  };
  /** The nested-circles `concentric` layout (`circlepack`). */
  concentric?: {
    /** Overall scale. Default `max(1, √n)`. */
    scale?: number;
  };
  /** The layered `tree` layout. */
  tree?: {
    /** Node `id` to root the layers at (BFS outward). Default: every
     *  zero-in-degree node, else the first node. */
    rootId?: string;
    /** Which way the tree grows. Default `"down"`. */
    direction?: "down" | "right";
    /** Multiplier on the gap between successive levels. Default `1`. */
    levelGap?: number;
  };
  /** The `grid` layout. */
  grid?: {
    /** Fixed column count. Default `⌈√n⌉`. */
    columns?: number;
  };
  /** The hierarchical `org` layout: a tidy org chart spaced by real node
   *  footprints (card sizes), with stacking strategies for horizontal space.
   *  Unlike `tree.levelGap` (a multiplier), org gaps are absolute units in the
   *  same coordinate space as the measured card boxes. */
  org?: {
    /** Node `id` to root the hierarchy at. Default: every zero-in-degree node
     *  (a forest laid side by side); remaining unreached nodes seed further
     *  trees by smallest in-degree. */
    rootId?: string;
    /** Growth direction. Default `"down"`. */
    direction?: "down" | "right";
    /** Gap between successive ranks. Default `40`. */
    levelGap?: number;
    /** Gap between sibling footprints along a rank. Default `12`. */
    nodeGap?: number;
    /** Horizontal-space strategy. Default `"none"`. */
    stack?: OrgStack;
    /** Indent per nesting level of stacked members, from the stack's left
     *  edge. Default `16`. */
    stackIndent?: number;
  };
}
