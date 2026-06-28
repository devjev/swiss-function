import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface UseOverflowOptions {
  /** When false the hook is inert (no observers, everything reported visible). */
  enabled?: boolean;
}

export interface UseOverflowResult<E extends HTMLElement = HTMLElement> {
  /** Attach to the real bar — its content width is the budget. */
  rootRef: React.RefObject<E | null>;
  /**
   * Attach to a hidden, full-width clone of the bar holding *all* collapsible
   * items. Each item element must carry `data-overflow-item`; an off-flow clone
   * of the overflow trigger must carry `data-overflow-trigger`.
   */
  ghostRef: React.RefObject<HTMLDivElement | null>;
  /**
   * How many leading items fit inline. `Infinity` until first measure (SSR-safe:
   * render everything inline, never flash a collapsed bar wider than needed).
   */
  visibleCount: number;
}

function px(el: Element, prop: string): number {
  return Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

/**
 * Progressive ("priority-plus") overflow: report how many leading items fit in a
 * container, so the rest can fold into an overflow menu. Container-width based
 * via ResizeObserver (same idiom as `useCollapse`/`Grid.tsx`), so it works in
 * sidebars and split panes.
 *
 * Measurement reads a hidden ghost row rather than caching intrinsic widths,
 * because some items (e.g. a `clamp(…, vw, …)` search field) have a width that
 * changes with the viewport — a cache would go stale. The ghost gives correct
 * live widths every pass, making the cut a single deterministic computation.
 *
 * SSR-safe: defaults to `Infinity` (all inline) and guards `ResizeObserver`.
 */
export function useOverflow<E extends HTMLElement = HTMLElement>({
  enabled = true,
}: UseOverflowOptions = {}): UseOverflowResult<E> {
  const rootRef = useRef<E | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);

  const measure = useCallback(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;

    const items = Array.from(ghost.querySelectorAll<HTMLElement>("[data-overflow-item]"));
    if (items.length === 0) {
      setVisibleCount((prev) => (prev === 0 ? prev : 0));
      return;
    }

    // The ghost mirrors the real bar (same width, padding, gap), so geometry read
    // here matches what the inline row would do.
    const ghostRect = ghost.getBoundingClientRect();
    const rightEdge = ghostRect.right - px(ghost, "padding-right");
    const lastItem = items[items.length - 1];
    if (!lastItem) return;
    const lastRight = lastItem.getBoundingClientRect().right;

    let count: number;
    // Fudge a sub-pixel slack so rounding never spuriously folds a fitting item.
    if (lastRight <= rightEdge + 0.5) {
      count = items.length;
    } else {
      const trigger = ghost.querySelector<HTMLElement>("[data-overflow-trigger]");
      const triggerWidth = trigger ? trigger.getBoundingClientRect().width : 0;
      const gap = px(ghost, "column-gap");
      const limit = rightEdge - triggerWidth - gap;
      count = items.filter((el) => el.getBoundingClientRect().right <= limit + 0.5).length;
    }
    setVisibleCount((prev) => (prev === count ? prev : count));
  }, []);

  // Observe container-width changes (set up once; `measure` is stable).
  useLayoutEffect(() => {
    if (!enabled) {
      setVisibleCount((prev) =>
        prev === Number.POSITIVE_INFINITY ? prev : Number.POSITIVE_INFINITY,
      );
      return;
    }
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [enabled, measure]);

  // Re-measure after every commit so adding/removing items (which doesn't resize
  // the container) is still picked up. `measure` only sets state when the count
  // actually changes, so this can't loop.
  useLayoutEffect(() => {
    if (enabled) measure();
  });

  return { rootRef, ghostRef, visibleCount };
}
