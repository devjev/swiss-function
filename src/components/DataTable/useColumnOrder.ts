import { useCallback, useState } from "react";

interface UseColumnOrderParams {
  /** Controlled column order (leaf column ids). Pass with `onColumnOrderChange`. */
  columnOrder?: string[];
  /** Initial order when uncontrolled (e.g. restored from storage). */
  defaultColumnOrder?: string[];
  /** Fired with the full order array whenever a column is reordered. */
  onColumnOrderChange?: (order: string[]) => void;
}

/**
 * Manages the leaf-column display order. Mirrors `useColumnWidths` /
 * `useTreeExpansion`: internal state unless the consumer passes `columnOrder`
 * (controlled). Either way `onColumnOrderChange` fires on change, so a consumer
 * can persist the order (e.g. to localStorage). An empty array means "natural
 * order" — TanStack falls back to the column definition order.
 */
export function useColumnOrder({
  columnOrder: controlled,
  defaultColumnOrder,
  onColumnOrderChange,
}: UseColumnOrderParams) {
  const [internal, setInternal] = useState<string[]>(defaultColumnOrder ?? []);
  const columnOrder = controlled ?? internal;

  const setColumnOrder = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      if (controlled !== undefined) {
        const next = typeof updater === "function" ? updater(controlled) : updater;
        if (next !== controlled) onColumnOrderChange?.(next);
      } else {
        setInternal((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          if (next !== prev) onColumnOrderChange?.(next);
          return next;
        });
      }
    },
    [controlled, onColumnOrderChange],
  );

  return { columnOrder, setColumnOrder };
}
