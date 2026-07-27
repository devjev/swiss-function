import type { HTMLAttributes, ReactNode, Ref } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  buildFeatures,
  openChildWindow,
  type PopOutRect,
  prepareChildDocument,
  syncStyles,
  syncThemeAttr,
  watchChildClosed,
} from "../../lib/childWindow";
import { cx } from "../../lib/cx";
import { PortalContainerProvider } from "../../lib/portalContainer";
import { StackingProvider } from "../../lib/stacking";
import styles from "./PopOut.module.css";

export type { PopOutRect } from "../../lib/childWindow";

/** Why the pop-out closed: the user closed the browser window, pressed Escape
 *  inside it, or a popup blocker refused to open it in the first place. */
export type PopOutCloseReason = "closed" | "escape" | "blocked";

export interface PopOutProps extends HTMLAttributes<HTMLDivElement> {
  /** Controlled open state. Omit for uncontrolled. */
  open?: boolean;
  /** Initial open state when uncontrolled. Default `false`. */
  defaultOpen?: boolean;
  /** Called on any transition; on close, `reason` says why. Opening must be
   *  triggered from a user gesture (a click handler) or popup blockers will
   *  refuse it and this reports `(false, "blocked")`. */
  onOpenChange?: (open: boolean, reason?: PopOutCloseReason) => void;
  /** The child window's `document.title`. Default `"Window"`. */
  title?: string;
  /** `window.name` for the popup. Reusing a live popup's name refocuses it
   *  instead of stacking a duplicate; keep names unique across concurrent
   *  pop-outs. Default: generated per instance. */
  name?: string;
  /** Preferred screen placement, in the opener's client coordinates
   *  (best-effort; browsers clamp). */
  rect?: PopOutRect;
  /** Raw `window.open` features string; overrides `rect` entirely. */
  features?: string;
  /** Escape inside the popup closes it (reason `"escape"`). Default `true`. */
  closeOnEscape?: boolean;
  /** The live child `Window`, `null` while closed. */
  windowRef?: Ref<Window | null>;
  children?: ReactNode;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T }).current = value;
}

/** Pop content out into a separate browser window. Closed, it renders its
 *  children in place; open, it opens a same-origin popup, clones the opener's
 *  stylesheets into it (and keeps them and `data-theme` in sync), and portals
 *  the children into the popup's body. The subtree remounts on each
 *  transition (the portal target changes), so lift any state you need to
 *  keep. `WindowArray` (`popOutable`) and `Dialog.PopOut` build on this. */
export const PopOut = forwardRef<HTMLDivElement, PopOutProps>(function PopOut(
  {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    title = "Window",
    name,
    rect,
    features,
    closeOnEscape = true,
    windowRef,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = useCallback(
    (next: boolean, reason?: PopOutCloseReason) => {
      onOpenChange?.(next, reason);
      if (openProp === undefined) setOpenState(next);
    },
    [onOpenChange, openProp],
  );

  const generatedName = useId();
  const windowName = name ?? `sf-popout-${generatedName}`;

  const [childWin, setChildWin] = useState<Window | null>(null);

  // Latest-value refs so the open/close effect re-runs only on `open` (and a
  // name change), never on rect/features/callback identity churn.
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const titleRef = useRef(title);
  titleRef.current = title;

  // Layout effect: for a discrete event (the consumer's click) React flushes
  // synchronously, so `window.open` here still carries the user activation
  // and popup blockers stay quiet. A passive effect would run too late.
  useLayoutEffect(() => {
    if (!open) return;
    const win = openChildWindow({
      name: windowName,
      features: featuresRef.current ?? buildFeatures(rectRef.current, window),
    });
    if (!win) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "PopOut: window.open was blocked. Toggle `open` from a user gesture (a click handler).",
        );
      }
      setOpenRef.current(false, "blocked");
      return;
    }
    prepareChildDocument(win.document, document, titleRef.current);
    const stopStyles = syncStyles(document, win.document);
    const stopTheme = syncThemeAttr(document, win.document);
    const stopWatch = watchChildClosed(win, () => {
      setChildWin(null);
      setOpenRef.current(false, "closed");
    });
    const onOpenerPageHide = () => win.close();
    window.addEventListener("pagehide", onOpenerPageHide);
    win.focus();
    setChildWin(win);
    return () => {
      window.removeEventListener("pagehide", onOpenerPageHide);
      stopWatch();
      stopStyles();
      stopTheme();
      setChildWin(null);
      if (!win.closed) win.close();
    };
  }, [open, windowName]);

  useEffect(() => {
    if (!childWin || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenRef.current(false, "escape");
    };
    childWin.document.addEventListener("keydown", onKey);
    return () => {
      try {
        childWin.document.removeEventListener("keydown", onKey);
      } catch {
        // The window is already gone; nothing to detach.
      }
    };
  }, [childWin, closeOnEscape]);

  useEffect(() => {
    if (childWin && !childWin.closed) childWin.document.title = title;
  }, [childWin, title]);

  useEffect(() => {
    if (!windowRef) return;
    assignRef(windowRef, childWin);
    return () => assignRef(windowRef, null);
  }, [windowRef, childWin]);

  if (!open || !childWin || childWin.closed) return <>{children}</>;
  return createPortal(
    // A popped window is a fresh document and a fresh stacking root; do not
    // inherit an opener overlay's ceiling. Publish the popup body so library
    // floaters opened inside portal into this window, not the opener's.
    <StackingProvider ceiling={0}>
      <PortalContainerProvider container={childWin.document.body}>
        <div ref={ref} className={cx(styles.root, className)} {...rest}>
          {children}
        </div>
      </PortalContainerProvider>
    </StackingProvider>,
    childWin.document.body,
  );
});
