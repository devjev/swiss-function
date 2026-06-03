import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Switch.module.css";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof BaseSwitch.Root> {}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, ...rest },
  ref,
) {
  return (
    <BaseSwitch.Root {...rest} ref={ref} className={cx(styles.root, className)}>
      <BaseSwitch.Thumb className={styles.thumb} />
    </BaseSwitch.Root>
  );
});
