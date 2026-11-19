import type { Bullet, BulletId, BulletPath, FlatBullet, OutlinerValue } from "./types";

// ----------------------------------------------------------------------------
// Lookup
// ----------------------------------------------------------------------------

export function findBullet(
  bullets: OutlinerValue,
  id: BulletId,
): { bullet: Bullet; path: BulletPath } | null {
  const recur = (list: Bullet[], path: BulletPath): { bullet: Bullet; path: BulletPath } | null => {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b) continue;
      const cur = [...path, i];
      if (b.id === id) return { bullet: b, path: cur };
      if (b.children) {
        const found = recur(b.children, cur);
        if (found) return found;
      }
    }
    return null;
  };
  return recur(bullets, []);
}

export function flatVisible(bullets: OutlinerValue): FlatBullet[] {
  const out: FlatBullet[] = [];
  const walk = (list: Bullet[], depth: number, path: BulletPath) => {
    list.forEach((b, i) => {
      const cur = [...path, i];
      const hasChildren = (b.children?.length ?? 0) > 0;
      out.push({
        id: b.id,
        bullet: b,
        depth,
        hasChildren,
        path: cur,
        index: i,
        siblings: list.length,
      });
      if (hasChildren && !b.collapsed) {
        walk(b.children ?? [], depth + 1, cur);
      }
    });
  };
  walk(bullets, 0, []);
  return out;
}

export function getPrevVisible(bullets: OutlinerValue, id: BulletId): BulletId | null {
  const flat = flatVisible(bullets);
  const idx = flat.findIndex((f) => f.id === id);
  return idx > 0 ? (flat[idx - 1]?.id ?? null) : null;
}

export function getNextVisible(bullets: OutlinerValue, id: BulletId): BulletId | null {
  const flat = flatVisible(bullets);
  const idx = flat.findIndex((f) => f.id === id);
  if (idx < 0 || idx >= flat.length - 1) return null;
  return flat[idx + 1]?.id ?? null;
}

// ----------------------------------------------------------------------------
// Low-level path operations (immutable)
// ----------------------------------------------------------------------------

function updateAt(bullets: Bullet[], path: BulletPath, updater: (b: Bullet) => Bullet): Bullet[] {
  if (path.length === 0) return bullets;
  const [head, ...rest] = path;
  return bullets.map((b, i) => {
    if (i !== head) return b;
    if (rest.length === 0) return updater(b);
    return { ...b, children: updateAt(b.children ?? [], rest, updater) };
  });
}

function removeAt(bullets: Bullet[], path: BulletPath): { removed: Bullet | null; rest: Bullet[] } {
  if (path.length === 0) return { removed: null, rest: bullets };
  if (path.length === 1) {
    const [i] = path as [number];
    const removed = bullets[i] ?? null;
    return {
      removed,
      rest: [...bullets.slice(0, i), ...bullets.slice(i + 1)],
    };
  }
  const [head, ...rest] = path;
  const child = bullets[head as number];
  if (!child) return { removed: null, rest: bullets };
  const { removed, rest: newChildren } = removeAt(child.children ?? [], rest);
  return {
    removed,
    rest: bullets.map((b, i) => (i === head ? { ...b, children: newChildren } : b)),
  };
}

/** Insert `bullet` at the position pointed to by `path`. Last index in path is
 *  the insertion index in the containing list. */
function insertAtPath(bullets: Bullet[], path: BulletPath, bullet: Bullet): Bullet[] {
  if (path.length === 0) return bullets;
  if (path.length === 1) {
    const [i] = path as [number];
    return [...bullets.slice(0, i), bullet, ...bullets.slice(i)];
  }
  const [head, ...rest] = path;
  return bullets.map((b, i) =>
    i === head ? { ...b, children: insertAtPath(b.children ?? [], rest, bullet) } : b,
  );
}

function getSiblingsCount(bullets: OutlinerValue, parentPath: BulletPath): number {
  if (parentPath.length === 0) return bullets.length;
  let cursor: Bullet[] = bullets;
  for (let i = 0; i < parentPath.length; i++) {
    const next = cursor[parentPath[i] as number]?.children;
    if (!next) return 0;
    cursor = next;
  }
  return cursor.length;
}

function bulletAt(bullets: OutlinerValue, path: BulletPath): Bullet | null {
  let list: Bullet[] | undefined = bullets;
  let found: Bullet | null = null;
  for (const i of path) {
    found = list?.[i] ?? null;
    if (!found) return null;
    list = found.children;
  }
  return found;
}

