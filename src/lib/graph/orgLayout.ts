/** Tidy hierarchical ("org chart") layout. Pure — no React, no DOM, no Sigma.
 *
 *  The tidy pass is Buchheim/Jünger/Leipert's linear-time refinement of
 *  Reingold-Tilford ("Improving Walker's Algorithm to Run in Linear Time",
 *  2002), adapted to variable node breadths: every sibling separation is the
 *  half-breadth sum of the pair plus `nodeGap`, so real card widths drive the
 *  spacing instead of an index grid. No external layout engine (elkjs/dagre
 *  blew the bundle + scale budgets long ago; the hand-rolled pass is the
 *  established pattern here).
 *
 *  Horizontal space is managed by *stacking*: a stacked group (leaf children,
 *  or every subtree below a depth threshold) leaves the rank grid and renders
 *  as an indented vertical list under its parent, participating in the tidy
 *  pass as one composite box. A stack taller than its own rank is extended,
 *  for contour purposes only, by a chain of phantom nodes spanning the ranks
 *  it overlaps — Walker's contour comparison is per-rank, so without the
 *  phantoms a neighbouring subtree could slide its deeper ranks under the
 *  stack and overlap it. Phantom count is bounded by the rank count.
 */

import type Graphology from "graphology";
import type { GraphLayoutOptions, OrgStack } from "./types";

/** A node footprint in layout units ("card px"). */
export interface CardBox {
  width: number;
  height: number;
}

/** Environment the layout needs from the renderer. */
export interface OrgLayoutEnv {
  /** Footprint of a node. Must be pure and cheap; called once per node. */
  measure: (id: string) => CardBox;
  /** Drawable viewport size, for `stack: "auto"`. Absent → "auto" degrades to
   *  `"leaves"`. */
  container?: { width: number; height: number };
  /** Called with the stacked members of the final pass: member id → spine
   *  offset (half the stack indent, in layout units). The renderer uses it to
   *  draw file-tree side-entry connectors into stacked cards. */
  reportStacks?: (members: Map<string, number>) => void;
}

export const ORG_DEFAULTS = {
  levelGap: 40,
  nodeGap: 12,
  stackIndent: 16,
  /** Gap between the trees of a forest, along the breadth axis. */
  treeGap: 48,
} as const;

/** Sigma's default stagePadding: the auto-fit aspect check must compare
 *  against the drawable box, not the raw container. */
const STAGE_PADDING = 30;
/** Recursion guard: beyond this tree depth, force maximal stacking (the tidy
 *  walks recurse per rank). No real org is this deep; a pathological chain is. */
const MAX_TIDY_DEPTH = 1000;
/** `stack: "auto"` tries at most this many layout passes. */
const MAX_AUTO_PASSES = 12;

type LayoutMapping = Record<string, { x: number; y: number }>;
type ResolvedStack = "none" | "leaves" | { depth: number };

interface StackMember {
  id: string;
  indent: number;
  box: CardBox;
}

/** One participant in the tidy pass: a real card, a composite stack box, or a
 *  phantom extending a tall stack's contour down the ranks it overlaps. */
interface LItem {
  kind: "node" | "stack" | "phantom";
  id: string | null;
  box: CardBox;
  members: StackMember[] | null;
  rank: number;
  parent: LItem | null;
  num: number;
  children: LItem[];
  // Buchheim state.
  prelim: number;
  mod: number;
  shift: number;
  change: number;
  thread: LItem | null;
  ancestorLink: LItem;
  /** Final breadth-axis centre. */
  x: number;
}

function makeItem(kind: LItem["kind"], id: string | null, box: CardBox, rank: number): LItem {
  const item: LItem = {
    kind,
    id,
    box,
    members: null,
    rank,
    parent: null,
    num: 0,
    children: [],
    prelim: 0,
    mod: 0,
    shift: 0,
    change: 0,
    thread: null,
    ancestorLink: undefined as unknown as LItem,
    x: 0,
  };
  item.ancestorLink = item;
  return item;
}

function attach(parent: LItem, child: LItem): void {
  child.parent = parent;
  child.num = parent.children.length;
  parent.children.push(child);
}

interface Forest {
  roots: string[];
  childrenOf: Map<string, string[]>;
  depthOfNode: Map<string, number>;
  maxDepth: number;
}

/** Stage A: extract a spanning forest. Directed edges define parentage first
 *  (`manager → report`); an undirected fallback keeps mind-map data working.
 *  A node with several in-edges belongs to the parent of its FIRST in-edge
 *  (data order marks the primary reporting line) — later cross-links (dotted
 *  lines, cycle back-edges) still render but never re-home the node. Unreached
 *  nodes (cycle-only components, islands) seed further trees by smallest
 *  in-degree, so every node is placed exactly once. */
