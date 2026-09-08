/** The Sankey layout: layered nodes with flow-proportional heights, links as
 *  flow-proportional ribbons between them. Hand-rolled after d3-sankey's
 *  algorithm (layer by longest path, order by barycenter relaxation, then
 *  resolve collisions), with no dependency. Pure functions, shared by the
 *  component and its tests. */

export interface SankeyNode {
  /** Unique id, referenced by the links. */
  id: string;
  /** Display name. Defaults to the id. */
  name?: string;
  /** Pin the node to a layer (0-based column). Others are placed by the
   *  longest path from the sources. */
  layer?: number;
  /** Any CSS colour / token, used by `linkFill="source"` / `"target"` and for
   *  the node itself. */
  color?: string;
}

export interface SankeyLink {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Flow magnitude (> 0). */
  value: number;
  /** Any CSS colour / token; wins over the node colours. */
  color?: string;
}

export type SankeyAlign = "left" | "right" | "center" | "justify";

export interface SankeyLayoutNode {
  id: string;
  name: string;
  layer: number;
  color?: string;
  /** Sum of incoming link values. */
  valueIn: number;
  /** Sum of outgoing link values. */
  valueOut: number;
  /** The node's flow, `max(valueIn, valueOut)`, which sets its height. */
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  sourceLinks: SankeyLayoutLink[];
  targetLinks: SankeyLayoutLink[];
}

export interface SankeyLayoutLink {
  index: number;
  source: SankeyLayoutNode;
  target: SankeyLayoutNode;
  value: number;
  color?: string;
  /** Ribbon thickness in px. */
  width: number;
  /** Centre y of the ribbon at the source's right edge. */
  y0: number;
  /** Centre y of the ribbon at the target's left edge. */
  y1: number;
  /** The link closes a cycle: drawn, but it took no part in the layering. */
  cyclic: boolean;
}

export type SankeySort = "auto" | "none" | ((a: SankeyLayoutNode, b: SankeyLayoutNode) => number);

export interface SankeyLayoutOptions {
  width: number;
  height: number;
  /** Node (column) thickness in px. */
  nodeWidth: number;
  /** Vertical gap between nodes of one layer in px. */
  nodePadding: number;
  align: SankeyAlign;
  /** Relaxation passes. */
  iterations: number;
  /** Node order within a layer: `"auto"` lets the relaxation reorder, `"none"`
   *  keeps the input order, a comparator fixes it. */
  sort: SankeySort;
}

export interface SankeyLayout {
  nodes: SankeyLayoutNode[];
  links: SankeyLayoutLink[];
  /** Nodes grouped by layer, in vertical order. */
  layers: SankeyLayoutNode[][];
  /** Input problems found while laying out (unknown ids, non-positive values,
   *  cycles). Empty when the input is clean. */
  warnings: string[];
}

interface Resolved {
  nodes: SankeyLayoutNode[];
  links: SankeyLayoutLink[];
  warnings: string[];
}

/** Build the node / link graph, dropping links with unknown ends or a
 *  non-positive value, and mark the links that close cycles. */
