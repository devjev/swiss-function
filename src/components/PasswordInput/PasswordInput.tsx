/** PasswordInput — an `Input` for a password with a monospace show/hide toggle
 *  at its end. Masks by default; the toggle swaps the input between `password`
 *  and `text`. Takes every `Input` prop; the reveal state is internal.
 */

import type { ReactNode } from "react";
import { forwardRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Input, type InputProps } from "../Input";
import styles from "./PasswordInput.module.css";

export interface PasswordInputProps extends Omit<InputProps, "type" | "className"> {
  /** Class for the wrapper; the input inside keeps its own styling. */
  className?: string;
  /** Toggle label while the password is masked. Default `"show"`. */
  showLabel?: ReactNode;
  /** Toggle label while the password is revealed. Default `"hide"`. */
  hideLabel?: ReactNode;
  /** Start revealed. Default `false`. */
  defaultRevealed?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      showLabel = "show",
      hideLabel = "hide",
      defaultRevealed = false,
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const [revealed, setRevealed] = useState(defaultRevealed);
    return (
      <div className={cx(styles.root, className)}>
        <Input
          {...rest}
          ref={ref}
          type={revealed ? "text" : "password"}
          autoComplete={rest.autoComplete ?? "current-password"}
          disabled={disabled}
          className={styles.input}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          aria-label={revealed ? "Hide password" : "Show password"}
          disabled={disabled}
        >
          {revealed ? hideLabel : showLabel}
        </button>
      </div>
    );
  },
);
