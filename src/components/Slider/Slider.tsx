import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import { resolveMarks, type SliderMarks } from "./Slider.math";
import styles from "./Slider.module.css";

/** Semantic accent colour, mirroring `Progress`/`Chip`. Neutral is the base. */
export type SliderTone = "neutral" | "primary" | "success" | "warning" | "danger";

/** How the filled portion of the track is painted. `"none"` hides it, leaving
 *  just the thumb as a marker (for a gradient/custom track). */
export type SliderFill = "color" | "dither" | "none";

/** A single value, or a `[start, end]` pair for a two-thumb range slider. */
export type SliderValue = number | number[];

export interface SliderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "color" | "defaultValue" | "onChange"> {
  /** Controlled value. An array with two entries makes it a range slider. Keep
   *  the arity (single vs range) stable across renders. */
  value?: SliderValue;
  /** Uncontrolled initial value (single number or `[start, end]`). */
  defaultValue?: SliderValue;
  /** Fired live as the value changes (drag, keyboard, track press). */
  onValueChange?: (value: SliderValue) => void;
  /** Fired once on pointer-up / commit. */
  onValueCommitted?: (value: SliderValue) => void;
  /** Range floor. Default `0`. */
  min?: number;
  /** Range ceiling. Default `100`. */
  max?: number;
  /** Step increment. Default `1`. */
  step?: number;
  /** Step for PageUp/PageDown and Shift+Arrow. Default `10`. */
  largeStep?: number;
  /** Minimum steps between the two thumbs of a range slider. Default `0`. */
  minStepsBetweenValues?: number;
  /** Ignore user interaction. */
  disabled?: boolean;
  /** Track direction. Default `"horizontal"`. A vertical slider has a default
   *  length of `12rem` (override with `--sf-slider-length`). */
  orientation?: "horizontal" | "vertical";
  /** Form field name (submits the value). */
  name?: string;
  /** Id of the form the slider belongs to. */
  form?: string;
  /** Intl formatting for the value bubble / aria text. */
  format?: Intl.NumberFormatOptions;
  /** Locale for `format`. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** How range thumbs behave when they meet. Default `"push"`. */
  thumbCollisionBehavior?: "push" | "swap" | "none";
  /** Track thickness + thumb size on the `--sf-unit` grid. Default `"md"`. */
  size?: "sm" | "md" | "lg";
  /** Semantic accent colour. Default `"primary"`. */
  tone?: SliderTone;
  /** Explicit accent colour (any CSS colour / `--sf-*` token); wins over `tone`. */
  color?: string;
  /** How the filled portion is painted: a solid colour, a static dither
   *  (the house halftone field, as `Progress`), or `"none"` to hide it and
   *  leave the thumb as a marker over a custom `--sf-slider-track-bg`. Default
   *  `"color"`. */
  fill?: SliderFill;
  /** Resting depth of the thumb on the `--sf-elevation-N` scale (as Box/Switch).
   *  Default `2`. */
  elevation?: BoxElevation;
  /** Discrete ticks along the track: `true` for one per step (capped), or an
   *  array of values / `{ value, label }`. */
  marks?: SliderMarks;
  /** The floating value bubble above the active thumb. `"hover"` reveals it on
   *  hover/drag (default), `"always"` pins it, `"off"` hides it. */
  valueLabel?: "hover" | "always" | "off";
  /** Formats the bubble and tick labels. Default: the raw number (or `format`). */
  formatValue?: (value: number) => ReactNode;
}

const sizeClass: Record<NonNullable<SliderProps["size"]>, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * A slider for picking a value (or a `[start, end]` range) along a continuous
 * scale. Wraps Base UI Slider for accessibility (`role="slider"`, the aria value
 * attributes, keyboard control) and dresses it as an instrument-panel fader: a
 * recessed slot with a sharp-cornered accent fill and a square, raised fader-cap
 * thumb. Adds tones, a dither fill, size rungs, ticks, and a value bubble.
 *
 * Drops into `Field` for a labelled row. For a whole form use `Form`/`FormField`.
 */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    value,
    defaultValue,
    onValueChange,
    onValueCommitted,
    min = 0,
    max = 100,
    step = 1,
    largeStep,
    minStepsBetweenValues,
    disabled,
    orientation,
    name,
    form,
    format,
    locale,
    thumbCollisionBehavior,
    size = "md",
    tone = "primary",
    color,
    fill = "color",
    elevation,
    marks,
    valueLabel = "hover",
    formatValue,
    className,
    style,
    ...rest
  },
  ref,
) {
  // How many thumbs: one, unless the value we hold is an array (a range).
  const held = value ?? defaultValue;
  const thumbCount = Array.isArray(held) ? Math.max(held.length, 1) : 1;

  const ticks = resolveMarks(marks, min, max, step);

  const rootStyle = { ...style, "--slider-accent": color } as CSSProperties;

  return (
    <BaseSlider.Root
      {...rest}
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as SliderValue)}
      onValueCommitted={(v) => onValueCommitted?.(v as SliderValue)}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      minStepsBetweenValues={minStepsBetweenValues}
      disabled={disabled}
      orientation={orientation}
      name={name}
      form={form}
      format={format}
      locale={locale}
      thumbCollisionBehavior={thumbCollisionBehavior}
      data-tone={tone === "neutral" ? undefined : tone}
      data-fill={fill}
      data-value-label={valueLabel}
      data-elevation={elevation}
      className={mergeClassName(cx(styles.root, sizeClass[size]), className)}
      style={rootStyle}
    >
      <BaseSlider.Control className={styles.control}>
        <BaseSlider.Track className={styles.track}>
          <BaseSlider.Indicator className={styles.indicator} />
        </BaseSlider.Track>
        {Array.from({ length: thumbCount }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are a fixed positional set
          <BaseSlider.Thumb key={i} index={i} className={styles.thumb}>
            {valueLabel !== "off" && (
              <BaseSlider.Value className={styles.bubble}>
                {(formatted, values) => {
                  const v = values[i];
                  return formatValue && v != null ? formatValue(v) : formatted[i];
                }}
              </BaseSlider.Value>
            )}
          </BaseSlider.Thumb>
        ))}
      </BaseSlider.Control>
      {ticks.length > 0 && (
        <div className={styles.ticks} aria-hidden="true">
          {ticks.map((t) => (
            <div
              key={t.value}
              className={styles.tick}
              style={{ "--pos": t.position } as CSSProperties}
            >
              <span className={styles.tickMark} />
              {t.label != null && <span className={styles.tickLabel}>{t.label}</span>}
            </div>
          ))}
        </div>
      )}
    </BaseSlider.Root>
  );
});