function resolveGraph(nodes: readonly SankeyNode[], links: readonly SankeyLink[]): Resolved {
  const warnings: string[] = [];
  const byId = new Map<string, SankeyLayoutNode>();
  const out: SankeyLayoutNode[] = [];
  for (const n of nodes) {
    if (byId.has(n.id)) {
      warnings.push(`duplicate node id "${n.id}"`);
      continue;
    }
    const node: SankeyLayoutNode = {
      id: n.id,
      name: n.name ?? n.id,
      layer: n.layer ?? 0,
      color: n.color,
      valueIn: 0,
      valueOut: 0,
      value: 0,
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 0,
      sourceLinks: [],
      targetLinks: [],
    };
    byId.set(n.id, node);
    out.push(node);
  }
  const resolvedLinks: SankeyLayoutLink[] = [];
  links.forEach((l, i) => {
    const source = byId.get(l.source);
    const target = byId.get(l.target);
    if (!source || !target) {
      warnings.push(`link ${i} references an unknown node ("${l.source}" → "${l.target}")`);
      return;
    }
    if (!(l.value > 0)) {
      warnings.push(`link ${i} ("${l.source}" → "${l.target}") has no positive value`);
      return;
    }
    if (source === target) {
      warnings.push(`link ${i} ("${l.source}") points at itself`);
      return;
    }
    const link: SankeyLayoutLink = {
      index: resolvedLinks.length,
      source,
      target,
      value: l.value,
      color: l.color,
      width: 0,
      y0: 0,
      y1: 0,
      cyclic: false,
    };
    resolvedLinks.push(link);
    source.sourceLinks.push(link);
    target.targetLinks.push(link);
  });
  const kept: SankeyLayoutNode[] = [];
  for (const n of out) {
    n.valueIn = n.targetLinks.reduce((s, l) => s + l.value, 0);
    n.valueOut = n.sourceLinks.reduce((s, l) => s + l.value, 0);
    n.value = Math.max(n.valueIn, n.valueOut);
    // A node no link reaches has no height; it is left out of the diagram.
    if (n.value > 0) kept.push(n);
    else warnings.push(`node "${n.id}" carries no flow`);
  }
  markCycles(kept, warnings);
  return { nodes: kept, links: resolvedLinks, warnings };
}

/** Iterative DFS over the outgoing links; a link into a node still on the
 *  stack closes a cycle and is marked `cyclic`. */
function markCycles(nodes: SankeyLayoutNode[], warnings: string[]): void {
  const state = new Map<SankeyLayoutNode, 0 | 1 | 2>();
  for (const root of nodes) {
    if (state.get(root)) continue;
    const stack: { node: SankeyLayoutNode; next: number }[] = [{ node: root, next: 0 }];
    state.set(root, 1);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      if (frame.next >= frame.node.sourceLinks.length) {
        state.set(frame.node, 2);
        stack.pop();
        continue;
      }
      const link = frame.node.sourceLinks[frame.next++];
      if (!link) continue;
      const s = state.get(link.target) ?? 0;
      if (s === 1) {
        link.cyclic = true;
        warnings.push(`link "${link.source.id}" → "${link.target.id}" closes a cycle`);
      } else if (s === 0) {
        state.set(link.target, 1);
        stack.push({ node: link.target, next: 0 });
      }
    }
  }
}

/** Longest-path layering over the acyclic links, honouring pinned layers, then
 *  the alignment: `justify` moves every sink to the last layer, `right` pulls
 *  each node as far right as its successors allow, `center` pulls sources up
 *  against their targets. */
