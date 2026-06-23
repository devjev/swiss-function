import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
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
const Portal = BaseDrawer.Portal;
const Close = BaseDrawer.Close;

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
  function DrawerPopup({ className, ...rest }, ref) {
    return (
      <BaseDrawer.Popup {...rest} ref={ref} className={mergeClassName(styles.popup, className)} />
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
