import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { Fragment, forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { usePointerDrag } from "../../lib/usePointerDrag";
import type { DropSlot, NavDirection, StripModel, WindowMove } from "./layout";
import {
  clampWidth,
  collectElements,
  edgeWindow,
  findWindow,
  moveByKey,
  neighbor,
  projectMove,
  rowTrack,
  subrowCount,
  successor,
} from "./layout";
import styles from "./WindowArray.module.css";

export type { WindowMove } from "./layout";

const DEFAULT_COLUMN_WIDTH = 480;

function toUnit(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

/** Window-chrome icons — shared 16px line set, matching `Dialog`/`ChatDrawer`. */
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
const ChevronLeftIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M10 3L5 8l5 5" strokeLinecap="square" />
  </svg>
);
const ChevronRightIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M6 3l5 5-5 5" strokeLinecap="square" />
  </svg>
);

// --- Column / Window (data carriers; never rendered directly — Root projects
// them, same contract as Reflow.Column) -------------------------------------

export interface WindowArrayColumnProps extends HTMLAttributes<HTMLDivElement> {
  /** Stable identity — move targets and width callbacks are keyed by it. */
  id: string;
  /** Controlled column width in px. */
  width?: number;
  /** Initial width in px when uncontrolled. Default `480`. */
  defaultWidth?: number;
  /** Fired with the new width (px) when a resize settles (drag end, key press,
   *  or double-click reset). */
  onWidthChange?: (width: number) => void;
  /** Min width in px; falls back to the root's `columnMinWidth`. */
  minWidth?: number;
  /** Allow dragging the column's trailing gutter to resize. Default `true`. */
  resizable?: boolean;
  /** Expect `WindowArray.Window` elements. */
  children?: ReactNode;
}

function Column(_props: WindowArrayColumnProps): null {
  return null;
}

export interface WindowArrayWindowProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Stable identity — active/fullscreen state and moves are keyed by it. */
  id: string;
  /** Shown in the title bar; also the window's accessible label. */
  title: ReactNode;
  /** Renders the ✕ button. Closing means the consumer removes the element. */
  onClose?: () => void;
  /** Show the fullscreen toggle. Default `true`. */
  maximizable?: boolean;
  /** Allow this window to be rearranged (drag / Shift+Arrow). Default `true`. */
  movable?: boolean;
  /** Extra icon buttons rendered before the maximize/close buttons. */
  actions?: ReactNode;
  /** Window body; scrolls internally. */
  children?: ReactNode;
}

function Window(_props: WindowArrayWindowProps): null {
  return null;
}

// --- Root -------------------------------------------------------------------

export interface WindowArrayProps extends HTMLAttributes<HTMLElement> {
  /** Controlled active (focused) window id. */
  activeId?: string | null;
  /** Initial active window when uncontrolled. */
  defaultActiveId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Controlled fullscreen window id (fills the WindowArray container). */
  fullscreenId?: string | null;
  /** Initial fullscreen window when uncontrolled. */
  defaultFullscreenId?: string | null;
  onFullscreenChange?: (id: string | null) => void;
  /** Enables rearranging (title-bar drag and Shift+Arrow). The component only
   *  reports the move — apply it to your own state. Absent → rearranging off. */
  onWindowMove?: (move: WindowMove) => void;
  /** Gap between columns and windows; `number` → `--sf-unit` multiples.
   *  Default `0.5`. Also the width of the resize gutters. */
  gap?: number | string;
  /** Default min column width in px for resizing. Default `240`. */
  columnMinWidth?: number;
  /** Proximity scroll-snap to column centers (suspended while dragging or
   *  resizing so gestures aren't fought). Default `false`. */
  snap?: boolean;
  /** Floating prev/next paddles at the inline edges that switch the active
   *  window to the neighbouring column. Default `false`. */
  controls?: boolean;
  /** Alt+ArrowLeft/Right switch columns while focus is anywhere inside the
   *  array (window content included) — scoped to the component, never the
   *  document. Default `false`. */
  hotkeys?: boolean;
  /** Expect `WindowArray.Column` elements. */
  children?: ReactNode;
}

