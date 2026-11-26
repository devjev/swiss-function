import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

/** The scale that makes `need` px of text fit `avail` px: 1 when it already
 *  fits, otherwise the ratio, rounded down to a thousandth (so the result
 *  never lands a fraction of a pixel too wide) and held at `minScale`. */
export function fitScale(avail: number, need: number, minScale: number): number {
  if (!(avail > 0) || !(need > avail)) return 1;
  return Math.max(minScale, Math.floor((avail / need) * 1000) / 1000);
}

/**
 * Shrink one line of text to the width it has. The hook measures the element
 * after every render and whenever its width changes, and sets `--sf-fit` on
 * it: 1 when the text fits, the ratio when it does not, never under
 * `minScale` (below that the element's own overflow rule takes over). The
 * stylesheet applies it, and keeps the line height, so the block's height
 * and the rhythm around it do not move:
 *
 * ```css
 * .value { white-space: nowrap; font-size: calc(var(--size) * var(--sf-fit, 1)); }
 * ```
 *
 * For a figure that must not be cut: a truncated number is a different number.
 * Writes a style property directly, so a fit costs no React render.
 */
export function useFitText<E extends HTMLElement = HTMLElement>(
  minScale = 0.5,
): RefObject<E | null> {
  const ref = useRef<E | null>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Measure at full size: the overflow at the last scale says nothing.
    el.style.setProperty("--sf-fit", "1");
    const scale = fitScale(el.clientWidth, el.scrollWidth, minScale);
    if (scale < 1) el.style.setProperty("--sf-fit", String(scale));
  }, [minScale]);
  // After every render: the text may have changed.
  useLayoutEffect(fit);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);
  return ref;
}
