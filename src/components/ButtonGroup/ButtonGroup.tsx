import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import type { ButtonSize } from "../Button";
import styles from "./ButtonGroup.module.css";
import { ButtonGroupSizeContext } from "./context";

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Cascade a size to all child Buttons that don't set their own. */
  size?: ButtonSize;
  children?: ReactNode;
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { size, className, children, ...rest },
  ref,
) {
  return (
    <ButtonGroupSizeContext.Provider value={size}>
      {/* biome-ignore lint/a11y/useSemanticElements: <fieldset> imposes form
          semantics that aren't appropriate for a generic button toolbar. */}
      <div {...rest} ref={ref} role="group" className={cx(styles.root, className)}>
        {children}
      </div>
    </ButtonGroupSizeContext.Provider>
  );
});
