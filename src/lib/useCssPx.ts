import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/** Resolve a CSS length (`var(--sf-unit)`, `calc(...)`) to px in the
 *  context of `parent`, through a hidden probe, so JS clamps agree with the
 *  token the CSS uses. Reads layout: call it at measurement time only. */
export function measureCssLength(parent: HTMLElement, value: string): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;width:${value};`;
  parent.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
}

/** One `--sf-unit` in px at the default (compact) density: the value a
 *  component assumes before it has measured the real one. */
export const DEFAULT_UNIT_PX = 20;

/** The default body row of DataTable and Explorer in px at the default
 *  density (`--sf-table-row-height`, 1.25 units). */
export const DEFAULT_TABLE_ROW_PX = 25;

/**
 * Resolve a CSS length (`var(--sf-unit)`, `calc(...)`) to px in the context
 * of `ref`'s element, once, when it mounts. For JS that must agree with a
 * token the CSS reads: a virtualised row height, a scroll step.
 *
 * Returns `fallback` on the first render and, when the measured value
 * differs (a `data-density="comfortable"` region, a themed unit), re-renders
 * with it before paint. The measurement is not repeated: set the density
 * before the subtree mounts, or remount it on a change.
 */
export function useCssPx(
  ref: RefObject<HTMLElement | null>,
  value: string,
  fallback: number,
): number {
  const [px, setPx] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measured = measureCssLength(el, value);
    // A detached or display:none host measures 0: keep the fallback then.
    if (measured > 0) setPx(Math.round(measured * 100) / 100);
  }, [ref, value]);
  return px;
}

/**
 * Drop a virtualizer's cached item sizes when its fixed item size changes.
 * TanStack Virtual caches every item's size from the first `estimateSize`, so
 * a size that arrives after mount (a token measured by `useCssPx` in a
 * comfortable region, a changed `rowHeight` prop) would leave the rows at the
 * old offsets. No-op on mount and while the size holds.
 */
export function useRemeasureOnSizeChange(virtualizer: { measure: () => void }, size: number): void {
  const applied = useRef(size);
  useLayoutEffect(() => {
    if (applied.current === size) return;
    applied.current = size;
    virtualizer.measure();
  }, [size, virtualizer]);
}
