import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./Switch.module.css";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof BaseSwitch.Root> {
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, elevation, ...rest },
  ref,
) {
  return (
    <BaseSwitch.Root
      {...rest}
      ref={ref}
      data-elevation={elevation}
      className={mergeClassName(styles.root, className)}
    >
      <BaseSwitch.Thumb className={styles.thumb} />
    </BaseSwitch.Root>
  );
});
