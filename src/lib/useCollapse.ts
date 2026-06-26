import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface UseCollapseOptions {
  /**
   * Collapse when the observed element is narrower than this.
   * - `number` → multiples of `--sf-unit` (resolved to px at runtime, so a
   *   consumer's `--sf-unit` override is honored).
   * - `string` → any CSS length (e.g. `"40rem"`, `"600px"`).
   * Default `32` (≈768px at the default unit).
   */
  collapseAt?: number | string;
}

export interface UseCollapseResult<E extends HTMLElement = HTMLElement> {
  /** Attach to the element whose width drives the collapse. */
  ref: (node: E | null) => void;
  /** `true` once the element is narrower than `collapseAt`. */
  collapsed: boolean;
}

const DEFAULT_COLLAPSE_AT = 32;

// Resolve a unit-multiple or CSS length to px by measuring a throwaway probe
// *inside* the observed element, so it inherits the consumer's --sf-unit. We
// can't parse getComputedStyle(el)['--sf-unit'] — that returns the raw token
// ("1.5rem"), not px.
function resolveThresholdPx(el: HTMLElement, collapseAt: number | string): number {
  const css = typeof collapseAt === "number" ? `calc(var(--sf-unit) * ${collapseAt})` : collapseAt;
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${css};`;
  el.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  el.removeChild(probe);
  return px;
}

/**
 * Watch an element's width with a ResizeObserver and report whether it has
 * dropped below a threshold — the library's container-width responsiveness
 * primitive (mirrors the ResizeObserver idiom in Grid.tsx). Detection is
 * container-based, not viewport-based, so it works in sidebars/split layouts.
 *
 * SSR-safe: defaults to `collapsed=false` (wide) and guards `ResizeObserver`.
 * The synchronous first measure in the ref callback runs before paint, so a
 * genuinely narrow container never flashes its wide layout.
 */
export function useCollapse<E extends HTMLElement = HTMLElement>({
  collapseAt = DEFAULT_COLLAPSE_AT,
}: UseCollapseOptions = {}): UseCollapseResult<E> {
  const elRef = useRef<E | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Cache the resolved px so we only probe the DOM when collapseAt changes,
  // not on every resize callback.
  const thresholdCache = useRef<{ key: number | string; px: number } | null>(null);

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    let cache = thresholdCache.current;
    if (!cache || cache.key !== collapseAt) {
      cache = { key: collapseAt, px: resolveThresholdPx(el, collapseAt) };
      thresholdCache.current = cache;
    }
    setCollapsed(el.getBoundingClientRect().width < cache.px);
  }, [collapseAt]);

  const ref = useCallback(
    (node: E | null) => {
      elRef.current = node;
      if (node && typeof ResizeObserver !== "undefined") measure();
    },
    [measure],
  );

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, collapsed };
}
