import type { ButtonHTMLAttributes } from "react";
import { forwardRef, useContext, useRef } from "react";
import { cx } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import type { BoxElevation } from "../Box";
import { ButtonGroupSizeContext } from "../ButtonGroup/context";
import styles from "./Button.module.css";
import { useOpticalCentre } from "./opticalCentre";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/** How much of a key the button is. `"sheet"` (default) is the thin key
 *  face: edge bands, a cast, 1px of travel. `"solid"` is the machined key of
 *  the front panel, built like `Knob`: a cap over a visible side wall that
 *  sits away from the light by the key's height, the cast on the wall, the
 *  label engraved, and a press that travels the full height onto the wall. */
export type ButtonBuild = "sheet" | "solid";

/** The machined finish of a solid key's cap: fine brushed lines, or plain. */
export type ButtonFinish = "brushed" | "plain";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Compact horizontal padding (3/16u) plus a 0.25u icon/text gap. The height
   *  still comes from `size`, so a tight button lines up with its non-tight
   *  peers. Composes with `size` (font) and `variant` (colour). Default false. */
  tight?: boolean;
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
  /** The face of the key: `"dish"` (default for the sheet build) is the scoop
   *  of a keycap, `"dome"` a rounded cap (default for the solid build),
   *  `"flat"` no ramp at all. `ghost` is always flat. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`
   *  (1 = the token, 2 doubles it, 0 flattens the face). A solid key reads at
   *  1.5 by default, like `Knob`. */
  curve?: number;
  /** The build of the key. Default `"sheet"`. `ghost` is always a sheet, and a
   *  joined row (`ButtonGroup`) keeps its keys as sheets. */
  build?: ButtonBuild;
  /** The cap finish of a solid key. Default `"brushed"`. */
  finish?: ButtonFinish;
  /** A round key (a power button): a circle of the size's height with no
   *  inline padding, for an icon or a one-letter label. The label is centred
   *  on its own ink (measured: text through canvas metrics, an `Icon` through
   *  its path box), not on its text box. Default false. */
  round?: boolean;
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
    surface,
    curve,
    build = "sheet",
    finish = "brushed",
    round,
    style,
    className,
    disabled,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  // Inside a <ButtonGroup size="..."> the group's size cascades — but an
  // explicit `size` prop on this Button always wins.
  const groupSize = useContext(ButtonGroupSizeContext);
  const resolvedSize: ButtonSize = size ?? groupSize ?? "md";
  const solid = build === "solid" && variant !== "ghost";
  const face =
    variant === "ghost" ? surfaceClass.flat : surfaceClass[surface ?? (solid ? "dome" : "dish")];
  // A round key's label sits on its ink centre, measured at mount.
  const glyphRef = useRef<HTMLSpanElement>(null);
  useOpticalCentre(glyphRef, !!round, [children, resolvedSize]);
  const label = round ? (
    <span ref={glyphRef} className={styles.glyph}>
      {children}
    </span>
  ) : (
    children
  );
  return (
    <button
      {...rest}
      ref={ref}
      style={curveStyle(curve, style)}
      type={type}
      disabled={disabled}
      data-disabled={disabled || undefined}
      data-elevation={elevation}
      data-build={solid ? "solid" : undefined}
      data-finish={solid ? finish : undefined}
      data-round={round || undefined}
      className={cx(
        styles.root,
        variantClass[variant],
        sizeClass[resolvedSize],
        solid ? styles.solid : face,
        tight && styles.tight,
        round && styles.round,
        className,
      )}
    >
      {solid ? <span className={cx(styles.face, face)}>{label}</span> : label}
    </button>
  );
});
