import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  open: boolean;
  /** Bounding rect of the element to attach to (in viewport coords). */
  anchorRect: DOMRect | null;
  children: ReactNode;
}

/**
 * Floating hover tooltip. Positions itself ABOVE the anchor by default;
 * flips below if it would overflow the viewport top. Horizontally clamped
 * to viewport edges with a small margin.
 *
 * Not a Base UI Popover — Popover is click-driven and adds friction for
 * cursor-tracking hover. This is the minimal viable solution: a div with
 * `position: fixed`, repositioned in useLayoutEffect after first paint.
 */
export function Tooltip({ open, anchorRect, children }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // SSR safety — only access window on the client. Re-runs whenever the
  // anchor moves so the tooltip tracks across hovers within one chart.
  useLayoutEffect(() => {
    if (!open || !anchorRect || !ref.current) {
      setPos(null);
      return;
    }
    const margin = 8;
    const tipRect = ref.current.getBoundingClientRect();
    // Default: centered above the anchor.
    let top = anchorRect.top - tipRect.height - margin;
    let left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
    // Flip below if we'd clip the top of the viewport.
    if (top < margin) top = anchorRect.bottom + margin;
    // Clamp horizontally.
    const maxLeft = window.innerWidth - tipRect.width - margin;
    if (left < margin) left = margin;
    if (left > maxLeft) left = maxLeft;
    setPos({ top, left });
  }, [open, anchorRect]);

  // Reset position when closing so the next open recomputes from scratch
  // (without this, a stale `pos` causes a one-frame flash at the old spot).
  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  if (!open || !anchorRect) return null;

  const style: CSSProperties = pos
    ? { top: `${pos.top}px`, left: `${pos.left}px` }
    : // Invisible during the measurement frame: the layout effect positions it
      // pre-paint, and visibility (unlike an off-screen park) can neither
      // flash nor stretch the scrollable area.
      { top: `${anchorRect.top}px`, left: `${anchorRect.left}px`, visibility: "hidden" };

  return (
    <div ref={ref} className={styles.tooltip} style={style} role="tooltip">
      {children}
    </div>
  );
}

/**
 * DOMRect for a plot-space point — the single anchor source shared by the
 * SVG Crosshair (which consumes plot px directly) and this Tooltip (which
 * needs viewport coords). Charts derive both from the same cx/cy, so the
 * two can never disagree, and per-hover getBoundingClientRect calls on
 * individual marks disappear.
 */
export function anchorRectFromPoint(plotEl: Element, x: number, y: number, r = 4): DOMRect {
  const plot = plotEl.getBoundingClientRect();
  return new DOMRect(plot.left + x - r, plot.top + y - r, r * 2, r * 2);
}
