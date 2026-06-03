import { useCallback, useMemo, useRef, useState } from "react";
import type { ExpandedState } from "./types";

interface UseTreeExpansionParams {
  defaultExpanded?: ExpandedState;
  expanded?: Record<string, boolean>;
  onExpandedChange?: (state: Record<string, boolean>) => void;
}

/**
 * Manages expanded state for tree rows. Mirrors our pagination pattern:
 * internal state unless the consumer passes `expanded` (controlled).
 *
 * TanStack accepts either `true` (all expanded) or a record. We normalize
 * to whatever TanStack's `state.expanded` accepts and emit records on change.
 */
export function useTreeExpansion({
  defaultExpanded,
  expanded: controlled,
  onExpandedChange,
}: UseTreeExpansionParams) {
  const [internal, setInternal] = useState<ExpandedState>(defaultExpanded ?? {});

  const expanded = controlled ?? internal;

  // Track structural changes so DataTable can clear selection.
  const versionRef = useRef(0);

  const setExpanded = useCallback(
    (updater: ExpandedState | ((prev: ExpandedState) => ExpandedState)) => {
      const apply = (prev: ExpandedState): Record<string, boolean> => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        return next === true ? {} : next; // TanStack maps `true` internally; we surface records
      };
      versionRef.current += 1;
      if (controlled !== undefined) {
        onExpandedChange?.(apply(controlled));
      } else {
        setInternal((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          onExpandedChange?.(next === true ? {} : next);
          return next;
        });
      }
    },
    [controlled, onExpandedChange],
  );

  const version = useMemo(() => {
    // Version increments whenever expansion changes; DataTable depends on it
    // to clear selection.
    return JSON.stringify(expanded === true ? "ALL" : expanded);
  }, [expanded]);

  return { expanded, setExpanded, version };
}