function extractForest(g: Graphology, rootId: string | undefined): Forest {
  const order = g.nodes();
  const visited = new Set<string>();
  const childrenOf = new Map<string, string[]>();
  const depthOfNode = new Map<string, number>();
  const roots: string[] = [];
  let maxDepth = 0;

  // The primary parent of every node: the source of its first in-edge
  // (graphology preserves insertion order, which is the data order).
  const primaryParent = new Map<string, string>();
  for (const n of order) {
    g.forEachInEdge(n, (_e, _attr, source) => {
      if (source !== n && !primaryParent.has(n)) primaryParent.set(n, source);
    });
  }

  const bfs = (seeds: string[], strict: boolean) => {
    const queue: string[] = [];
    for (const s of seeds) {
      if (visited.has(s)) continue;
      visited.add(s);
      depthOfNode.set(s, 0);
      roots.push(s);
      queue.push(s);
    }
    for (let i = 0; i < queue.length; i++) {
      const v = queue[i];
      if (v === undefined) continue;
      const d = depthOfNode.get(v) ?? 0;
      const kids: string[] = [];
      const claim = (n: string, requirePrimary: boolean) => {
        if (visited.has(n)) return;
        // In the strict (primary) pass a claim only succeeds from the node's
        // primary parent (nodes without one — undirected data — are free);
        // the fallback pass takes what's left.
        if (requirePrimary && primaryParent.has(n) && primaryParent.get(n) !== v) return;
        visited.add(n);
        depthOfNode.set(n, d + 1);
        maxDepth = Math.max(maxDepth, d + 1);
        kids.push(n);
        queue.push(n);
      };
      g.forEachOutNeighbor(v, (n) => claim(n, strict));
      g.forEachNeighbor(v, (n) => claim(n, true));
      const existing = childrenOf.get(v);
      childrenOf.set(v, existing ? existing.concat(kids) : kids);
    }
  };

  const seeds: string[] = [];
  if (rootId !== undefined && g.hasNode(rootId)) seeds.push(rootId);
  for (const n of order) {
    if (g.inDegree(n) === 0) seeds.push(n);
  }
  bfs(seeds, true);

  while (visited.size < order.length) {
    let best: string | undefined;
    let bestIn = Number.POSITIVE_INFINITY;
    for (const n of order) {
      if (visited.has(n)) continue;
      const deg = g.inDegree(n);
      if (deg < bestIn) {
        bestIn = deg;
        best = n;
      }
    }
    if (best === undefined) break;
    bfs([best], false);
  }

  return { roots, childrenOf, depthOfNode, maxDepth };
}

/** DFS preorder over a subtree, emitting stack members with nested indents. */
function collectStackMembers(
  seedIds: string[],
  seedDepth: number,
  baseDepth: number,
  forest: Forest,
  boxes: Map<string, CardBox>,
  out: StackMember[],
): void {
  // Explicit stack: stacked subtrees can be arbitrarily deep.
  const work: Array<{ id: string; depth: number }> = [];
  for (let i = seedIds.length - 1; i >= 0; i--) {
    const id = seedIds[i];
    if (id !== undefined) work.push({ id, depth: seedDepth });
  }
  while (work.length > 0) {
    const cur = work.pop();
    if (cur === undefined) continue;
    out.push({
      id: cur.id,
      indent: 1 + (cur.depth - baseDepth),
      box: boxes.get(cur.id) ?? { width: 1, height: 1 },
    });
    const kids = forest.childrenOf.get(cur.id) ?? [];
    for (let i = kids.length - 1; i >= 0; i--) {
      const kid = kids[i];
      if (kid !== undefined) work.push({ id: kid, depth: cur.depth + 1 });
    }
  }
}

interface Gaps {
  levelGap: number;
  nodeGap: number;
  stackIndent: number;
  treeGap: number;
}

/** Composite footprint of a stack. The same physical box serves both
 *  directions: members run along the depth axis (`height` for "down", read as
 *  the depth extent) and indent along the breadth axis. */
function stackBox(members: StackMember[], gaps: Gaps): CardBox {
  let width = 1;
  let height = 0;
  for (const m of members) {
    width = Math.max(width, m.indent * gaps.stackIndent + m.box.width);
    height += m.box.height;
  }
  height += Math.max(0, members.length - 1) * gaps.nodeGap;
  return { width, height };
}

