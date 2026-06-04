import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./Radio.module.css";

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof BaseRadioGroup> {}
export interface RadioProps extends ComponentPropsWithoutRef<typeof BaseRadio.Root> {
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, ...rest },
  ref,
) {
  return <BaseRadioGroup {...rest} ref={ref} className={mergeClassName(styles.group, className)} />;
});

export const Radio = forwardRef<HTMLButtonElement, RadioProps>(function Radio(
  { className, elevation, ...rest },
  ref,
) {
  return (
    <BaseRadio.Root
      {...rest}
      ref={ref}
      data-elevation={elevation}
      className={mergeClassName(styles.root, className)}
    >
      <BaseRadio.Indicator className={styles.indicator} />
    </BaseRadio.Root>
  );
});
