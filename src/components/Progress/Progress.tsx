import { Progress as BaseProgress } from "@base-ui/react/progress";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { type EffectName, type EffectOptions, useDitheredFill } from "../../lib/effects";
import type { BoxElevation } from "../Box";
import styles from "./Progress.module.css";

/** Semantic fill colour, mirroring `Chip`. Neutral is the resting default. */
export type ProgressTone = "neutral" | "primary" | "success" | "warning" | "danger";

/** How the filled portion of the bar is painted. */
export type ProgressFill = "color" | "dither" | "animated";

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  /** Current value. `null` renders an indeterminate (busy) bar. */
  value: number | null;
  /** Range floor. Default `0`. */
  min?: number;
  /** Range ceiling. Default `100`. */
  max?: number;
  /** How the filled portion is painted: a solid colour, a static dither, or an
   *  animated WebGL dither. Default `"color"`. */
  fill?: ProgressFill;
  /** Bar thickness. Unlike the three-rung type scale, this is a geometric
   *  dimension, so it adds an `xs` rung. Default `"md"`. */
  size?: "xs" | "sm" | "md" | "lg";
  /** Semantic fill colour. Default `"primary"`. */
  tone?: ProgressTone;
  /** Explicit fill colour (any CSS colour or `--sf-*` token); wins over `tone`. */
  color?: string;
  /** Track depth on the `--sf-elevation-N` scale (same as Box). Omitted = flat. */
  elevation?: BoxElevation;
  /** Show an inline percentage readout after the bar. Hidden when indeterminate. */
  showValue?: boolean;
  /** Custom readout, given the raw value and `max`. Default `` `${pct}%` ``. */
  formatValue?: (value: number, max: number) => ReactNode;
  /** Animated fill: which effect drives the dither. `fill="animated"` only.
   *  Default `"shimmer"` (an evenly-covered effect that reads on a thin bar). */
  effect?: EffectName;
  /** Animated fill: animation speed multiplier. Default `1`. */
  speed?: number;
  /** Animated fill: coverage 0..1. Default `0.6`. */
  density?: number;
  /** Animated fill: shade-block size in px. Default `3` (finer than the general
   *  default, to give a thin track more vertical rows). */
  cellSize?: number;
  /** Animated fill: advanced effect tuning (e.g. `wavelength`, `seed`). */
  effectOptions?: EffectOptions;
}

const sizeClass: Record<NonNullable<ProgressProps["size"]>, string | undefined> = {
  xs: styles.xs,
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * A progress bar: a determinate 0..100% value, or an indeterminate busy state
 * (`value={null}`). Wraps Base UI Progress for accessibility (`role="progressbar"`
 * and the aria value attributes) and adds three fill treatments (`color`,
 * static `dither`, animated WebGL `dither`), tones, elevation, and four
 * thickness rungs.
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  {
    value,
    min = 0,
    max = 100,
    fill = "color",
    size = "md",
    tone = "primary",
    color,
    elevation,
    showValue = false,
    formatValue,
    effect = "shimmer",
    speed,
    density,
    cellSize = 3,
    effectOptions,
    className,
    style,
    ...rest
  },
  ref,
) {
  const pct =
    value == null || max === min
      ? null
      : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  // The animated fill drives a WebGL dither into a canvas sized to the full
  // track; the track's `--progress-pct` clip reveals it up to the value. The
  // canvas inherits its colour from the track's `--progress-accent`, so a `tone`
  // or `color` tints the effect with no extra wiring. The hook runs
  // unconditionally (Rules of Hooks) but only fetches the ~6KB engine once a
  // canvas is mounted, i.e. only for `fill="animated"` (Skeleton's pattern).
  const { rootRef, canvasRef } = useDitheredFill({
    effect,
    speed,
    density,
    cellSize,
    effectOptions,
  });

  const setTrackRef = (node: HTMLDivElement | null) => {
    if (fill === "animated") rootRef.current = node;
  };

  const rootStyle = {
    ...style,
    "--progress-accent": color,
    "--progress-pct": pct ?? undefined,
  } as CSSProperties;

  return (
    <BaseProgress.Root
      {...rest}
      ref={ref}
      value={value}
      min={min}
      max={max}
      data-tone={tone === "neutral" ? undefined : tone}
      data-fill={fill}
      className={cx(styles.root, sizeClass[size], className)}
      style={rootStyle}
    >
      <BaseProgress.Track ref={setTrackRef} className={styles.track} data-elevation={elevation}>
        {fill === "animated" ? (
          // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative fill canvas, no focusable content
          <canvas ref={canvasRef} aria-hidden="true" className={styles.canvas} />
        ) : (
          <BaseProgress.Indicator className={styles.indicator} />
        )}
      </BaseProgress.Track>
      {showValue && (
        <BaseProgress.Value className={styles.value}>
          {(_formatted, v) =>
            v == null ? null : formatValue ? formatValue(v, max) : `${Math.round(pct ?? 0)}%`
          }
        </BaseProgress.Value>
      )}
    </BaseProgress.Root>
  );
});
