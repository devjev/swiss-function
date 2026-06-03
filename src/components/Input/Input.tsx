import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import styles from "./Input.module.css";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends ComponentPropsWithoutRef<typeof BaseInput> {
  /** Visual size of the input. */
  inputSize?: InputSize;
}

const sizeClass: Record<InputSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "md", className, ...rest },
  ref,
) {
  return (
    <BaseInput
      {...rest}
      ref={ref}
      className={mergeClassName(cx(styles.root, sizeClass[inputSize]), className)}
    />
  );
});
