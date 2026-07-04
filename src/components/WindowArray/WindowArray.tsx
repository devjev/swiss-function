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
  ComponentPropsWithoutRef,
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
  slotsEqual,
  subrowCount,
  successor,
  transposeDir,
} from "./layout";
import styles from "./WindowArray.module.css";

export type { WindowMove } from "./layout";

const DEFAULT_COLUMN_WIDTH = 480;
/** Default `verticalBelow` breakpoint: narrower than one default column and
 *  the horizontal strip has no room to breathe. */
const DEFAULT_VERTICAL_BELOW = 480;
/** Largest near-fit overflow (px) absorbed by narrowing the last column
 *  instead of growing a horizontal scrollbar. */
const SQUEEZE_MAX = 8;
/** Distance (px) from an inline edge within which its paddle fades in. */
const PADDLE_PROXIMITY = 80;

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
const ChevronUpIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M3 10l5-5 5 5" strokeLinecap="square" />
  </svg>
);
const ChevronDownIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M3 6l5 5 5-5" strokeLinecap="square" />
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

/** Resting shadow depth for the strip's windows (`--sf-elevation-N`). */
export type WindowArrayElevation = 0 | 1 | 2 | 3 | 4 | 5;

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
  /** Resting shadow depth for the windows (`--sf-elevation-N`). Default `1`. */
  elevation?: WindowArrayElevation;
  /** Proximity scroll-snap to column centers (suspended while dragging or
   *  resizing so gestures aren't fought). Default `false`. */
  snap?: boolean;
  /** Floating prev/next paddles at the inline edges that switch the active
   *  window to the neighbouring column. Each fades in while the pointer is
   *  near its edge (always visible on hoverless devices). Default `false`. */
  controls?: boolean;
  /** Alt+ArrowLeft/Right switch columns while focus is anywhere inside the
   *  array (window content included) — scoped to the component, never the
   *  document. Alt+ArrowUp/Down in the vertical orientation. Default `false`. */
  hotkeys?: boolean;
  /** Layout axis. `"auto"` transposes to a vertical, top-to-bottom strip while
   *  the container is narrower than `verticalBelow`: columns become full-width
   *  bands and their windows sit side by side. Default `"auto"`. */
  orientation?: "auto" | "horizontal" | "vertical";
  /** Container width (px) below which `orientation="auto"` goes vertical.
   *  Default `480`. */
  verticalBelow?: number;
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
    elevation = 1,
    snap = false,
    controls = false,
    hotkeys = false,
    orientation = "auto",
    verticalBelow = DEFAULT_VERTICAL_BELOW,
    className,
    style,
    children,
    onKeyDown: onKeyDownProp,
    onPointerMove: onPointerMoveProp,
    onPointerLeave: onPointerLeaveProp,
    ...rest
  },
  ref,
) {
  // --- Model from declarative children (Reflow collection pattern) ---------
  // Memoized on `children`: internal state changes (drop slot per pointermove,
  // width overrides per resize step, squeeze, active/fullscreen) re-render
  // without re-walking the consumer's element tree.
  const { columns, model } = useMemo(() => {
    const columnEls = collectElements<WindowArrayColumnProps>(children, Column);
    const cols = columnEls.map((el) => ({
      props: el.props,
      windows: collectElements<WindowArrayWindowProps>(el.props.children, Window).map(
        (w) => w.props,
      ),
    }));
    const strip: StripModel = {
      columns: cols.map((c) => ({
        id: c.props.id,
        windowIds: c.windows.map((w) => w.id),
      })),
    };
    return { columns: cols, model: strip };
  }, [children]);
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
  const rootRef = useRef<HTMLElement | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusRef = useRef<string | null>(null);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // --- Orientation -----------------------------------------------------------
  // "auto" watches the ROOT's width (parent-controlled — the scrollbar lives
  // inside the viewport, so switching orientation can't feed back into the
  // measurement). Before the first observer tick the strip renders horizontal.
  const [measuredNarrow, setMeasuredNarrow] = useState(false);
  useEffect(() => {
    if (orientation !== "auto") return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? root.clientWidth;
      setMeasuredNarrow(width < verticalBelow);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [orientation, verticalBelow]);
  const vertical = orientation === "vertical" || (orientation === "auto" && measuredNarrow);
  // For stable callbacks (drop projection, squeeze) that must not re-bind
  // dnd-kit listeners or the ResizeObserver on an orientation flip.
  const verticalRef = useRef(vertical);
  verticalRef.current = vertical;

  // --- Column resize (in-flow gutters, one shared drag instance) -----------
  const [widthOverrides, setWidthOverrides] = useState<Record<string, number>>({});
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStart = useRef<{
    columnId: string;
    start: number;
    min: number;
    controlled: boolean;
    /** Drag axis captured at press, so an orientation flip mid-drag (container
     *  resize during the gesture) can't scramble the delta. */
    vertical: boolean;
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
        vertical: verticalRef.current,
        onWidthChange: col.props.onWidthChange,
      };
      setResizingId(columnId);
    },
    onMove: (delta) => {
      const s = resizeStart.current;
      if (!s) return;
      const next = clampWidth(s.start + (s.vertical ? delta.dy : delta.dx), s.min);
      setWidthOverrides((prev) => ({ ...prev, [s.columnId]: next }));
    },
    onEnd: (delta) => {
      const s = resizeStart.current;
      resizeStart.current = null;
      setResizingId(null);
      if (!s) return;
      const final = clampWidth(s.start + (s.vertical ? delta.dy : delta.dx), s.min);
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
      // The gutter follows the layout axis: Left/Right resize a column,
      // Up/Down resize a band in the vertical orientation.
      const grow = vertical ? "ArrowDown" : "ArrowRight";
      const shrink = vertical ? "ArrowUp" : "ArrowLeft";
      if (event.key !== grow && event.key !== shrink) return;
      // Leave modified arrows alone (Alt+Arrow is the column-switch hotkey).
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      const min = props.minWidth ?? columnMinWidth;
      const current = columnWidth(props);
      const next = clampWidth(current + (event.key === grow ? step : -step), min);
      if (next === current) return;
      props.onWidthChange?.(next);
      if (props.width === undefined) {
        setWidthOverrides((prev) => ({ ...prev, [props.id]: next }));
      }
    },
    [columnMinWidth, columnWidth, vertical],
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
          const rect = e.over.rect;
          // Insertion side follows the stacking axis: pointer y against the
          // window's midline, or x when the stack runs sideways (vertical
          // orientation). Read through the ref so this callback stays stable.
          const before = verticalRef.current
            ? activator.clientX + e.delta.x < rect.left + rect.width / 2
            : activator.clientY + e.delta.y < rect.top + rect.height / 2;
          slot = {
            kind: "cell",
            columnId: data.columnId,
            index: before ? data.row : data.row + 1,
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
      const next = draggingId ? computeDrop(e, draggingId) : null;
      // Bail out (same reference → no re-render) while the pointer stays
      // within one slot — the strip only re-renders when the indicator must
      // actually move.
      setDropSlot((prev) => (slotsEqual(prev, next) ? prev : next));
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
      const visualDir = dirs[event.key];
      if (visualDir) {
        // Alt/Ctrl/Meta arrows are not ours (Alt+Arrow bubbles to the root
        // hotkey handler; the others are browser/OS combos).
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        // The model stays column-major in both orientations; in the vertical
        // (transposed) layout a visual arrow maps to the axis-swapped model
        // direction, so navigation and Shift+move follow what's on screen.
        const dir = vertical ? transposeDir(visualDir) : visualDir;
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
    [onWindowMove, setActive, focusHandle, resolvedFullscreen, setFullscreen, vertical],
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
  // Axis follows the orientation (and re-reveals on an orientation flip).
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
    const gapRect = column.previousElementSibling?.getBoundingClientRect();
    const gapPx = (vertical ? gapRect?.height : gapRect?.width) ?? 0;
    const lead = vertical
      ? columnRect.top - viewportRect.top + viewport.scrollTop
      : columnRect.left - viewportRect.left + viewport.scrollLeft;
    const size = vertical ? columnRect.height : columnRect.width;
    const client = vertical ? viewport.clientHeight : viewport.clientWidth;
    const scrollSize = vertical ? viewport.scrollHeight : viewport.scrollWidth;
    const position = vertical ? viewport.scrollTop : viewport.scrollLeft;
    const startAligned = lead - gapPx;
    const endAligned = lead + size + gapPx - client;
    let target: number | null = null;
    if (position > startAligned) target = startAligned;
    else if (position < endAligned) target = endAligned;
    if (target == null) return;
    const clamped = Math.max(0, Math.min(scrollSize - client, target));
    viewport.scrollTo(vertical ? { top: clamped } : { left: clamped });
  }, [resolvedActive, vertical]);

  // --- Near-fit overflow absorption ------------------------------------------
  // When the columns' natural extent along the scroll axis exceeds the
  // viewport by no more than SQUEEZE_MAX px (an "exactly full" layout off by a
  // rounding hair or a gap), the rendered size of the LAST column is reduced
  // by the overflow so no scrollbar appears. State (widths, aria-valuenow) is
  // untouched.
  const [squeeze, setSqueeze] = useState(0);
  const squeezeRef = useRef(0);
  squeezeRef.current = squeeze;
  const measureSqueeze = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scrollWidth/scrollHeight already reflect the currently applied squeeze —
    // add it back to recover the natural size, so the fixpoint is stable.
    const vert = verticalRef.current;
    const natural = (vert ? viewport.scrollHeight : viewport.scrollWidth) + squeezeRef.current;
    const overflow = natural - (vert ? viewport.clientHeight : viewport.clientWidth);
    const next = overflow > 0 && overflow <= SQUEEZE_MAX ? overflow : 0;
    setSqueeze((prev) => (prev === next ? prev : next));
  }, []);
  // Track widths and column count change through renders; container size
  // changes through the observer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs after every commit — any re-render may have changed the strip's natural width.
  useEffect(() => {
    measureSqueeze();
  });
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measureSqueeze);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measureSqueeze]);

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

  // Paddles rest invisible and fade in while the pointer is near their edge
  // (CSS keeps them always-on where hover doesn't exist). Tracked on the root
  // so any pointer position inside the array counts — not just hovering the
  // button's own box.
  const [nearEdges, setNearEdges] = useState({ start: false, end: false });
  const handleRootPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    onPointerMoveProp?.(event);
    if (!controls) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Proximity along the scroll axis: inline edges, or block edges when the
    // strip is vertical (paddles sit at the top/bottom there).
    const start = vertical
      ? event.clientY - rect.top < PADDLE_PROXIMITY
      : event.clientX - rect.left < PADDLE_PROXIMITY;
    const end = vertical
      ? rect.bottom - event.clientY < PADDLE_PROXIMITY
      : rect.right - event.clientX < PADDLE_PROXIMITY;
    // Bail on same values so pointer movement doesn't re-render the strip.
    setNearEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  };
  const handleRootPointerLeave = (event: React.PointerEvent<HTMLElement>) => {
    onPointerLeaveProp?.(event);
    setNearEdges((prev) => (prev.start || prev.end ? { start: false, end: false } : prev));
  };

  const handleRootKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    onKeyDownProp?.(event);
    if (!hotkeys || event.defaultPrevented) return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // The hotkey pair follows the layout axis: Alt+Left/Right across columns,
    // Alt+Up/Down across bands in the vertical orientation.
    const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = vertical ? "ArrowDown" : "ArrowRight";
    if (event.key !== prevKey && event.key !== nextKey) return;
    // Also suppresses the browser's Alt+Arrow history navigation while the
    // strip has focus.
    event.preventDefault();
    switchColumn(event.key === prevKey ? "left" : "right", true);
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
  // window's fiber and its content state survives the move. The dithered
  // "desk" the windows sit on is the strip's ::before (see the CSS).
  // All placements are computed here (main axis = track, cross axis = full
  // span or subrow range) and swap grid-column/grid-row when vertical.
  const gutterPlacement = (index: number): CSSProperties =>
    vertical
      ? { gridRow: index * 2 + 1, gridColumn: "1 / -1" }
      : { gridColumn: index * 2 + 1, gridRow: "1 / -1" };
  const backPlacement = (ci: number): CSSProperties =>
    vertical
      ? { gridRow: ci * 2 + 2, gridColumn: "1 / -1" }
      : { gridColumn: ci * 2 + 2, gridRow: "1 / -1" };
  const windowPlacement = (ci: number, track: { start: number; span: number }): CSSProperties =>
    vertical
      ? { gridRow: ci * 2 + 2, gridColumn: `${track.start} / span ${track.span}` }
      : { gridColumn: ci * 2 + 2, gridRow: `${track.start} / span ${track.span}` };
  const subrows = subrowCount(columns.map((c) => c.windows.length));
  const trackWidths = columns.map((c) => columnWidth(c.props));
  if (squeeze > 0 && trackWidths.length > 0) {
    const last = trackWidths.length - 1;
    trackWidths[last] = Math.max(0, (trackWidths[last] ?? 0) - squeeze);
  }
  // Vertical orientation transposes the same templates: column tracks become
  // row tracks (a column's width value is its band height) and the fractional
  // subrows split the width instead of the height.
  const mainTemplate = `${gapSize} ${trackWidths
    .map((w) => `${w}px`)
    .join(` ${gapSize} `)} ${gapSize}`;
  const crossTemplate = `repeat(${subrows}, minmax(0, 1fr))`;
  const stripStyle: CSSProperties | undefined = lastColumn
    ? vertical
      ? { gridTemplateRows: mainTemplate, gridTemplateColumns: crossTemplate }
      : { gridTemplateColumns: mainTemplate, gridTemplateRows: crossTemplate }
    : undefined;

  return (
    // A <section> with a consumer-supplied aria-label is a named region
    // landmark — document the label in API.md rather than defaulting one.
    // biome-ignore lint/a11y/noStaticElementInteractions: onKeyDown only observes bubbling Alt+Arrow hotkeys from focusable descendants, and the pointer handlers only track paddle proximity; the section itself is not interactive.
    <section
      {...rest}
      ref={setRefs}
      className={cx(styles.root, className)}
      style={
        {
          "--sf-wa-gap": gapSize,
          "--sf-wa-elevation": `var(--sf-elevation-${elevation})`,
          ...style,
        } as CSSProperties
      }
      data-orientation={vertical ? "vertical" : "horizontal"}
      data-has-fullscreen={resolvedFullscreen != null ? "" : undefined}
      data-snap={snap ? "" : undefined}
      data-controls={controls ? "" : undefined}
      data-interacting={draggingId != null || resizingId != null ? "" : undefined}
      onKeyDown={handleRootKeyDown}
      onPointerMove={handleRootPointerMove}
      onPointerLeave={handleRootPointerLeave}
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
                    placement={gutterPlacement(ci)}
                    vertical={vertical}
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
                    placement={backPlacement(ci)}
                    registerColumn={columnRefs.current}
                  />
                </Fragment>
              );
            })}
            {lastColumn && (
              <GutterView
                index={columns.length}
                placement={gutterPlacement(columns.length)}
                vertical={vertical}
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
                  placement={windowPlacement(ci, rowTrack(row, col.windows.length, subrows))}
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
            data-visible={nearEdges.start ? "" : undefined}
            disabled={switchTarget("left") == null}
            onClick={() => switchColumn("left", false)}
          >
            {vertical ? <ChevronUpIcon /> : <ChevronLeftIcon />}
          </button>
          <button
            type="button"
            aria-label="Next column"
            className={styles.pager}
            data-side="end"
            data-visible={nearEdges.end ? "" : undefined}
            disabled={switchTarget("right") == null}
            onClick={() => switchColumn("right", false)}
          >
            {vertical ? <ChevronDownIcon /> : <ChevronRightIcon />}
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
  placement: CSSProperties;
  registerColumn: Map<string, HTMLDivElement>;
}

/** Invisible grid item spanning a column's full track under its windows. It
 *  carries the consumer's Column props, is the measuring target for
 *  auto-scroll, and is the drop target for an empty column (occupied columns
 *  defer to their windows' droppables). The windows themselves are NOT its
 *  children. */
function ColumnBackdrop({ col, windowCount, placement, registerColumn }: ColumnBackdropProps) {
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
      style={{ ...placement, ...style }}
    />
  );
}