// ----------------------------------------------------------------------------
// High-level mutations (all immutable)
// ----------------------------------------------------------------------------

export function updateContent(
  bullets: OutlinerValue,
  id: BulletId,
  content: string,
): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  return updateAt(bullets, f.path, (b) => ({ ...b, content }));
}

export function toggleCollapsed(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  return updateAt(bullets, f.path, (b) => ({ ...b, collapsed: !b.collapsed }));
}

export function setCollapsed(
  bullets: OutlinerValue,
  id: BulletId,
  collapsed: boolean,
): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  return updateAt(bullets, f.path, (b) => ({ ...b, collapsed }));
}

/** Insert `newBullet` as the next sibling of `id`. */
export function insertAfter(
  bullets: OutlinerValue,
  id: BulletId,
  newBullet: Bullet,
): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const lastIdx = f.path[f.path.length - 1] as number;
  const insertPath: BulletPath = [...f.path.slice(0, -1), lastIdx + 1];
  return insertAtPath(bullets, insertPath, newBullet);
}

/** Delete a bullet; promote its children up into its slot. */
export function deleteBullet(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  const children = removed.children ?? [];
  if (children.length === 0) return rest;
  let result = rest;
  let insertPath: BulletPath = [...f.path];
  for (const child of children) {
    result = insertAtPath(result, insertPath, child);
    insertPath = [...insertPath.slice(0, -1), (insertPath[insertPath.length - 1] as number) + 1];
  }
  return result;
}

/** Indent: bullet becomes the last child of the preceding sibling.
 *  No-op if there is no preceding sibling. */
export function indent(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const lastIdx = f.path[f.path.length - 1] as number;
  if (lastIdx === 0) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  const precedingPath: BulletPath = [...f.path.slice(0, -1), lastIdx - 1];
  return updateAt(rest, precedingPath, (sibling) => ({
    ...sibling,
    children: [...(sibling.children ?? []), removed],
    // expand the parent so the newly-indented bullet is visible
    collapsed: false,
  }));
}

/** Outdent: the bullet becomes the sibling right after its parent, and its
 *  following siblings become its children (the Roam and Logseq default), so
 *  no line changes its place on screen. No-op at root level. */
export function outdent(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  if (f.path.length <= 1) return bullets;
  const parentPath = f.path.slice(0, -1);
  const idx = f.path[f.path.length - 1] as number;
  const parent = bulletAt(bullets, parentPath);
  if (!parent) return bullets;
  const siblings = parent.children ?? [];
  const following = siblings.slice(idx + 1);
  const moved: Bullet =
    following.length > 0
      ? { ...f.bullet, children: [...(f.bullet.children ?? []), ...following], collapsed: false }
      : f.bullet;
  const trimmed = updateAt(bullets, parentPath, (p) => ({
    ...p,
    children: siblings.slice(0, idx),
  }));
  const parentIdx = parentPath[parentPath.length - 1] as number;
  return insertAtPath(trimmed, [...parentPath.slice(0, -1), parentIdx + 1], moved);
}

/** Move up among the siblings. At the first sibling the bullet crosses into
 *  the parent's previous sibling, as its last child. */
export function moveUp(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const lastIdx = f.path[f.path.length - 1] as number;
  const parentPath = f.path.slice(0, -1);
  if (lastIdx > 0) {
    const { removed, rest } = removeAt(bullets, f.path);
    if (!removed) return bullets;
    return insertAtPath(rest, [...parentPath, lastIdx - 1], removed);
  }
  const parentIdx = parentPath[parentPath.length - 1];
  if (parentIdx === undefined || parentIdx === 0) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  return updateAt(rest, [...parentPath.slice(0, -1), parentIdx - 1], (uncle) => ({
    ...uncle,
    children: [...(uncle.children ?? []), removed],
    collapsed: false,
  }));
}

/** Move down among the siblings. At the last sibling the bullet crosses into
 *  the parent's next sibling, as its first child. */
