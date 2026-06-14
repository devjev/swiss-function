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
  /** Allow the popup to be resized from its right / bottom / corner edges. */
  resizable?: boolean;
}

/** Smallest a resizable popup may be dragged to, in px. */
const MIN_W = 240;
const MIN_H = 120;

const Popup = forwardRef<HTMLDivElement, PopupProps>(function DialogPopup(
  { className, draggable, resizable, style, children, ...rest },
  ref,
) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const dragStart = useRef<{ ox: number; oy: number; rect: DOMRect } | null>(null);
  const resizeStart = useRef<{ w: number; h: number; edge: string } | null>(null);

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

  const { onPointerDown: onResizeDown } = usePointerDrag({
    onStart: (_origin, event) => {
      const el = popupRef.current;
      const edge = (event.currentTarget as HTMLElement).dataset.edge;
      if (!el || !edge) return;
      const r = el.getBoundingClientRect();
      resizeStart.current = { w: r.width, h: r.height, edge };
    },
    onMove: (delta) => {
      const s = resizeStart.current;
      if (!s) return;
      let w = s.w;
      let h = s.h;
      if (s.edge.includes("e")) w = s.w + delta.dx;
      if (s.edge.includes("s")) h = s.h + delta.dy;
      w = Math.max(MIN_W, Math.min(window.innerWidth - 16, w));
      h = Math.max(MIN_H, Math.min(window.innerHeight - 16, h));
      setSize({ w, h });
    },
    onEnd: () => {
      resizeStart.current = null;
    },
  });

  const dragStyle = draggable
    ? ({ "--sf-dialog-x": `${offset.x}px`, "--sf-dialog-y": `${offset.y}px` } as CSSProperties)
    : undefined;
  const sizeStyle: CSSProperties | undefined = size
    ? { width: `${size.w}px`, height: `${size.h}px`, maxWidth: "none", maxHeight: "none" }
    : undefined;

  return (
    <BaseDialog.Popup
      {...rest}
      ref={setRefs}
      className={mergeClassName(cx(styles.popup, draggable && styles.draggable), className)}
      style={{ ...dragStyle, ...sizeStyle, ...style }}
    >
      {draggable ? (
        <DragContext.Provider value={{ onHandlePointerDown }}>{children}</DragContext.Provider>
      ) : (
        children
      )}
      {resizable && (
        <>
          <div
            aria-hidden="true"
            data-edge="e"
            className={styles.resizeE}
            onPointerDown={onResizeDown}
          />
          <div
            aria-hidden="true"
            data-edge="s"
            className={styles.resizeS}
            onPointerDown={onResizeDown}
          />
          <div
            aria-hidden="true"
            data-edge="se"
            className={styles.resizeSE}
            onPointerDown={onResizeDown}
          />
        </>
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
