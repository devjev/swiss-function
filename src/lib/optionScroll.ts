/** Scroll-into-view for the windowed dropdowns (Selector, Picker). Base UI
 *  reports every highlight change through `onItemHighlighted`; only some of
 *  them should move the list, so the rule lives here rather than twice. */

import type { Virtualizer } from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect } from "react";

/** Why the highlight moved, as Base UI's Combobox reports it. */
export type HighlightReason = "keyboard" | "pointer" | "none";

/** Called with a flat item index (what Base UI counts) and the reason. */
export type ScrollToItem = (index: number, reason: HighlightReason) => void;

/**
 * Publish a `scrollToItem` on `ref` that brings the highlighted row into view,
 * for every reason but `"pointer"`.
 *
 * A pointer highlight must never scroll: the row is already under the cursor,
 * and moving the list would slide a different row under the cursor, highlight
 * that one, and scroll again. Before this gate, hovering a row that was clipped
 * at an edge dragged the whole list, which is what made a stray mouse movement
 * over an open dropdown feel like it jumped.
 *
 * `"keyboard"` and `"none"` (opening with a selection, a filter change) both
 * scroll. Base UI scrolls the highlighted element into view itself when it is
 * mounted, and `align: "auto"` makes a second call on a visible row a no-op, so
 * this costs nothing in the ordinary case and is the only thing that brings the
 * row back when a manual scroll has unmounted it.
 *
 * A layout effect, not render, for render purity; child layout effects run
 * before ancestors', so the ref is set before Base UI's open-time highlight
 * needs it.
 *
 * @param itemRowIndex maps a flat item index to its row index (headers shift it).
 */
export function useOptionScroll(
  ref: RefObject<ScrollToItem | null>,
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  itemRowIndex: number[],
): void {
  useLayoutEffect(() => {
    ref.current = (index, reason) => {
      if (reason === "pointer") return;
      // Row 0 for the first item, so a group header above it stays visible.
      const row = index === 0 ? 0 : (itemRowIndex[index] ?? index);
      // A microtask, so the virtualizer measures against the committed DOM.
      queueMicrotask(() => virtualizer.scrollToIndex(row, { align: "auto" }));
    };
    return () => {
      ref.current = null;
    };
  }, [ref, virtualizer, itemRowIndex]);
}
