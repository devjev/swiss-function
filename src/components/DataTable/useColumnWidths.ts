import { useCallback, useState } from "react";

type WidthMap = Record<string, number>;

interface UseColumnWidthsParams {
  /** Controlled px overrides (keyed by column id). Pass with `onColumnWidthsChange`. */
  columnWidths?: WidthMap;
  /** Initial px overrides when uncontrolled. */
  defaultColumnWidths?: WidthMap;
  /** Fired with the full override map whenever a column is resized / auto-fit. */
  onColumnWidthsChange?: (widths: WidthMap) => void;
}

/**
 * Manages column-width px overrides. Mirrors the table's expansion/collapse
 * pattern: internal state unless the consumer passes `columnWidths` (controlled).
 * Either way `onColumnWidthsChange` fires on change, so a consumer can persist
 * resized widths (e.g. to localStorage).
 *
 * `setColumnWidths` accepts a value or an updater; updaters that return the
 * previous map unchanged (same reference) don't emit, matching how the resize
 * and auto-fit writers already bail out on no-ops.
 */
export function useColumnWidths({
  columnWidths: controlled,
  defaultColumnWidths,
  onColumnWidthsChange,
}: UseColumnWidthsParams) {
  const [internal, setInternal] = useState<WidthMap>(defaultColumnWidths ?? {});
  const columnWidths = controlled ?? internal;

  const setColumnWidths = useCallback(
    (updater: WidthMap | ((prev: WidthMap) => WidthMap)) => {
      if (controlled !== undefined) {
        const next = typeof updater === "function" ? updater(controlled) : updater;
        if (next !== controlled) onColumnWidthsChange?.(next);
      } else {
        setInternal((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          if (next !== prev) onColumnWidthsChange?.(next);
          return next;
        });
      }
    },
    [controlled, onColumnWidthsChange],
  );

  return { columnWidths, setColumnWidths };
}
