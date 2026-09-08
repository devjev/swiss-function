import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { type DragDelta, usePointerDrag } from "../../lib/usePointerDrag";
import styles from "./SplitPane.module.css";

export type SplitSide = "left" | "right" | "top" | "bottom";

/** A panel size: px as a number, or a share of the container as a percentage
 *  string (`"30%"`), which the panel keeps as the container resizes. */
export type SplitSize = number | string;

/** Smallest the main pane is allowed to get (px) by default: the panel can't be
 *  dragged wider than `container − this`. */
const MIN_MAIN = 96;
/** Keyboard resize step (px). */
const KEY_STEP = 24;

interface ParsedSize {
  px?: number;
  fraction?: number;
}

/** A number is px; a `"30%"` string is a fraction of the container; any other
 *  string is read as px. */
function parseSize(value: SplitSize): ParsedSize {
  if (typeof value === "number") return { px: value };
  const text = value.trim();
  if (text.endsWith("%")) {
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? { fraction: n / 100 } : { px: 0 };
  }
  const n = Number.parseFloat(text);
  return { px: Number.isFinite(n) ? n : 0 };
}

interface SplitContextValue {
  side: SplitSide;
  open: boolean;
  /** The panel's resolved size in px. */
  size: number;
  /** Set the open state (honors controlled/uncontrolled). For a close button
   *  inside the panel, read it via `useSplitPane()`. */
  setOpen: (open: boolean) => void;
}
const SplitContext = createContext<SplitContextValue | null>(null);

/** Access the enclosing `SplitPane`'s open state — e.g. for a close button. */
export function useSplitPane(): SplitContextValue {
  const ctx = useContext(SplitContext);
  if (!ctx) throw new Error("useSplitPane must be used within a <SplitPane>");
  return ctx;
}

export interface SplitMainProps extends HTMLAttributes<HTMLDivElement> {}

/** The main region — flexes to fill whatever the panel leaves. */
const Main = forwardRef<HTMLDivElement, SplitMainProps>(function SplitMain(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.main, className)} />;
});

export interface SplitPanelProps extends HTMLAttributes<HTMLDivElement> {}

/** The side panel — sized to `size` when open, collapsed to 0 when closed. */
const Panel = forwardRef<HTMLDivElement, SplitPanelProps>(function SplitPanel(
  { className, style, ...rest },
  ref,
) {
  const ctx = useContext(SplitContext);
  const size = ctx?.open ? (ctx?.size ?? 0) : 0;
  const vertical = ctx?.side === "top" || ctx?.side === "bottom";
  const sizeProp = vertical ? "blockSize" : "inlineSize";
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.panel, className)}
      style={{ [sizeProp]: `${size}px`, ...style }}
    />
  );
});

export interface SplitPaneProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Edge the panel sits on. Default `"right"`. */
  side?: SplitSide;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Allow dragging the divider to resize. Default `true`. */
  resizable?: boolean;
  /** Controlled panel size: px as a number, or a share of the container as a
   *  percentage string (`"30%"`). A drag or keyboard step reports through
   *  `onSizeChange`; the panel moves with the pointer while the drag lasts and
   *  then shows whatever the owner sets. */
  size?: SplitSize;
  /** Initial panel size when uncontrolled: px, or a percentage of the
   *  container (`"30%"`), which the panel keeps as the container resizes.
   *  Remembered across open/close. Default 320. */
  defaultSize?: SplitSize;
  /** Min / max panel size in px. `maxSize` is also capped to the container
   *  minus `minMainSize`, and so is a px panel in a container that shrinks
   *  below it. Default min 200. */
  minSize?: number;
  maxSize?: number;
  /** The least the main pane keeps, in px; the panel can never take more than
   *  the container minus this. Default 96. */
  minMainSize?: number;
  /** Fired with the new size when a resize settles or a keyboard step lands:
   *  the px, and the same as a fraction of the container (persist that one to
   *  restore a percentage size). */
  onSizeChange?: (size: number, fraction: number) => void;
  /** Expect `<SplitPane.Main>` and `<SplitPane.Panel>` as children. */
  children: ReactNode;
}

