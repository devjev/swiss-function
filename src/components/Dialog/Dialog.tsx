import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { createContext, forwardRef, useCallback, useContext, useRef, useState } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { usePointerDrag } from "../../lib/usePointerDrag";
import styles from "./Dialog.module.css";

const Root = BaseDialog.Root;
const Trigger = BaseDialog.Trigger;
const Portal = BaseDialog.Portal;
const Close = BaseDialog.Close;

const Backdrop = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>>(
  function DialogBackdrop({ className, ...rest }, ref) {
    return (
      <BaseDialog.Backdrop
        {...rest}
        ref={ref}
        className={mergeClassName(styles.backdrop, className)}
      />
    );
  },
);

/** Lets `Dialog.Handle` reach the popup's drag starter without prop drilling. */
interface DragContextValue {
  onHandlePointerDown: (event: ReactPointerEvent) => void;
}
const DragContext = createContext<DragContextValue | null>(null);

interface PopupProps extends ComponentPropsWithoutRef<typeof BaseDialog.Popup> {
  /** Allow the popup to be dragged around by a `Dialog.Handle` (or the title). */
  draggable?: boolean;
}

const Popup = forwardRef<HTMLDivElement, PopupProps>(function DialogPopup(
  { className, draggable, style, children, ...rest },
  ref,
) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ ox: number; oy: number; rect: DOMRect } | null>(null);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      popupRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
    [ref],
  );

  const { onPointerDown: onHandlePointerDown } = usePointerDrag({
    onStart: () => {
      const el = popupRef.current;
      if (!el) return;
      dragStart.current = { ox: offset.x, oy: offset.y, rect: el.getBoundingClientRect() };
    },
    onMove: (delta) => {
      const s = dragStart.current;
      if (!s) return;
      // Keep the whole popup on screen with an 8px margin.
      const M = 8;
      const cdx = Math.max(
        M - s.rect.left,
        Math.min(window.innerWidth - M - s.rect.right, delta.dx),
      );
      const cdy = Math.max(
        M - s.rect.top,
        Math.min(window.innerHeight - M - s.rect.bottom, delta.dy),
      );
      setOffset({ x: s.ox + cdx, y: s.oy + cdy });
    },
    onEnd: () => {
      dragStart.current = null;
    },
  });

  const dragStyle = draggable
    ? ({ "--sf-dialog-x": `${offset.x}px`, "--sf-dialog-y": `${offset.y}px` } as CSSProperties)
    : undefined;

  return (
    <BaseDialog.Popup
      {...rest}
      ref={setRefs}
      className={mergeClassName(cx(styles.popup, draggable && styles.draggable), className)}
      style={{ ...dragStyle, ...style }}
    >
      {draggable ? (
        <DragContext.Provider value={{ onHandlePointerDown }}>{children}</DragContext.Provider>
      ) : (
        children
      )}
    </BaseDialog.Popup>
  );
});

/** Grab region for a draggable dialog. Wrap it around the title (or any header
 *  content). Outside a draggable `Dialog.Popup` it renders as a plain element. */
const Handle = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function DialogHandle(
  { className, ...rest },
  ref,
) {
  const ctx = useContext(DragContext);
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.handle, ctx && styles.handleActive, className)}
      onPointerDown={ctx?.onHandlePointerDown}
    />
  );
});

const Title = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<typeof BaseDialog.Title>>(
  function DialogTitle({ className, ...rest }, ref) {
    return (
      <BaseDialog.Title {...rest} ref={ref} className={mergeClassName(styles.title, className)} />
    );
  },
);

const Description = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof BaseDialog.Description>
>(function DialogDescription({ className, ...rest }, ref) {
  return (
    <BaseDialog.Description
      {...rest}
      ref={ref}
      className={mergeClassName(styles.description, className)}
    />
  );
});

export const Dialog = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Popup,
  Handle,
  Title,
  Description,
  Close,
};
