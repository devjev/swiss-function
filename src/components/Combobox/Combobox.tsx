import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Combobox.module.css";

const Root = BaseCombobox.Root;
const Portal = BaseCombobox.Portal;
const Positioner = BaseCombobox.Positioner;
const Empty = BaseCombobox.Empty;
const List = BaseCombobox.List;

const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof BaseCombobox.Input>>(
  function ComboboxInput({ className, ...rest }, ref) {
    return <BaseCombobox.Input {...rest} ref={ref} className={cx(styles.input, className)} />;
  },
);

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseCombobox.Popup>>(
  function ComboboxPopup({ className, ...rest }, ref) {
    return <BaseCombobox.Popup {...rest} ref={ref} className={cx(styles.popup, className)} />;
  },
);

const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseCombobox.Item>>(
  function ComboboxItem({ className, ...rest }, ref) {
    return <BaseCombobox.Item {...rest} ref={ref} className={cx(styles.item, className)} />;
  },
);

export const Combobox = {
  Root,
  Input,
  Portal,
  Positioner,
  Popup,
  List,
  Item,
  Empty,
};
