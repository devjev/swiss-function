import type { ButtonHTMLAttributes } from "react";
import { forwardRef, useContext } from "react";
import { cx } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import type { BoxElevation } from "../Box";
import { ButtonGroupSizeContext } from "../ButtonGroup/context";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Compact horizontal padding (3/16u) plus a 0.25u icon/text gap. The height
   *  still comes from `size`, so a tight button lines up with its non-tight
   *  peers. Composes with `size` (font) and `variant` (colour). Default false. */
  tight?: boolean;
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
  /** The face of the key: `"dish"` (default) is the scoop of a keycap, `"dome"`
   *  a rounded cap, `"flat"` no ramp at all. `ghost` is always flat. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`
   *  (1 = the token, 2 doubles it, 0 flattens the face). */
  curve?: number;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.variantPrimary ?? "",
  secondary: styles.variantSecondary ?? "",
  ghost: styles.variantGhost ?? "",
  danger: styles.variantDanger ?? "",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm ?? "",
  md: styles.sizeMd ?? "",
  lg: styles.sizeLg ?? "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size,
    tight,
    elevation,
    surface = "dish",
    curve,
    style,
    className,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  // Inside a <ButtonGroup size="..."> the group's size cascades — but an
  // explicit `size` prop on this Button always wins.
  const groupSize = useContext(ButtonGroupSizeContext);
  const resolvedSize: ButtonSize = size ?? groupSize ?? "md";
  return (
    <button
      {...rest}
      ref={ref}
      style={curveStyle(curve, style)}
      type={type}
      disabled={disabled}
      data-disabled={disabled || undefined}
      data-elevation={elevation}
      className={cx(
        styles.root,
        variantClass[variant],
        sizeClass[resolvedSize],
        variant === "ghost" ? surfaceClass.flat : surfaceClass[surface],
        tight && styles.tight,
        className,
      )}
    />
  );
});
