import { Menu as BaseMenu } from "@base-ui/react/menu";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Menu.module.css";

const Root = BaseMenu.Root;
const Trigger = BaseMenu.Trigger;
const Portal = BaseMenu.Portal;
const Positioner = BaseMenu.Positioner;
const Group = BaseMenu.Group;

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Popup>>(
  function MenuPopup({ className, ...rest }, ref) {
    return <BaseMenu.Popup {...rest} ref={ref} className={cx(styles.popup, className)} />;
  },
);

const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Item>>(
  function MenuItem({ className, ...rest }, ref) {
    return <BaseMenu.Item {...rest} ref={ref} className={cx(styles.item, className)} />;
  },
);

const Separator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Separator>>(
  function MenuSeparator({ className, ...rest }, ref) {
    return (
      <BaseMenu.Separator {...rest} ref={ref} className={cx(styles.separator, className)} />
    );
  },
);

const GroupLabel = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseMenu.GroupLabel>
>(function MenuGroupLabel({ className, ...rest }, ref) {
  return (
    <BaseMenu.GroupLabel {...rest} ref={ref} className={cx(styles.groupLabel, className)} />
  );
});

export const Menu = {
  Root,
  Trigger,
  Portal,
  Positioner,
  Popup,
  Item,
  Separator,
  Group,
  GroupLabel,
};
