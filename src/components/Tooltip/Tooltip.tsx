import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Tooltip.module.css";

const Provider = BaseTooltip.Provider;
const Root = BaseTooltip.Root;
const Trigger = BaseTooltip.Trigger;
const Portal = BaseTooltip.Portal;
const Positioner = BaseTooltip.Positioner;
const Arrow = BaseTooltip.Arrow;

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTooltip.Popup>>(
  function TooltipPopup({ className, ...rest }, ref) {
    return (
      <BaseTooltip.Popup {...rest} ref={ref} className={mergeClassName(styles.popup, className)} />
    );
  },
);

export const Tooltip = {
  Provider,
  Root,
  Trigger,
  Portal,
  Positioner,
  Popup,
  Arrow,
};
