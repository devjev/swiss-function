import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { type SpinnerVariant, useSpinnerFrame } from "../../lib/effects";
import styles from "./Spinner.module.css";

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Which glyph animation to cycle. Default `"braille"`. */
  variant?: SpinnerVariant;
  /** Speed multiplier (2 = twice as fast, 0.5 = half). Default `1`. */
  speed?: number;
  /** Accessible name announced to assistive tech. Default `"Loading…"`. */
  label?: string;
  /** Glyph size; omit to inherit the surrounding font size. */
  size?: "sm" | "md" | "lg";
  /** Glyph color — any CSS color or token (e.g. `"var(--sf-color-primary)"`).
   *  Omit to inherit `currentColor` from the surrounding text. */
  color?: string;
}

const sizeClass: Record<NonNullable<SpinnerProps["size"]>, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * An animated, monospace glyph spinner (CLI-style) for inline "busy" feedback.
 * Cycles a small frame sequence; honors `prefers-reduced-motion` by holding a
 * single static frame. Inherits `currentColor` and (by default) the surrounding
 * font size, so it sits naturally inside text or beside a label.
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { variant = "braille", speed = 1, label = "Loading…", size, color, className, style, ...rest },
  ref,
) {
  const glyph = useSpinnerFrame(variant, speed);
  return (
    <span
      {...rest}
      ref={ref}
      role="status"
      aria-label={label}
      className={cx(styles.root, size && sizeClass[size], className)}
      // `color` prop sets the glyph color; an explicit `style.color` still wins.
      style={{ color, ...style }}
    >
      {glyph}
    </span>
  );
});