const Root = forwardRef<HTMLElement, WindowArrayProps>(function WindowArray(
  {
    activeId: activeProp,
    defaultActiveId = null,
    onActiveChange,
    fullscreenId: fullscreenProp,
    defaultFullscreenId = null,
    onFullscreenChange,
    onWindowMove,
    gap = 0.5,
    columnMinWidth = 240,
    snap = false,
    controls = false,
    hotkeys = false,
    className,
    style,
    children,
    onKeyDown: onKeyDownProp,
    ...rest
  },
  ref,
) {
  // --- Model from declarative children (Reflow collection pattern) ---------
  const columnEls = collectElements<WindowArrayColumnProps>(children, Column);
  const columns = columnEls.map((el) => ({
    props: el.props,
    windows: collectElements<WindowArrayWindowProps>(el.props.children, Window).map((w) => w.props),
  }));
  const model: StripModel = {
    columns: columns.map((c) => ({
      id: c.props.id,
      windowIds: c.windows.map((w) => w.id),
    })),
  };
  const modelRef = useRef(model);
  modelRef.current = model;

  // --- Active / fullscreen (controlled triples; explicit undefined checks
  // because null is a legitimate controlled value) ---------------------------
  const [activeState, setActiveState] = useState<string | null>(defaultActiveId);
  const active = activeProp !== undefined ? activeProp : activeState;
  const setActive = useCallback(
    (next: string | null) => {
      onActiveChange?.(next);
      if (activeProp === undefined) setActiveState(next);
    },
    [onActiveChange, activeProp],
  );

  const [fullscreenState, setFullscreenState] = useState<string | null>(defaultFullscreenId);
  const fullscreen = fullscreenProp !== undefined ? fullscreenProp : fullscreenState;
  const setFullscreen = useCallback(
    (next: string | null) => {
      onFullscreenChange?.(next);
      if (fullscreenProp === undefined) setFullscreenState(next);
    },
    [onFullscreenChange, fullscreenProp],
  );

  // A stale controlled id (window no longer exists) reads as null.
  const resolvedActive = active != null && findWindow(model, active) ? active : null;
  const resolvedFullscreen =
    fullscreen != null && findWindow(model, fullscreen) ? fullscreen : null;
  // The single Tab stop: the active window's handle, else the first window's.
  const rovingId = resolvedActive ?? edgeWindow(model, "first");

  // --- Element registries ---------------------------------------------------
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusRef = useRef<string | null>(null);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // --- Column resize (in-flow gutters, one shared drag instance) -----------
  const [widthOverrides, setWidthOverrides] = useState<Record<string, number>>({});
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStart = useRef<{
    columnId: string;
    start: number;
    min: number;
    controlled: boolean;
    onWidthChange?: (width: number) => void;
  } | null>(null);

  const columnWidth = useCallback(
    (props: WindowArrayColumnProps) =>
      widthOverrides[props.id] ?? props.width ?? props.defaultWidth ?? DEFAULT_COLUMN_WIDTH,
    [widthOverrides],
  );

  const { onPointerDown: onGutterPointerDown } = usePointerDrag({
    onStart: (_origin, event) => {
      const columnId = (event.currentTarget as HTMLElement).dataset.resizeFor;
      const col = columns.find((c) => c.props.id === columnId);
      if (!columnId || !col) return;
      resizeStart.current = {
        columnId,
        start: columnWidth(col.props),
        min: col.props.minWidth ?? columnMinWidth,
        controlled: col.props.width !== undefined,
        onWidthChange: col.props.onWidthChange,
      };
      setResizingId(columnId);
    },
    onMove: (delta) => {
      const s = resizeStart.current;
      if (!s) return;
      const next = clampWidth(s.start + delta.dx, s.min);
      setWidthOverrides((prev) => ({ ...prev, [s.columnId]: next }));
    },
    onEnd: (delta) => {
      const s = resizeStart.current;
      resizeStart.current = null;
      setResizingId(null);
      if (!s) return;
      const final = clampWidth(s.start + delta.dx, s.min);
      s.onWidthChange?.(final);
      // Controlled columns take back over from the live override on settle.
      if (s.controlled) {
        setWidthOverrides(({ [s.columnId]: _drop, ...rest }) => rest);
      } else {
        setWidthOverrides((prev) => ({ ...prev, [s.columnId]: final }));
      }
    },
  });

  const resizeByKey = useCallback(
    (props: WindowArrayColumnProps, event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // Leave modified arrows alone (Alt+Arrow is the column-switch hotkey).
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      const min = props.minWidth ?? columnMinWidth;
      const current = columnWidth(props);
      const next = clampWidth(current + (event.key === "ArrowRight" ? step : -step), min);
      if (next === current) return;
      props.onWidthChange?.(next);
      if (props.width === undefined) {
        setWidthOverrides((prev) => ({ ...prev, [props.id]: next }));
      }
    },
    [columnMinWidth, columnWidth],
  );

  const resetWidth = useCallback((props: WindowArrayColumnProps) => {
    setWidthOverrides(({ [props.id]: _drop, ...rest }) => rest);
    props.onWidthChange?.(props.defaultWidth ?? DEFAULT_COLUMN_WIDTH);
  }, []);

  // --- Drag-rearrange (dnd-kit core; Explorer precedent) --------------------
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<DropSlot | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const within = pointerWithin(args);
    return within.length > 0 ? within : closestCenter(args);
  }, []);

  const computeDrop = useCallback(
    (e: DragMoveEvent | DragEndEvent, dragging: string): DropSlot | null => {
      if (!e.over) return null;
      const data = e.over.data.current as
        | { gapIndex?: number; columnId?: string; row?: number | null }
        | undefined;
      if (!data) return null;
      let slot: DropSlot | null = null;
      if (data.gapIndex != null) {
        slot = { kind: "column", index: data.gapIndex };
      } else if (data.columnId != null) {
        if (data.row == null) {
          // Empty column: the whole body is one insertion slot.
          slot = { kind: "cell", columnId: data.columnId, index: 0 };
        } else {
          const activator = e.activatorEvent as PointerEvent | null;
          if (activator == null) return null;
          const y = activator.clientY + e.delta.y;
          const rect = e.over.rect;
          slot = {
            kind: "cell",
            columnId: data.columnId,
            index: y < rect.top + rect.height / 2 ? data.row : data.row + 1,
          };
        }
      }
      if (!slot) return null;
      // Null out no-op drops so no indicator appears for them.
      return projectMove(modelRef.current, dragging, slot) ? slot : null;
    },
    [],
  );

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);
      setDraggingId(id);
      setActive(id);
    },
    [setActive],
  );
  const onDragMove = useCallback(
    (e: DragMoveEvent) => {
      setDropSlot(draggingId ? computeDrop(e, draggingId) : null);
    },
    [draggingId, computeDrop],
  );
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const id = draggingId;
      setDraggingId(null);
      setDropSlot(null);
      if (!id) return;
      const slot = computeDrop(e, id);
      const move = slot ? projectMove(modelRef.current, id, slot) : null;
      if (move) {
        pendingFocusRef.current = id;
        onWindowMove?.(move);
      }
    },
    [draggingId, computeDrop, onWindowMove],
  );
  const onDragCancel = useCallback(() => {
    setDraggingId(null);
    setDropSlot(null);
  }, []);

  // --- Keyboard navigation on window handles --------------------------------
  const focusHandle = useCallback((id: string) => {
    handleRefs.current.get(id)?.focus();
  }, []);

  const onHandleKeyDown = useCallback(
    (id: string) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const dirs: Record<string, NavDirection> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const dir = dirs[event.key];
      if (dir) {
        // Alt/Ctrl/Meta arrows are not ours (Alt+Arrow bubbles to the root
        // hotkey handler; the others are browser/OS combos).
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        if (event.shiftKey) {
          if (!onWindowMove) return;
          const move = moveByKey(modelRef.current, id, dir);
          if (move) {
            pendingFocusRef.current = id;
            onWindowMove(move);
          }
        } else {
          const next = neighbor(modelRef.current, id, dir);
          if (next) {
            setActive(next);
            focusHandle(next);
          }
        }
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = edgeWindow(modelRef.current, event.key === "Home" ? "first" : "last");
        if (next) {
          setActive(next);
          focusHandle(next);
        }
      } else if (event.key === "Escape" && resolvedFullscreen != null) {
        event.preventDefault();
        setFullscreen(null);
      }
    },
    [onWindowMove, setActive, focusHandle, resolvedFullscreen, setFullscreen],
  );

  // Escape exits fullscreen from anywhere (container-scoped — no body scroll
  // lock; deliberately NOT `useFullscreen`, which overlays the viewport).
  useEffect(() => {
    if (resolvedFullscreen == null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [resolvedFullscreen, setFullscreen]);

  // --- Focus / state upkeep when windows come and go ------------------------
  const prevModelRef = useRef(model);
  useEffect(() => {
    const prev = prevModelRef.current;
    prevModelRef.current = model;
    // Refocus a window after a rearrange re-render: reordering keyed siblings
    // moves the DOM node, and moving a focused element blurs it.
    const pending = pendingFocusRef.current;
    if (pending != null && findWindow(model, pending)) {
      pendingFocusRef.current = null;
      focusHandle(pending);
    }
    // The active window was removed: hand focus to its successor.
    if (active != null && !findWindow(model, active) && findWindow(prev, active)) {
      const next = successor(prev, active);
      const valid = next != null && findWindow(model, next) ? next : edgeWindow(model, "first");
      setActive(valid);
      // Only steal focus if the removal actually dropped it on <body>.
      if (valid != null && (document.activeElement === document.body || !document.activeElement)) {
        focusHandle(valid);
      }
    }
    if (fullscreen != null && !findWindow(model, fullscreen)) setFullscreen(null);
  });

  // Auto-scroll the strip when the active window's column is (partly) out of
  // view: minimal reveal to the NEAREST EDGE (Niri-style), keeping the
  // column's gutter visible — never centering. Container-scoped on purpose —
  // scrollIntoView would also scroll the page. Smoothness comes from CSS
  // `scroll-behavior`; with `snap` on, both edge positions are exactly the
  // CSS snap positions (start on backdrops, end on windows, gap padding).
  useEffect(() => {
    if (resolvedActive == null) return;
    const viewport = viewportRef.current;
    const pos = findWindow(modelRef.current, resolvedActive);
    const columnId = pos ? (modelRef.current.columns[pos.col]?.id ?? null) : null;
    const column = columnId ? columnRefs.current.get(columnId) : null;
    if (!viewport || !column) return;
    const viewportRect = viewport.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    // The backdrop's previous sibling is always its leading gutter — measure
    // it so the gap stays in view at the aligned edge.
    const gapPx = column.previousElementSibling?.getBoundingClientRect().width ?? 0;
    const left = columnRect.left - viewportRect.left + viewport.scrollLeft;
    const startAligned = left - gapPx;
    const endAligned = left + columnRect.width + gapPx - viewport.clientWidth;
    let target: number | null = null;
    if (viewport.scrollLeft > startAligned) target = startAligned;
    else if (viewport.scrollLeft < endAligned) target = endAligned;
    if (target == null) return;
    viewport.scrollTo({
      left: Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, target)),
    });
  }, [resolvedActive]);

  // --- Column switching (paddle controls + Alt+Arrow hotkeys) ---------------
  // With no active window, "next" starts at the strip's first window and
  // "previous" at its last; otherwise the neighbouring column, row clamped.
  const switchTarget = (dir: "left" | "right"): string | null =>
    resolvedActive == null
      ? edgeWindow(model, dir === "left" ? "last" : "first")
      : neighbor(model, resolvedActive, dir);

  const switchColumn = (dir: "left" | "right", focus: boolean) => {
    const next = switchTarget(dir);
    if (next == null) return;
    setActive(next);
    if (focus) focusHandle(next);
  };

  const handleRootKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    onKeyDownProp?.(event);
    if (!hotkeys || event.defaultPrevented) return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // Also suppresses the browser's Alt+Arrow history navigation while the
    // strip has focus.
    event.preventDefault();
    switchColumn(event.key === "ArrowLeft" ? "left" : "right", true);
  };

  // --- Drop-indicator resolution --------------------------------------------
  const dropEdgeFor = (columnId: string, row: number, count: number): "before" | "after" | null => {
    if (dropSlot?.kind !== "cell" || dropSlot.columnId !== columnId) return null;
    if (dropSlot.index === row) return "before";
    // Only the last window shows an "after" line — for every other slot the
    // next window's "before" line is the same boundary.
    if (dropSlot.index === row + 1 && row === count - 1) return "after";
    return null;
  };

  const draggingProps = draggingId
    ? columns.flatMap((c) => c.windows).find((w) => w.id === draggingId)
    : undefined;

  const lastColumn = columns.length > 0 ? columns[columns.length - 1] : undefined;
  const gapSize = toUnit(gap);

  // Flat strip grid: alternating gutter/column tracks (gutter i sits before
  // column i), fractional subrows so unequal stacks share the height exactly.
  // Windows are placed by grid-column/grid-row, NOT nested in column elements
  // — a rearrange only changes a keyed sibling's placement, so React keeps the
  // window's fiber and its content state survives the move.
  const subrows = subrowCount(columns.map((c) => c.windows.length));
  const stripStyle: CSSProperties | undefined = lastColumn
    ? {
        gridTemplateColumns: `${gapSize} ${columns
          .map((c) => `${columnWidth(c.props)}px`)
          .join(` ${gapSize} `)} ${gapSize}`,
        gridTemplateRows: `repeat(${subrows}, minmax(0, 1fr))`,
      }
    : undefined;

  return (
    // A <section> with a consumer-supplied aria-label is a named region
    // landmark — document the label in API.md rather than defaulting one.
    // biome-ignore lint/a11y/noStaticElementInteractions: onKeyDown only observes bubbling Alt+Arrow hotkeys from focusable descendants; the section itself is not interactive.
    <section
      {...rest}
      ref={setRefs}
      className={cx(styles.root, className)}
      style={{ "--sf-wa-gap": gapSize, ...style } as CSSProperties}
      data-has-fullscreen={resolvedFullscreen != null ? "" : undefined}
      data-snap={snap ? "" : undefined}
      data-interacting={draggingId != null || resizingId != null ? "" : undefined}
      onKeyDown={handleRootKeyDown}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div ref={viewportRef} className={styles.viewport}>
          <div className={styles.strip} style={stripStyle}>
            {columns.map((col, ci) => {
              const before = ci > 0 ? columns[ci - 1] : undefined;
              return (
                <Fragment key={col.props.id}>
                  <GutterView
                    index={ci}
                    leftColumn={before ? before.props : null}
                    width={before ? columnWidth(before.props) : 0}
                    minWidth={before ? (before.props.minWidth ?? columnMinWidth) : 0}
                    resizing={before != null && resizingId === before.props.id}
                    dropActive={dropSlot?.kind === "column" && dropSlot.index === ci}
                    onPointerDown={onGutterPointerDown}
                    onKeyDown={resizeByKey}
                    onReset={resetWidth}
                  />
                  <ColumnBackdrop
                    col={col.props}
                    windowCount={col.windows.length}
                    gridColumn={ci * 2 + 2}
                    registerColumn={columnRefs.current}
                  />
                </Fragment>
              );
            })}
            {lastColumn && (
              <GutterView
                index={columns.length}
                leftColumn={lastColumn.props}
                width={columnWidth(lastColumn.props)}
                minWidth={lastColumn.props.minWidth ?? columnMinWidth}
                resizing={resizingId === lastColumn.props.id}
                dropActive={dropSlot?.kind === "column" && dropSlot.index === columns.length}
                onPointerDown={onGutterPointerDown}
                onKeyDown={resizeByKey}
                onReset={resetWidth}
              />
            )}
            {/* One flat keyed list for every window on the strip — the single
                stable parent that makes cross-column moves state-preserving.
                Do NOT nest these under per-column elements or fragments. */}
            {columns.flatMap((col, ci) =>
              col.windows.map((win, row) => (
                <WindowView
                  key={win.id}
                  win={win}
                  columnId={col.props.id}
                  row={row}
                  gridColumn={ci * 2 + 2}
                  rowTrack={rowTrack(row, col.windows.length, subrows)}
                  active={resolvedActive === win.id}
                  fullscreen={resolvedFullscreen === win.id}
                  anyFullscreen={resolvedFullscreen != null}
                  rovingTab={rovingId === win.id}
                  dragging={draggingId === win.id}
                  dropEdge={dropEdgeFor(col.props.id, row, col.windows.length)}
                  moveEnabled={(win.movable ?? true) && onWindowMove != null}
                  onActivate={() => {
                    if (resolvedActive !== win.id) setActive(win.id);
                  }}
                  onToggleFullscreen={() => {
                    setActive(win.id);
                    setFullscreen(resolvedFullscreen === win.id ? null : win.id);
                  }}
                  onKeyDown={onHandleKeyDown(win.id)}
                  registerHandle={handleRefs.current}
                />
              )),
            )}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {draggingProps ? <div className={styles.dragGhost}>{draggingProps.title}</div> : null}
        </DragOverlay>
      </DndContext>
      {controls && resolvedFullscreen == null && columns.length > 0 && (
        <>
          <button
            type="button"
            aria-label="Previous column"
            className={styles.pager}
            data-side="start"
            disabled={switchTarget("left") == null}
            onClick={() => switchColumn("left", false)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            aria-label="Next column"
            className={styles.pager}
            data-side="end"
            disabled={switchTarget("right") == null}
            onClick={() => switchColumn("right", false)}
          >
            <ChevronRightIcon />
          </button>
        </>
      )}
    </section>
  );
});

