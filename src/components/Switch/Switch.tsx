import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import type { BoxElevation } from "../Box";
import styles from "./Switch.module.css";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof BaseSwitch.Root> {
  /** A cast below the rail (`--sf-elevation-N`, same scale as Box). Omitted,
   *  the rail sits flush as a slot cut into the panel. */
  elevation?: BoxElevation;
  /** The face of the thumb: `"dome"` (default) a rounded cap, `"dish"` a
   *  scooped one, `"flat"` no ramp. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`
   *  (1 = the token, 2 doubles it, 0 flattens the face). */
  curve?: number;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, elevation, surface = "dome", curve, style, ...rest },
  ref,
) {
  return (
    <BaseSwitch.Root
      {...rest}
      ref={ref}
      style={curveStyle(curve, style)}
      data-elevation={elevation}
      className={mergeClassName(styles.root, className)}
    >
      <BaseSwitch.Thumb className={cx(styles.thumb, surfaceClass[surface])} />
    </BaseSwitch.Root>
  );
});
