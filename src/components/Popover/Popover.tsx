import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import { Box } from "../Box";
import styles from "./Popover.module.css";

const Root = BasePopover.Root;
const Trigger = BasePopover.Trigger;
const Portal = BasePopover.Portal;
const Arrow = BasePopover.Arrow;
const Close = BasePopover.Close;

// Base UI positions the popup with an inline `transform`, which creates a
// stacking context — so the popup's own `z-index` is trapped inside it and inert
// at the page root. The tier must live on the positioner to win against
// positioned page content (e.g. a DataTable sticky header). Same fix as the
// Menu/Combobox positioners.
const Positioner = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BasePopover.Positioner>
>(function PopoverPositioner({ className, ...rest }, ref) {
  return (
    <BasePopover.Positioner
      {...rest}
      ref={ref}
      className={mergeClassName(styles.positioner, className)}
    />
  );
});

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BasePopover.Popup>>(
  function PopoverPopup({ className, ...rest }, ref) {
    return (
      <BasePopover.Popup
        {...rest}
        ref={ref}
        className={mergeClassName(styles.popup, className)}
        // Surface chrome (bg, border, radius, padding, shadow) comes from Box
        // via Base UI's render-as pattern. Elevation 3 is a typical "lifted
        // floating panel" depth; padding 0.75 ≈ 18px keeps the popup tight.
        render={<Box elevation={3} padding={0.75} />}
      />
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
