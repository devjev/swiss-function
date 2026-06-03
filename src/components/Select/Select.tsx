import { Select as BaseSelect } from "@base-ui/react/select";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Select.module.css";

const Root = BaseSelect.Root;
const Value = BaseSelect.Value;
const Portal = BaseSelect.Portal;
const Positioner = BaseSelect.Positioner;
const ItemText = BaseSelect.ItemText;
const ItemIndicator = BaseSelect.ItemIndicator;

const Trigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof BaseSelect.Trigger>>(
  function SelectTrigger({ className, children, ...rest }, ref) {
    return (
      <BaseSelect.Trigger {...rest} ref={ref} className={mergeClassName(styles.trigger, className)}>
        {children}
        <BaseSelect.Icon className={styles.icon}>▾</BaseSelect.Icon>
      </BaseSelect.Trigger>
    );
  },
);

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseSelect.Popup>>(
  function SelectPopup({ className, ...rest }, ref) {
    return (
      <BaseSelect.Popup {...rest} ref={ref} className={mergeClassName(styles.popup, className)} />
    );
  },
);

const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseSelect.Item>>(
  function SelectItem({ className, ...rest }, ref) {
    return (
      <BaseSelect.Item {...rest} ref={ref} className={mergeClassName(styles.item, className)} />
    );
  },
);

export const Select = {
  Root,
  Trigger,
  Value,
  Portal,
  Positioner,
  Popup,
  Item,
  ItemText,
  ItemIndicator,
};
