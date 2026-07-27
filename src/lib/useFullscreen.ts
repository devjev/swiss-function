import { type RefObject, useCallback, useEffect, useState } from "react";

export interface UseFullscreenOptions {
  /** Controlled expanded state. Omit for uncontrolled. */
  expanded?: boolean;
  /** Initial expanded state when uncontrolled. Default `false`. */
  defaultExpanded?: boolean;
  /** Called when the user toggles (button or Escape). */
  onExpandedChange?: (expanded: boolean) => void;
  /** A ref to an element inside the target document. Its `ownerDocument` is
   *  used for the Escape listener and scroll lock, so a chart maximized inside
   *  a `PopOut` window (issue #84) works in that window, not the opener. Omit
   *  to use the global `document`. */
  ownerRef?: RefObject<Element | null>;
}

/** Shared maximize-to-viewport state: tracks expanded (controlled or not), and
 *  while expanded, exits on Escape and locks page scroll. The CSS overlay
 *  (`position: fixed; inset: 0`) is applied by each consumer to its own root. */
export function useFullscreen({
  expanded: controlled,
  defaultExpanded = false,
  onExpandedChange,
  ownerRef,
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
    // The element's document (the popped-out window when inside PopOut), or the
    // global document at the app root.
    const doc = ownerRef?.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    doc.addEventListener("keydown", onKey);
    const prevOverflow = doc.body.style.overflow;
    doc.body.style.overflow = "hidden";
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.body.style.overflow = prevOverflow;
    };
  }, [expanded, setExpanded, ownerRef]);

  const toggle = useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);
  return { expanded, toggle };
}
