import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { buildRipple, buildVignette, GAIN, type NonIdealStateVariant } from "./dither";
import styles from "./NonIdealState.module.css";

export type { NonIdealStateVariant };

/** Measure the real monospace cell (width + line height) in the fill's own
 *  font by probing a known run of full blocks. Hardcoded estimates mismatch
 *  the actual glyph metrics and leave the block partly uncovered. */
function measureCell(pre: HTMLElement): { cellW: number; cellH: number } {
  const probe = document.createElement("span");
  probe.textContent = "█".repeat(40);
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;";
  pre.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { cellW: rect.width / 40 || 6, cellH: rect.height || 11 };
}

export interface NonIdealStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Which state this represents — picks the fill weight, tint, and a11y
   *  semantics. Default `"empty"`. */
  variant?: NonIdealStateVariant;
  /** Headline — what's missing / what happened. */
  title?: ReactNode;
  /** Secondary line — what to do about it. */
  description?: ReactNode;
  /** Action slot — typically a `Button`. */
  action?: ReactNode;
  /** Block width. `number` → multiples of `--sf-unit`; `string` → raw CSS.
   *  Default fills the container. */
  width?: number | string;
  /** Block height. `number` → multiples of `--sf-unit`; `string` → raw CSS.
   *  Default `calc(--sf-unit * 14)`. */
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
  loading: styles.loading,
};

/** A non-ideal state — empty, no-results, error, or loading — rendered as a
 *  sizable block continuously filled with console-style dithered shade blocks,
 *  with an informative message in the cleared center. Loading ripples the
 *  fill characters outward. */
export const NonIdealState = forwardRef<HTMLDivElement, NonIdealStateProps>(function NonIdealState(
  { variant = "empty", title, description, action, width, height, className, style, ...rest },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const [dims, setDims] = useState<{ cols: number; rows: number }>({ cols: 0, rows: 0 });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
    [ref],
  );

  // Measure the block → cell grid. Overfill by one cell per axis; the <pre>
  // clips the overflow, so the field always reaches every edge.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const pre = preRef.current;
    if (!el || !pre) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const { cellW, cellH } = measureCell(pre);
      setDims({
        cols: Math.max(1, Math.ceil(r.width / cellW) + 1),
        rows: Math.max(1, Math.ceil(r.height / cellH) + 1),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const animate = variant === "loading";

  // Static fill (every non-loading variant; loading falls back to a single
  // ripple frame under reduced motion — handled in the animation effect).
  useEffect(() => {
    if (animate) return;
    const pre = preRef.current;
    if (pre) pre.textContent = buildVignette(dims.cols, dims.rows, GAIN[variant]);
  }, [animate, variant, dims]);

  // Loading ripple — rewrite the fill characters ~20fps. No React re-render;
  // we write straight to the <pre>. Reduced motion → one static frame.
  useEffect(() => {
    if (!animate) return;
    const pre = preRef.current;
    if (!pre) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      pre.textContent = buildRipple(dims.cols, dims.rows, 0);
      return;
    }
    let raf = 0;
    let t = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= 50) {
        pre.textContent = buildRipple(dims.cols, dims.rows, t);
        t += 0.4;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, dims]);

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
      <pre ref={preRef} aria-hidden="true" data-nis-fill="" className={styles.fill} />
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
