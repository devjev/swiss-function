import type { ButtonHTMLAttributes } from "react";
import { forwardRef, useContext } from "react";
import { cx } from "../../lib/cx";
import { ButtonGroupSizeContext } from "../ButtonGroup/context";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.variantPrimary ?? "",
  secondary: styles.variantSecondary ?? "",
  ghost: styles.variantGhost ?? "",
  danger: styles.variantDanger ?? "",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm ?? "",
  md: styles.sizeMd ?? "",
  lg: styles.sizeLg ?? "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size, className, disabled, type = "button", ...rest },
  ref,
) {
  // Inside a <ButtonGroup size="..."> the group's size cascades — but an
  // explicit `size` prop on this Button always wins.
  const groupSize = useContext(ButtonGroupSizeContext);
  const resolvedSize: ButtonSize = size ?? groupSize ?? "md";
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled}
      data-disabled={disabled || undefined}
      className={cx(styles.root, variantClass[variant], sizeClass[resolvedSize], className)}
    />
  );
});
