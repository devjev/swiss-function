/** The pinned popover for a frozen chart selection (see `selection.ts`).
 *
 *  It anchors a Base UI `Popover` to a VIRTUAL element built from the chart's
 *  plot element and the mark's plot-space centre; because the chart re-derives
 *  `x`/`y` from the mark's data coordinates every render, the popover tracks
 *  zoom / pan / resize. It dismisses on scroll (Base UI keeps a virtual anchor
 *  viewport-fixed, so following document scroll isn't reliable; closing is the
 *  clean alternative to drifting). Non-modal: it neither traps focus, locks
 *  scroll, nor steals focus on open (`initialFocus={false}`), so the chart stays
 *  interactive underneath. Dismissal (outside press, Escape, scroll, the ✕)
 *  routes through `onClose`, EXCEPT an outside press on THIS chart's own mark,
 *  which the chart handles (move / toggle the pin) — so it doesn't
 *  dismiss-then-reopen. Routing through the house `Popover` seeds the stacking
 *  band, so it clears a Dialog / Fullscreen and follows into a `PopOut` window. */

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { X } from "../../components/Icon";
import { Popover } from "../../components/Popover";
import { Glyph } from "../icons";
import styles from "./SelectionPopover.module.css";
import { anchorRectFromPoint } from "./Tooltip";

export interface SelectionPopoverProps {
  open: boolean;
  /** The chart's plot element — the anchor is measured relative to it live, and
   *  it scopes which marks the popover treats as "this chart's". */
  plotEl: Element | null;
  /** The pinned mark's centre in plot-space px (re-derived by the chart from the
   *  mark's data coordinates through the live scales, so it tracks zoom/pan). */
  x: number | null;
  y: number | null;
  /** Dismissal: outside press, Escape, scroll, or the close button. */
  onClose: () => void;
  children: ReactNode;
}

export function SelectionPopover({ open, plotEl, x, y, onClose, children }: SelectionPopoverProps) {
  // Dismiss on scroll. Base UI positions the popup absolutely and does not
  // follow document scroll for a virtual anchor, so rather than let the popover
  // drift away from its mark, close it when any ancestor scrolls (capture-phase
  // catches nested scroll containers, not just the window) — the common,
  // predictable behavior for a pinned floating panel. Resize is handled by the
  // chart re-rendering (its plot size feeds `x`/`y`), so it repositions in place.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onScroll = () => closeRef.current();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  // The virtual anchor. Its identity changes when the mark's plot-space centre
  // moves (zoom/pan re-render), forcing Base UI to reposition; getBoundingClientRect
  // reads the plot's current viewport rect.
  const anchor = useMemo(() => {
    if (plotEl == null || x == null || y == null) return null;
    return {
      getBoundingClientRect: () => anchorRectFromPoint(plotEl, x, y),
      contextElement: plotEl,
    };
  }, [plotEl, x, y]);

  if (!open || !anchor) return null;

  return (
    <Popover.Root
      open
      onOpenChange={(next, details) => {
        if (next) return;
        // A press on THIS chart's own mark is the chart's to handle (move the
        // pin or toggle it off); cancel the popover's outside-press dismiss there
        // so the mark click owns the gesture. Scoped to `plotEl` so a press on
        // ANOTHER chart's mark still dismisses this popover.
        if (
          details.reason === "outside-press" &&
          details.event.target instanceof Element &&
          plotEl?.contains(details.event.target) &&
          details.event.target.closest("[data-chart-mark]")
        ) {
          details.cancel();
          return;
        }
        onClose();
      }}
      // Non-modal: don't trap focus or lock scroll — the chart stays live.
      modal={false}
    >
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="top" sideOffset={8} align="center">
          {/* initialFocus={false}: opening the pin must not yank keyboard focus
              out of the chart (e.g. its arrow-key mark nav) into the popover. */}
          <Popover.Popup className={styles.popup} initialFocus={false}>
            <button
              type="button"
              className={styles.close}
              aria-label="Dismiss selection"
              onClick={onClose}
            >
              <Glyph slot="close" fallback={X} />
            </button>
            <div className={styles.body}>{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
