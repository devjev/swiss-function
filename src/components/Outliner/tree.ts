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
      out.push({ id: b.id, bullet: b, depth, hasChildren, path: cur });
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

/** Outdent: bullet becomes the sibling immediately after its parent.
 *  No-op if already at root level. */
export function outdent(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  if (f.path.length <= 1) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  const parentPath = f.path.slice(0, -1);
  const parentIdx = parentPath[parentPath.length - 1] as number;
  const insertPath: BulletPath = [...parentPath.slice(0, -1), parentIdx + 1];
  return insertAtPath(rest, insertPath, removed);
}

export function moveUp(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const lastIdx = f.path[f.path.length - 1] as number;
  if (lastIdx === 0) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  const insertPath: BulletPath = [...f.path.slice(0, -1), lastIdx - 1];
  return insertAtPath(rest, insertPath, removed);
}

export function moveDown(bullets: OutlinerValue, id: BulletId): OutlinerValue {
  const f = findBullet(bullets, id);
  if (!f) return bullets;
  const lastIdx = f.path[f.path.length - 1] as number;
  const siblingCount = getSiblingsCount(bullets, f.path.slice(0, -1));
  if (lastIdx >= siblingCount - 1) return bullets;
  const { removed, rest } = removeAt(bullets, f.path);
  if (!removed) return bullets;
  const insertPath: BulletPath = [...f.path.slice(0, -1), lastIdx + 1];
  return insertAtPath(rest, insertPath, removed);
}