export function moveDown(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const lastIdx = f.path[f.path.length - 1] as number;
  const parentPath = f.path.slice(0, -1);
  const siblingCount = getSiblingsCount(bullets, parentPath);
  if (lastIdx < siblingCount - 1) {
    const { removed, rest } = removeAt(bullets, f.path);
    if (!removed) return bullets;
    return insertAtPath(rest, [...parentPath, lastIdx + 1], removed);
  }
  const parentIdx = parentPath[parentPath.length - 1];
  if (parentIdx === undefined) return bullets;
  const unclePath = [...parentPath.slice(0, -1), parentIdx + 1];
  if (!bulletAt(bullets, unclePath)) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  return updateAt(rest, unclePath, (uncle) => ({
    ...uncle,
    children: [removed, ...(uncle.children ?? [])],
    collapsed: false,
  }));
}

// ----------------------------------------------------------------------------
// Editing operations (the caret-driven ones)
// ----------------------------------------------------------------------------

/** Where the caret goes after a structural edit. */
export interface EditResult {
  value: OutlinerValue;
  /** The bullet that holds the caret afterwards. */
  focusId: BulletId;
  /** Caret offset in that bullet's source. */
  offset: number;
}

/** Enter in a bullet whose selection runs from `start` to `end`.
 *
 *  - Caret at 0 of a non-empty bullet: an empty bullet goes in above, the
 *    caret stays where it is.
 *  - An empty, childless, nested last child: it outdents instead.
 *  - Otherwise the bullet splits: it keeps the text before the selection and a
 *    new bullet takes the text after it. The new bullet is the first child
 *    when the bullet shows children, the next sibling otherwise. */
export function splitBullet(
  bullets: OutlinerValue,
  id: BulletId,
  start: number,
  end: number,
  newId: BulletId,
): EditResult | null {
  const f = findBullet(bullets, id);
  if (!f) return null;
  const { content } = f.bullet;
  const hasChildren = (f.bullet.children?.length ?? 0) > 0;

  if (start === 0 && end === 0 && content.length > 0) {
    return {
      value: insertAtPath(bullets, f.path, { id: newId, content: "" }),
      focusId: id,
      offset: 0,
    };
  }

  if (content === "" && !hasChildren && f.path.length > 1) {
    const idx = f.path[f.path.length - 1] as number;
    if (idx === getSiblingsCount(bullets, f.path.slice(0, -1)) - 1) {
      return { value: outdent(bullets, id), focusId: id, offset: 0 };
    }
  }

  const before = content.slice(0, start).trimEnd();
  const after = content.slice(end).trimStart();
  const fresh: Bullet = { id: newId, content: after };
  const kept = updateAt(bullets, f.path, (b) => ({ ...b, content: before }));
  const value =
    hasChildren && !f.bullet.collapsed
      ? updateAt(kept, f.path, (b) => ({ ...b, children: [fresh, ...(b.children ?? [])] }))
      : insertAfter(kept, id, fresh);
  return { value, focusId: newId, offset: 0 };
}

/** Append `sourceId`'s text to `targetId` and remove the source: Backspace at
 *  the start of the source, or Delete at the end of the target. The caret lands
 *  at the join.
 *
 *  A source with children merges only into a childless target that is its
 *  previous sibling, which then adopts them; anything else would move a
 *  subtree to another depth, so it returns null. */
export function mergeInto(
  bullets: OutlinerValue,
  targetId: BulletId,
  sourceId: BulletId,
): EditResult | null {
  if (targetId === sourceId) return null;
  const t = findBullet(bullets, targetId);
  const s = findBullet(bullets, sourceId);
  if (!t || !s) return null;
  const sourceChildren = s.bullet.children ?? [];
  if (sourceChildren.length > 0) {
    const targetChildless = (t.bullet.children?.length ?? 0) === 0;
    const sameParent =
      t.path.length === s.path.length && t.path.slice(0, -1).every((v, i) => v === s.path[i]);
    const adjacent = (t.path[t.path.length - 1] as number) + 1 === s.path[s.path.length - 1];
    if (!targetChildless || !sameParent || !adjacent) return null;
  }
  const offset = t.bullet.content.length;
  const { rest } = removeAt(bullets, s.path);
  const again = findBullet(rest, targetId);
  if (!again) return null;
  const value = updateAt(rest, again.path, (b) => ({
    ...b,
    content: b.content + s.bullet.content,
    ...(sourceChildren.length > 0
      ? { children: sourceChildren, collapsed: s.bullet.collapsed }
      : null),
  }));
  return { value, focusId: targetId, offset };
}