/** Stage B: build the layout tree for one root, applying the stacking mode. */
function buildLTree(
  root: string,
  mode: ResolvedStack,
  forest: Forest,
  boxes: Map<string, CardBox>,
  gaps: Gaps,
): LItem {
  const stackAtDepth = typeof mode === "object" ? mode.depth : null;

  const build = (id: string, depth: number): LItem => {
    const item = makeItem("node", id, boxes.get(id) ?? { width: 1, height: 1 }, depth);
    const kids = forest.childrenOf.get(id) ?? [];
    if (kids.length === 0) return item;

    if (stackAtDepth !== null && depth === stackAtDepth - 1) {
      // Everything below this node merges into one nested list.
      const members: StackMember[] = [];
      collectStackMembers(kids, depth + 1, stackAtDepth, forest, boxes, members);
      const stack = makeItem("stack", null, stackBox(members, gaps), depth + 1);
      stack.members = members;
      attach(item, stack);
      return item;
    }

    if (mode === "leaves") {
      const leafMembers: StackMember[] = [];
      for (const kid of kids) {
        const grandKids = forest.childrenOf.get(kid) ?? [];
        if (grandKids.length === 0) {
          leafMembers.push({
            id: kid,
            indent: 1,
            box: boxes.get(kid) ?? { width: 1, height: 1 },
          });
        } else {
          attach(item, build(kid, depth + 1));
        }
      }
      if (leafMembers.length > 0) {
        const stack = makeItem("stack", null, stackBox(leafMembers, gaps), depth + 1);
        stack.members = leafMembers;
        attach(item, stack);
      }
      return item;
    }

    for (const kid of kids) attach(item, build(kid, depth + 1));
    return item;
  };

  return build(root, 0);
}

/** Buchheim first walk: post-order preliminary x + subtree shifts. */
function firstWalk(v: LItem, sep: (a: LItem, b: LItem) => number): void {
  const leftSibling = v.parent && v.num > 0 ? (v.parent.children[v.num - 1] ?? null) : null;
  if (v.children.length === 0) {
    v.prelim = leftSibling ? leftSibling.prelim + sep(leftSibling, v) : 0;
    return;
  }
  let defaultAncestor = v.children[0] as LItem;
  for (const w of v.children) {
    firstWalk(w, sep);
    defaultAncestor = apportion(w, defaultAncestor, sep);
  }
  executeShifts(v);
  const first = v.children[0] as LItem;
  const last = v.children[v.children.length - 1] as LItem;
  const midpoint = (first.prelim + last.prelim) / 2;
  if (leftSibling) {
    v.prelim = leftSibling.prelim + sep(leftSibling, v);
    v.mod = v.prelim - midpoint;
  } else {
    v.prelim = midpoint;
  }
}

function nextLeft(v: LItem): LItem | null {
  return v.children.length > 0 ? (v.children[0] as LItem) : v.thread;
}
function nextRight(v: LItem): LItem | null {
  return v.children.length > 0 ? (v.children[v.children.length - 1] as LItem) : v.thread;
}

function moveSubtree(wm: LItem, wp: LItem, shift: number): void {
  const subtrees = wp.num - wm.num;
  wp.change -= shift / subtrees;
  wp.shift += shift;
  wm.change += shift / subtrees;
  wp.prelim += shift;
  wp.mod += shift;
}

function executeShifts(v: LItem): void {
  let shift = 0;
  let change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i] as LItem;
    w.prelim += shift;
    w.mod += shift;
    change += w.change;
    shift += w.shift + change;
  }
}

function ancestorOf(vim: LItem, v: LItem, defaultAncestor: LItem): LItem {
  return vim.ancestorLink.parent === v.parent ? vim.ancestorLink : defaultAncestor;
}

/** Buchheim apportion: walk the inner contours of `v` and its left sibling
 *  forest, shifting `v`'s subtree right whenever the contours would touch. */
