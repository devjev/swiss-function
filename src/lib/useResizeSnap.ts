/** Snap a resizable control (a `resize`-able descendant, e.g. TextEdit's
 *  textarea) to whole `--sf-unit` heights, so a form's rows stay on the unit
 *  grid (issue #33). On mount it snaps the control's current height to the
 *  nearest whole unit (a 4-row TextEdit paints at 4.5u — half a unit off the
 *  grid — because of its deliberate single-line-1.5u padding contract); after
 *  a user drag it snaps again once the resize settles.
 *
 *  Two correctness details the app learned the hard way:
 *   - The unit is read LIVE off the element's line-height (which is exactly
 *     1u) at measure time and written back as a `calc()` string, never
 *     assuming 1.5rem — so a token drift can't turn the snap into a
 *     self-amplifying grow/shrink loop.
 *   - The ResizeObserver's spec-mandated initial notification is skipped, so
 *     mounting doesn't look like a user resize.
 *
 *  Inert when the wrapper has no resizable descendant. */

import { type RefObject, useEffect } from "react";

const SETTLE_MS = 100;

export function useResizeSnap(wrapperRef: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // The resizable target: the first descendant the browser will let the user
    // drag (computed `resize` isn't `none`).
    let target: HTMLElement | null = null;
    for (const el of wrapper.querySelectorAll<HTMLElement>("textarea")) {
      if (getComputedStyle(el).resize !== "none") {
        target = el;
        break;
      }
    }
    if (!target) return;
    const el = target;

    const unitPx = () => {
      const lh = Number.parseFloat(getComputedStyle(el).lineHeight);
      return Number.isFinite(lh) && lh > 0 ? lh : 24;
    };
    const snap = () => {
      const units = Math.max(1, Math.round(el.getBoundingClientRect().height / unitPx()));
      el.style.height = `calc(${units} * var(--sf-unit))`;
    };

    snap(); // whole-unit default height on first paint

    let first = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false; // skip the spec-mandated initial notification
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(snap, SETTLE_MS); // snap once the drag settles
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [wrapperRef, enabled]);
}
