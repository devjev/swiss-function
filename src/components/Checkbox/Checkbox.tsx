import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof BaseCheckbox.Root> {}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { className, ...rest },
  ref,
) {
  return (
    <BaseCheckbox.Root {...rest} ref={ref} className={mergeClassName(styles.root, className)}>
      <BaseCheckbox.Indicator className={styles.indicator} keepMounted>
        <svg className={cx(styles.icon, styles.iconCheck)} viewBox="0 0 12 12" aria-hidden="true">
          <polyline points="2,6.5 5,9.5 10,3.5" />
        </svg>
        <svg
          className={cx(styles.icon, styles.iconIndeterminate)}
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <line x1="2" y1="6" x2="10" y2="6" />
        </svg>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
});
