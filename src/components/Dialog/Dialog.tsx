import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { usePortalContainer } from "../../lib/portalContainer";
import { StackingProvider, useStackLayer, Z_LAYER } from "../../lib/stacking";
import { useFullscreen } from "../../lib/useFullscreen";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { Button } from "../Button";
import type { PopOutRect } from "../PopOut";
import { PopOut as PopOutWindow } from "../PopOut";
import styles from "./Dialog.module.css";

const Root = BaseDialog.Root;
const Trigger = BaseDialog.Trigger;
const Close = BaseDialog.Close;

// Portal into the popped-out window's body when inside a PopOut (issue #84);
// `undefined` at the app root keeps Base UI's default (the document body).
const Portal = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseDialog.Portal>>(
  function DialogPortal({ container, ...rest }, ref) {
    const fallback = usePortalContainer();
    return <BaseDialog.Portal ref={ref} container={container ?? fallback ?? undefined} {...rest} />;
  },
);

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
// The Icon set's ExternalLink path (arrow leaving a box); matches WindowArray.
const PopOutIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5" strokeLinecap="square" />
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
  /** Whether the dialog's content is showing in a separate browser window. */
  popped: boolean;
  /** Toggle the popped-out state (measures the popup rect on the way out). */
  togglePopOut: () => void;
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
  /** Controlled popped-out state: the dialog's content shows alone in a
   *  separate browser window (a `PopOut` popup) while the dialog stays open
   *  as a small placeholder, so the modal focus trap keeps trapping here and
   *  closing the dialog closes the popup. Toggle it from `Dialog.PopOut` (a
   *  user gesture), or popup blockers refuse the window. */
  poppedOut?: boolean;
  /** Initial popped-out state when uncontrolled. Default `false`. */
  defaultPoppedOut?: boolean;
  onPoppedOutChange?: (popped: boolean) => void;
  /** The popup window's `document.title` while popped out. Default `"Dialog"`. */
  popOutTitle?: string;
  /** Replaces the built-in placeholder (a line of text + Bring back / Show
   *  window buttons) shown in the dialog while popped out. */
  popOutPlaceholder?: ReactNode;
}

/** Smallest a resizable popup may be dragged to, in px. */
const MIN_W = 240;
const MIN_H = 120;

const Popup = forwardRef<HTMLDivElement, PopupProps>(function DialogPopup(
  {
    className,
    draggable,
    resizable,
    defaultWidth,
    defaultHeight,
    poppedOut: poppedProp,
    defaultPoppedOut = false,
    onPoppedOutChange,
    popOutTitle = "Dialog",
    popOutPlaceholder,
    style,
    children,
    ...rest
  },
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

  // Popped-out (controlled triple, same pattern as WindowArray's poppedIds).
  const [poppedState, setPoppedState] = useState(defaultPoppedOut);
  const popped = poppedProp !== undefined ? poppedProp : poppedState;
  const setPopped = useCallback(
    (next: boolean) => {
      onPoppedOutChange?.(next);
      if (poppedProp === undefined) setPoppedState(next);
    },
    [onPoppedOutChange, poppedProp],
  );
  const popRectRef = useRef<PopOutRect | undefined>(undefined);
  const popWinRef = useRef<Window | null>(null);

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
  // While popped out the placeholder collapses to its natural height (the
  // remembered size returns with the content).
  const sizeStyle: CSSProperties | undefined =
    size && !expanded && !popped
      ? {
          ...(size.w != null && { width: `${size.w}px`, maxWidth: "none" }),
          ...(size.h != null && { height: `${size.h}px`, maxHeight: "none" }),
        }
      : undefined;

  // Stable context identity: dragging updates `offset` state per pointermove —
  // without the memo, every frame would hand Handle/Maximize/CloseButton a
  // fresh context object and re-render them all.
  // Popping out exits fullscreen (the content leaves this viewport) and
  // remembers the popup's rect so the browser window opens over it.
  const togglePopOut = useCallback(() => {
    if (!popped) {
      if (expanded) toggle();
      const el = popupRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        popRectRef.current = {
          left: r.left,
          top: r.top,
          width: Math.max(r.width, MIN_W),
          height: Math.max(r.height, MIN_H),
        };
      }
    }
    setPopped(!popped);
  }, [popped, expanded, toggle, setPopped]);

  const ctx: PopupContextValue = useMemo(
    () => ({
      // Dragging is meaningless once maximized or popped — drop the starter.
      onHandlePointerDown: draggable && !expanded && !popped ? onHandlePointerDown : undefined,
      expanded,
      toggleFullscreen: toggle,
      popped,
      togglePopOut,
    }),
    [draggable, expanded, onHandlePointerDown, toggle, popped, togglePopOut],
  );

  // Cross-portal stacking (issue #82): seed the modal band so a floater opened
  // inside the dialog paints above it, and climb when nested in another overlay.
  const { zIndex, ceiling } = useStackLayer(Z_LAYER.modal, true);

  return (
    <BaseDialog.Popup
      {...rest}
      ref={setRefs}
      className={mergeClassName(
        cx(styles.popup, positioned && styles.draggable, expanded && styles.fullscreen),
        className,
      )}
      data-popped={popped ? "" : undefined}
      style={{ ...dragStyle, ...sizeStyle, ...style, ...(zIndex != null && { zIndex }) }}
    >
      <StackingProvider ceiling={ceiling}>
        <PopupContext.Provider value={ctx}>
          {popped &&
            (popOutPlaceholder ?? (
              <div className={styles.popped}>
                <p className={styles.poppedText}>This dialog is open in a separate window.</p>
                <div className={styles.poppedActions}>
                  <Button variant="secondary" size="sm" onClick={() => setPopped(false)}>
                    Bring back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => popWinRef.current?.focus()}>
                    Show window
                  </Button>
                </div>
              </div>
            ))}
          <PopOutWindow
            open={popped}
            onOpenChange={(next) => {
              if (next !== popped) setPopped(next);
            }}
            title={popOutTitle}
            rect={popRectRef.current}
            windowRef={popWinRef}
            className={styles.poppedSurface}
          >
            {children}
          </PopOutWindow>
        </PopupContext.Provider>
      </StackingProvider>
      {resizable && !expanded && !popped && (
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
    // Maximizing a placeholder is meaningless while the content is popped out.
    if (ctx?.popped) return null;
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

/** Icon button that pops the dialog's content out into a separate browser
 *  window (and back). Reads the popup's popped state from context, so it must
 *  live inside a `Dialog.Popup`; place it in `Dialog.Actions` next to
 *  `Maximize`/`CloseButton`. While popped it renders inside the popup window
 *  as the pressed return toggle. */
const PopOutButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
  function DialogPopOut({ className, onClick, onPointerDown, ...rest }, ref) {
    const ctx = useContext(PopupContext);
    const popped = ctx?.popped ?? false;
    return (
      <button
        type="button"
        aria-label={popped ? "Bring the dialog back" : "Open in a separate window"}
        aria-pressed={popped}
        {...rest}
        ref={ref}
        className={cx(styles.iconButton, className)}
        onClick={(event) => {
          onClick?.(event);
          ctx?.togglePopOut();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown?.(event);
        }}
      >
        <PopOutIcon />
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
  PopOut: PopOutButton,
  Title,
  Description,
  Close,
  CloseButton,
};
