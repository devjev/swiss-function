import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PlotSize {
  width: number;
  height: number;
}

/** One sizing hook for every 2D chart, replacing the per-chart inline
 *  ResizeObserver effects. Differences from the old idiom, both load-bearing:
 *  the first measure happens synchronously in the ref callback during commit
 *  (the useCollapse pattern), so the `plotSize > 0` render gate passes before
 *  the first browser paint — no blank first frame; and observer updates are
 *  rAF-coalesced with a half-pixel epsilon, so a live resize costs at most
 *  one scales/ticks/downsample recompute per frame and sub-pixel feedback
 *  from the measured y-axis column cannot oscillate. */
export function useMeasuredPlot<E extends HTMLElement = HTMLDivElement>(): {
  ref: (node: E | null) => void;
  plotRef: RefObject<E | null>;
  size: PlotSize;
} {
  const [size, setSize] = useState<PlotSize>({ width: 0, height: 0 });
  const plotRef = useRef<E | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef<PlotSize>({ width: 0, height: 0 });

  const commit = useCallback(() => {
    frameRef.current = null;
    const el = plotRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const last = lastRef.current;
    if (Math.abs(width - last.width) < 0.5 && Math.abs(height - last.height) < 0.5) return;
    lastRef.current = { width, height };
    setSize({ width, height });
  }, []);

  const ref = useCallback(
    (node: E | null) => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      plotRef.current = node;
      if (node && typeof ResizeObserver !== "undefined") {
        commit();
        const ro = new ResizeObserver(() => {
          if (frameRef.current !== null) return;
          frameRef.current = requestAnimationFrame(commit);
        });
        ro.observe(node);
        roRef.current = ro;
      }
    },
    [commit],
  );

  useEffect(
    () => () => {
      roRef.current?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return { ref, plotRef, size };
}
