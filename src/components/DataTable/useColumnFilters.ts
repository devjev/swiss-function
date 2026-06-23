import type { ColumnFiltersState } from "@tanstack/react-table";
import { useCallback, useState } from "react";

interface UseColumnFiltersParams {
  /** Controlled filter state. Pass with `onColumnFiltersChange`. */
  columnFilters?: ColumnFiltersState;
  /** Initial filters when uncontrolled (e.g. restored from storage). */
  defaultColumnFilters?: ColumnFiltersState;
  /** Fired with the full filter array whenever a filter changes. */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
}

/**
 * Manages the active per-column filters. Mirrors `useColumnWidths` /
 * `useColumnOrder`: internal state unless the consumer passes `columnFilters`
 * (controlled). Either way `onColumnFiltersChange` fires on change, so a consumer
 * can persist filters. The value type per entry depends on the column's filter
 * kind — a `string[]` (checklist) or `[number | undefined, number | undefined]`
 * (numeric range).
 */
export function useColumnFilters({
  columnFilters: controlled,
  defaultColumnFilters,
  onColumnFiltersChange,
}: UseColumnFiltersParams) {
  const [internal, setInternal] = useState<ColumnFiltersState>(defaultColumnFilters ?? []);
  const columnFilters = controlled ?? internal;

  const setColumnFilters = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      if (controlled !== undefined) {
        const next = typeof updater === "function" ? updater(controlled) : updater;
        if (next !== controlled) onColumnFiltersChange?.(next);
      } else {
        setInternal((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          if (next !== prev) onColumnFiltersChange?.(next);
          return next;
        });
      }
    },
    [controlled, onColumnFiltersChange],
  );

  return { columnFilters, setColumnFilters };
}