function apportion(v: LItem, defaultAncestor: LItem, sep: (a: LItem, b: LItem) => number): LItem {
  const w = v.parent && v.num > 0 ? (v.parent.children[v.num - 1] ?? null) : null;
  if (!w || !v.parent) return defaultAncestor;
  let vip: LItem = v;
  let vop: LItem = v;
  let vim: LItem = w;
  let vom: LItem = v.parent.children[0] as LItem;
  let sip = vip.mod;
  let sop = vop.mod;
  let sim = vim.mod;
  let som = vom.mod;
  let nr = nextRight(vim);
  let nl = nextLeft(vip);
  while (nr && nl) {
    vim = nr;
    vip = nl;
    vom = nextLeft(vom) as LItem;
    vop = nextRight(vop) as LItem;
    vop.ancestorLink = v;
    const shift = vim.prelim + sim - (vip.prelim + sip) + sep(vim, vip);
    if (shift > 0) {
      moveSubtree(ancestorOf(vim, v, defaultAncestor), v, shift);
      sip += shift;
      sop += shift;
    }
    sim += vim.mod;
    sip += vip.mod;
    som += vom.mod;
    sop += vop.mod;
    nr = nextRight(vim);
    nl = nextLeft(vip);
  }
  if (nr && !nextRight(vop)) {
    vop.thread = nr;
    vop.mod += sim - sop;
  }
  if (nl && !nextLeft(vom)) {
    vom.thread = nl;
    vom.mod += sip - som;
    return v;
  }
  return defaultAncestor;
}

function secondWalk(v: LItem, m: number): void {
  v.x = v.prelim + m;
  for (const w of v.children) secondWalk(w, m + v.mod);
}

interface PassResult {
  mapping: LayoutMapping;
  bboxWidth: number;
  bboxHeight: number;
  /** Stacked member id → spine offset (stackIndent / 2). */
  stacked: Map<string, number>;
}

/** One full layout pass at a resolved stacking mode. */
function layoutPass(
  forest: Forest,
  mode: ResolvedStack,
  boxes: Map<string, CardBox>,
  gaps: Gaps,
  isDown: boolean,
): PassResult {
  const breadthOf = (b: CardBox) => (isDown ? b.width : b.height);
  const depthOf = (b: CardBox) => (isDown ? b.height : b.width);
  const sep = (a: LItem, b: LItem) => breadthOf(a.box) / 2 + breadthOf(b.box) / 2 + gaps.nodeGap;

  const trees = forest.roots.map((r) => buildLTree(r, mode, forest, boxes, gaps));

  // Global ranks: every tree shares the rank pitch, so a forest reads as one
  // chart. Stacks contribute their first member's depth size to their own
  // rank; the rest of their extent hangs below (guarded by phantoms).
  const rankSize: number[] = [];
  const eachItem = (item: LItem, fn: (i: LItem) => void) => {
    fn(item);
    for (const c of item.children) eachItem(c, fn);
  };
  for (const t of trees) {
    eachItem(t, (i) => {
      const size =
        i.kind === "node"
          ? depthOf(i.box)
          : i.kind === "stack" && i.members && i.members.length > 0
            ? depthOf((i.members[0] as StackMember).box)
            : 0;
      rankSize[i.rank] = Math.max(rankSize[i.rank] ?? 0, size);
    });
  }
  const rankStart: number[] = [0];
  for (let r = 0; r < rankSize.length; r++) {
    rankStart[r + 1] = (rankStart[r] ?? 0) + (rankSize[r] ?? 0) + gaps.levelGap;
  }

  // Phantom chains: extend each stack's contour down every rank it overlaps.
  for (const t of trees) {
    eachItem(t, (i) => {
      if (i.kind !== "stack") return;
      const bottom = (rankStart[i.rank] ?? 0) + depthOf(i.box);
      let tail = i;
      for (let q = i.rank + 1; q < rankSize.length && (rankStart[q] ?? 0) < bottom - 1e-6; q++) {
        const phantom = makeItem("phantom", null, i.box, q);
        attach(tail, phantom);
        tail = phantom;
      }
    });
  }

  // Tidy pass per tree, then pack the forest along the breadth axis.
  const mapping: LayoutMapping = {};
  const stacked = new Map<string, number>();
  let cursor = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  trees.forEach((t, ti) => {
    firstWalk(t, sep);
    secondWalk(t, -t.prelim);

    let treeMin = Number.POSITIVE_INFINITY;
    let treeMax = Number.NEGATIVE_INFINITY;
    eachItem(t, (i) => {
      if (i.kind === "phantom") return;
      treeMin = Math.min(treeMin, i.x - breadthOf(i.box) / 2);
      treeMax = Math.max(treeMax, i.x + breadthOf(i.box) / 2);
    });
    if (!Number.isFinite(treeMin)) return;
    const offset = (ti === 0 ? 0 : cursor + gaps.treeGap) - treeMin;
    cursor = treeMax + offset;

    const emit = (cx: number, cy: number, box: CardBox, id: string) => {
      mapping[id] = { x: cx, y: cy };
      minX = Math.min(minX, cx - box.width / 2);
      maxX = Math.max(maxX, cx + box.width / 2);
      minY = Math.min(minY, cy - box.height / 2);
      maxY = Math.max(maxY, cy + box.height / 2);
    };

    eachItem(t, (i) => {
      const b = i.x + offset; // breadth-axis centre
      const start = rankStart[i.rank] ?? 0;
      if (i.kind === "node" && i.id !== null) {
        // Cards top-align within their rank (the org-chart convention).
        if (isDown) emit(b, -(start + i.box.height / 2), i.box, i.id);
        else emit(start + i.box.width / 2, -b, i.box, i.id);
      } else if (i.kind === "stack" && i.members) {
        // Members list along the depth axis, indented along the breadth axis
        // from the composite box's leading edge.
        const lead = b - breadthOf(i.box) / 2;
        let along = start;
        for (const m of i.members) {
          stacked.set(m.id, gaps.stackIndent / 2);
          if (isDown) {
            emit(
              lead + m.indent * gaps.stackIndent + m.box.width / 2,
              -(along + m.box.height / 2),
              m.box,
              m.id,
            );
          } else {
            emit(
              start + m.indent * gaps.stackIndent + m.box.width / 2,
              -(lead + (along - start) + m.box.height / 2),
              m.box,
              m.id,
            );
          }
          along += m.box.height + gaps.nodeGap;
        }
      }
    });
  });

  return {
    mapping,
    bboxWidth: Number.isFinite(minX) ? maxX - minX : 0,
    bboxHeight: Number.isFinite(minY) ? maxY - minY : 0,
    stacked,
  };
}