interface GutterViewProps {
  index: number;
  placement: CSSProperties;
  /** Layout axis — flips the separator's aria-orientation and resize cursor. */
  vertical: boolean;
  /** The column this gutter resizes (its leading neighbour); null for the
   *  leading gutter, which is drop-only. */
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
  placement,
  vertical,
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
      // A separator's aria-orientation names the line's own axis: a horizontal
      // line (vertical strip) is "horizontal", resized with Up/Down.
      aria-orientation={vertical ? "horizontal" : "vertical"}
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
  placement: CSSProperties;
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
  placement,
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
      style={{ ...placement, ...style }}
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

// --- WindowButton -------------------------------------------------------------

export interface WindowArrayWindowButtonProps extends ComponentPropsWithoutRef<"button"> {}

/** A title-bar icon button sharing the window chrome's exact styling (the
 *  ✕ / fullscreen look) — for the `Window` `actions` slot, so custom actions
 *  match the built-in pair (issue #26). The actions row already swallows
 *  pointer-down, so these never start a window drag. Give it an `aria-label`;
 *  the content should be a 16px line-set icon like the built-ins. */
const WindowButton = forwardRef<HTMLButtonElement, WindowArrayWindowButtonProps>(
  function WindowArrayWindowButton({ className, type, ...rest }, ref) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type ?? "button"}
        className={cx(styles.iconButton, className)}
      />
    );
  },
);

export const WindowArray = Object.assign(Root, { Column, Window, WindowButton });
