import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { EffectName, EffectOptions } from "./effects";
import styles from "./NonIdealState.module.css";
import { createWebglFill, type WebglFill } from "./webglFill";

export type NonIdealStateVariant = "empty" | "no-results" | "error" | "loading";
export type { EffectName };

/** Default shade-block size in px (square). Smaller = finer dither; the
 *  consumer can override with `cellSize`. */
const DEFAULT_CELL = 5;

export interface NonIdealStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Which state this represents — picks the default effect, tint, and a11y
   *  semantics. Default `"empty"`. */
  variant?: NonIdealStateVariant;
  /** Headline — what's missing / what happened. */
  title?: ReactNode;
  /** Secondary line — what to do about it. */
  description?: ReactNode;
  /** Action slot — typically a `Button`. */
  action?: ReactNode;
  /** Override the fill effect. Each variant has an animated default (see below). */
  effect?: EffectName;
  /** Animation speed multiplier. 1 = normal, 2 = twice as fast, 0.5 = half. */
  speed?: number;
  /** Overall fill density — scales coverage (average + max). 1 = full range
   *  (can reach solid █); lower = sparser. Default 0.6. */
  density?: number;
  /** Advanced effect tuning (ripple `wavelength`, `seed`). */
  effectOptions?: EffectOptions;
  /** Shade-block size in px (square). Default 7. Smaller = finer dither, so
   *  density (coverage) carries more of the look than opacity. */
  cellSize?: number;
  /** Base fill color — any CSS color (e.g. a token `var(--sf-color-primary)`).
   *  Defaults to a subtle muted token; `error` uses the danger token. */
  color?: string;
  /** Overall fill opacity 0..1. Default 0.85 — blocks are fairly solid and the
   *  effect's density (coverage) does the shading; lower it for a fainter wash. */
  opacity?: number;
  /** Block width. `number` → multiples of `--sf-unit`; `string` → raw CSS. */
  width?: number | string;
  /** Block height. `number` → multiples of `--sf-unit`; `string` → raw CSS. */
  height?: number | string;
}

function toSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

const variantClass: Record<NonIdealStateVariant, string | undefined> = {
  empty: undefined,
  "no-results": undefined,
  error: styles.error,
  loading: undefined,
};

// Every variant gets an animated default (no static effects). Non-loading
// states use calmer effects so they don't distract; consumers can override.
const defaultEffect: Record<NonIdealStateVariant, EffectName> = {
  empty: "plasma",
  "no-results": "noise",
  error: "scan",
  loading: "ripple",
};

/** Read a CSS color (set on the canvas via a token) as 0..1 premultipliable RGB. */
function readColor(el: HTMLElement): [number, number, number] {
  const c = getComputedStyle(el).color;
  const m = c.match(/-?\d+\.?\d*/g);
  if (!m || m.length < 3) return [0.42, 0.447, 0.502];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

interface Dims {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  w: number;
  h: number;
}

/** A non-ideal state — empty, no-results, error, or loading — rendered as a
 *  sizable block whose whole area is a console-style dithered shade-block fill
 *  (WebGL), with an informative message in the cleared center. */
export const NonIdealState = forwardRef<HTMLDivElement, NonIdealStateProps>(function NonIdealState(
  {
    variant = "empty",
    title,
    description,
    action,
    effect,
    speed = 1,
    density = 0.6,
    effectOptions,
    cellSize = DEFAULT_CELL,
    color,
    opacity = 1,
    width,
    height,
    className,
    style,
    ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fillRef = useRef<WebglFill | null>(null);
  const [dims, setDims] = useState<Dims>({
    cols: 0,
    rows: 0,
    cellW: cellSize,
    cellH: cellSize,
    w: 0,
    h: 0,
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
    [ref],
  );

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

  const activeEffect = effect ?? defaultEffect[variant];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0) return;
    if (!fillRef.current) fillRef.current = createWebglFill(canvas);
    const fill = fillRef.current;
    if (!fill) return;
    fill.resize(dims.w, dims.h);
    // A `color` prop wins over the CSS token; readColor resolves either to RGB.
    canvas.style.color = color ?? "";
    const base = {
      cols: dims.cols,
      rows: dims.rows,
      cellW: dims.cellW,
      cellH: dims.cellH,
      effect: activeEffect,
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
  }, [dims, activeEffect, speed, density, effectOptions, color, opacity]);

  useEffect(() => () => fillRef.current?.destroy(), []);

  const role = variant === "loading" ? "status" : variant === "error" ? "alert" : undefined;
  const blockStyle: CSSProperties = { ...style };
  const w = toSize(width);
  const h = toSize(height);
  if (w !== undefined) blockStyle.width = w;
  if (h !== undefined) blockStyle.height = h;

  return (
    <div
      ref={setRefs}
      role={role}
      aria-busy={variant === "loading" || undefined}
      data-nis-root=""
      className={cx(styles.root, variantClass[variant], className)}
      style={blockStyle}
      {...rest}
    >
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative empty canvas, no focusable content */}
      <canvas ref={canvasRef} aria-hidden="true" data-nis-fill="" className={styles.fill} />
      {(title != null || description != null || action != null) && (
        <div className={styles.panel}>
          {title != null && <p className={styles.title}>{title}</p>}
          {description != null && <p className={styles.description}>{description}</p>}
          {action != null && <div className={styles.action}>{action}</div>}
        </div>
      )}
    </div>
  );
});
