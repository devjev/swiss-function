import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Radio.module.css";

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof BaseRadioGroup> {}
export interface RadioProps extends ComponentPropsWithoutRef<typeof BaseRadio.Root> {}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, ...rest },
  ref,
) {
  return <BaseRadioGroup {...rest} ref={ref} className={mergeClassName(styles.group, className)} />;
});

export const Radio = forwardRef<HTMLButtonElement, RadioProps>(function Radio(
  { className, ...rest },
  ref,
) {
  return (
    <BaseRadio.Root {...rest} ref={ref} className={mergeClassName(styles.root, className)}>
      <BaseRadio.Indicator className={styles.indicator} />
    </BaseRadio.Root>
  );
});
