import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { createContext, forwardRef, useCallback, useContext, useRef, useState } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { useFullscreen } from "../../lib/useFullscreen";
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

/** Window-chrome icons — shared 16px line set, matching `ChatDrawer`. */
const ICON_PROPS = {
  viewBox: "0 0 16 16",
  width: 14,
  height: 14,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
} as const;

const ExpandIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" strokeLinecap="square" />
  </svg>
);
const CollapseIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" strokeLinecap="square" />
  </svg>
);
const CloseIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" strokeLinecap="square" />
  </svg>
);

/** Lets `Dialog.Handle` reach the popup's drag starter and `Dialog.Maximize`
 *  reach its fullscreen state without prop drilling. */
interface PopupContextValue {
  /** Drag starter — `undefined` when the popup isn't draggable (or is fullscreen). */
  onHandlePointerDown?: (event: ReactPointerEvent) => void;
  /** Whether the popup is currently maximized to the viewport. */
  expanded: boolean;
  /** Toggle the popup's fullscreen state. */
  toggleFullscreen: () => void;
}
const PopupContext = createContext<PopupContextValue | null>(null);

interface PopupProps extends ComponentPropsWithoutRef<typeof BaseDialog.Popup> {
  /** Allow the popup to be dragged around by a `Dialog.Handle` (or the title). */
  draggable?: boolean;
  /** Allow the popup to be resized from any edge or corner. */
  resizable?: boolean;
  /** Initial width in px. Sets the size up front (the default is content-driven,
   *  capped at 32rem). A later resize takes over from here. */
  defaultWidth?: number;
  /** Initial height in px. Sets the size up front (the default is content-driven,
   *  capped at the viewport). A later resize takes over from here. */
  defaultHeight?: number;
}

/** Smallest a resizable popup may be dragged to, in px. */
const MIN_W = 240;
const MIN_H = 120;

const Popup = forwardRef<HTMLDivElement, PopupProps>(function DialogPopup(
  { className, draggable, resizable, defaultWidth, defaultHeight, style, children, ...rest },
  ref,
) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  // Maximize-to-viewport. While expanded the popup ignores the drag offset and
  // manual size (the `.fullscreen` class takes over); exiting restores both,
  // since they're kept in state and merely not applied while expanded.
  const { expanded, toggle } = useFullscreen();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // `size` is the resize-tracked size; seeded from defaultWidth/Height so the
  // popup can open at a chosen size. Either axis may be unset (content-driven).
  const [size, setSize] = useState<{ w?: number; h?: number } | null>(() =>
    defaultWidth != null || defaultHeight != null ? { w: defaultWidth, h: defaultHeight } : null,
  );
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
  // resizable-but-not-draggable popup needs the offset vars applied too. While
  // expanded the `.fullscreen` class drives layout, so skip the inline overrides.
  const positioned = draggable || resizable;
  const dragStyle =
    positioned && !expanded
      ? ({ "--sf-dialog-x": `${offset.x}px`, "--sf-dialog-y": `${offset.y}px` } as CSSProperties)
      : undefined;
  // Lift the cap only on the axis we set, so an unset axis keeps its clamp.
  const sizeStyle: CSSProperties | undefined =
    size && !expanded
      ? {
          ...(size.w != null && { width: `${size.w}px`, maxWidth: "none" }),
          ...(size.h != null && { height: `${size.h}px`, maxHeight: "none" }),
        }
      : undefined;

  const ctx: PopupContextValue = {
    // Dragging is meaningless once maximized — drop the handle starter.
    onHandlePointerDown: draggable && !expanded ? onHandlePointerDown : undefined,
    expanded,
    toggleFullscreen: toggle,
  };

  return (
    <BaseDialog.Popup
      {...rest}
      ref={setRefs}
      className={mergeClassName(
        cx(styles.popup, positioned && styles.draggable, expanded && styles.fullscreen),
        className,
      )}
      style={{ ...dragStyle, ...sizeStyle, ...style }}
    >
      <PopupContext.Provider value={ctx}>{children}</PopupContext.Provider>
      {resizable && !expanded && (
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
  const ctx = useContext(PopupContext);
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.handle, ctx?.onHandlePointerDown && styles.handleActive, className)}
      onPointerDown={ctx?.onHandlePointerDown}
    />
  );
});

/** Right-aligned row for window-chrome buttons; place it inside `Dialog.Handle`
 *  after the title. Swallows pointer-down so clicking a button never starts a
 *  drag. */
const Actions = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function DialogActions(
  { className, onPointerDown, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.actions, className)}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
    />
  );
});

/** Icon button that maximizes the popup to the viewport (and back). Reads the
 *  popup's fullscreen state from context, so it must live inside a `Dialog.Popup`. */
const Maximize = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
  function DialogMaximize({ className, onClick, onPointerDown, ...rest }, ref) {
    const ctx = useContext(PopupContext);
    const expanded = ctx?.expanded ?? false;
    return (
      <button
        type="button"
        aria-label={expanded ? "Exit fullscreen" : "Enter fullscreen"}
        aria-pressed={expanded}
        {...rest}
        ref={ref}
        className={cx(styles.iconButton, className)}
        onClick={(event) => {
          onClick?.(event);
          ctx?.toggleFullscreen();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown?.(event);
        }}
      >
        {expanded ? <CollapseIcon /> : <ExpandIcon />}
      </button>
    );
  },
);

/** Pre-styled icon ✕ that closes the dialog. Wraps Base UI's `Close`, so it
 *  works anywhere inside `Dialog.Root`. Supply children to override the glyph. */
const CloseButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof BaseDialog.Close>
>(function DialogCloseButton({ className, children, onPointerDown, ...rest }, ref) {
  return (
    <BaseDialog.Close
      type="button"
      aria-label="Close"
      {...rest}
      ref={ref}
      className={mergeClassName(styles.iconButton, className)}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
    >
      {children ?? <CloseIcon />}
    </BaseDialog.Close>
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
  Actions,
  Maximize,
  Title,
  Description,
  Close,
  CloseButton,
};
