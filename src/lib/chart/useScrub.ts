/** Long-press scrub for the charts that read a value under the pointer: a
 *  finger that rests on the plot takes the crosshair and the tooltip with it
 *  until it lifts.
 *
 *  A finger has no hover. A tap reads one mark; a drag belongs to the page
 *  (it scrolls) or to a zoomable chart (it pans). The rest tells the three
 *  apart: before `SCRUB_DELAY` the gesture is the browser's or the viewport's,
 *  after it the hook owns the finger and the page stays put.
 *
 *  The hook does not know the chart. It replays the pointer events a mouse
 *  would have produced, on the marks the chart already listens on:
 *
 *    - a chart whose marks carry `data-idx` (Scatterplot, CandlestickChart,
 *      Histogram) gets `pointerover` / `pointerout` on the mark nearest the
 *      finger, the horizontal distance counting most;
 *    - a chart that reads the pointer's position over the plot (HorizonChart)
 *      gets `pointermove`.
 *
 *  The reading stays after the finger lifts, as it does after a tap, and goes
 *  with the next press anywhere. */

import { type RefObject, useEffect } from "react";

/** How long a finger rests before it scrubs, in ms. Shorter than the 500ms
 *  of a context-menu long press: the reading should come first. */
export const SCRUB_DELAY = 300;
/** How far a resting finger may drift, in px. */
export const SCRUB_TOLERANCE = 8;
/** A vertical px counts this much less than a horizontal one when the nearest
 *  mark is picked: a scrub follows the x axis. */
const Y_WEIGHT = 0.25;

/** Marks set on the plot element so the zoom/pan viewport and the scrub stay
 *  out of each other's way (`useViewport` reads and writes the same two). */
export const SCRUBBING_ATTR = "data-scrubbing";
export const PANNING_ATTR = "data-panning";

export interface ScrubTarget {
  x: number;
  y: number;
}

/** Index of the target nearest to `(x, y)`, the horizontal distance counting
 *  most; `-1` for no targets. */
export function nearestTarget(targets: readonly ScrubTarget[], x: number, y: number): number {
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i] as ScrubTarget;
    const dx = t.x - x;
    const dy = (t.y - y) * Y_WEIGHT;
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
}

/** Attach the scrub to `plotRef`'s element. Inert while `enabled` is false. */
export function useScrub(plotRef: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = plotRef.current;
    if (!el || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number } | null = null;
    let scrubbing = false;
    let marks: Element[] = [];
    let centers: ScrubTarget[] = [];
    let current: Element | null = null;
    /** The mark left lit after the finger lifted. */
    let lingering: Element | null = null;
    let swallowClickUntil = 0;

    const clearTimer = () => {
      if (timer != null) clearTimeout(timer);
      timer = null;
    };
    const release = (target: Element | null) => {
      target?.dispatchEvent(pointer("pointerout", 0, 0));
    };
    const update = (x: number, y: number) => {
      if (marks.length === 0) {
        // A chart that reads the position over its plot.
        const under = document.elementFromPoint(x, y);
        const target = under && el.contains(under) ? under : el;
        target.dispatchEvent(pointer("pointermove", x, y));
        current = el;
        return;
      }
      const next = marks[nearestTarget(centers, x, y)] ?? null;
      if (next === current) return;
      release(current);
      current = next;
      next?.dispatchEvent(pointer("pointerover", x, y));
    };
    const begin = () => {
      timer = null;
      // The viewport already took the finger for a pan.
      if (!start || el.hasAttribute(PANNING_ATTR)) return;
      scrubbing = true;
      el.setAttribute(SCRUBBING_ATTR, "");
      release(lingering);
      lingering = null;
      marks = [...el.querySelectorAll("[data-idx]")];
      centers = marks.map((mark) => {
        const r = mark.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      update(start.x, start.y);
    };
    const end = () => {
      clearTimer();
      start = null;
      if (!scrubbing) return;
      scrubbing = false;
      el.removeAttribute(SCRUBBING_ATTR);
      lingering = current;
      current = null;
      marks = [];
      centers = [];
      // The lift of a rested finger must not also activate the mark under it.
      swallowClickUntil = performance.now() + 400;
    };

    const onTouchStart = (e: TouchEvent) => {
      end();
      const touch = e.touches[0];
      const onChrome =
        e.target instanceof Element && e.target.closest("button, [role='toolbar'], input");
      if (e.touches.length !== 1 || !touch || onChrome) return;
      start = { x: touch.clientX, y: touch.clientY };
      timer = setTimeout(begin, SCRUB_DELAY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !start) return;
      if (scrubbing) {
        // The finger is the crosshair now: the page must not scroll under it.
        if (e.cancelable) e.preventDefault();
        update(touch.clientX, touch.clientY);
        return;
      }
      if (
        e.touches.length > 1 ||
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > SCRUB_TOLERANCE
      ) {
        clearTimer();
        start = null;
      }
    };
    const onClick = (e: MouseEvent) => {
      if (performance.now() > swallowClickUntil) return;
      swallowClickUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };
    const onContextMenu = (e: Event) => {
      if (scrubbing) e.preventDefault();
    };
    // The next press anywhere ends a reading left on screen.
    const onDocPointerDown = (e: PointerEvent) => {
      if (!lingering || !e.isTrusted) return;
      release(lingering);
      lingering = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("click", onClick, true);
    el.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => {
      end();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  }, [plotRef, enabled]);
}
