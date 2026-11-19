import type { BulletId, FlatBullet } from "./types";

/**
 * Block selection over the visible rows.
 *
 * A selection is a run of rows between an anchor and a focus, and a selected
 * block always includes its children (as in Roam and Logseq: a block is its
 * subtree). So the run is widened to the end of every subtree it touches, and
 * the operations act on its roots: the selected rows whose parent is not
 * selected.
 */
export interface BlockSelection {
  /** Every selected visible row. */
  ids: Set<BulletId>;
  /** The selected rows whose parent is not selected, top to bottom. */
  roots: BulletId[];
  /** Flat index of the first and of the last selected row. */
  first: number;
  last: number;
}

/** The last row of `index`'s visible subtree (the row itself when it has none). */
export function subtreeEnd(flat: FlatBullet[], index: number): number {
  const depth = flat[index]?.depth ?? 0;
  let end = index;
  while (end + 1 < flat.length && (flat[end + 1]?.depth ?? 0) > depth) end++;
  return end;
}

/** The row's parent row, or -1 at root level. */
function parentIndex(flat: FlatBullet[], index: number): number {
  const depth = flat[index]?.depth ?? 0;
  for (let i = index - 1; i >= 0; i--) {
    if ((flat[i]?.depth ?? 0) < depth) return i;
  }
  return -1;
}

export function blockSelection(
  flat: FlatBullet[],
  anchor: BulletId,
  focus: BulletId,
): BlockSelection | null {
  const a = flat.findIndex((f) => f.id === anchor);
  const f = flat.findIndex((row) => row.id === focus);
  if (a < 0 || f < 0) return null;
  const first = Math.min(a, f);
  let last = Math.max(a, f);
  for (let i = first; i <= last; i++) last = Math.max(last, subtreeEnd(flat, i));

  const ids = new Set<BulletId>();
  const roots: BulletId[] = [];
  for (let i = first; i <= last; i++) ids.add((flat[i] as FlatBullet).id);
  for (let i = first; i <= last; i = subtreeEnd(flat, i) + 1)
    roots.push((flat[i] as FlatBullet).id);
  return { ids, roots, first, last };
}

/** Shift+Arrow: the focus after one step up (-1) or down (1). Growing downward
 *  steps over the focus block's children (they are selected with it); shrinking
 *  upward lands on the root that holds the row above, so no press is spent
 *  inside a subtree that stays selected. */
export function extendSelection(
  flat: FlatBullet[],
  anchor: BulletId,
  focus: BulletId,
  direction: -1 | 1,
): BulletId {
  const a = flat.findIndex((f) => f.id === anchor);
  const f = flat.findIndex((row) => row.id === focus);
  if (a < 0 || f < 0) return focus;
  let next: number;
  if (direction === 1) {
    next = f >= a ? subtreeEnd(flat, f) + 1 : f + 1;
  } else {
    next = f - 1;
    if (f > a) {
      for (let p = parentIndex(flat, next); p >= a; p = parentIndex(flat, next)) next = p;
    }
  }
  return flat[next]?.id ?? focus;
}
