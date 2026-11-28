import { type Ref, useMemo } from "react";
import { mergeRefs } from "./mergeRefs";
import styles from "./topLayer.module.css";

/**
 * The browser's top layer for the library's overlays (issue #83).
 *
 * Every overlay renders through a Base UI portal: a `<div>` appended to the
 * body (or, for an overlay opened inside another, to that overlay's portal).
 * Each portal enters the top layer as it mounts (`popover="manual"` and
 * `showPopover()`), and the top layer stacks by the order elements enter it.
 * So whatever opened last is on top: a menu in a dialog, a dialog opened from
 * a popover, a calendar in a drawer, with no z-index between them. A portal
 * leaves the top layer when it unmounts.
 *
 * `manual` keeps the browser's light dismiss and Escape handling out: Base UI
 * owns dismissal and focus.
 *
 * Without the Popover API (Firefox before 125, Safari before 17) a lifted
 * element gets the same order from a z-index instead: above the whole
 * `--sf-z-*` scale, one higher for each element lifted after it. A portal
 * becomes `position: relative` for its z-index to apply, which leaves its
 * floaters where they were.
 */

/** Put `el` in the top layer, above everything on the page and every
 *  top-layer element already there. Returns whether it is in it. */
export function enterTopLayer(el: HTMLElement): boolean {
  if (typeof el.showPopover !== "function" || !el.isConnected) return false;
  try {
    if (el.matches(":popover-open")) return true;
    if (!el.hasAttribute("popover")) el.setAttribute("popover", "manual");
    el.showPopover();
    return true;
  } catch {
    // A browser that refuses (a detached document, an element that is already
    // a modal dialog) leaves the element where it was, visible.
    el.removeAttribute("popover");
    return false;
  }
}

/** Take `el` out of the top layer. */
export function leaveTopLayer(el: HTMLElement): void {
  if (typeof el.hidePopover !== "function") return;
  try {
    if (el.matches(":popover-open")) el.hidePopover();
  } catch {
    // Already out.
  }
  el.removeAttribute("popover");
}

/** The top of the `--sf-z-*` scale (`--sf-z-tooltip`). Without a top layer,
 *  lifted elements stack from here up, in the order they were lifted. */
const FALLBACK_Z = 1400;
let fallbackOrder = 0;

/** A callback ref that lifts an element into the top layer as it mounts (a
 *  portal, or a bar portalled on its own). Stable, so React calls it once per
 *  element; the element leaves the top layer when it unmounts. */
export function liftPortal(node: HTMLElement | null): void {
  if (!node || enterTopLayer(node)) return;
  if (node.style.zIndex !== "") return;
  const view = node.ownerDocument.defaultView;
  if (view && view.getComputedStyle(node).position === "static") node.style.position = "relative";
  fallbackOrder += 1;
  node.style.zIndex = String(FALLBACK_Z + fallbackOrder);
}

/** The class a portal in the top layer carries. The browser styles a popover
 *  as a centred, bordered, padded box; this makes the portal a zero-size box
 *  at the top left of the viewport, so the floater inside is placed exactly as
 *  it was at the body. */
export const topLayerPortalClass: string = styles.portal ?? "";

/** The class an element lifted where it stands carries (the Outliner's
 *  keyboard bar): it takes the browser's popover look back, and the element's
 *  own rules draw it. */
export const topLayerLiftedClass: string = styles.lifted ?? "";

/** A portal's ref, merged with the one the consumer passed. */
export function useTopLayerPortalRef<T extends HTMLElement>(ref: Ref<T> | undefined) {
  return useMemo(() => (ref ? mergeRefs<T>(ref, liftPortal) : liftPortal), [ref]);
}
