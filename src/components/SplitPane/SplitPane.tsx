import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { type DragDelta, usePointerDrag } from "../../lib/usePointerDrag";
import styles from "./SplitPane.module.css";

export type SplitSide = "left" | "right" | "top" | "bottom";

/** Smallest the main pane is allowed to get (px) — the panel can't be dragged
 *  wider than `container − this`. */
const MIN_MAIN = 96;
/** Keyboard resize step (px). */
const KEY_STEP = 24;

interface SplitContextValue {
  side: SplitSide;
  open: boolean;
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
  /** Panel size in px (uncontrolled). Remembered across open/close. Default 320. */
  defaultSize?: number;
  /** Min / max panel size in px. `maxSize` is also capped to the container width
   *  minus a small minimum for the main pane. Default min 200. */
  minSize?: number;
  maxSize?: number;
  /** Fired with the new size (px) when a resize settles or a keyboard step lands. */
  onSizeChange?: (size: number) => void;
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
    defaultSize = 320,
    minSize = 200,
    maxSize,
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

  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startSize = useRef(size);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const clampSize = useCallback(
    (raw: number) => {
      let max = maxSize ?? Number.POSITIVE_INFINITY;
      const el = containerRef.current;
      if (el) {
        const verticalAxis = side === "top" || side === "bottom";
        const containerPx = verticalAxis ? el.clientHeight : el.clientWidth;
        max = Math.min(max, containerPx - MIN_MAIN);
      }
      return Math.max(minSize, Math.min(max, raw));
    },
    [side, minSize, maxSize],
  );

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
    onMove: (d) => setSize(clampSize(rawFromDelta(d))),
    onEnd: (d) => {
      const final = clampSize(rawFromDelta(d));
      setSize(final);
      setDragging(false);
      onSizeChange?.(final);
    },
  });

  const onDividerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // The key that grows the panel points from the divider toward the main pane.
    const growBySide = { left: "ArrowRight", right: "ArrowLeft", top: "ArrowDown", bottom: "ArrowUp" };
    const shrinkBySide = { left: "ArrowLeft", right: "ArrowRight", top: "ArrowUp", bottom: "ArrowDown" };
    const grow = growBySide[side];
    const shrink = shrinkBySide[side];
    let next: number;
    if (e.key === grow) next = size + KEY_STEP;
    else if (e.key === shrink) next = size - KEY_STEP;
    else return;
    e.preventDefault();
    const c = clampSize(next);
    setSize(c);
    onSizeChange?.(c);
  };

  let mainEl: ReactNode = null;
  let panelEl: ReactNode = null;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Main) mainEl = child;
    else if (child.type === Panel) panelEl = child;
  });

  const orientation = side === "top" || side === "bottom" ? "horizontal" : "vertical";
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

  return (
    <SplitContext.Provider value={{ side, open, size, setOpen }}>
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
