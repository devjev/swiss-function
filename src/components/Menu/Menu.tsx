import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Menu.module.css";

const Root = BaseMenu.Root;
const Trigger = BaseMenu.Trigger;
const Portal = BaseMenu.Portal;
const Positioner = BaseMenu.Positioner;
const Group = BaseMenu.Group;

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Popup>>(
  function MenuPopup({ className, ...rest }, ref) {
    return (
      <BaseMenu.Popup {...rest} ref={ref} className={mergeClassName(styles.popup, className)} />
    );
  },
);

const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Item>>(
  function MenuItem({ className, ...rest }, ref) {
    return <BaseMenu.Item {...rest} ref={ref} className={mergeClassName(styles.item, className)} />;
  },
);

const Separator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Separator>>(
  function MenuSeparator({ className, ...rest }, ref) {
    return (
      <BaseMenu.Separator
        {...rest}
        ref={ref}
        className={mergeClassName(styles.separator, className)}
      />
    );
  },
);

const GroupLabel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.GroupLabel>>(
  function MenuGroupLabel({ className, ...rest }, ref) {
    return (
      <BaseMenu.GroupLabel
        {...rest}
        ref={ref}
        className={mergeClassName(styles.groupLabel, className)}
      />
    );
  },
);

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
