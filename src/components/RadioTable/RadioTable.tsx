/** RadioTable — a bordered, hairline-divided table of radio options, each a
 *  radio + label + description. The description sits to the right of the label
 *  on a wide container and drops below it when narrow (the VerticalForm.Field
 *  responsive pattern, tighter), so the whole thing reads as one coherent
 *  "pick one" table (plan pickers, settings).
 *
 *  Built on the RadioGroup / Radio primitives, which supply single selection,
 *  roving arrow-key navigation and the radiogroup/radio roles.
 */

import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { Radio } from "../Radio";
import styles from "./RadioTable.module.css";

export type RadioTableProps = ComponentPropsWithoutRef<typeof BaseRadioGroup>;

const Root = forwardRef<HTMLDivElement, RadioTableProps>(function RadioTable(
  { className, ...rest },
  ref,
) {
  // The wrapper carries the size-query container; the RadioGroup is the grid.
  // (container-type on the grid that owns the max-content label track zeroes it.)
  return (
    <div className={styles.root}>
      <BaseRadioGroup {...rest} ref={ref} className={mergeClassName(styles.table, className)} />
    </div>
  );
});

export interface RadioTableOptionProps extends Omit<HTMLAttributes<HTMLLabelElement>, "onChange"> {
  /** The value selected when this option is chosen. */
  value: string;
  /** The option's title. Also the radio's accessible name. */
  label: ReactNode;
  /** Supplementary copy (full-strength fg, never grey). Right of the label on a
   *  wide row, below it when narrow. */
  description?: ReactNode;
  /** Disable just this option. */
  disabled?: boolean;
}

const Option = forwardRef<HTMLLabelElement, RadioTableOptionProps>(function RadioTableOption(
  { value, label, description, disabled, className, ...rest },
  ref,
) {
  const base = useId();
  const radioId = `${base}-r`;
  const labelId = `${base}-l`;
  const descId = `${base}-d`;
  return (
    // A <button> is a labelable element, so the whole row is the click target
    // (Radio.stories' pattern). aria-labelledby scopes the accessible name to
    // the title; aria-describedby adds the description.
    // biome-ignore lint/a11y/noLabelWithoutControl: the label wraps its Radio control (htmlFor + nested)
    <label
      {...rest}
      ref={ref}
      htmlFor={radioId}
      className={cx(styles.option, description != null && styles.hasDescription, className)}
      data-disabled={disabled || undefined}
    >
      <Radio
        id={radioId}
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={description != null ? descId : undefined}
        className={styles.radio}
      />
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      {description != null ? (
        <span id={descId} className={styles.description}>
          {description}
        </span>
      ) : null}
    </label>
  );
});

export const RadioTable = Object.assign(Root, { Option });