function assignLayers(nodes: SankeyLayoutNode[], align: SankeyAlign, pinned: Set<string>): void {
  // Kahn's order over the acyclic links.
  const indeg = new Map<SankeyLayoutNode, number>();
  for (const n of nodes) indeg.set(n, n.targetLinks.filter((l) => !l.cyclic).length);
  const queue = nodes.filter((n) => indeg.get(n) === 0);
  const order: SankeyLayoutNode[] = [];
  for (const n of nodes) if (!pinned.has(n.id)) n.layer = 0;
  while (queue.length > 0) {
    const n = queue.shift();
    if (!n) break;
    order.push(n);
    for (const l of n.sourceLinks) {
      if (l.cyclic) continue;
      const t = l.target;
      if (!pinned.has(t.id)) t.layer = Math.max(t.layer, n.layer + 1);
      const d = (indeg.get(t) ?? 0) - 1;
      indeg.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  let maxLayer = 0;
  for (const n of nodes) maxLayer = Math.max(maxLayer, n.layer);
  if (align === "justify") {
    for (const n of nodes) {
      if (pinned.has(n.id)) continue;
      if (n.sourceLinks.every((l) => l.cyclic)) n.layer = maxLayer;
    }
  } else if (align === "right") {
    // Longest path to a sink, walked in reverse topological order.
    const toSink = new Map<SankeyLayoutNode, number>();
    for (let i = order.length - 1; i >= 0; i--) {
      const n = order[i];
      if (!n) continue;
      let d = 0;
      for (const l of n.sourceLinks)
        if (!l.cyclic) d = Math.max(d, (toSink.get(l.target) ?? 0) + 1);
      toSink.set(n, d);
    }
    for (const n of nodes) {
      if (pinned.has(n.id)) continue;
      n.layer = maxLayer - (toSink.get(n) ?? 0);
    }
  } else if (align === "center") {
    for (const n of nodes) {
      if (pinned.has(n.id)) continue;
      const acyclicIn = n.targetLinks.some((l) => !l.cyclic);
      const outs = n.sourceLinks.filter((l) => !l.cyclic);
      if (!acyclicIn && outs.length > 0) {
        n.layer = Math.max(0, Math.min(...outs.map((l) => l.target.layer)) - 1);
      }
    }
  }
}

function groupLayers(nodes: SankeyLayoutNode[]): SankeyLayoutNode[][] {
  let max = 0;
  for (const n of nodes) max = Math.max(max, n.layer);
  const layers: SankeyLayoutNode[][] = Array.from({ length: max + 1 }, () => []);
  for (const n of nodes) layers[n.layer]?.push(n);
  return layers.filter((l) => l.length > 0);
}

function centre(n: SankeyLayoutNode): number {
  return (n.y0 + n.y1) / 2;
}

/** Push overlapping nodes of one column apart (top-down, then back up if the
 *  column overflows the bottom), keeping the column's current order. */
function resolveCollisions(
  column: SankeyLayoutNode[],
  padding: number,
  height: number,
  alpha: number,
): void {
  let y = 0;
  for (const n of column) {
    const dy = y - n.y0;
    if (dy > 0) {
      n.y0 += dy * alpha;
      n.y1 += dy * alpha;
    }
    y = n.y1 + padding;
  }
  const last = column[column.length - 1];
  if (!last) return;
  let overflow = last.y1 - height;
  if (overflow > 0) {
    last.y0 -= overflow * alpha;
    last.y1 -= overflow * alpha;
    for (let i = column.length - 2; i >= 0; i--) {
      const n = column[i];
      const below = column[i + 1];
      if (!n || !below) continue;
      overflow = n.y1 + padding - below.y0;
      if (overflow <= 0) break;
      n.y0 -= overflow * alpha;
      n.y1 -= overflow * alpha;
    }
  }
}

function reorder(column: SankeyLayoutNode[], sort: SankeySort): void {
  if (sort === "none") return;
  if (sort === "auto") column.sort((a, b) => a.y0 - b.y0);
  else column.sort(sort);
}

function weightedMean(
  n: SankeyLayoutNode,
  links: SankeyLayoutLink[],
  other: (l: SankeyLayoutLink) => SankeyLayoutNode,
): number | null {
  let sum = 0;
  let weight = 0;
  for (const l of links) {
    if (l.cyclic) continue;
    sum += centre(other(l)) * l.value;
    weight += l.value;
  }
  if (weight <= 0) return null;
  return sum / weight - centre(n);
}

/** Lay out the graph. Returns px positions for every node and link inside the
 *  `width` × `height` box: nodes span `[x0, x1]` × `[y0, y1]`, links run from
 *  `(source.x1, y0)` to `(target.x0, y1)` at `width` thick. */
export function sankeyLayout(
  nodes: readonly SankeyNode[],
  links: readonly SankeyLink[],
  options: SankeyLayoutOptions,
): SankeyLayout {
  const { width, height, nodeWidth, nodePadding, align, iterations, sort } = options;
  const graph = resolveGraph(nodes, links);
  const pinned = new Set(nodes.filter((n) => n.layer != null).map((n) => n.id));
  assignLayers(graph.nodes, align, pinned);
  const layers = groupLayers(graph.nodes);
  if (graph.nodes.length === 0 || width <= 0 || height <= 0) {
    return { nodes: graph.nodes, links: graph.links, layers, warnings: graph.warnings };
  }

  // Columns: evenly spaced, the node thickness capped so a single layer still
  // has room. The pinned layer numbers may leave empty columns behind; the
  // visible columns are the occupied ones.
  const columns = layers.length;
  const nw = Math.min(nodeWidth, width);
  const step = columns > 1 ? (width - nw) / (columns - 1) : 0;
  layers.forEach((column, ci) => {
    const x0 = columns > 1 ? ci * step : (width - nw) / 2;
    for (const n of column) {
      n.x0 = x0;
      n.x1 = x0 + nw;
    }
  });

  // Vertical scale: the tightest column decides the px per unit of flow, so
  // every column fits with its padding.
  let ky = Number.POSITIVE_INFINITY;
  for (const column of layers) {
    const total = column.reduce((s, n) => s + n.value, 0);
    const pad = nodePadding * (column.length - 1);
    if (total > 0) ky = Math.min(ky, Math.max(0, height - pad) / total);
  }
  if (!Number.isFinite(ky)) ky = 0;

  // Initial stack, input order, top-aligned.
  for (const column of layers) {
    let y = 0;
    for (const n of column) {
      n.y0 = y;
      n.y1 = y + n.value * ky;
      y = n.y1 + nodePadding;
    }
  }
  for (const l of graph.links) l.width = l.value * ky;

  // Barycenter relaxation, sweeping left to right then right to left, with the
  // step shrinking per pass, as d3-sankey does.
  for (let i = 0, alpha = 1; i < iterations; i++, alpha *= 0.99) {
    const beta = Math.max(1 - alpha, (i + 1) / iterations);
    for (let ci = 1; ci < layers.length; ci++) {
      const column = layers[ci];
      if (!column) continue;
      for (const n of column) {
        const d = weightedMean(n, n.targetLinks, (l) => l.source);
        if (d != null) {
          n.y0 += d * alpha;
          n.y1 += d * alpha;
        }
      }
      reorder(column, sort);
      resolveCollisions(column, nodePadding, height, beta);
    }
    for (let ci = layers.length - 2; ci >= 0; ci--) {
      const column = layers[ci];
      if (!column) continue;
      for (const n of column) {
        const d = weightedMean(n, n.sourceLinks, (l) => l.target);
        if (d != null) {
          n.y0 += d * alpha;
          n.y1 += d * alpha;
        }
      }
      reorder(column, sort);
      resolveCollisions(column, nodePadding, height, beta);
    }
  }
  // A final hard pass so nothing overlaps whatever the relaxation left.
  for (const column of layers) {
    reorder(column, sort);
    resolveCollisions(column, nodePadding, height, 1);
  }

  // Link slots: on each node, outgoing ribbons are stacked in the order of
  // their targets' positions and incoming ones in the order of their sources',
  // so ribbons leave and arrive without crossing at the node.
  for (const n of graph.nodes) {
    n.sourceLinks.sort((a, b) => centre(a.target) - centre(b.target) || a.index - b.index);
    n.targetLinks.sort((a, b) => centre(a.source) - centre(b.source) || a.index - b.index);
    let y = n.y0;
    for (const l of n.sourceLinks) {
      l.y0 = y + l.width / 2;
      y += l.width;
    }
    y = n.y0;
    for (const l of n.targetLinks) {
      l.y1 = y + l.width / 2;
      y += l.width;
    }
  }

  return { nodes: graph.nodes, links: graph.links, layers, warnings: graph.warnings };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** The ribbon's centre line as an SVG path: a horizontal cubic bezier from the
 *  source's right edge to the target's left edge (the d3-sankey link shape).
 *  Stroke it with the link's `width`. */
export function sankeyLinkPath(link: SankeyLayoutLink): string {
  const x0 = link.source.x1;
  const x1 = link.target.x0;
  const xm = (x0 + x1) / 2;
  return `M ${fmt(x0)} ${fmt(link.y0)} C ${fmt(xm)} ${fmt(link.y0)} ${fmt(xm)} ${fmt(link.y1)} ${fmt(x1)} ${fmt(link.y1)}`;
}

/** The midpoint of a ribbon's centre line (the tooltip and pin anchor). */
export function sankeyLinkMidpoint(link: SankeyLayoutLink): { x: number; y: number } {
  return { x: (link.source.x1 + link.target.x0) / 2, y: (link.y0 + link.y1) / 2 };
}
