import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatColumnWidth, READOUT_FADE_MS, READOUT_HOLD_MS } from "./resizeBoundary";
import styles from "./WidthReadout.module.css";

/** What the readout shows: the column, its width, and whether the gesture
 *  is stopped at a floor or a cap. `leaving` is the fade. */
export interface WidthReadoutState {
  id: string;
  px: number;
  atFloor: boolean;
  atCap: boolean;
  leaving: boolean;
}

/** The width readout's state and its two verbs (issue #102). A mono chip
 *  under the handle while a column is dragged or keyed: unit multiples and
 *  px, "min" at the floor (the one place a stopped drag is explained). Held
 *  briefly after a keyboard step, faded after a drag.
 *
 *  The chip enters one frame after the resize commit. Inserting an element
 *  in the same commit as the template change makes Chromium's style recalc
 *  of the rows several times slower (a step went from 8 to 16ms, measured);
 *  a frame later the new width has painted and the chip's own recalc has
 *  the frame to itself. During a drag each move lands a frame late, and a
 *  held step shows within 16ms: neither reads as a delay. */
export function useWidthReadout() {
  const [readout, setReadout] = useState<WidthReadoutState | null>(null);
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (frame.current != null) {
      window.cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  };
  const hideReadout = useCallback(() => {
    clear();
    setReadout((r) => (r && !r.leaving ? { ...r, leaving: true } : r));
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setReadout(null);
    }, READOUT_FADE_MS);
  }, []);
  const showReadout = useCallback(
    (id: string, px: number, atFloor: boolean, hold: boolean, atCap = false) => {
      clear();
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        setReadout({ id, px: Math.round(px), atFloor, atCap, leaving: false });
        if (hold) timer.current = window.setTimeout(hideReadout, READOUT_HOLD_MS);
      });
    },
    [hideReadout],
  );
  useEffect(() => clear, []);
  return { readout, showReadout, hideReadout };
}

/** The chip itself, rendered inside the header cell of column `id` (which
 *  is `position: relative`) and only while the readout names that column. */
export function WidthReadout({
  readout,
  id,
  unitPx,
}: {
  readout: WidthReadoutState | null;
  id: string;
  unitPx: number | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = readout?.id === id;
  const px = readout?.px;
  // The chip hangs from the handle's edge; on a column narrower than the
  // chip it would spill past the column's start and be clipped by the
  // table's edge, so it flips to hang from the start and spill over the
  // neighbours instead. One rect read per shown width, before paint.
  useLayoutEffect(() => {
    const el = ref.current;
    const cell = el?.parentElement;
    if (!el || !cell) return;
    delete el.dataset.fromStart;
    if (el.getBoundingClientRect().left < cell.getBoundingClientRect().left - 0.5) {
      el.dataset.fromStart = "";
    }
  }, [shown, px]);
  if (!shown || !readout) return null;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-width-readout=""
      className={styles.readout}
      data-at-floor={readout.atFloor || undefined}
      data-at-cap={readout.atCap || undefined}
      data-leaving={readout.leaving || undefined}
    >
      {formatColumnWidth(readout.px, unitPx, readout.atFloor, readout.atCap)}
    </span>
  );
}
