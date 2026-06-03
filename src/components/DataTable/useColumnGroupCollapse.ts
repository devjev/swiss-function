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
        id: `${def.id}::placeholder`,
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