/** Compute org-chart positions for every node of `g`. Returns centres in the
 *  same coordinate convention as the other layouts (y grows upward; deeper
 *  ranks are more negative for `"down"`). */
export function orgLayout(
  g: Graphology,
  options: GraphLayoutOptions["org"] | undefined,
  env: OrgLayoutEnv,
): LayoutMapping {
  if (g.order === 0) return {};

  const gaps: Gaps = {
    levelGap: options?.levelGap ?? ORG_DEFAULTS.levelGap,
    nodeGap: options?.nodeGap ?? ORG_DEFAULTS.nodeGap,
    stackIndent: options?.stackIndent ?? ORG_DEFAULTS.stackIndent,
    treeGap: ORG_DEFAULTS.treeGap,
  };
  const isDown = options?.direction !== "right";
  const forest = extractForest(g, options?.rootId);

  const boxes = new Map<string, CardBox>();
  for (const n of g.nodes()) {
    const m = env.measure(n);
    boxes.set(n, {
      width: Math.max(1, m.width),
      height: Math.max(1, m.height),
    });
  }

  const requested: OrgStack = options?.stack ?? "none";
  const finish = (pass: PassResult): LayoutMapping => {
    env.reportStacks?.(pass.stacked);
    return pass.mapping;
  };

  // Recursion guard: the tidy walks recurse per rank, so a pathological chain
  // (depth > 1000) forces maximal stacking, which flattens the tree to two
  // ranks and lists the rest.
  if (forest.maxDepth > MAX_TIDY_DEPTH) {
    return finish(layoutPass(forest, { depth: 1 }, boxes, gaps, isDown));
  }

  if (requested !== "auto") {
    return finish(layoutPass(forest, requested, boxes, gaps, isDown));
  }

  // Fit-driven: least stacking whose aspect fits the drawable container box.
  if (!env.container) {
    return finish(layoutPass(forest, "leaves", boxes, gaps, isDown));
  }
  const availW = Math.max(1, env.container.width - 2 * STAGE_PADDING);
  const availH = Math.max(1, env.container.height - 2 * STAGE_PADDING);
  const targetAspect = availW / availH;

  const candidates: ResolvedStack[] = ["none", "leaves"];
  const depths: number[] = [];
  for (let d = forest.maxDepth - 1; d >= 1; d--) depths.push(d);
  const budget = MAX_AUTO_PASSES - candidates.length;
  if (depths.length > budget) {
    // Thin the ladder evenly so the widest and tightest depths survive.
    const thinned: number[] = [];
    for (let i = 0; i < budget; i++) {
      const idx = Math.round((i * (depths.length - 1)) / (budget - 1));
      const d = depths[idx];
      if (d !== undefined && !thinned.includes(d)) thinned.push(d);
    }
    depths.length = 0;
    depths.push(...thinned);
  }
  candidates.push(...depths.map((d) => ({ depth: d })));

  let last: PassResult | null = null;
  for (const mode of candidates) {
    last = layoutPass(forest, mode, boxes, gaps, isDown);
    if (last.bboxHeight <= 0 || last.bboxWidth / last.bboxHeight <= targetAspect) {
      return finish(last);
    }
  }
  return finish(last as PassResult);
}
