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
  openPipWindow,
  type PopOutRect,
  prepareChildDocument,
  supportsPip,
  syncRootAttributes,
  syncStyles,
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
  /** Prefer a **chromeless** Picture-in-Picture window (no address bar) when
   *  the browser supports it (Chromium: Chrome/Edge/Brave, secure context).
   *  Falls back to a normal `window.open` popup otherwise. Note the API allows
   *  only **one** such window at a time (a second pop-out closes the first),
   *  it is always-on-top, and the browser places it (so `rect`/`features`
   *  positioning and `name` reuse do not apply). Default `false`. */
  pip?: boolean;
  /** Escape inside the popup closes it (reason `"escape"`). Default `true`. */
  closeOnEscape?: boolean;
  /** The live child `Window`, `null` while closed. */
  windowRef?: Ref<Window | null>;
  children?: ReactNode;
}

/** The live child-window session, held on a ref across effect runs so a
 *  StrictMode remount adopts it instead of re-opening (see the open effect). */
interface PopOutSession {
  /** `windowName` + the open mode; a change means a different window. */
  key: string;
  /** The child window, once open (null while a PiP request is in flight). */
  win: Window | null;
  disposed: boolean;
  disposeScheduled: boolean;
  teardown: () => void;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T }).current = value;
}

/** Pop content out into a separate browser window. Closed, it renders its
 *  children in place; open, it opens a same-origin popup, clones the opener's
 *  stylesheets into it (and keeps them and the opener's root theme/palette
 *  attributes in sync), and portals
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
    pip = false,
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
  const pipRef = useRef(pip);
  pipRef.current = pip;

  // The live open session, held across effect runs. Picture-in-Picture opens
  // asynchronously and spends the click's one-shot activation, and React
  // StrictMode double-invokes effects (mount → cleanup → mount) in dev. If the
  // remount re-opened, the second `requestWindow` would reject (activation
  // spent) and the first window would be closed as canceled. So the session is
  // adopted by a same-window remount, and its disposal is deferred a microtask
  // so that synchronous remount can cancel it; only a real unmount disposes.
  const sessionRef = useRef<PopOutSession | null>(null);

  // Layout effect: for a discrete event (the consumer's click) React flushes
  // synchronously, so opening the window here still carries the user activation
  // and popup blockers stay quiet. A passive effect would run too late.
  useLayoutEffect(() => {
    if (!open) return;
    const key = `${windowName}|${pipRef.current ? "pip" : "win"}`;

    const disposeSession = (session: PopOutSession) => {
      if (session.disposed) return;
      session.disposed = true;
      session.disposeScheduled = false;
      session.teardown();
      if (sessionRef.current === session) sessionRef.current = null;
      setChildWin(null);
      if (session.win && !session.win.closed) session.win.close();
    };
    const scheduleDispose = (session: PopOutSession) => {
      session.disposeScheduled = true;
      // A StrictMode remount runs synchronously before this microtask and
      // clears the flag; a real unmount leaves it set.
      queueMicrotask(() => {
        if (session.disposeScheduled) disposeSession(session);
      });
    };

    const existing = sessionRef.current;
    if (existing && existing.key === key && !existing.disposed) {
      // Same window remounting: adopt it, don't re-open.
      existing.disposeScheduled = false;
      if (existing.win && !existing.win.closed) setChildWin(existing.win);
      return () => scheduleDispose(existing);
    }

    const session: PopOutSession = {
      key,
      win: null,
      disposed: false,
      disposeScheduled: false,
      teardown: () => {},
    };
    sessionRef.current = session;

    const setup = (win: Window) => {
      if (session.disposed) {
        if (!win.closed) win.close();
        return;
      }
      session.win = win;
      prepareChildDocument(win.document, document, titleRef.current);
      const stopStyles = syncStyles(document, win.document);
      const stopAttrs = syncRootAttributes(document, win.document);
      const stopWatch = watchChildClosed(win, () => {
        disposeSession(session);
        setOpenRef.current(false, "closed");
      });
      const onOpenerPageHide = () => win.close();
      window.addEventListener("pagehide", onOpenerPageHide);
      session.teardown = () => {
        window.removeEventListener("pagehide", onOpenerPageHide);
        stopWatch();
        stopStyles();
        stopAttrs();
      };
      win.focus();
      setChildWin(win);
    };
    const blocked = (kind: string) => {
      if (session.disposed) return;
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `PopOut: ${kind} was blocked. Toggle \`open\` from a user gesture (a click handler).`,
        );
      }
      setOpenRef.current(false, "blocked");
    };

    if (pipRef.current && supportsPip()) {
      // Chromeless Picture-in-Picture (no address bar). Placement is the
      // browser's; only width/height are honored.
      openPipWindow({ width: rectRef.current?.width, height: rectRef.current?.height })
        .then(setup)
        .catch(() => blocked("Picture-in-Picture"));
    } else {
      const win = openChildWindow({
        name: windowName,
        features: featuresRef.current ?? buildFeatures(rectRef.current, window),
      });
      if (!win) blocked("window.open");
      else setup(win);
    }

    return () => scheduleDispose(session);
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