// --- Internal views ----------------------------------------------------------

interface ColumnBackdropProps {
  col: WindowArrayColumnProps;
  windowCount: number;
  gridColumn: number;
  registerColumn: Map<string, HTMLDivElement>;
}

/** Invisible full-height grid item under a column's windows. It carries the
 *  consumer's Column props, is the measuring target for auto-scroll, and is
 *  the drop target for an empty column (occupied columns defer to their
 *  windows' droppables). The windows themselves are NOT its children. */
function ColumnBackdrop({ col, windowCount, gridColumn, registerColumn }: ColumnBackdropProps) {
  const {
    id,
    width: _width,
    defaultWidth: _defaultWidth,
    onWidthChange: _onWidthChange,
    minWidth: _minWidth,
    resizable: _resizable,
    className,
    style,
    children: _children,
    ...rest
  } = col;
  const { setNodeRef } = useDroppable({
    id: `col-${id}`,
    data: { columnId: id, row: null },
    disabled: windowCount > 0,
  });
  return (
    <div
      {...rest}
      ref={(el) => {
        setNodeRef(el);
        if (el) registerColumn.set(id, el);
        else registerColumn.delete(id);
      }}
      data-column-id={id}
      className={cx(styles.columnBack, className)}
      style={{ gridColumn, ...style }}
    />
  );
}

