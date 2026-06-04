import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { forwardRef, useContext } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { ButtonSize } from "../Button";
import { ButtonGroupSizeContext } from "../ButtonGroup/context";
import styles from "./ToggleGroup.module.css";

interface ToggleGroupRootProps extends ComponentPropsWithoutRef<typeof BaseToggleGroup> {
  /** Cascade a size to all items. */
  size?: ButtonSize;
  children?: ReactNode;
}

const Root = forwardRef<HTMLDivElement, ToggleGroupRootProps>(function ToggleGroupRoot(
  { size, className, children, ...rest },
  ref,
) {
  return (
    <ButtonGroupSizeContext.Provider value={size}>
      <BaseToggleGroup {...rest} ref={ref} className={mergeClassName(styles.root, className)}>
        {children}
      </BaseToggleGroup>
    </ButtonGroupSizeContext.Provider>
  );
});

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

interface ToggleGroupItemProps extends ComponentPropsWithoutRef<typeof BaseToggle> {
  value: string;
}

const Item = forwardRef<HTMLButtonElement, ToggleGroupItemProps>(function ToggleGroupItem(
  { className, ...rest },
  ref,
) {
  const groupSize = useContext(ButtonGroupSizeContext) ?? "md";
  return (
    <BaseToggle
      {...rest}
      ref={ref}
      className={mergeClassName(cx(styles.item, sizeClass[groupSize]), className)}
    />
  );
});

export const ToggleGroup = Object.assign(Root, { Item });
