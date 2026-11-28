import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import { usePortalContainer } from "../../lib/portalContainer";
import { topLayerPortalClass, useTopLayerPortalRef } from "../../lib/topLayer";
import { Box } from "../Box";
import styles from "./Popover.module.css";

const Root = BasePopover.Root;
const Trigger = BasePopover.Trigger;
const Arrow = BasePopover.Arrow;
const Close = BasePopover.Close;

// Portal into the popped-out window's body when inside a PopOut (issue #84);
// `undefined` at the app root keeps Base UI's default (the document body). The
// portal enters the browser's top layer as it mounts (lib/topLayer, issue #83),
// so the overlay opened last is on top.
const Portal = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BasePopover.Portal>>(
  function PopoverPortal({ container, className, ...rest }, ref) {
    const fallback = usePortalContainer();
    const layerRef = useTopLayerPortalRef(ref);
    return (
      <BasePopover.Portal
        {...rest}
        ref={layerRef}
        container={container ?? fallback ?? undefined}
        className={mergeClassName(topLayerPortalClass, className)}
      />
    );
  },
);

// Base UI positions the popup with an inline `transform`, which creates a
// stacking context, so the popup's own `z-index` is trapped inside it. Where the
// browser has no top layer, the positioner's z-index (`--sf-z-popover`) orders
// it against positioned page content (e.g. a DataTable sticky header).
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