interface GutterViewProps {
  index: number;
  /** The column this gutter resizes (its left neighbour); null for the leading
   *  gutter, which is drop-only. */
  leftColumn: WindowArrayColumnProps | null;
  width: number;
  minWidth: number;
  resizing: boolean;
  dropActive: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (col: WindowArrayColumnProps, event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onReset: (col: WindowArrayColumnProps) => void;
}

function GutterView({
  index,
  leftColumn,
  width,
  minWidth,
  resizing,
  dropActive,
  onPointerDown,
  onKeyDown,
  onReset,
}: GutterViewProps) {
  const { setNodeRef } = useDroppable({ id: `gap-${index}`, data: { gapIndex: index } });
  const resizable = leftColumn != null && (leftColumn.resizable ?? true);
  const placement: CSSProperties = { gridColumn: index * 2 + 1 };
  if (!resizable) {
    return (
      <div
        ref={setNodeRef}
        aria-hidden="true"
        className={styles.gutter}
        style={placement}
        data-drop-active={dropActive ? "" : undefined}
      />
    );
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable, draggable resize grip is not an <hr>
    <div
      ref={setNodeRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      aria-valuenow={Math.round(width)}
      aria-valuemin={minWidth}
      tabIndex={0}
      className={styles.gutter}
      style={placement}
      data-resizable=""
      data-resize-for={leftColumn.id}
      data-dragging={resizing ? "" : undefined}
      data-drop-active={dropActive ? "" : undefined}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => onKeyDown(leftColumn, event)}
      onDoubleClick={() => onReset(leftColumn)}
    />
  );
}

interface WindowViewProps {
  win: WindowArrayWindowProps;
  columnId: string;
  row: number;
  gridColumn: number;
  rowTrack: { start: number; span: number };
  active: boolean;
  fullscreen: boolean;
  anyFullscreen: boolean;
  rovingTab: boolean;
  dragging: boolean;
  dropEdge: "before" | "after" | null;
  moveEnabled: boolean;
  onActivate: () => void;
  onToggleFullscreen: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  registerHandle: Map<string, HTMLButtonElement>;
}

function WindowView({
  win,
  columnId,
  row,
  gridColumn,
  rowTrack: track,
  active,
  fullscreen,
  anyFullscreen,
  rovingTab,
  dragging,
  dropEdge,
  moveEnabled,
  onActivate,
  onToggleFullscreen,
  onKeyDown,
  registerHandle,
}: WindowViewProps) {
  const {
    id,
    title,
    onClose,
    maximizable = true,
    movable: _movable,
    actions,
    className,
    style,
    children,
    ...rest
  } = win;
  const titleId = useId();
  const dragEnabled = moveEnabled && !anyFullscreen;
  const { setNodeRef: setDragRef, listeners } = useDraggable({
    id,
    disabled: !dragEnabled,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `win-${id}`,
    data: { columnId, row },
  });
  return (
    // biome-ignore lint/a11y/useSemanticElements: a window holds arbitrary interactive content — "group" labelled by its title fits; <fieldset> does not.
    <section
      {...rest}
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      role="group"
      aria-labelledby={titleId}
      data-window-id={id}
      data-column-id={columnId}
      className={cx(styles.window, className)}
      style={{ gridColumn, gridRow: `${track.start} / span ${track.span}`, ...style }}
      data-active={active ? "" : undefined}
      data-fullscreen={fullscreen ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-drop-edge={dropEdge ?? undefined}
      onPointerDownCapture={onActivate}
    >
      <header className={styles.titlebar} data-movable={dragEnabled ? "" : undefined}>
        {/* The handle button is the window's single roving Tab stop: its text
            is the accessible name, arrows navigate, Shift+arrows move, and the
            dnd-kit pointer listeners make it the drag grip. */}
        <button
          {...listeners}
          type="button"
          id={titleId}
          ref={(el) => {
            if (el) registerHandle.set(id, el);
            else registerHandle.delete(id);
          }}
          className={styles.handle}
          tabIndex={rovingTab ? 0 : -1}
          onClick={onActivate}
          onKeyDown={onKeyDown}
        >
          {title}
        </button>
        <div
          className={styles.actions}
          onPointerDown={(event) => {
            // Buttons never start a drag (Dialog.Actions pattern).
            event.stopPropagation();
          }}
        >
          {actions}
          {maximizable && (
            <button
              type="button"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              aria-pressed={fullscreen}
              className={styles.iconButton}
              onClick={onToggleFullscreen}
            >
              {fullscreen ? <CollapseIcon /> : <ExpandIcon />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Close"
              className={styles.iconButton}
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

export const WindowArray = Object.assign(Root, { Column, Window });
