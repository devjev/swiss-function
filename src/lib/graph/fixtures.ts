/** Deterministic synthetic-graph generators for benchmarks/tests. Pure — no React, no DOM. */

import type { GraphData, GraphEdge, GraphNode } from "./types";

/** The structural shape of a generated graph. */
export type GraphShape = "scaleFree" | "tree" | "clustered";

/** Options for {@link makeGraph}. */
export interface MakeGraphOptions {
  /** Number of nodes to generate (>= 1). */
  nodes: number;
  /**
   * Target average degree (edges per node, counting each edge once). Drives
   * roughly `nodes * avgDegree / 2` edges. Ignored by `tree` (always a tree).
   */
  avgDegree?: number;
  /** Structural shape. Defaults to `scaleFree`. */
  shape?: GraphShape;
  /** Seed for the RNG so output is fully reproducible. Defaults to `1`. */
  seed?: number;
}

/**
 * A small, fast, deterministic PRNG (mulberry32). Given the same seed it always
 * yields the same sequence — we never touch `Math.random` so fixtures are
 * reproducible across runs and machines.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One of a few stable `kind` buckets so nodes color/group consistently. */
const KINDS = ["primary", "secondary", "tertiary", "quaternary"] as const;

function makeNode(i: number, rand: () => number): GraphNode {
  const kind = KINDS[Math.floor(rand() * KINDS.length)] as string;
  return {
    id: `n${i}`,
    label: `Node ${i}`,
    kind,
    data: { index: i },
  };
}

function makeEdge(i: number, source: string, target: string, rand: () => number): GraphEdge {
  return {
    id: `e${i}`,
    source,
    target,
    weight: Math.round((0.25 + rand() * 0.75) * 100) / 100,
    data: {},
  };
}

/**
 * Scale-free graph via Barabási–Albert-style preferential attachment: each new
 * node connects to `m` existing nodes chosen with probability proportional to
 * their current degree, producing a few high-degree hubs (the disorderly-blob
 * default a force layout has to cope with).
 */
function scaleFree(nodes: number, avgDegree: number, rand: () => number): GraphData {
  const nodeList: GraphNode[] = [];
  for (let i = 0; i < nodes; i++) nodeList.push(makeNode(i, rand));

  const edges: GraphEdge[] = [];
  // m edges per new node so the mean degree converges to ~2m = avgDegree.
  const m = Math.max(1, Math.round(avgDegree / 2));
  // Degree-weighted attachment list: each node id appears once per incident edge.
  const targets: number[] = [];
  let edgeId = 0;
  const seen = new Set<string>();

  for (let i = 0; i < nodes; i++) {
    if (i === 0) {
      targets.push(0);
      continue;
    }
    const links = Math.min(m, i);
    const chosen = new Set<number>();
    let guard = 0;
    while (chosen.size < links && guard < links * 20) {
      guard++;
      const pick = targets.length > 0 ? targets[Math.floor(rand() * targets.length)] : 0;
      const t = pick ?? Math.floor(rand() * i);
      if (t === i || chosen.has(t)) continue;
      chosen.add(t);
    }
    for (const t of chosen) {
      const key = i < t ? `${i}-${t}` : `${t}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(makeEdge(edgeId++, `n${i}`, `n${t}`, rand));
      targets.push(i, t);
    }
  }

  return { nodes: nodeList, edges };
}

/**
 * Rooted tree: every node except the root gets exactly one parent picked
 * uniformly from earlier nodes, so the result is connected, acyclic, and has
 * exactly `nodes - 1` edges (ignores `avgDegree`).
 */
function tree(nodes: number, rand: () => number): GraphData {
  const nodeList: GraphNode[] = [];
  for (let i = 0; i < nodes; i++) nodeList.push(makeNode(i, rand));

  const edges: GraphEdge[] = [];
  let edgeId = 0;
  for (let i = 1; i < nodes; i++) {
    const parent = Math.floor(rand() * i);
    edges.push(makeEdge(edgeId++, `n${parent}`, `n${i}`, rand));
  }
  return { nodes: nodeList, edges };
}

/**
 * Clustered graph: nodes are split into ~`sqrt(nodes)` communities. Most edges
 * stay inside a community (dense intra-cluster), a few bridge clusters — a
 * realistic stress for layouts that must reveal community structure.
 */
function clustered(nodes: number, avgDegree: number, rand: () => number): GraphData {
  const nodeList: GraphNode[] = [];
  const clusterCount = Math.max(1, Math.round(Math.sqrt(nodes)));
  const clusterOf: number[] = [];
  for (let i = 0; i < nodes; i++) {
    nodeList.push(makeNode(i, rand));
    clusterOf.push(Math.floor(rand() * clusterCount));
  }

  // Group node indices by cluster.
  const buckets: number[][] = Array.from({ length: clusterCount }, () => []);
  for (let i = 0; i < nodes; i++) (buckets[clusterOf[i] as number] as number[]).push(i);

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  let edgeId = 0;
  const targetEdges = Math.round((nodes * avgDegree) / 2);

  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(makeEdge(edgeId++, `n${a}`, `n${b}`, rand));
  };

  let guard = 0;
  while (edges.length < targetEdges && guard < targetEdges * 30) {
    guard++;
    // 85% intra-cluster, 15% inter-cluster bridges.
    if (rand() < 0.85) {
      const c = buckets[Math.floor(rand() * clusterCount)] as number[];
      if (c.length < 2) continue;
      addEdge(
        c[Math.floor(rand() * c.length)] as number,
        c[Math.floor(rand() * c.length)] as number,
      );
    } else {
      addEdge(Math.floor(rand() * nodes), Math.floor(rand() * nodes));
    }
  }

  return { nodes: nodeList, edges };
}

/**
 * Build a deterministic synthetic graph. Same `{nodes, avgDegree, shape, seed}`
 * always yields byte-identical output (seeded RNG, no `Math.random`).
 */
export function makeGraph(options: MakeGraphOptions): GraphData {
  const { nodes, avgDegree = 4, shape = "scaleFree", seed = 1 } = options;
  const n = Math.max(1, Math.floor(nodes));
  const rand = mulberry32(seed);
  switch (shape) {
    case "tree":
      return tree(n, rand);
    case "clustered":
      return clustered(n, Math.max(1, avgDegree), rand);
    default:
      return scaleFree(n, Math.max(1, avgDegree), rand);
  }
}

/** ~100-node scale-free graph for quick visual checks. */
export const SMALL: GraphData = makeGraph({
  nodes: 100,
  avgDegree: 4,
  shape: "scaleFree",
  seed: 1,
});

/** ~1k-node clustered graph for mid-size interaction tests. */
export const MEDIUM: GraphData = makeGraph({
  nodes: 1000,
  avgDegree: 4,
  shape: "clustered",
  seed: 2,
});

/** 10k-node scale-free graph — the LARGE benchmark fixture (§7 rubric). */
export const LARGE: GraphData = makeGraph({
  nodes: 10000,
  avgDegree: 4,
  shape: "scaleFree",
  seed: 3,
});
