import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback } from "react";
import { cx } from "../../lib/cx";
import type { EffectName, EffectOptions } from "./effects";
import styles from "./NonIdealState.module.css";
import { DEFAULT_CELL, useDitheredFill } from "./useDitheredFill";

export type NonIdealStateVariant = "empty" | "no-results" | "error" | "loading";
export type { EffectName };

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
  const activeEffect = effect ?? defaultEffect[variant];
  const { rootRef, canvasRef } = useDitheredFill({
    effect: activeEffect,
    speed,
    density,
    effectOptions,
    cellSize,
    color,
    opacity,
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
    [ref, rootRef],
  );

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
