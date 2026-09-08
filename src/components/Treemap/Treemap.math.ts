/** The treemap's pure layout: value aggregation over a hierarchy, the tiling
 *  algorithms (squarify after Bruls, Huizing and van Wijk; slice, dice and
 *  slice-and-dice after Shneiderman), pixel snapping with hairline gaps, and
 *  the path lookup a breadcrumb needs. No React, no DOM. */

export interface TreemapNode {
  /** Stable identity. Defaults to the node's path (names joined by `/`). */
  id?: string;
  name: string;
  /** The node's size. A parent without one sums its children. */
  value?: number;
  children?: TreemapNode[];
  /** An explicit fill (any CSS colour / token) that wins over `colorBy`. */
  color?: string;
  /** A second measure for `colorBy="change"` (a signed percent, typically). A
   *  parent without one takes the value-weighted mean of its children. */
  change?: number;
}

export type TreemapLayout = "squarify" | "slice" | "dice" | "sliceDice";

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A node with its aggregated value and change, its path id and its parent. */
export interface AggregatedNode {
  node: TreemapNode;
  id: string;
  name: string;
  value: number;
  change?: number;
  /** Depth below the data root (the root itself is 0). */
  depth: number;
  /** Names from the data root down to and including this node. */
  path: string[];
  children: AggregatedNode[];
  parent?: AggregatedNode;
}

/** One drawn rectangle: a leaf cell, a group's container, or a group's header
 *  strip. Pixel coordinates inside the plot. */
export interface TreemapCell {
  kind: "leaf" | "group" | "header";
  id: string;
  name: string;
  value: number;
  change?: number;
  /** Depth below the drawn root (1 = the drawn root's children). */
  depth: number;
  path: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  /** Index of the top-level group (the drawn root's child) this cell belongs to. */
  groupIndex: number;
  shareOfParent: number;
  shareOfTotal: number;
  parentName?: string;
  node: TreemapNode;
  /** Whether a leaf stands for an aggregated subtree (the `depth` cut). */
  aggregated: boolean;
}

export interface TreemapLayoutOptions {
  layout: TreemapLayout;
  /** Gap between siblings, px. */
  padding: number;
  /** Inset inside a group around its children, px. */
  groupPadding: number;
  /** The header strip's height, px. */
  headerHeight: number;
  /** Levels to draw below the drawn root; deeper subtrees aggregate. */
  maxDepth: number;
  /** A group narrower than this draws no header strip. */
  minHeaderWidth: number;
}

