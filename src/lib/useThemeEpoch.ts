import type { RefObject } from "react";
import { useEffect, useState } from "react";

/**
 * A counter that increments whenever the resolved SF theme changes for `ref`'s
 * subtree — a `[data-theme]` (or `class`) mutation on ANY ancestor, or an OS
 * `prefers-color-scheme` flip.
 *
 * Why it exists: pure CSS/SVG components re-resolve `var(--sf-*)` automatically
 * when a token changes (the cascade does it for free). Canvas/WebGL renderers
 * can't — they read a token once via `token()` and bake it into pixels — so a
 * live light↔dark switch leaves them stale until some other dependency retriggers
 * the draw. Such a renderer adds this epoch to its draw-effect deps to repaint
 * on a theme change. Mirrors the observer `Map` runs for its MapLibre paint.
 *
 * The theme host can be any ancestor (the nearest one wins, re-scoping the
 * tokens), so we watch the whole chain from the element up to the root. A cheap
 * guard — the resolved `--sf-color-bg`/`--sf-color-fg` pair — means an unrelated
 * `class` mutation up the chain doesn't force a needless repaint.
 *
 * `enabled` lets a caller whose canvas mounts conditionally (e.g. the dithered
 * fill, present only when an `effect` is set) start observing once it appears.
 */
export function useThemeEpoch(ref: RefObject<Element | null>, enabled = true): number {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || el == null || typeof window === "undefined") return;

    const signature = () => {
      const s = getComputedStyle(el);
      return `${s.getPropertyValue("--sf-color-bg")}|${s.getPropertyValue("--sf-color-fg")}`;
    };
    let last = signature();
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = signature();
        if (next === last) return;
        last = next;
        setEpoch((e) => e + 1);
      });
    };

    const observer = new MutationObserver(check);
    const opts: MutationObserverInit = {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    };
    for (let node: Element | null = el; node; node = node.parentElement) {
      observer.observe(node, opts);
    }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", check);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      media?.removeEventListener?.("change", check);
    };
  }, [ref, enabled]);

  return epoch;
}
