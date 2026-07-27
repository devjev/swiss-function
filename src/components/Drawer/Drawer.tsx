import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import { usePortalContainer } from "../../lib/portalContainer";
import { StackingProvider, useStackLayer, Z_LAYER } from "../../lib/stacking";
import styles from "./Drawer.module.css";

export type DrawerSide = "left" | "right" | "bottom";

/** Friendly `side` → Base UI's `swipeDirection` (the direction you swipe to
 *  dismiss, which is also the edge the drawer is pinned to). */
const SIDE_TO_SWIPE = { left: "left", right: "right", bottom: "down" } as const;

export interface DrawerRootProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseDrawer.Root>, "swipeDirection"> {
  /** Edge the drawer slides in from. Default `"right"`. */
  side?: DrawerSide;
}

/** Groups the drawer; non-modal by default so the page stays interactive. */
function Root({ side = "right", modal = false, ...rest }: DrawerRootProps) {
  return <BaseDrawer.Root {...rest} modal={modal} swipeDirection={SIDE_TO_SWIPE[side]} />;
}

const Trigger = BaseDrawer.Trigger;
const Close = BaseDrawer.Close;

// Portal into the popped-out window's body when inside a PopOut (issue #84);
// `undefined` at the app root keeps Base UI's default (the document body).
const Portal = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDrawer.Portal>>(
  function DrawerPortal({ container, ...rest }, ref) {
    const fallback = usePortalContainer();
    return <BaseDrawer.Portal ref={ref} container={container ?? fallback ?? undefined} {...rest} />;
  },
);

const Backdrop = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDrawer.Backdrop>>(
  function DrawerBackdrop({ className, ...rest }, ref) {
    return (
      <BaseDrawer.Backdrop
        {...rest}
        ref={ref}
        className={mergeClassName(styles.backdrop, className)}
      />
    );
  },
);

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDrawer.Popup>>(
  function DrawerPopup({ className, style, ...rest }, ref) {
    // Cross-portal stacking (issue #82): seed the modal band so a floater opened
    // inside the drawer paints above it, and climb when the drawer is itself
    // opened inside another overlay.
    const { zIndex, ceiling } = useStackLayer(Z_LAYER.modal, true);
    return (
      <StackingProvider ceiling={ceiling}>
        <BaseDrawer.Popup
          {...rest}
          ref={ref}
          style={zIndex != null ? { ...style, zIndex } : style}
          className={mergeClassName(styles.popup, className)}
        />
      </StackingProvider>
    );
  },
);

const Viewport = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDrawer.Viewport>>(
  function DrawerViewport({ className, ...rest }, ref) {
    return (
      <BaseDrawer.Viewport
        {...rest}
        ref={ref}
        className={mergeClassName(styles.viewport, className)}
      />
    );
  },
);

const Content = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDrawer.Content>>(
  function DrawerContent({ className, ...rest }, ref) {
    return (
      <BaseDrawer.Content
        {...rest}
        ref={ref}
        className={mergeClassName(styles.content, className)}
      />
    );
  },
);

/** Optional persistent handle: a visible grab rail at the edge that stays when the
 *  drawer is closed; swipe/drag it to open. Omit it for a drawer that fully hides. */
const SwipeArea = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDrawer.SwipeArea>>(
  function DrawerSwipeArea({ className, ...rest }, ref) {
    return (
      <BaseDrawer.SwipeArea
        {...rest}
        ref={ref}
        className={mergeClassName(styles.swipeArea, className)}
      />
    );
  },
);

const Title = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<typeof BaseDrawer.Title>>(
  function DrawerTitle({ className, ...rest }, ref) {
    return (
      <BaseDrawer.Title {...rest} ref={ref} className={mergeClassName(styles.title, className)} />
    );
  },
);

const Description = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof BaseDrawer.Description>
>(function DrawerDescription({ className, ...rest }, ref) {
  return (
    <BaseDrawer.Description
      {...rest}
      ref={ref}
      className={mergeClassName(styles.description, className)}
    />
  );
});

export const Drawer = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Popup,
  Viewport,
  Content,
  SwipeArea,
  Title,
  Description,
  Close,
};
