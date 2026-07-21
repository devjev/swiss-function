import type { CSSProperties } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./ColorPicker.module.css";

export type ColorSwatchSize = "sm" | "md" | "lg";

export interface ColorSwatchProps {
  /** Any CSS colour string. Shown over a checkerboard so alpha reads. */
  color: string;
  /** Swatch size. Default `"md"`. */
  size?: ColorSwatchSize;
  /** Makes the swatch an accessible button (for presets / a popover trigger). */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  "aria-label"?: string;
}

const sizeClass: Record<ColorSwatchSize, string | undefined> = {
  sm: styles.swSm,
  md: styles.swMd,
  lg: styles.swLg,
};

/**
 * A colour chip drawn over a checkerboard (so transparency is visible), with the
 * library's sharp corners. Presentational by default (`role="img"`); pass
 * `onClick` to make it a keyboard-reachable button — e.g. a preset swatch or a
 * `Popover` trigger for a `ColorPicker`.
 */
export const ColorSwatch = forwardRef<HTMLElement, ColorSwatchProps>(function ColorSwatch(
  { color, size = "md", onClick, disabled, className, style, title, "aria-label": ariaLabel },
  ref,
) {
  const s = { ...style, "--swatch-color": color } as CSSProperties;
  const cls = cx(styles.swatch, sizeClass[size], className);
  if (onClick) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cls}
        style={s}
        title={title}
        aria-label={ariaLabel ?? `Colour ${color}`}
      />
    );
  }
  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      role="img"
      className={cls}
      style={s}
      title={title}
      aria-label={ariaLabel ?? `Colour ${color}`}
    />
  );
});
