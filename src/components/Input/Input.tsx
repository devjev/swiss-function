import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import type { BoxElevation } from "../Box";
import styles from "./Input.module.css";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends ComponentPropsWithoutRef<typeof BaseInput> {
  /** Visual size of the input. */
  inputSize?: InputSize;
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
  /** The floor of the slot: `"flat"` (default) or `"concave"`, a floor
   *  scooped into the page. `"dish"` / `"dome"` are accepted but meant for keys. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`
   *  (1 = the token, 2 doubles it, 0 flattens the face). */
  curve?: number;
}

const sizeClass: Record<InputSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "md", elevation, surface = "flat", curve, style, className, ...rest },
  ref,
) {
  return (
    <BaseInput
      {...rest}
      ref={ref}
      style={curveStyle(curve, style)}
      data-elevation={elevation}
      className={mergeClassName(
        cx(styles.root, sizeClass[inputSize], surfaceClass[surface]),
        className,
      )}
    />
  );
});
