import { type RefObject, useLayoutEffect, useState } from "react";

/** The part of `window.visualViewport` read here. */
export interface VisibleViewport {
  offsetTop: number;
  height: number;
  /** The pinch zoom. While the page is zoomed the visible part is smaller for
   *  that reason, not a keyboard's. */
  scale?: number;
}

/** Below this many px of the layout viewport hidden at the bottom, it is a
 *  browser bar settling, not a keyboard. */
const KEYBOARD_MIN_PX = 80;

/** Whether an on-screen keyboard covers part of the window: the visible part
 *  is shorter than the layout viewport (`layoutHeight`, the root element's
 *  client height) by more than a bar's height, and the page is not zoomed.
 *  On a browser that resizes the layout for the keyboard (Chrome on Android
 *  with `interactive-widget=resizes-content`) the layout already fits, and the
 *  answer is false. */
export function keyboardOpen(layoutHeight: number, viewport: VisibleViewport | null | undefined) {
  if (!viewport) return false;
  if ((viewport.scale ?? 1) > 1.01) return false;
  return layoutHeight - viewport.height > KEYBOARD_MIN_PX;
}

/** The px of a box (its top and bottom in layout-viewport coordinates, as
 *  `getBoundingClientRect` gives them) out of sight while an on-screen
 *  keyboard is open: at its top, where the browser panned the page to show a
 *  focused field, and at its bottom, under the keyboard. Both 0 while no
 *  keyboard is open, so a page scrolled the ordinary way is left alone. */
export function hiddenInsets(
  box: { top: number; bottom: number },
  layoutHeight: number,
  viewport: VisibleViewport | null | undefined,
): { top: number; bottom: number; open: boolean } {
  if (!viewport || !keyboardOpen(layoutHeight, viewport)) return { top: 0, bottom: 0, open: false };
  const visibleTop = viewport.offsetTop;
  const visibleBottom = viewport.offsetTop + viewport.height;
  return {
    top: Math.max(0, Math.round(visibleTop - box.top)),
    bottom: Math.max(0, Math.round(box.bottom - visibleBottom)),
    open: true,
  };
}

/** Run `update` now and whenever the visible part of the window may have
 *  changed: the keyboard opening or closing resizes the visual viewport, and
 *  a pan to a focused field scrolls it. */
function watchViewport(update: () => void): () => void {
  const viewport = window.visualViewport;
  update();
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  window.addEventListener("scroll", update, { passive: true });
  return () => {
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    window.removeEventListener("scroll", update);
  };
}

const layoutHeight = () => document.documentElement.clientHeight;

/** Whether an on-screen keyboard covers part of the window, live. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    return watchViewport(() => setOpen(keyboardOpen(layoutHeight(), window.visualViewport)));
  }, []);
  return open;
}

/**
 * The px of an element out of sight while an on-screen keyboard is open, at
 * its top (a pan) and its bottom (under the keyboard), live. A surface that
 * fills the screen pads itself by them, so all of it stays in the visible part:
 * its header in view, its field above the keyboard. Its own box does not
 * change, so the padding does not feed back. `enabled` false skips the work.
 */
export function useVisibleInsets(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
): { top: number; bottom: number; open: boolean } {
  const [insets, setInsets] = useState({ top: 0, bottom: 0, open: false });
  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setInsets((now) => (now.open ? { top: 0, bottom: 0, open: false } : now));
      return;
    }
    return watchViewport(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = hiddenInsets(rect, layoutHeight(), window.visualViewport);
      setInsets((now) =>
        now.top === next.top && now.bottom === next.bottom && now.open === next.open ? now : next,
      );
    });
  }, [ref, enabled]);
  return insets;
}
