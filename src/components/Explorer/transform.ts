import type { ExplorerColumn, ExplorerNode } from "./types";
import { isFolder } from "./types";

/** Raw (unrendered) value a column reads from a node — accessor first, else
 *  `node.meta[col.id]`. Distinct from the display `readCell` (which runs
 *  `render` and stringifies); sort/filter must compare raw values. The tree
 *  column, which shows `node.name`, is handled by the caller (Explorer passes
 *  an explicit `read` closure), not here. */
export function readCellValue<M>(col: ExplorerColumn<M>, node: ExplorerNode<M>): unknown {
  if (col.accessor) return col.accessor(node);
  return (node.meta as Record<string, unknown> | undefined)?.[col.id];
}

// --- Sorting ---------------------------------------------------------------

/** Shared natural-order string comparator ("file2" before "file10"). A single
 *  Intl.Collator resolves locale data once; per-call `localeCompare` with an
 *  options bag re-resolves it on every comparison (~30-50x slower over large
 *  sorts) while producing the identical ordering. */
export const naturalCompare: (a: string, b: string) => number = new Intl.Collator(undefined, {
  numeric: true,
}).compare;

function toTime(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  const t = new Date(v as string | number).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function baseCompare(av: unknown, bv: unknown, sortType?: "string" | "number" | "date"): number {
  if (sortType === "number") return Number(av) - Number(bv);
  if (sortType === "date") return toTime(av) - toTime(bv);
  if (sortType === "string") return naturalCompare(String(av), String(bv));
  // Inference: numbers compare numerically, Dates by time, everything else as
  // natural-ordered strings ("file2" before "file10").
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  if (av instanceof Date && bv instanceof Date) return av.getTime() - bv.getTime();
  return naturalCompare(String(av), String(bv));
}

/** Build an ascending/descending comparator from a value reader. Nullish values
 *  always sort last (applied before the desc flip, so they stay at the bottom in
 *  both directions). */
export function makeComparator<M>(
  read: (node: ExplorerNode<M>) => unknown,
  dir: "asc" | "desc",
  sortType?: "string" | "number" | "date",
): (a: ExplorerNode<M>, b: ExplorerNode<M>) => number {
  return (a, b) => {
    const av = read(a);
    const bv = read(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const base = baseCompare(av, bv, sortType);
    return dir === "desc" ? -base : base;
  };
}

/** Sort each sibling group by `comparator`, recursing into children — hierarchy
 *  is preserved because only siblings reorder. `null` comparator is identity
 *  (no allocation). With `foldersFirst`, folders always precede files within a
 *  group, each partition sorted independently. */
export function sortTree<M>(
  nodes: ExplorerNode<M>[],
  comparator: ((a: ExplorerNode<M>, b: ExplorerNode<M>) => number) | null,
  foldersFirst: boolean,
): ExplorerNode<M>[] {
  if (!comparator) return nodes;
  const sortLevel = (list: ExplorerNode<M>[]): ExplorerNode<M>[] => {
    const recursed = list.map((n) => (n.children ? { ...n, children: sortLevel(n.children) } : n));
    if (foldersFirst) {
      const folders = recursed.filter((n) => isFolder(n)).sort(comparator);
      const files = recursed.filter((n) => !isFolder(n)).sort(comparator);
      return [...folders, ...files];
    }
    return recursed.slice().sort(comparator);
  };
  return sortLevel(nodes);
}

// --- Filtering -------------------------------------------------------------

/** A resolved, active filter: how to read the value and whether it passes. */
export interface ActiveFilter<M> {
  read: (node: ExplorerNode<M>) => unknown;
  test: (value: unknown) => boolean;
}

/** Prune the forest to matches, retaining the ancestor path to every match. A
 *  node that matches all filters is kept with its whole subtree; a non-matching
 *  folder survives only if some descendant matches (with non-matching children
 *  pruned); a non-matching file is dropped. Empty `filters` is identity. */
export function filterTree<M>(
  nodes: ExplorerNode<M>[],
  filters: ActiveFilter<M>[],
): ExplorerNode<M>[] {
  if (filters.length === 0) return nodes;
  const matches = (node: ExplorerNode<M>) => filters.every((f) => f.test(f.read(node)));
  const prune = (node: ExplorerNode<M>): ExplorerNode<M> | null => {
    if (matches(node)) return node; // direct match → keep entire subtree
    if (!node.children) return null; // non-matching file
    const kept = node.children.map(prune).filter((n): n is ExplorerNode<M> => n !== null);
    return kept.length > 0 ? { ...node, children: kept } : null;
  };
  return nodes.map(prune).filter((n): n is ExplorerNode<M> => n !== null);
}

/** Keep-set test for a checklist filter. An empty/undefined allow-list keeps
 *  everything (an inactive filter). */
export function checklistTest(allowed: string[] | undefined): (value: unknown) => boolean {
  if (!allowed || allowed.length === 0) return () => true;
  const set = new Set(allowed);
  return (value) => set.has(String(value));
}

/** Numeric range test; a blank bound is open. Undefined range keeps everything. */
export function rangeTest(
  range: [number | undefined, number | undefined] | undefined,
): (value: unknown) => boolean {
  const [min, max] = range ?? [];
  if (min == null && max == null) return () => true;
  return (value) => {
    const n = Number(value);
    if (min != null && !(n >= min)) return false;
    if (max != null && !(n <= max)) return false;
    return true;
  };
}

/** Every folder id in a (pruned) forest — the set to auto-expand so all retained
 *  matches are revealed. */
export function collectKeptFolderIds<M>(nodes: ExplorerNode<M>[]): Set<string> {
  const out = new Set<string>();
  const walk = (ns: ExplorerNode<M>[]) => {
    for (const n of ns) {
      if (isFolder(n)) {
        out.add(n.id);
        if (n.children) walk(n.children);
      }
    }
  };
  walk(nodes);
  return out;
}