export const SplitPaneRoot = forwardRef<HTMLDivElement, SplitPaneProps>(function SplitPane(
  {
    side = "right",
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    resizable = true,
    size: sizeProp,
    defaultSize = 320,
    minSize = 200,
    maxSize,
    minMainSize = MIN_MAIN,
    onSizeChange,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setOpenState(next);
    },
    [onOpenChange, openProp],
  );

  const verticalAxis = side === "top" || side === "bottom";

  // The size model: px, or a fraction of the container. The uncontrolled state
  // holds whichever form `defaultSize` came in; a drag keeps that form, so a
  // percentage panel stays a percentage. During a drag a px override follows
  // the pointer whether or not the size is controlled.
  const [sizeState, setSizeState] = useState<ParsedSize>(() => parseSize(defaultSize));
  const stored = sizeProp !== undefined ? parseSize(sizeProp) : sizeState;
  const [dragPx, setDragPx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // The container's extent along the split axis, kept current by a
  // ResizeObserver: a percentage panel follows it, and a px panel is clamped
  // to it so a container that shrinks below the panel never overflows.
  const [containerPx, setContainerPx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const measure = useCallback(
    (el: HTMLDivElement) => {
      const next = verticalAxis ? el.clientHeight : el.clientWidth;
      setContainerPx((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    },
    [verticalAxis],
  );
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      containerRef.current = node;
      if (node) {
        measure(node);
        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(() => measure(node));
          ro.observe(node);
          observerRef.current = ro;
        }
      }
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref, measure],
  );

  const clampSize = useCallback(
    (raw: number) => {
      let max = maxSize ?? Number.POSITIVE_INFINITY;
      const el = containerRef.current;
      const extent = containerPx || (el ? (verticalAxis ? el.clientHeight : el.clientWidth) : 0);
      if (extent > 0) max = Math.min(max, extent - minMainSize);
      return Math.max(minSize, Math.min(max, raw));
    },
    [containerPx, verticalAxis, minSize, maxSize, minMainSize],
  );

  const resolvedPx =
    stored.fraction !== undefined ? stored.fraction * containerPx : (stored.px ?? 0);
  const size = clampSize(dragPx ?? resolvedPx);

  /** Store a settled px size in the uncontrolled state, keeping the form the
   *  size came in (a percentage stays a percentage). */
  const commit = useCallback(
    (px: number) => {
      const fraction = containerPx > 0 ? px / containerPx : 0;
      if (sizeProp === undefined) {
        setSizeState(stored.fraction !== undefined && containerPx > 0 ? { fraction } : { px });
      }
      onSizeChange?.(px, fraction);
    },
    [containerPx, sizeProp, stored.fraction, onSizeChange],
  );

  const startSize = useRef(size);

  // Dragging the divider toward the main pane grows the panel; the sign of the
  // delta depends on which edge the panel is on.
  const rawFromDelta = useCallback(
    (d: DragDelta) => {
      if (side === "left") return startSize.current + d.dx;
      if (side === "top") return startSize.current + d.dy;
      if (side === "bottom") return startSize.current - d.dy;
      return startSize.current - d.dx; // right
    },
    [side],
  );

  const { onPointerDown } = usePointerDrag({
    onStart: () => {
      startSize.current = size;
      setDragging(true);
    },
    onMove: (d) => setDragPx(clampSize(rawFromDelta(d))),
    onEnd: (d) => {
      const final = clampSize(rawFromDelta(d));
      setDragPx(null);
      setDragging(false);
      commit(final);
    },
  });

  const onDividerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // The key that grows the panel points from the divider toward the main pane.
    const growBySide = {
      left: "ArrowRight",
      right: "ArrowLeft",
      top: "ArrowDown",
      bottom: "ArrowUp",
    };
    const shrinkBySide = {
      left: "ArrowLeft",
      right: "ArrowRight",
      top: "ArrowUp",
      bottom: "ArrowDown",
    };
    const grow = growBySide[side];
    const shrink = shrinkBySide[side];
    let next: number;
    if (e.key === grow) next = size + KEY_STEP;
    else if (e.key === shrink) next = size - KEY_STEP;
    else return;
    e.preventDefault();
    commit(clampSize(next));
  };

  let mainEl: ReactNode = null;
  let panelEl: ReactNode = null;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Main) mainEl = child;
    else if (child.type === Panel) panelEl = child;
  });

  const orientation = verticalAxis ? "horizontal" : "vertical";
  const divider =
    resizable && open ? (
      // biome-ignore lint/a11y/useSemanticElements: ARIA splitter pattern — a focusable, draggable resize separator; <hr> can't be interactive.
      <div
        role="separator"
        aria-orientation={orientation}
        aria-label="Resize panel"
        aria-valuenow={Math.round(size)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        tabIndex={0}
        className={styles.divider}
        onPointerDown={onPointerDown}
        onKeyDown={onDividerKey}
      />
    ) : null;

  // Render order so the panel sits on the chosen edge (panel-first for the
  // leading edges: left and top).
  const ordered =
    side === "left" || side === "top" ? (
      <>
        {panelEl}
        {divider}
        {mainEl}
      </>
    ) : (
      <>
        {mainEl}
        {divider}
        {panelEl}
      </>
    );

  // Stable context identity: without the memo every parent-driven re-render
  // hands consumers a fresh object and re-renders them all.
  const splitCtx = useMemo(() => ({ side, open, size, setOpen }), [side, open, size, setOpen]);

  return (
    <SplitContext.Provider value={splitCtx}>
      <div
        {...rest}
        ref={setRefs}
        className={cx(styles.root, className)}
        data-side={side}
        data-dragging={dragging || undefined}
      >
        {ordered}
      </div>
    </SplitContext.Provider>
  );
});

export const SplitPane = Object.assign(SplitPaneRoot, { Main, Panel });
