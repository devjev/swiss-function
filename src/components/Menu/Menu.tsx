import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Menu.module.css";

const Root = BaseMenu.Root;
const Trigger = BaseMenu.Trigger;
const Portal = BaseMenu.Portal;
const Group = BaseMenu.Group;

// The Positioner is the transform element that creates the popup's stacking
// context, so the dropdown z-index must live here to win against positioned page
// content (e.g. a DataTable's sticky header).
const Positioner = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Positioner>>(
  function MenuPositioner({ className, ...rest }, ref) {
    return (
      <BaseMenu.Positioner
        {...rest}
        ref={ref}
        className={mergeClassName(styles.positioner, className)}
      />
    );
  },
);

export interface MenuPopupProps extends ComponentPropsWithoutRef<typeof BaseMenu.Popup> {
  /** Whether to return focus to the trigger when the menu closes (Base UI's
   *  default). Set `false` to leave focus where it is — useful when a custom
   *  hotkey layer owns focus and you don't want the trigger re-armed, so a
   *  subsequent Space/Enter doesn't reopen it. Maps to Base UI `finalFocus`;
   *  pass `finalFocus` directly for a specific target element. */
  returnFocus?: boolean;
}

const Popup = forwardRef<HTMLDivElement, MenuPopupProps>(function MenuPopup(
  { className, returnFocus = true, finalFocus, ...rest },
  ref,
) {
  return (
    <BaseMenu.Popup
      {...rest}
      ref={ref}
      className={mergeClassName(styles.popup, className)}
      finalFocus={finalFocus ?? (returnFocus ? undefined : false)}
    />
  );
});

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
