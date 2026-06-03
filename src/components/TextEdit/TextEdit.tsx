import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./TextEdit.module.css";

export interface TextEditProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const TextEdit = forwardRef<HTMLTextAreaElement, TextEditProps>(function TextEdit(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea {...rest} ref={ref} rows={rows} className={cx(styles.root, className)} />;
});