function isFiniteValue(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Resolve values (leaves sum upward), changes (value-weighted means) and path
 *  ids over the hierarchy. Pure: never mutates the input. */
export function aggregate(root: TreemapNode): AggregatedNode {
  const build = (node: TreemapNode, depth: number, path: string[], parent?: AggregatedNode) => {
    const ownPath = [...path, node.name];
    const out: AggregatedNode = {
      node,
      id: node.id ?? ownPath.join("/"),
      name: node.name,
      value: 0,
      change: isFiniteValue(node.change) ? node.change : undefined,
      depth,
      path: ownPath,
      children: [],
      parent,
    };
    out.children = (node.children ?? []).map((c) => build(c, depth + 1, ownPath, out));
    if (isFiniteValue(node.value)) {
      out.value = Math.max(0, node.value);
    } else {
      let sum = 0;
      for (const c of out.children) sum += c.value;
      out.value = sum;
    }
    if (out.change === undefined && out.children.length > 0) {
      let weighted = 0;
      let weight = 0;
      for (const c of out.children) {
        if (c.change !== undefined && c.value > 0) {
          weighted += c.change * c.value;
          weight += c.value;
        }
      }
      if (weight > 0) out.change = weighted / weight;
    }
    return out;
  };
  return build(root, 0, []);
}

/** Depth-first lookup by id. */
export function findNode(root: AggregatedNode, id: string): AggregatedNode | undefined {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return undefined;
}

/** The nodes from the data root down to the node with `id` (inclusive), for a
 *  breadcrumb over a drilled-down treemap. Empty when the id is unknown. */
export function treemapPath(data: TreemapNode, id: string): TreemapNode[] {
  const hit = findNode(aggregate(data), id);
  if (!hit) return [];
  const out: TreemapNode[] = [];
  for (let n: AggregatedNode | undefined = hit; n; n = n.parent) out.unshift(n.node);
  return out;
}

function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Split `rect` along x: one column per value, left to right, in input order. */
export function dice(values: readonly number[], rect: Rect): Rect[] {
  const total = sum(values);
  const k = total > 0 ? (rect.x1 - rect.x0) / total : 0;
  let x = rect.x0;
  return values.map((v) => {
    const r = { x0: x, y0: rect.y0, x1: x + v * k, y1: rect.y1 };
    x = r.x1;
    return r;
  });
}

/** Split `rect` along y: one row per value, top to bottom, in input order. */
export function slice(values: readonly number[], rect: Rect): Rect[] {
  const total = sum(values);
  const k = total > 0 ? (rect.y1 - rect.y0) / total : 0;
  let y = rect.y0;
  return values.map((v) => {
    const r = { x0: rect.x0, y0: y, x1: rect.x1, y1: y + v * k };
    y = r.y1;
    return r;
  });
}

/** Squarified tiling: rows of near-square cells laid along the shorter side,
 *  each row closed when adding the next value would worsen its worst aspect
 *  ratio. `values` should be sorted descending for the classic result; the
 *  rects come back in input order. `ratio` is the target aspect (1 = square). */
export function squarify(values: readonly number[], rect: Rect, ratio = 1): Rect[] {
  const n = values.length;
  const out: Rect[] = new Array(n);
  let { x0, y0 } = rect;
  const { x1, y1 } = rect;
  let remaining = sum(values);
  let i0 = 0;
  while (i0 < n) {
    // Zero-sized values get empty rects and never open a row.
    let first = values[i0] ?? 0;
    while (i0 < n && !(first > 0)) {
      out[i0] = { x0, y0, x1: x0, y1: y0 };
      i0++;
      first = values[i0] ?? 0;
    }
    if (i0 >= n) break;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let sumValue = first;
    let minValue = first;
    let maxValue = first;
    const alpha =
      dx > 0 && dy > 0 && remaining > 0
        ? Math.max(dy / dx, dx / dy) / (remaining * ratio)
        : Number.POSITIVE_INFINITY;
    let beta = sumValue * sumValue * alpha;
    let minRatio = Math.max(maxValue / beta, beta / minValue);
    let i1 = i0 + 1;
    for (; i1 < n; i1++) {
      const v = values[i1] ?? 0;
      if (!(v > 0)) break;
      sumValue += v;
      if (v < minValue) minValue = v;
      if (v > maxValue) maxValue = v;
      beta = sumValue * sumValue * alpha;
      const newRatio = Math.max(maxValue / beta, beta / minValue);
      if (newRatio > minRatio) {
        sumValue -= v;
        break;
      }
      minRatio = newRatio;
    }
    const rowValues = values.slice(i0, i1);
    if (dx < dy) {
      // A horizontal strip across the top, its cells side by side.
      const rowY1 = remaining > 0 ? y0 + (dy * sumValue) / remaining : y1;
      const rects = dice(rowValues, { x0, y0, x1, y1: rowY1 });
      for (let k = 0; k < rects.length; k++) out[i0 + k] = rects[k] as Rect;
      y0 = rowY1;
    } else {
      // A vertical strip down the left, its cells stacked.
      const rowX1 = remaining > 0 ? x0 + (dx * sumValue) / remaining : x1;
      const rects = slice(rowValues, { x0, y0, x1: rowX1, y1 });
      for (let k = 0; k < rects.length; k++) out[i0 + k] = rects[k] as Rect;
      x0 = rowX1;
    }
    remaining -= sumValue;
    i0 = i1;
  }
  return out;
}

/** The worst (largest) aspect ratio among rects with area; `1` is square. */
export function worstAspect(rects: readonly Rect[]): number {
  let worst = 1;
  for (const r of rects) {
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    if (w > 0 && h > 0) worst = Math.max(worst, w / h, h / w);
  }
  return worst;
}

function tile(layout: TreemapLayout, values: readonly number[], rect: Rect, depth: number): Rect[] {
  switch (layout) {
    case "slice":
      return slice(values, rect);
    case "dice":
      return dice(values, rect);
    case "sliceDice":
      return depth % 2 === 1 ? slice(values, rect) : dice(values, rect);
    default:
      return squarify(values, rect);
  }
}

interface PxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Snap a child's float rect to whole pixels inside its parent's snapped rect,
 *  leaving a `padding` gap on the right and bottom wherever the edge is
 *  interior (siblings share the same rounded edge, so the gap is exact).
 *  Returns null for a cell too small to draw. */
export function snapCell(r: Rect, parent: Rect, padding: number): PxRect | null {
  const x0 = Math.round(r.x0);
  const y0 = Math.round(r.y0);
  let x1 = Math.round(r.x1);
  let y1 = Math.round(r.y1);
  if (r.x1 < parent.x1 - 0.5) x1 -= padding;
  if (r.y1 < parent.y1 - 0.5) y1 -= padding;
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Lay the subtree at `root` out in a `width` x `height` box. Groups (nodes with
 *  children above the depth cut) come first in the list, then their header
 *  strips, then their children, so painting in list order stacks correctly. */
export function layoutTreemap(
  root: AggregatedNode,
  width: number,
  height: number,
  opts: TreemapLayoutOptions,
): TreemapCell[] {
  const cells: TreemapCell[] = [];
  if (!(width > 0) || !(height > 0) || root.value <= 0) return cells;
  const total = root.value;

  const place = (
    parent: AggregatedNode,
    parentRect: Rect,
    depth: number,
    groupIndexOf: (i: number) => number,
  ) => {
    const kids = parent.children.filter((c) => c.value > 0);
    if (kids.length === 0) return;
    const ordered = opts.layout === "squarify" ? [...kids].sort((a, b) => b.value - a.value) : kids;
    const rects = tile(
      opts.layout,
      ordered.map((c) => c.value),
      parentRect,
      depth,
    );
    ordered.forEach((child, k) => {
      const rect = rects[k];
      if (!rect) return;
      const px = snapCell(rect, parentRect, opts.padding);
      if (!px) return;
      const groupIndex = groupIndexOf(kids.indexOf(child));
      const base = {
        id: child.id,
        name: child.name,
        value: child.value,
        change: child.change,
        depth,
        path: child.path,
        groupIndex,
        shareOfParent: parent.value > 0 ? child.value / parent.value : 0,
        shareOfTotal: child.value / total,
        parentName: parent.name,
        node: child.node,
        ...px,
      };
      const drawChildren = child.children.some((c) => c.value > 0) && depth < opts.maxDepth;
      if (!drawChildren) {
        cells.push({ kind: "leaf", aggregated: child.children.length > 0, ...base });
        return;
      }
      const gp = opts.groupPadding;
      const withHeader =
        px.height >= opts.headerHeight * 3 + gp * 2 && px.width >= opts.minHeaderWidth;
      const innerTop = px.y + (withHeader ? opts.headerHeight : 0) + gp;
      const inner: Rect = {
        x0: px.x + gp,
        y0: innerTop,
        x1: px.x + px.width - gp,
        y1: px.y + px.height - gp,
      };
      if (inner.x1 - inner.x0 < 2 || inner.y1 - inner.y0 < 2) {
        // Too small to subdivide: the group reads as one aggregated cell.
        cells.push({ kind: "leaf", aggregated: true, ...base });
        return;
      }
      cells.push({ kind: "group", aggregated: false, ...base });
      if (withHeader) {
        cells.push({
          kind: "header",
          aggregated: false,
          ...base,
          y: px.y,
          height: opts.headerHeight,
        });
      }
      place(child, inner, depth + 1, () => groupIndex);
    });
  };

  place(root, { x0: 0, y0: 0, x1: width, y1: height }, 1, (i) => i);
  return cells;
}
