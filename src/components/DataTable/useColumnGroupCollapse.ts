import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef, isGroup } from "./types";

interface UseColumnGroupCollapseParams<T> {
  columns: ColumnDef<T>[];
  controlled?: Record<string, boolean>;
  onChange?: (state: Record<string, boolean>) => void;
}

/**
 * Tracks which column groups are collapsed and produces the "effective"
 * column tree where collapsed groups are swapped for a single placeholder leaf.
 *
 * Initial state comes from `defaultCollapsed` on each group def. After that,
 * either internal or controlled state (consumer's `columnGroupsCollapsed`).
 */
export function useColumnGroupCollapse<T>({
  columns,
  controlled,
  onChange,
}: UseColumnGroupCollapseParams<T>) {
  const [internal, setInternal] = useState<Record<string, boolean>>(() => collectDefaults(columns));

  const collapsed = controlled ?? internal;

  // Seed any groups added after first mount with their defaultCollapsed.
  useEffect(() => {
    if (controlled !== undefined) return;
    setInternal((prev) => {
      const next = { ...collectDefaults(columns), ...prev };
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [columns, controlled]);

  const toggle = useCallback(
    (groupId: string) => {
      const next = { ...collapsed, [groupId]: !collapsed[groupId] };
      if (controlled !== undefined) {
        onChange?.(next);
      } else {
        setInternal(next);
        onChange?.(next);
      }
    },
    [collapsed, controlled, onChange],
  );

  const effectiveColumns = useMemo(
    () => buildEffectiveColumns(columns, collapsed),
    [columns, collapsed],
  );

  // Stable version string used to detect structural change.
  const version = useMemo(() => JSON.stringify(collapsed), [collapsed]);

  return { collapsed, toggle, effectiveColumns, version };
}

function collectDefaults<T>(defs: ColumnDef<T>[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const walk = (cols: ColumnDef<T>[]) => {
    for (const c of cols) {
      if (isGroup(c)) {
        if (c.defaultCollapsed) out[c.id] = true;
        walk(c.columns);
      }
    }
  };
  walk(defs);
  return out;
}

/** The synthetic leaf id a collapsed group renders as in the effective tree. */
export function placeholderId(groupId: string): string {
  return `${groupId}::placeholder`;
}

export function buildEffectiveColumns<T>(
  defs: ColumnDef<T>[],
  collapsed: Record<string, boolean>,
): ColumnDef<T>[] {
  return defs.map((def) => {
    if (!isGroup(def)) return def;
    if (collapsed[def.id]) {
      // Collapsed group → single placeholder leaf. Same id so the header still
      // identifies the group and the chevron can re-expand it.
      return {
        id: placeholderId(def.id),
        header: def.header,
        accessor: () => null,
        width: 4,
        align: "center" as const,
        cell: ({ row, rowIndex }) => def.collapsedCell?.({ row: row as T, rowIndex }) ?? "—",
        // Tag so the header renderer knows to draw the (collapsed) chevron and
        // wire its toggle back to the parent group id.
        meta: { collapsedGroupId: def.id },
      } as PlaceholderLeaf<T>;
    }
    return { ...def, columns: buildEffectiveColumns(def.columns, collapsed) };
  });
}

/** Internal-only leaf shape; consumers never see this. */
export type PlaceholderLeaf<T> = import("./types").LeafColumnDef<T> & {
  meta?: { collapsedGroupId: string };
};

export function getCollapsedGroupId<T>(col: ColumnDef<T>): string | undefined {
  if (isGroup(col)) return undefined;
  return (col as PlaceholderLeaf<T>).meta?.collapsedGroupId;
}

/** Leaf ids of a group's whole subtree, in definition order. */
function subtreeLeafIds<T>(defs: ColumnDef<T>[], out: string[] = []): string[] {
  for (const d of defs) {
    if (isGroup(d)) subtreeLeafIds(d.columns, out);
    else out.push(d.id);
  }
  return out;
}

/** Sort `ids` by their position in `prior` (ids absent from `prior` keep their
 *  relative order at the tail), so a group's leaves reappear in the order the
 *  user last gave them. */
function orderIdsBy(ids: string[], prior: string[]): string[] {
  if (prior.length === 0) return ids;
  const pending = new Set(ids);
  const out: string[] = [];
  for (const id of prior) {
    if (pending.has(id)) {
      out.push(id);
      pending.delete(id);
    }
  }
  for (const id of ids) if (pending.has(id)) out.push(id);
  return out;
}

/**
 * Replace each collapsed-group placeholder id in a visible-leaf order with the
 * group's real leaf ids, so the persisted column order (the consumer-facing
 * `onColumnOrderChange` payload) only ever carries real ids. Without this, a
 * reorder while a group is collapsed persists `<groupId>::placeholder` and
 * omits the group's leaves, which then jump to the tail on expand. The leaves'
 * relative order within the group comes from `priorOrder` (the order state
 * before the drag), falling back to definition order. Pure.
 */
export function expandPlaceholderOrder<T>(
  order: string[],
  columns: ColumnDef<T>[],
  priorOrder: string[] = [],
): string[] {
  // Every group's placeholder id → its subtree leaf ids (a placeholder only
  // exists while the group is collapsed, so mapping all groups is harmless).
  const groups = new Map<string, string[]>();
  const walk = (defs: ColumnDef<T>[]) => {
    for (const d of defs) {
      if (isGroup(d)) {
        groups.set(placeholderId(d.id), subtreeLeafIds(d.columns));
        walk(d.columns);
      }
    }
  };
  walk(columns);

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  };
  for (const id of order) {
    const leafIds = groups.get(id);
    if (leafIds) for (const leafId of orderIdsBy(leafIds, priorOrder)) push(leafId);
    else push(id);
  }
  return out;
}

/**
 * Project a real-leaf-id order onto the effective (collapse-applied) tree: the
 * leaf ids of a collapsed group collapse to the group's placeholder id at the
 * first leaf's position (an outermost collapsed ancestor wins over a nested
 * one). The inverse of {@link expandPlaceholderOrder}: together they let the
 * order state hold real ids while a collapsed group still reorders (and stays
 * put) as one placeholder unit. Ids of expanded leaves pass through. Pure.
 */
export function toEffectiveOrder<T>(
  order: string[],
  columns: ColumnDef<T>[],
  collapsed: Record<string, boolean>,
): string[] {
  if (order.length === 0) return order;
  // Real leaf id → owning collapsed group's placeholder id.
  const toPlaceholder = new Map<string, string>();
  const walk = (defs: ColumnDef<T>[], collapsedAncestor: string | null) => {
    for (const d of defs) {
      if (isGroup(d)) {
        walk(d.columns, collapsedAncestor ?? (collapsed[d.id] ? d.id : null));
      } else if (collapsedAncestor) {
        toPlaceholder.set(d.id, placeholderId(collapsedAncestor));
      }
    }
  };
  walk(columns, null);
  if (toPlaceholder.size === 0) return order;

  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const mapped = toPlaceholder.get(id) ?? id;
    if (!seen.has(mapped)) {
      out.push(mapped);
      seen.add(mapped);
    }
  }
  return out;
}
