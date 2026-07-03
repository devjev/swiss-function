import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useThemeEpoch } from "../useThemeEpoch";
import type { EffectName, EffectOptions } from "./effects";
import { createWebglFill, type WebglFill } from "./webglFill";

/** Default shade-block size in px (square). Smaller = finer dither. */
export const DEFAULT_CELL = 5;

export interface DitheredFillOptions {
  /** Which animated effect drives the per-pixel intensity. */
  effect: EffectName;
  /** Animation speed multiplier. 1 = normal. */
  speed?: number;
  /** Overall coverage. 1 = full range (can reach solid). Default 0.6. */
  density?: number;
  /** Advanced effect tuning (e.g. ripple `wavelength`, `seed`). */
  effectOptions?: EffectOptions;
  /** Shade-block size in px (square). Default `DEFAULT_CELL`. */
  cellSize?: number;
  /** Fill color (any CSS color). When omitted the canvas inherits its CSS color. */
  color?: string;
  /** Overall opacity 0..1. Default 1. */
  opacity?: number;
}

interface Dims {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  w: number;
  h: number;
}

/** Read a CSS color (set on the canvas via a token) as 0..1 RGB. */
function readColor(el: HTMLElement): [number, number, number] {
  const c = getComputedStyle(el).color;
  const m = c.match(/-?\d+\.?\d*/g);
  if (!m || m.length < 3) return [0.42, 0.447, 0.502];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

/**
 * Drives a console-style dithered shade-block fill (WebGL) into a `<canvas>`
 * sized to a container. Handles cell-grid measurement (ResizeObserver), the
 * animation loop, pausing while off-screen (IntersectionObserver) or on a hidden
 * tab, the reduced-motion static frame, and GL teardown.
 *
 * Attach `rootRef` to the measured container and `canvasRef` to the `<canvas>`.
 * Shared by `NonIdealState` and `Skeleton`.
 */
export function useDitheredFill({
  effect,
  speed = 1,
  density = 0.6,
  effectOptions,
  cellSize = DEFAULT_CELL,
  color,
  opacity = 1,
}: DitheredFillOptions) {
  const rootRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fillRef = useRef<WebglFill | null>(null);
  // The fill bakes its token color into WebGL, so a live theme switch won't
  // re-tint it the way CSS would — repaint when the resolved theme changes.
  // Only meaningful when there's a canvas (an `effect` is set).
  const themeEpoch = useThemeEpoch(canvasRef, Boolean(effect));
  const [dims, setDims] = useState<Dims>({
    cols: 0,
    rows: 0,
    cellW: cellSize,
    cellH: cellSize,
    w: 0,
    h: 0,
  });

  // Square cells of `cellSize` px; the grid overfills by one cell and the
  // canvas clips, so the fill always covers every edge.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const cell = Math.max(2, cellSize);
    const measure = () => {
      const r = el.getBoundingClientRect();
      setDims({
        cols: Math.max(1, Math.ceil(r.width / cell) + 1),
        rows: Math.max(1, Math.ceil(r.height / cell) + 1),
        cellW: cell,
        cellH: cell,
        w: r.width,
        h: r.height,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cellSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0) return;
    if (!fillRef.current) fillRef.current = createWebglFill(canvas);
    const fill = fillRef.current;
    if (!fill) return;
    fill.resize(dims.w, dims.h);
    // A `color` arg wins over the CSS token; readColor resolves either to RGB.
    canvas.style.color = color ?? "";
    const base = {
      cols: dims.cols,
      rows: dims.rows,
      cellW: dims.cellW,
      cellH: dims.cellH,
      effect,
      speed,
      density,
      color: readColor(canvas),
      alpha: opacity,
      ...effectOptions,
    };
    // All effects animate; reduced motion draws a single static frame.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      fill.draw({ ...base, t: 0 });
      return;
    }

    // Animated: run only while on-screen and the tab is visible, so the fill
    // never burns CPU/GPU when it can't be seen.
    let raf = 0;
    let start = 0;
    let onScreen = true;
    const loop = (now: number) => {
      if (!start) start = now;
      fill.draw({ ...base, t: (now - start) / 1000 });
      raf = requestAnimationFrame(loop);
    };
    const shouldRun = () => onScreen && !document.hidden;
    const sync = () => {
      if (shouldRun() && !raf) {
        start = 0;
        raf = requestAnimationFrame(loop);
      } else if (!shouldRun() && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver((entries) => {
      onScreen = entries[0]?.isIntersecting ?? true;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [dims, effect, speed, density, effectOptions, color, opacity, themeEpoch]);

  useEffect(() => () => fillRef.current?.destroy(), []);

  return { rootRef, canvasRef };
}
