import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { EffectName, NoiseParams, RippleParams } from "./fields";
import styles from "./NonIdealState.module.css";
import { createWebglFill, type WebglFill } from "./webglFill";

export type NonIdealStateVariant = "empty" | "no-results" | "error" | "loading";
export type { EffectName };

/** Monospace cell metrics for the dither grid resolution (matches the fill font). */
const FONT_PX = 10;
const LINE_PX = 11;

function measureCell(host: HTMLElement): { cellW: number; cellH: number } {
  const probe = document.createElement("span");
  probe.textContent = "█".repeat(40);
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;left:-9999px;font:${FONT_PX}px var(--sf-font-mono);line-height:${LINE_PX}px;`;
  host.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { cellW: rect.width / 40 || 6, cellH: rect.height || LINE_PX };
}

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
  /** Override the fill effect. Defaults to `ripple` for loading, else `vignette`. */
  effect?: EffectName;
  /** Effect parameters (ripple speed/wavelength/amplitude, noise rate/density/seed). */
  effectOptions?: RippleParams & NoiseParams;
  /** Base fill color — any CSS color (e.g. a token `var(--sf-color-primary)`).
   *  Defaults to a subtle muted token; `error` uses the danger token. */
  color?: string;
  /** Overall fill opacity 0..1. Default 0.7 — the blocks read as a faint
   *  texture; lower it for subtler, raise toward 1 for denser. */
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

const defaultEffect: Record<NonIdealStateVariant, EffectName> = {
  empty: "vignette",
  "no-results": "vignette",
  error: "vignette",
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
    effectOptions,
    color,
    opacity = 0.7,
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
    cellW: 6,
    cellH: LINE_PX,
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

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const { cellW, cellH } = measureCell(el);
      setDims({
        cols: Math.max(1, Math.ceil(r.width / cellW) + 1),
        rows: Math.max(1, Math.ceil(r.height / cellH) + 1),
        cellW,
        cellH,
        w: r.width,
        h: r.height,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      color: readColor(canvas),
      alpha: opacity,
      ...effectOptions,
    };
    const animated = activeEffect !== "vignette";
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!animated || reduced) {
      fill.draw({ ...base, t: 0 });
      return;
    }
    let raf = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      fill.draw({ ...base, t: (now - start) / 1000 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dims, activeEffect, effectOptions, color, opacity]);

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