/** The bullet's parent, or null at root level. */
export function getParentId(bullets: OutlinerValue, id: BulletId): BulletId | null {
  const f = findBullet(bullets, id);
  if (!f || f.path.length <= 1) return null;
  return bulletAt(bullets, f.path.slice(0, -1))?.id ?? null;
}

// ----------------------------------------------------------------------------
// Whole-block operations (a selection, the clipboard)
// ----------------------------------------------------------------------------

/** Remove a bullet together with its children. */
export function deleteSubtree(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  return removeAt(bullets, f.path).rest;
}

/** Insert `fresh` as the siblings right after `id`, in order. */
export function insertSiblingsAfter(
  bullets: OutlinerValue,
  id: BulletId,
  fresh: Bullet[],
): OutlinerValue {
  let result = bullets;
  let after = id;
  for (const bullet of fresh) {
    result = insertAfter(result, after, bullet);
    after = bullet.id;
  }
  return result;
}

/** Replace a bullet's text and children (pasting into an empty block). */
export function fillBullet(
  bullets: OutlinerValue,
  id: BulletId,
  content: string,
  children: Bullet[] | undefined,
): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  return updateAt(bullets, f.path, (b) => ({
    ...b,
    content,
    ...(children?.length ? { children, collapsed: false } : null),
  }));
}

// ----------------------------------------------------------------------------
// Zoom, reveal and drag
// ----------------------------------------------------------------------------

/** The bullets from the top level down to `id`, the bullet itself last. Empty
 *  when the id is not in the tree. */
export function pathTo(bullets: OutlinerValue, id: BulletId): Bullet[] {
  const f = findBullet(bullets, id);
  if (!f) return [];
  const out: Bullet[] = [];
  let list: Bullet[] | undefined = bullets;
  for (const i of f.path) {
    const b: Bullet | undefined = list?.[i];
    if (!b) return [];
    out.push(b);
    list = b.children;
  }
  return out;
}

/** Put `next` in the place of the bullet `id`. */
export function replaceBullet(bullets: OutlinerValue, id: BulletId, next: Bullet): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  return updateAt(bullets, f.path, () => next);
}

/** Unfold every ancestor of `id`, so the bullet is on screen. Returns the same
 *  tree when nothing was folded. */
export function expandAncestors(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  let result = bullets;
  for (let depth = 1; depth < f.path.length; depth++) {
    const path = f.path.slice(0, depth);
    if (bulletAt(result, path)?.collapsed) {
      result = updateAt(result, path, (b) => ({ ...b, collapsed: false }));
    }
  }
  return result;
}

/** Insert `fresh` as the first children of `id`, in order, and unfold it. */
export function prependChildren(
  bullets: OutlinerValue,
  id: BulletId,
  fresh: Bullet[],
): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f || fresh.length === 0) return bullets;
  return updateAt(bullets, f.path, (b) => ({
    ...b,
    children: [...fresh, ...(b.children ?? [])],
    collapsed: false,
  }));
}

function sameShape(a: Bullet[], b: Bullet[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return y !== undefined && x.id === y.id && sameShape(x.children ?? [], y.children ?? []);
  });
}

/** Move the bullets `ids` (each with its children, kept in the given order) to
 *  a new place: right after the sibling `afterId`, or, when that is null, to
 *  the front of `parentId`'s children (of the top level when `parentId` is
 *  null too). Returns the same tree when the place is inside what moves, or
 *  when nothing would change. */
export function moveBlocks(
  bullets: OutlinerValue,
  ids: BulletId[],
  parentId: BulletId | null,
  afterId: BulletId | null,
): OutlinerValue {
  const moved: Bullet[] = [];
  for (const id of ids) {
    const found = findBullet(bullets, id)?.bullet;
    if (found) moved.push(found);
  }
  if (moved.length === 0) return bullets;
  const inside = (id: BulletId | null) => id !== null && findBullet(moved, id) !== null;
  if (inside(parentId) || inside(afterId)) return bullets;

  let rest = bullets;
  for (const b of moved) rest = deleteSubtree(rest, b.id);
  let next: OutlinerValue;
  if (afterId !== null) {
    if (!findBullet(rest, afterId)) return bullets;
    next = insertSiblingsAfter(rest, afterId, moved);
  } else if (parentId !== null) {
    if (!findBullet(rest, parentId)) return bullets;
    next = prependChildren(rest, parentId, moved);
  } else {
    next = [...moved, ...rest];
  }
  return sameShape(bullets, next) ? bullets : next;
}
