import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Popover.module.css";

const Root = BasePopover.Root;
const Trigger = BasePopover.Trigger;
const Portal = BasePopover.Portal;
const Positioner = BasePopover.Positioner;
const Arrow = BasePopover.Arrow;
const Close = BasePopover.Close;

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BasePopover.Popup>>(
  function PopoverPopup({ className, ...rest }, ref) {
    return (
      <BasePopover.Popup {...rest} ref={ref} className={mergeClassName(styles.popup, className)} />
    );
  },
);

const Title = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<typeof BasePopover.Title>>(
  function PopoverTitle({ className, ...rest }, ref) {
    return (
      <BasePopover.Title {...rest} ref={ref} className={mergeClassName(styles.title, className)} />
    );
  },
);

const Description = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof BasePopover.Description>
>(function PopoverDescription({ className, ...rest }, ref) {
  return (
    <BasePopover.Description
      {...rest}
      ref={ref}
      className={mergeClassName(styles.description, className)}
    />
  );
});

export const Popover = {
  Root,
  Trigger,
  Portal,
  Positioner,
  Popup,
  Arrow,
  Title,
  Description,
  Close,
};
