import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

/** Measured header needs by id, kept fresh (issue #102). Shared by DataTable
 *  and Explorer, so the rules for *when* a header is re-measured live once.
 *
 *  `measure` reads the rendered header cells and returns `{ id: px }`. It runs
 *  in a layout effect when `deps` change, once more after the webfont has
 *  loaded (the metrics change with it), and when the header `block` is
 *  revealed after being hidden. While the block is hidden (a `display: none`
 *  ancestor: a kept-mounted tab panel, a collapsed shelf) every rect reads 0,
 *  and a need of 0 would silently drop a floor to its declared minimum, so
 *  the measurement is skipped and the last good record kept; a
 *  ResizeObserver on the block re-runs it when the width comes back.
 *
 *  The record is replaced only when a value changed, so anything memoised on
 *  it stays put across renders. */
export function useHeaderNeeds(
  block: RefObject<HTMLElement | null>,
  measure: () => Record<string, number>,
  deps: readonly unknown[],
): Record<string, number> {
  const [needs, setNeeds] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) setTick((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const el = block.current;
    if (!el) return;
    let hidden = el.getBoundingClientRect().width === 0;
    const ro = new ResizeObserver((entries) => {
      const shown = (entries[entries.length - 1]?.contentRect.width ?? 0) > 0;
      if (hidden && shown) setTick((n) => n + 1);
      hidden = !shown;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [block]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `deps` is the caller's list of what changes the measurement; the tick covers the font and the reveal
  useLayoutEffect(() => {
    const el = block.current;
    if (el && el.getBoundingClientRect().width === 0) return;
    const next = measure();
    setNeeds((prev) => {
      const keys = Object.keys(next);
      const same =
        keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
  }, [...deps, tick]);
  return needs;
}
