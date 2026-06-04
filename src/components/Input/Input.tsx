import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./Input.module.css";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends ComponentPropsWithoutRef<typeof BaseInput> {
  /** Visual size of the input. */
  inputSize?: InputSize;
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
}

const sizeClass: Record<InputSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "md", elevation, className, ...rest },
  ref,
) {
  return (
    <BaseInput
      {...rest}
      ref={ref}
      data-elevation={elevation}
      className={mergeClassName(cx(styles.root, sizeClass[inputSize]), className)}
    />
  );
});
