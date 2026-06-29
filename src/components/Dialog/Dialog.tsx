import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
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
  /** Allow the popup to be resized from any edge or corner. */
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
  const resizeStart = useRef<{ w: number; h: number; ox: number; oy: number; edge: string } | null>(
    null,
  );

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
      resizeStart.current = { w: r.width, h: r.height, ox: offset.x, oy: offset.y, edge };
    },
    onMove: (delta) => {
      const s = resizeStart.current;
      if (!s) return;
      const e = s.edge.includes("e");
      const wst = s.edge.includes("w");
      const so = s.edge.includes("s");
      const no = s.edge.includes("n");
      let w = s.w;
      let h = s.h;
      if (e) w = s.w + delta.dx;
      if (wst) w = s.w - delta.dx;
      if (so) h = s.h + delta.dy;
      if (no) h = s.h - delta.dy;
      w = Math.max(MIN_W, Math.min(window.innerWidth - 16, w));
      h = Math.max(MIN_H, Math.min(window.innerHeight - 16, h));
      setSize({ w, h });
      // The popup is centred (translate(-50%)), so growing it expands BOTH edges
      // by half the delta. Shift the offset by half the size change toward the
      // dragged edge so the OPPOSITE edge stays anchored and the grabbed edge
      // tracks the pointer 1:1 (e/s push the offset +, w/n push it −).
      let ox = s.ox;
      let oy = s.oy;
      if (e) ox = s.ox + (w - s.w) / 2;
      if (wst) ox = s.ox - (w - s.w) / 2;
      if (so) oy = s.oy + (h - s.h) / 2;
      if (no) oy = s.oy - (h - s.h) / 2;
      setOffset({ x: ox, y: oy });
    },
    onEnd: () => {
      resizeStart.current = null;
    },
  });

  // Keyboard resize from the focused SE handle.
  const resizeByKey = useCallback((ev: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) return;
    ev.preventDefault();
    const el = popupRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const step = ev.shiftKey ? 24 : 8;
    let w = r.width;
    let h = r.height;
    if (ev.key === "ArrowRight") w += step;
    if (ev.key === "ArrowLeft") w -= step;
    if (ev.key === "ArrowDown") h += step;
    if (ev.key === "ArrowUp") h -= step;
    w = Math.max(MIN_W, Math.min(window.innerWidth - 16, w));
    h = Math.max(MIN_H, Math.min(window.innerHeight - 16, h));
    const dw = w - r.width;
    const dh = h - r.height;
    setSize({ w, h });
    // Anchor the top-left corner, same as pointer resize (see onMove above).
    setOffset((o) => ({ x: o.x + dw / 2, y: o.y + dh / 2 }));
  }, []);

  // The drag offset also anchors the top-left corner while resizing, so a
  // resizable-but-not-draggable popup needs the offset vars applied too.
  const positioned = draggable || resizable;
  const dragStyle = positioned
    ? ({ "--sf-dialog-x": `${offset.x}px`, "--sf-dialog-y": `${offset.y}px` } as CSSProperties)
    : undefined;
  const sizeStyle: CSSProperties | undefined = size
    ? { width: `${size.w}px`, height: `${size.h}px`, maxWidth: "none", maxHeight: "none" }
    : undefined;

  return (
    <BaseDialog.Popup
      {...rest}
      ref={setRefs}
      className={mergeClassName(cx(styles.popup, positioned && styles.draggable), className)}
      style={{ ...dragStyle, ...sizeStyle, ...style }}
    >
      {draggable ? (
        <DragContext.Provider value={{ onHandlePointerDown }}>{children}</DragContext.Provider>
      ) : (
        children
      )}
      {resizable && (
        <>
          {/* Edges first, then corners — corners must come later in the DOM so
              they win the hit-test where they overlap an edge. */}
          <div
            aria-hidden="true"
            data-edge="n"
            className={styles.resizeN}
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
            data-edge="e"
            className={styles.resizeE}
            onPointerDown={onResizeDown}
          />
          <div
            aria-hidden="true"
            data-edge="w"
            className={styles.resizeW}
            onPointerDown={onResizeDown}
          />
          <div
            aria-hidden="true"
            data-edge="ne"
            className={styles.resizeNE}
            onPointerDown={onResizeDown}
          />
          <div
            aria-hidden="true"
            data-edge="nw"
            className={styles.resizeNW}
            onPointerDown={onResizeDown}
          />
          <div
            aria-hidden="true"
            data-edge="sw"
            className={styles.resizeSW}
            onPointerDown={onResizeDown}
          />
          {/* biome-ignore lint/a11y/useSemanticElements: a focusable, draggable resize grip is not an <hr> */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize dialog"
            aria-valuenow={Math.round(size?.w ?? 0)}
            aria-valuemin={MIN_W}
            tabIndex={0}
            data-edge="se"
            className={styles.resizeSE}
            onPointerDown={onResizeDown}
            onKeyDown={resizeByKey}
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
