import { useCallback, useEffect, useState } from "react";

export interface UseFullscreenOptions {
  /** Controlled expanded state. Omit for uncontrolled. */
  expanded?: boolean;
  /** Initial expanded state when uncontrolled. Default `false`. */
  defaultExpanded?: boolean;
  /** Called when the user toggles (button or Escape). */
  onExpandedChange?: (expanded: boolean) => void;
}

/** Shared maximize-to-viewport state: tracks expanded (controlled or not), and
 *  while expanded, exits on Escape and locks page scroll. The CSS overlay
 *  (`position: fixed; inset: 0`) is applied by each consumer to its own root. */
export function useFullscreen({
  expanded: controlled,
  defaultExpanded = false,
  onExpandedChange,
}: UseFullscreenOptions = {}): { expanded: boolean; toggle: () => void } {
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = controlled ?? internal;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setInternal(next);
      onExpandedChange?.(next);
    },
    [controlled, onExpandedChange],
  );

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded, setExpanded]);

  const toggle = useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);
  return { expanded, toggle };
}
