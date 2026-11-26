import { useCallback, useRef, useState } from "react";
import { fitWeekDays, type WeekDayCount } from "./calendarLayout";

export interface WeekDayFit {
  /** Attach to a hidden element one `--sf-unit` wide, a direct child of the
   *  calendar root. Its parent is the element whose width is measured. */
  probeRef: (node: HTMLElement | null) => void;
  /** The day columns that fit the root's width. */
  days: WeekDayCount;
}

/**
 * How many day columns the week view has room for, from the calendar's own
 * width (a ResizeObserver, as `lib/useCollapse`: container width, never the
 * viewport). The width is read in units against a probe that is one unit
 * wide, and the probe is observed too, so a density change re-measures.
 *
 * Starts at seven (the wide form, and what a server render gets). The first
 * measure runs in the ref callback, before paint, so a narrow container never
 * shows the seven-day form first.
 */
export function useWeekDayFit(): WeekDayFit {
  const [days, setDays] = useState<WeekDayCount>(7);
  const observer = useRef<ResizeObserver | null>(null);

  const probeRef = useCallback((probe: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const host = probe?.parentElement;
    if (!probe || !host || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const unit = probe.getBoundingClientRect().width;
      const width = host.getBoundingClientRect().width;
      // A hidden calendar (display: none) measures 0: keep the last answer.
      if (unit > 0 && width > 0) setDays(fitWeekDays(width / unit));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    ro.observe(probe);
    observer.current = ro;
  }, []);

  return { probeRef, days };
}
