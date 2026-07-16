import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./TextEdit.module.css";

export interface TextEditProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Stretch to fill the height of a flexible parent (a `Stack.Fill`, a
   *  definite-height container) and lock to its edge instead of sizing to
   *  `rows`. Drops the manual resize handle, since the parent owns the size.
   *  Issue #74. */
  fill?: boolean;
}

export const TextEdit = forwardRef<HTMLTextAreaElement, TextEditProps>(function TextEdit(
  { className, rows = 3, fill, ...rest },
  ref,
) {
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      data-fill={fill || undefined}
      className={cx(styles.root, className)}
    />
  );
});
