import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KEY_RESIZE_STEP_COARSE_PX,
  KEY_RESIZE_STEP_PX,
  resizeBoundary,
} from "../../lib/columns/resizeBoundary";
import { type HeaderDnd, SortableHeaderCell } from "../../lib/columns/SortableHeaderCell";
import { useColumnOrder } from "../../lib/columns/useColumnOrder";
import { useColumnWidths } from "../../lib/columns/useColumnWidths";
import { cx } from "../../lib/cx";
import { regionIdOf, SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import { useDitheredFill } from "../../lib/effects";
import {
  ColumnFilter,
  type ColumnFilterKind,
  type FilterOption,
} from "../../lib/filter/ColumnFilter";
import { useColumnFilters } from "../../lib/filter/useColumnFilters";
import { Glyph } from "../../lib/icons";
import { surfaceClass } from "../../lib/surface";
import { TreeChevron } from "../../lib/TreeChevron";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { File, Folder } from "../Icon";
import { Menu } from "../Menu";
import type { DropZone, FlatRow } from "./dnd";
import { computeDropZone, dropZoneEqual, findNode, flatten } from "./dnd";
import styles from "./Explorer.module.css";
import { RenameField } from "./RenameField";
import {
  checklistTest,
  collectKeptFolderIds,
  filterTree,
  makeComparator,
  naturalCompare,
  rangeTest,
  sortTree,
} from "./transform";
import type { ExplorerColumn, ExplorerNode, ExplorerProps, ExplorerSort } from "./types";
import { isFolder } from "./types";

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Lower bound a column may be dragged to when `resizableColumns` is on (px). */
const MIN_COL_PX = 48;
/** Preferred width for a resizable column that declares no numeric `width`. */
const DEFAULT_COL_PX = 120;
/** Extra px added past the widest measured content on double-click auto-fit. */
const AUTOFIT_SLACK_PX = 8;

/** Inferred filter UI for a column: its kind and (checklist) selectable values. */
type FilterMeta = { kind: ColumnFilterKind; options: FilterOption[] };

// --- Helpers ----------------------------------------------------------------

/** Display value for a cell (runs `render`, else accessor / `meta[id]`, and
 *  stringifies). Sort/filter use the raw `read` closures below instead. */
function readCell<M>(col: ExplorerColumn<M>, node: ExplorerNode<M>): ReactNode {
  if (col.render) return col.render(node);
  const raw = col.accessor
    ? col.accessor(node)
    : (node.meta as Record<string, unknown> | undefined)?.[col.id];
  return raw == null ? "" : String(raw);
}

/** Raw value a column reads, with the tree column (index 0) falling back to
 *  `node.name` (its displayed value). Used for sorting and filtering. */
function makeRead<M>(col: ExplorerColumn<M>, isTree: boolean): (node: ExplorerNode<M>) => unknown {
  return (node) =>
    col.accessor
      ? col.accessor(node)
      : isTree
        ? node.name
        : (node.meta as Record<string, unknown> | undefined)?.[col.id];
}

function forEachNode<M>(nodes: ExplorerNode<M>[], fn: (n: ExplorerNode<M>) => void): void {
  for (const n of nodes) {
    fn(n);
    if (n.children) forEachNode(n.children, fn);
  }
}

/** Strip this instance's region prefix off a dnd id, recovering the real
 *  node/column id. Ids are namespaced `${regionId}:${realId}` so two instances
 *  under one `SfDndProvider` never collide. */
function unwrapDndId(dndId: string, regionId: string): string {
  return dndId.startsWith(`${regionId}:`) ? dndId.slice(regionId.length + 1) : dndId;
}

/** Collision detection for one of this widget's two regions (columns / tree):
 *  drop the sibling region's droppables before intersecting, so a header drag
 *  never resolves over a tree row (and vice versa). Droppables of other
 *  widgets and of the host stay in, which is what makes cross-widget drag-out
 *  and host drops keep working. */
function excludeRegionCollision(excludedRegionId: string): CollisionDetection {
  return (args) =>
    rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.[SF_REGION_KEY] !== excludedRegionId,
      ),
    });
}

/** Build the `grid-template-columns` string shared by the header and every row.
 *  Without resizing it keeps Explorer's original semantics (number→px, string
 *  as-is, undefined→`1fr`). With resizing on it mirrors DataTable: every track
 *  is `minmax(min, preferred)` and the last stretches, so `resizeBoundary`'s px
 *  overrides cascade into the flexible filler. In fill mode (`columnFill`) the
 *  last track keeps a fixed preferred width too, so the dither panel has slack
 *  to paint into instead of being crushed by a stretched last column. */
function buildGridTemplate<M>(
  columns: ExplorerColumn<M>[],
  overrides: Record<string, number>,
  resizable: boolean,
  fill: boolean,
): string {
  if (!resizable) {
    return columns
      .map((c) => {
        const ov = overrides[c.id];
        if (ov != null) return `${ov}px`;
        return typeof c.width === "number" ? `${c.width}px` : (c.width ?? "minmax(0, 1fr)");
      })
      .join(" ");
  }
  const lastIdx = columns.length - 1;
  return columns
    .map((c, i) => {
      const min = `${c.minWidth ?? MIN_COL_PX}px`;
      if (i === lastIdx && !fill) return `minmax(${min}, 1fr)`;
      const ov = overrides[c.id];
      const preferred =
        ov != null
          ? `${ov}px`
          : typeof c.width === "number"
            ? `${c.width}px`
            : (c.width ?? `${DEFAULT_COL_PX}px`);
      return `minmax(${min}, ${preferred})`;
    })
    .join(" ");
}

// --- Main component --------------------------------------------------------

export function Explorer<M = unknown>(props: ExplorerProps<M>) {
  const {
    nodes,
    columns,
    selectedIds = EMPTY_SET as Set<string>,
    onSelectionChange,
    expandedIds = EMPTY_SET as Set<string>,
    onExpandedChange,
    editingId = null,
    onEditingChange,
    editable = false,
    onRename,
    onAdd,
    onMove,
    onDelete,
    onExternalDrop,
    resizableColumns = false,
    columnWidths: controlledColumnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
    reorderableColumns = false,
    columnOrder: controlledColumnOrder,
    defaultColumnOrder,
    onColumnOrderChange,
    sort: controlledSort,
    defaultSort,
    onSortChange,
    sortFoldersFirst = true,
    filterableColumns = false,
    columnFilters: controlledColumnFilters,
    defaultColumnFilters,
    onColumnFiltersChange,
    icon,
    showHeader = true,
    empty = "No data",
    edgeFade = false,
    gridLines = false,
    headerSurface = "concave",
    columnFill = false,
    cellPadding = "md",
    cellFontSize = "md",
    rowHeight = 32,
    height = "100%",
    className,
    style,
    ...rest
  } = props;

  // Internal: keyboard cursor, range anchor, context menu, drag state.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; targetId: string | null } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [draggingColId, setDraggingColId] = useState<string | null>(null);

  // Shared drag-and-drop (SfDndProvider): two regions, columns and the tree.
  const shared = useSfDnd();
  const colRegionId = useId();
  const treeRegionId = useId();

  // --- Column state (widths / order), controlled or internal ----------------
  const { columnWidths, setColumnWidths } = useColumnWidths({
    columnWidths: controlledColumnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
  });
  const { columnOrder, setColumnOrder } = useColumnOrder({
    columnOrder: controlledColumnOrder,
    defaultColumnOrder,
    onColumnOrderChange,
  });
  const { columnFilters, setColumnFilters } = useColumnFilters({
    columnFilters: controlledColumnFilters,
    defaultColumnFilters,
    onColumnFiltersChange,
  });

  // --- Sort state (controlled or internal) ----------------------------------
  const [internalSort, setInternalSort] = useState<ExplorerSort | null>(defaultSort ?? null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const setSort = (next: ExplorerSort | null) => {
    if (controlledSort === undefined) setInternalSort(next);
    onSortChange?.(next);
  };

  // --- Ordered columns (tree column pinned at index 0) ----------------------
  const orderedColumns = useMemo(() => {
    const treeCol = columns[0];
    if (!treeCol || !reorderableColumns || columnOrder.length === 0) return columns;
    const rest = columns.slice(1);
    const byId = new Map(rest.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const ordered: ExplorerColumn<M>[] = [];
    // Defensive: ignore the tree id if a consumer echoed it into columnOrder.
    for (const id of columnOrder) {
      if (id === treeCol.id) continue;
      const c = byId.get(id);
      if (c && !seen.has(id)) {
        ordered.push(c);
        seen.add(id);
      }
    }
    for (const c of rest) if (!seen.has(c.id)) ordered.push(c);
    return [treeCol, ...ordered];
  }, [columns, columnOrder, reorderableColumns]);

  const treeColId = orderedColumns[0]?.id;

  // Fill flags resolved here (not in the dither section below) because the
  // grid template and the resize logic both branch on fill mode.
  const fillOn = columnFill !== false;
  const fillOpts = typeof columnFill === "object" ? columnFill : {};
  const fillAnimated = fillOpts.animated === true;

  const gridTemplate = useMemo(
    () => buildGridTemplate(orderedColumns, columnWidths, resizableColumns, fillOn),
    [orderedColumns, columnWidths, resizableColumns, fillOn],
  );

  // --- Filtering: infer each filterable column's UI + build active filters ---
  const filterCols = useMemo(
    () => (filterableColumns ? orderedColumns.filter((c) => c.filterable !== false) : []),
    [filterableColumns, orderedColumns],
  );

  // Per-column identity cache: consumers commonly pass an inline `columns`
  // array, so keying the memo on array identity alone would re-walk every node
  // on each parent render. Each column's inferred meta is reused while the node
  // forest and the column's accessor/filter identities are unchanged — exactly
  // the cases where the current inference could not produce different output.
  const filterMetaCache = useRef<{
    nodes: ExplorerNode<M>[];
    entries: Map<
      string,
      {
        accessor: ExplorerColumn<M>["accessor"];
        filter: ExplorerColumn<M>["filter"];
        isTree: boolean;
        meta: FilterMeta;
      }
    >;
    result: Map<string, FilterMeta>;
  } | null>(null);

  const filterMeta = useMemo(() => {
    let cache = filterMetaCache.current;
    if (!cache || cache.nodes !== nodes) {
      cache = { nodes, entries: new Map(), result: new Map() };
      filterMetaCache.current = cache;
    }
    const map = new Map<string, FilterMeta>();
    let allHits = true;
    for (const col of filterCols) {
      const isTree = col.id === treeColId;
      const hit = cache.entries.get(col.id);
      if (
        hit &&
        hit.accessor === col.accessor &&
        hit.filter === col.filter &&
        hit.isTree === isTree
      ) {
        map.set(col.id, hit.meta);
        continue;
      }
      allHits = false;
      let meta: FilterMeta;
      if (col.filter) {
        meta = { kind: col.filter.kind, options: col.filter.options ?? [] };
      } else {
        const read = makeRead(col, isTree);
        const values: unknown[] = [];
        forEachNode(nodes, (n) => values.push(read(n)));
        const present = values.filter((v) => v != null);
        const allNumeric = present.length > 0 && present.every((v) => typeof v === "number");
        if (allNumeric) {
          meta = { kind: "range", options: [] };
        } else {
          const distinct = [...new Set(present.map((v) => String(v)))].sort(naturalCompare);
          meta = { kind: "checklist", options: distinct.map((v) => ({ value: v, label: v })) };
        }
      }
      cache.entries.set(col.id, { accessor: col.accessor, filter: col.filter, isTree, meta });
      map.set(col.id, meta);
    }
    // When nothing changed, return the previous Map instance so downstream
    // memos (activeFilters → filtered → filterTree) stay stable.
    if (allHits && cache.result.size === map.size) {
      let same = true;
      for (const [id, meta] of map) {
        if (cache.result.get(id) !== meta) {
          same = false;
          break;
        }
      }
      if (same) return cache.result;
    }
    cache.result = map;
    return map;
  }, [filterCols, nodes, treeColId]);

  const activeFilters = useMemo(() => {
    const out: { read: (n: ExplorerNode<M>) => unknown; test: (v: unknown) => boolean }[] = [];
    for (const f of columnFilters) {
      const meta = filterMeta.get(f.id);
      const col = orderedColumns.find((c) => c.id === f.id);
      if (!meta || !col) continue;
      const read = makeRead(col, col.id === treeColId);
      const test =
        meta.kind === "range"
          ? rangeTest(f.value as [number | undefined, number | undefined])
          : checklistTest(f.value as string[] | undefined);
      out.push({ read, test });
    }
    return out;
  }, [columnFilters, filterMeta, orderedColumns, treeColId]);

  // --- Sort comparator ------------------------------------------------------
  const comparator = useMemo(() => {
    if (!sort) return null;
    const idx = orderedColumns.findIndex((c) => c.id === sort.columnId);
    const col = orderedColumns[idx];
    if (!col) return null;
    if (col.sortComparator) {
      const c = col.sortComparator;
      return sort.dir === "desc" ? (a: ExplorerNode<M>, b: ExplorerNode<M>) => -c(a, b) : c;
    }
    return makeComparator(makeRead(col, idx === 0), sort.dir, col.sortType);
  }, [sort, orderedColumns]);

  // --- Data pipeline: filter → sort → (effective expand) → flatten ----------
  const filtered = useMemo(() => filterTree(nodes, activeFilters), [nodes, activeFilters]);
  const sorted = useMemo(
    () => sortTree(filtered, comparator, sortFoldersFirst),
    [filtered, comparator, sortFoldersFirst],
  );
  const filterActive = columnFilters.length > 0;
  const effectiveExpandedIds = useMemo(
    () =>
      filterActive ? new Set([...expandedIds, ...collectKeptFolderIds(filtered)]) : expandedIds,
    [filterActive, expandedIds, filtered],
  );

  const flatRows = useMemo(
    () => flatten(sorted, effectiveExpandedIds),
    [sorted, effectiveExpandedIds],
  );
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < flatRows.length; i++) {
      const r = flatRows[i];
      if (r) m.set(r.node.id, i);
    }
    return m;
  }, [flatRows]);
  const showEmpty = flatRows.length === 0;

  // Latest values for the stable row handlers below (created once so memoized
  // rows don't re-render when a handler's inputs change). Assigned in
  // useLayoutEffect — not during render — so a discarded concurrent render
  // can't leak values, and it still runs before any event can fire.
  const latest = useRef({
    anchorId,
    selectedIds,
    expandedIds,
    flatRows,
    indexById,
    editable,
    onSelectionChange,
    onExpandedChange,
    onEditingChange,
    onRename,
  });
  useLayoutEffect(() => {
    latest.current = {
      anchorId,
      selectedIds,
      expandedIds,
      flatRows,
      indexById,
      editable,
      onSelectionChange,
      onExpandedChange,
      onEditingChange,
      onRename,
    };
  });

  // --- Virtualization -----------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLDivElement>(null);

  // Mirror the sticky header's measured width onto the body. The header spans
  // the full scroll width, but the body (`inline-size: 100%`) shrinks to the
  // scrollbar-reduced client width, so when a vertical scrollbar is present the
  // body columns drift left of the header's — worsening toward the right as the
  // flexible tracks re-solve against the narrower width (issue #70). Forcing the
  // body to the header's width keeps every column aligned. Same mechanism as
  // DataTable's `contentWidth`.
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  useEffect(() => {
    const vp = viewportRef.current;
    const hr = headerRowRef.current;
    if (!vp || !hr) return;
    const measure = () => setContentWidth(Math.round(hr.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(hr);
    return () => ro.disconnect();
  }, []);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  // --- State setters that always go through the controlled callbacks -----
  const setSelection = (ids: Set<string>) => onSelectionChange?.(ids);
  const setEditing = (id: string | null) => onEditingChange?.(id);

  const toggleExpand = useCallback((id: string) => {
    // Toggle against the raw controlled set (not the filter-effective one), so
    // user collapses persist and are restored when the filter clears.
    const { expandedIds, onExpandedChange } = latest.current;
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onExpandedChange?.(next);
  }, []);

  // --- Column resizing ------------------------------------------------------
  const measureHeaderWidths = (): number[] | null => {
    const row = headerRowRef.current;
    if (!row) return null;
    return Array.from(row.children).map((el) => (el as HTMLElement).getBoundingClientRect().width);
  };

  /** Column ids that may be resized (table opt-in × per-column opt-out). */
  const resizableColumnIds = useMemo(() => {
    const ids = new Set<string>();
    if (resizableColumns) {
      for (const c of orderedColumns) if (c.resizable !== false) ids.add(c.id);
    }
    return ids;
  }, [resizableColumns, orderedColumns]);

  // The last column is resized via the boundary on its left, normally the
  // previous column's trailing handle. If the previous column is locked it has
  // no handle, so the last column would be stuck: give it its own leading-edge
  // handle that trades width with the nearest resizable column to the left.
  const lastColLeadingTarget = useMemo(() => {
    // In fill mode the last column has its own trailing handle, so the
    // leading-edge workaround never applies.
    if (fillOn) return null;
    const n = orderedColumns.length;
    const last = orderedColumns[n - 1];
    const prev = orderedColumns[n - 2];
    if (!last || !resizableColumnIds.has(last.id)) return null;
    if (!prev || resizableColumnIds.has(prev.id)) return null; // prev's handle already serves
    for (let k = n - 2; k >= 0; k--) {
      const c = orderedColumns[k];
      if (c && resizableColumnIds.has(c.id)) return c.id;
    }
    return null;
  }, [orderedColumns, resizableColumnIds, fillOn]);

  // The handle id → the column its drag actually grows. A leading handle (on
  // the last column) is remapped to the nearest resizable column on the left;
  // every other handle resizes its own column.
  const resolveResizeIdx = (id: string): number => {
    const idx = orderedColumns.findIndex((c) => c.id === id);
    if (idx === orderedColumns.length - 1 && lastColLeadingTarget) {
      return orderedColumns.findIndex((c) => c.id === lastColLeadingTarget);
    }
    return idx;
  };

  const applyResize = (idx: number, startWidths: number[], dx: number) => {
    const col = orderedColumns[idx];
    if (!col) return;
    // Fill mode: columns are independent (the dither filler absorbs slack), so
    // a drag just sets this one column's width, no cascade.
    if (fillOn) {
      const v = Math.max(col.minWidth ?? MIN_COL_PX, Math.round((startWidths[idx] ?? 0) + dx));
      setColumnWidths((prev) => (prev[col.id] === v ? prev : { ...prev, [col.id]: v }));
      return;
    }
    const resizable = orderedColumns.map((c) => c.resizable !== false);
    // Per-column floors: the CSS tracks clamp at each column's own min, so the
    // cascade must clamp at the same floors or overrides desync from render.
    const mins = orderedColumns.map((c) => c.minWidth ?? MIN_COL_PX);
    const out = resizeBoundary(startWidths, resizable, idx, dx, mins);
    setColumnWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (let k = 0; k < out.length - 1; k++) {
        const c = orderedColumns[k];
        if (!c) continue;
        const v = Math.round(out[k] as number);
        if (next[c.id] !== v) {
          next[c.id] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const resizeRef = useRef<{
    idx: number;
    startWidths: number[];
    /** +1 in LTR, -1 in RTL: pointer dx is physical, the boundary math is
     *  logical (positive = grow), so an RTL container flips the sign. */
    dir: 1 | -1;
    handle: HTMLElement;
  } | null>(null);
  const { onPointerDown: onColumnResizeDown } = usePointerDrag({
    onStart: (_origin, event) => {
      const handle = event.currentTarget as HTMLElement;
      const id = handle.dataset.columnId;
      if (!id) return;
      const idx = resolveResizeIdx(id);
      const startWidths = measureHeaderWidths();
      if (idx < 0 || !startWidths) return;
      handle.dataset.dragging = "true";
      resizeRef.current = {
        idx,
        startWidths,
        // Read once per gesture; direction cannot change mid-drag.
        dir: getComputedStyle(handle).direction === "rtl" ? -1 : 1,
        handle,
      };
    },
    onMove: (delta) => {
      const r = resizeRef.current;
      if (r) applyResize(r.idx, r.startWidths, r.dir * delta.dx);
    },
    onEnd: () => {
      const r = resizeRef.current;
      if (r) delete r.handle.dataset.dragging;
      resizeRef.current = null;
    },
  });

  const nudgeResize = (colId: string, dx: number) => {
    const idx = resolveResizeIdx(colId);
    const widths = measureHeaderWidths();
    if (idx < 0 || !widths) return;
    applyResize(idx, widths, dx);
  };

  // Auto-fit (double-click a handle): size the column to its widest currently
  // mounted content. Cells clip with ellipsis, so the content span's
  // scrollWidth reports the natural width; the tree column's leading
  // indent/chevron/icon run is included via the content's offset in the cell.
  const autoFitColumn = (colId: string) => {
    const idx = orderedColumns.findIndex((c) => c.id === colId);
    const headerCell = headerRowRef.current?.children[idx] as HTMLElement | undefined;
    const vp = viewportRef.current;
    if (idx < 0 || !headerCell || !vp) return;
    // The leading offset (indent/chevron/icon run before the content) is on
    // the inline-start side, which in RTL is the cell's right edge.
    const rtl = getComputedStyle(vp).direction === "rtl";
    const measure = (cell: HTMLElement, content: HTMLElement): number => {
      const cellRect = cell.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const leading = rtl ? cellRect.right - contentRect.right : contentRect.left - cellRect.left;
      return leading + content.scrollWidth;
    };
    const label = headerCell.querySelector<HTMLElement>("span");
    let widest = label ? measure(headerCell, label) : 0;
    for (const row of Array.from(vp.querySelectorAll<HTMLElement>("[data-row-id]"))) {
      const cell = row.children[idx] as HTMLElement | undefined;
      if (!cell) continue;
      const content = cell.querySelector<HTMLElement>(`.${styles.cellContent}`);
      widest = Math.max(widest, content ? measure(cell, content) : cell.scrollWidth);
    }
    // Trailing cell padding (the leading one is inside the measured offset).
    const padEnd = Number.parseFloat(getComputedStyle(headerCell).paddingInlineEnd) || 0;
    const min = orderedColumns[idx]?.minWidth ?? MIN_COL_PX;
    const next = Math.max(min, Math.ceil(widest + padEnd + AUTOFIT_SLACK_PX));
    setColumnWidths((prev) => (prev[colId] === next ? prev : { ...prev, [colId]: next }));
  };

  // --- Sorting header interaction -------------------------------------------
  const cycleSort = (columnId: string) => {
    if (!sort || sort.columnId !== columnId) setSort({ columnId, dir: "asc" });
    else if (sort.dir === "asc") setSort({ columnId, dir: "desc" });
    else setSort(null);
  };

  // --- Column reorder DnD (own context; tree column excluded) ---------------
  const colSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const nonTreeIds = useMemo(() => orderedColumns.slice(1).map((c) => c.id), [orderedColumns]);
  // Sortable ids are namespaced per instance; the real column id travels in
  // the item data (read back below and in the overlay).
  const nonTreeDndIds = useMemo(
    () => nonTreeIds.map((id) => `${colRegionId}:${id}`),
    [nonTreeIds, colRegionId],
  );
  const realColumnId = (item: {
    data: { current?: Record<string, unknown> | undefined };
  }): string | null => {
    const id = item.data.current?.columnId;
    return typeof id === "string" ? id : null;
  };
  const onColDragStart = (e: DragStartEvent) => setDraggingColId(realColumnId(e.active));
  const onColDragEnd = (e: DragEndEvent) => {
    setDraggingColId(null);
    const activeId = realColumnId(e.active);
    const overId = e.over ? realColumnId(e.over) : null;
    if (!activeId || !overId || activeId === overId) return;
    const from = nonTreeIds.indexOf(activeId);
    const to = nonTreeIds.indexOf(overId);
    if (from < 0 || to < 0) return;
    setColumnOrder(arrayMove(nonTreeIds, from, to));
  };

  // --- Column-fill dither ---------------------------------------------------
  const [columnsWidth, setColumnsWidth] = useState(0);
  const [fillHeight, setFillHeight] = useState(0);
  useEffect(() => {
    if (!fillOn) return;
    const hr = headerRowRef.current;
    const vp = viewportRef.current;
    if (hr) {
      const tracks = getComputedStyle(hr).gridTemplateColumns.split(" ");
      setColumnsWidth(tracks.reduce((sum, t) => sum + (Number.parseFloat(t) || 0), 0));
    }
    if (vp) setFillHeight(Math.max(vp.scrollHeight, virtualizer.getTotalSize()));
  }, [fillOn, gridTemplate, flatRows.length, rowHeight, virtualizer]);
  const { rootRef: fillRootRef, canvasRef: fillCanvasRef } = useDitheredFill({
    effect: fillOpts.effect ?? "noise",
    density: fillOpts.density ?? 0.5,
    color: fillOpts.color,
    speed: fillOpts.speed,
  });

  // --- Selection --------------------------------------------------------
  // Row handlers read state through `latest` so their identity never changes —
  // a requirement for the row memo below to hold.
  const handleRowPointerDown = useCallback((e: MouseEvent, row: FlatRow<M>) => {
    // Right-click is handled in onContextMenu; don't disturb selection here for it.
    if (e.button === 2) return;
    const { anchorId, selectedIds, flatRows, indexById, onSelectionChange } = latest.current;
    const id = row.node.id;
    if (e.shiftKey && anchorId) {
      const a = indexById.get(anchorId);
      const b = indexById.get(id);
      if (a != null && b != null) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) {
          const r = flatRows[i];
          if (r) next.add(r.node.id);
        }
        onSelectionChange?.(next);
      }
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(next);
      setAnchorId(id);
    } else {
      onSelectionChange?.(new Set([id]));
      setAnchorId(id);
    }
    setFocusedId(id);
  }, []);

  const handleRowDoubleClick = useCallback((row: FlatRow<M>) => {
    const { editable, onEditingChange } = latest.current;
    if (!editable) return;
    onEditingChange?.(row.node.id);
  }, []);

  const handleRowContextMenu = useCallback((e: MouseEvent, row: FlatRow<M>) => {
    const { editable, selectedIds, onSelectionChange } = latest.current;
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.has(row.node.id)) {
      onSelectionChange?.(new Set([row.node.id]));
      setAnchorId(row.node.id);
    }
    setFocusedId(row.node.id);
    setCtx({ x: e.clientX, y: e.clientY, targetId: row.node.id });
  }, []);

  const handleRenameCommit = useCallback((id: string, name: string) => {
    const { onRename, onEditingChange } = latest.current;
    onRename?.(id, name);
    onEditingChange?.(null);
  }, []);

  const handleRenameCancel = useCallback(() => {
    latest.current.onEditingChange?.(null);
  }, []);

  const handleViewportContextMenu = (e: MouseEvent) => {
    if (!editable) return;
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, targetId: null });
  };

  const handleViewportClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelection(new Set());
      setAnchorId(null);
      setFocusedId(null);
    }
  };

  // --- Keyboard -----------------------------------------------------------
  const handleKeyDown = (e: KeyboardEvent) => {
    if (editingId != null) return; // RenameField owns its keys
    if (flatRows.length === 0) return;

    // Cmd/Ctrl+A: select all visible
    if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setSelection(new Set(flatRows.map((r) => r.node.id)));
      return;
    }

    const idx = focusedId != null ? indexById.get(focusedId) : undefined;
    const cur = idx != null ? flatRows[idx] : null;

    const moveFocus = (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(nextIdx, flatRows.length - 1));
      const target = flatRows[clamped];
      if (!target) return;
      const id = target.node.id;
      setFocusedId(id);
      if (e.shiftKey && anchorId) {
        const a = indexById.get(anchorId);
        if (a != null) {
          const [lo, hi] = a <= clamped ? [a, clamped] : [clamped, a];
          const next = new Set<string>();
          for (let i = lo; i <= hi; i++) {
            const r = flatRows[i];
            if (r) next.add(r.node.id);
          }
          setSelection(next);
        }
      } else {
        setSelection(new Set([id]));
        setAnchorId(id);
      }
    };

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus((idx ?? -1) + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus((idx ?? flatRows.length) - 1);
    } else if (e.key === "ArrowLeft" && cur) {
      e.preventDefault();
      if (isFolder(cur.node) && effectiveExpandedIds.has(cur.node.id)) {
        toggleExpand(cur.node.id);
      } else if (cur.parentId) {
        const parentIdx = indexById.get(cur.parentId);
        if (parentIdx != null) moveFocus(parentIdx);
      }
    } else if (e.key === "ArrowRight" && cur) {
      e.preventDefault();
      if (isFolder(cur.node)) {
        if (!effectiveExpandedIds.has(cur.node.id)) {
          toggleExpand(cur.node.id);
        } else {
          const child = flatRows[(idx ?? -1) + 1];
          if (child && child.parentId === cur.node.id) moveFocus((idx ?? -1) + 1);
        }
      }
    } else if ((e.key === "Enter" || e.key === "F2") && cur && editable) {
      e.preventDefault();
      setEditing(cur.node.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSelection(new Set());
      setAnchorId(null);
    } else if ((e.key === "Delete" || e.key === "Backspace") && editable && selectedIds.size > 0) {
      e.preventDefault();
      onDelete?.([...selectedIds]);
    }
  };

  // --- Row DnD ------------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const dropZoneFromEvent = (e: DragMoveEvent | DragEndEvent): DropZone | null => {
    if (!draggingId) return null;
    // Released over nothing (or another widget's droppable): cancel, never
    // reorganize the tree from a drop outside it.
    if (!e.over || regionIdOf(e.over) !== treeRegionId) return null;

    const data = e.over.data.current as { rowIndex?: number; viewport?: boolean } | undefined;
    // The scroll viewport itself is a droppable: a drop inside the tree but
    // below the last row appends to the root.
    if (data?.viewport) return { kind: "after-all" };
    const rowIdx = data?.rowIndex;
    if (rowIdx == null) return null;

    const activator = e.activatorEvent as PointerEvent | null;
    if (!activator) return null;
    const currentY = activator.clientY + e.delta.y;
    const draggedNode = findNode(nodes, draggingId);
    if (!draggedNode) return null;

    return computeDropZone({
      draggedNode,
      flatRows,
      rowIndex: rowIdx,
      yWithinRow: currentY - e.over.rect.top,
      rowHeight,
    });
  };

  const onDragStart = (e: DragStartEvent) =>
    setDraggingId((e.active.data.current as { nodeId?: string } | undefined)?.nodeId ?? null);

  const onDragMove = (e: DragMoveEvent) => {
    if (!editable) return;
    const next = dropZoneFromEvent(e);
    // Equality bail: a pointermove that resolves to the same zone must not
    // allocate a new state object and re-render the whole tree.
    setDropZone((prev) => (dropZoneEqual(prev, next) ? prev : next));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const zone = dropZoneFromEvent(e);
    const id = draggingId;
    setDropZone(null);
    setDraggingId(null);
    if (!zone || !id) return;
    // Defense in depth: rows aren't draggable while sorted (see the row's
    // `draggable`), but a sort applied mid-drag via controlled props would
    // still compute `beforeId` from the sorted order, not the persisted one.
    if (sort) return;
    if (zone.kind === "into") onMove?.(id, zone.folderId, null);
    else if (zone.kind === "after-all") onMove?.(id, null, null);
    else {
      const tgt = flatRows[zone.flatIndex];
      if (!tgt) onMove?.(id, null, null);
      else onMove?.(id, tgt.parentId, tgt.node.id);
    }
  };

  const onDragCancel = () => {
    setDropZone(null);
    setDraggingId(null);
  };

  // The shared provider renders one DragOverlay per region during its own render
  // pass (ahead of this one), so overlays and external-drop targets read through
  // refs, not render-cycle state. The lists are stable during a drag.
  const orderedColumnsRef = useRef(orderedColumns);
  orderedColumnsRef.current = orderedColumns;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const flatRowsRef = useRef(flatRows);
  flatRowsRef.current = flatRows;

  // Each region's collision detection ignores the sibling region's droppables,
  // so the two regions of one instance never cross-talk (a header drag can't
  // resolve over a tree row, a row drag can't land on a header).
  const colCollision = useMemo(() => excludeRegionCollision(treeRegionId), [treeRegionId]);
  const treeCollision = useMemo(() => excludeRegionCollision(colRegionId), [colRegionId]);

  // Column region: header ghost overlay.
  useSfDndRegion(reorderableColumns ? shared : null, {
    id: colRegionId,
    collisionDetection: colCollision,
    onDragStart: onColDragStart,
    onDragEnd: onColDragEnd,
    onDragCancel: () => setDraggingColId(null),
    renderOverlay: (activeId) => {
      const colId = unwrapDndId(activeId, colRegionId);
      const header = orderedColumnsRef.current.find((c) => c.id === colId)?.header;
      return header ? <div className={styles.headerDragOverlay}>{header}</div> : null;
    },
  });

  // Tree region: node drag/reorder plus host-item drops onto a row.
  useSfDndRegion(shared, {
    id: treeRegionId,
    collisionDetection: treeCollision,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onExternalDrop: (e) => {
      // Guard against this instance's own header drags resolving here.
      if (regionIdOf(e.active) === colRegionId) return;
      const rowIndex = (e.over?.data.current as { rowIndex?: number } | undefined)?.rowIndex;
      const overNode = rowIndex != null ? (flatRowsRef.current[rowIndex]?.node ?? null) : null;
      onExternalDrop?.({ active: e.active, overNode });
    },
    renderOverlay: (activeId) => (
      <DragOverlayContent
        name={findNode(nodesRef.current, unwrapDndId(activeId, treeRegionId))?.name ?? ""}
        height={rowHeight}
      />
    ),
  });

  // --- Context menu derived ----------------------------------------------
  const ctxTargetRow = ctx?.targetId != null ? flatRows[indexById.get(ctx.targetId) ?? -1] : null;
  const ctxTargetIsFolder = ctxTargetRow ? isFolder(ctxTargetRow.node) : false;
  const addParentId = ctxTargetRow
    ? ctxTargetIsFolder
      ? ctxTargetRow.node.id
      : ctxTargetRow.parentId
    : null;

  // --- Header cell rendering ------------------------------------------------
  const renderHeaderCell = (col: ExplorerColumn<M>, index: number, dnd?: HeaderDnd): ReactNode => {
    const isLast = index === orderedColumns.length - 1;
    const isSorted = sort?.columnId === col.id;
    const meta = filterableColumns ? filterMeta.get(col.id) : undefined;
    const filterValue = columnFilters.find((f) => f.id === col.id)?.value;
    const showTrailingHandle = resizableColumnIds.has(col.id) && (!isLast || fillOn);
    const showLeadingHandle = isLast && lastColLeadingTarget != null;
    const showResizeHandle = showTrailingHandle || showLeadingHandle;
    const widthOverride = columnWidths[col.id];
    return (
      // Headers are pointer-drag-only (Enter/Space belongs to sorting), so only
      // dnd listeners are spread (on the label), never dnd.attributes.
      <div
        key={col.id}
        ref={dnd?.ref}
        className={cx(
          styles.headerCell,
          surfaceClass[headerSurface],
          dnd?.dragging && styles.headerDragging,
        )}
        data-align={col.align ?? "start"}
        data-surface={headerSurface}
        data-sortable={col.sortable || undefined}
        data-sorted={(col.sortable && isSorted) || undefined}
        style={dnd?.style}
        onClick={col.sortable ? () => cycleSort(col.id) : undefined}
      >
        <span
          className={cx(styles.headerLabel, dnd && styles.headerDraggable)}
          {...(dnd?.listeners ?? {})}
        >
          {col.header}
        </span>
        {col.sortable && isSorted ? (
          <span className={styles.sortArrow} aria-hidden="true">
            {sort?.dir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
        {meta ? (
          <ColumnFilter
            label={col.header}
            kind={meta.kind}
            options={meta.options}
            value={filterValue}
            active={filterValue !== undefined}
            onChange={(value) =>
              setColumnFilters((prev) => {
                const others = prev.filter((f) => f.id !== col.id);
                return value === undefined ? others : [...others, { id: col.id, value }];
              })
            }
          />
        ) : null}
        {showResizeHandle ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${col.header}`}
            aria-valuemin={col.minWidth ?? MIN_COL_PX}
            aria-valuenow={widthOverride != null ? Math.round(widthOverride) : undefined}
            tabIndex={0}
            data-column-id={col.id}
            className={cx(styles.resizeHandle, showLeadingHandle && styles.resizeHandleStart)}
            onPointerDown={(e: ReactPointerEvent) => {
              e.stopPropagation();
              onColumnResizeDown(e);
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              // A leading handle resizes a different column; auto-fit only
              // makes sense on a column's own trailing handle.
              if (!showLeadingHandle) autoFitColumn(col.id);
            }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              e.stopPropagation();
              const step = e.shiftKey ? KEY_RESIZE_STEP_COARSE_PX : KEY_RESIZE_STEP_PX;
              // Arrow keys are physical directions: in RTL "right" shrinks.
              const dir = getComputedStyle(e.currentTarget).direction === "rtl" ? -1 : 1;
              nudgeResize(col.id, (e.key === "ArrowRight" ? 1 : -1) * step * dir);
            }}
          />
        ) : null}
      </div>
    );
  };

  const headerCells = orderedColumns.map((col, i) =>
    reorderableColumns && i > 0 ? (
      <SortableHeaderCell
        key={col.id}
        id={`${colRegionId}:${col.id}`}
        regionId={shared ? colRegionId : undefined}
        data={{ columnId: col.id }}
        render={(dnd) => renderHeaderCell(col, i, dnd)}
      />
    ) : (
      renderHeaderCell(col, i)
    ),
  );

  const header = showHeader ? (
    <div
      ref={headerRowRef}
      className={styles.headerRow}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {reorderableColumns ? (
        shared ? (
          // The provider owns the DndContext + overlay; render only the sortable.
          <SortableContext items={nonTreeDndIds} strategy={horizontalListSortingStrategy}>
            {headerCells}
          </SortableContext>
        ) : (
          <DndContext
            sensors={colSensors}
            onDragStart={onColDragStart}
            onDragEnd={onColDragEnd}
            onDragCancel={() => setDraggingColId(null)}
          >
            <SortableContext items={nonTreeDndIds} strategy={horizontalListSortingStrategy}>
              {headerCells}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {draggingColId ? (
                <div className={styles.headerDragOverlay}>
                  {orderedColumns.find((c) => c.id === draggingColId)?.header}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )
      ) : (
        headerCells
      )}
    </div>
  ) : null;

  // --- Render -------------------------------------------------------------
  return (
    <div
      className={cx(styles.wrapper, className)}
      style={style as CSSProperties}
      data-explorer-root=""
      data-grid-lines={gridLines || undefined}
      data-cell-padding={cellPadding === "md" ? undefined : cellPadding}
      data-cell-font={cellFontSize === "md" ? undefined : cellFontSize}
      {...rest}
    >
      {header}

      {(() => {
        const body = (
          <>
            <div
              ref={viewportRef}
              role="treegrid"
              aria-label="Explorer"
              className={styles.viewport}
              style={{ height: typeof height === "number" ? `${height}px` : height }}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onContextMenu={handleViewportContextMenu}
              onClick={handleViewportClick}
            >
              <ViewportDroppable
                regionId={treeRegionId}
                viewportRef={viewportRef}
                disabled={draggingId == null}
              />
              {showEmpty ? (
                <div className={styles.empty}>{empty}</div>
              ) : (
                <div
                  className={styles.body}
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    minWidth: contentWidth ?? undefined,
                  }}
                >
                  {fillOn ? (
                    <div
                      ref={
                        fillAnimated
                          ? (node) => {
                              fillRootRef.current = node;
                            }
                          : undefined
                      }
                      className={cx(styles.columnFill, fillAnimated && styles.columnFillAnimated)}
                      aria-hidden="true"
                      style={
                        {
                          height: fillHeight || "100%",
                          "--sf-columns-width": `${columnsWidth}px`,
                          ...(fillOpts.color ? { "--sf-columnfill-color": fillOpts.color } : null),
                        } as CSSProperties
                      }
                    >
                      {fillAnimated ? (
                        <canvas ref={fillCanvasRef} className={styles.columnFillCanvas} />
                      ) : null}
                    </div>
                  ) : null}
                  {virtualizer.getVirtualItems().map((vRow) => {
                    const row = flatRows[vRow.index];
                    if (!row) return null;
                    const id = row.node.id;
                    const isLast = vRow.index === flatRows.length - 1;
                    // Drop flags resolve to per-row booleans here so a drag-move
                    // re-renders only the rows whose flags actually flipped.
                    const dropInto = dropZone?.kind === "into" && dropZone.folderId === id;
                    const dropBefore =
                      dropZone?.kind === "before" && dropZone.flatIndex === vRow.index;
                    const dropAfterLast =
                      isLast &&
                      (dropZone?.kind === "after-all" ||
                        (dropZone?.kind === "before" && dropZone.flatIndex === vRow.index + 1));
                    // Every non-primitive prop below must be reference-stable or
                    // the row memo silently stops working — no inline closures.
                    return (
                      <MemoExplorerRow<M>
                        key={id}
                        row={row}
                        rowIndex={vRow.index}
                        top={vRow.start}
                        rowHeight={rowHeight}
                        columns={orderedColumns}
                        gridTemplate={gridTemplate}
                        isSelected={selectedIds.has(id)}
                        isFocused={focusedId === id}
                        isExpanded={effectiveExpandedIds.has(id)}
                        isEditing={editingId === id}
                        isDragging={draggingId === id}
                        dropInto={dropInto}
                        dropBefore={dropBefore}
                        dropAfterLast={dropAfterLast}
                        // While sorted, a reorder can't be applied (beforeId
                        // would come from the sorted order), so no drag starts.
                        draggable={editable && !sort}
                        regionId={treeRegionId}
                        icon={icon}
                        onChevronToggle={toggleExpand}
                        onRowPointerDown={handleRowPointerDown}
                        onRowDoubleClick={handleRowDoubleClick}
                        onRowContextMenu={handleRowContextMenu}
                        onRenameCommit={handleRenameCommit}
                        onRenameCancel={handleRenameCancel}
                      />
                    );
                  })}
                </div>
              )}

              {edgeFade && !showEmpty ? (
                <div
                  className={styles.edgeFade}
                  aria-hidden="true"
                  style={
                    {
                      "--sf-row-height": `${rowHeight}px`,
                      ...(typeof edgeFade === "object"
                        ? {
                            "--sf-datatable-fade-rows": edgeFade.rows,
                            "--sf-datatable-fade-density": edgeFade.density,
                          }
                        : null),
                    } as CSSProperties
                  }
                />
              ) : null}
            </div>

            {editable ? (
              <ContextMenu
                ctx={ctx}
                onClose={() => setCtx(null)}
                hasTarget={ctx?.targetId != null}
                onNewFile={() => {
                  onAdd?.(addParentId, "file");
                  setCtx(null);
                }}
                onNewFolder={() => {
                  onAdd?.(addParentId, "folder");
                  setCtx(null);
                }}
                onRename={() => {
                  if (ctx?.targetId) setEditing(ctx.targetId);
                  setCtx(null);
                }}
                onDelete={() => {
                  if (ctx?.targetId) onDelete?.([ctx.targetId]);
                  setCtx(null);
                }}
              />
            ) : null}
          </>
        );
        // Under a shared provider, render only the body: the provider owns the
        // single DndContext and DragOverlay for the whole subtree.
        if (shared) return body;
        return (
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            {body}
            <DragOverlay dropAnimation={null}>
              {draggingId ? (
                <DragOverlayContent
                  name={findNode(nodes, draggingId)?.name ?? ""}
                  height={rowHeight}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        );
      })()}
    </div>
  );
}

// --- ExplorerRow (internal) -----------------------------------------------

interface ExplorerRowProps<M> {
  row: FlatRow<M>;
  rowIndex: number;
  top: number;
  rowHeight: number;
  columns: ExplorerColumn<M>[];
  gridTemplate: string;
  isSelected: boolean;
  isFocused: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  isDragging: boolean;
  dropInto: boolean;
  dropBefore: boolean;
  dropAfterLast: boolean;
  draggable: boolean;
  /** Shared-dnd tree region id, stamped on this row's drag/drop data. */
  regionId: string;
  icon?: (node: ExplorerNode<M>) => ReactNode;
  onChevronToggle: (id: string) => void;
  onRowPointerDown: (e: MouseEvent, row: FlatRow<M>) => void;
  onRowDoubleClick: (row: FlatRow<M>) => void;
  onRowContextMenu: (e: MouseEvent, row: FlatRow<M>) => void;
  onRenameCommit: (id: string, next: string) => void;
  onRenameCancel: () => void;
}

function ExplorerRow<M>(props: ExplorerRowProps<M>) {
  const {
    row,
    rowIndex,
    top,
    rowHeight,
    columns,
    gridTemplate,
    isSelected,
    isFocused,
    isExpanded,
    isEditing,
    isDragging,
    dropInto,
    dropBefore,
    dropAfterLast,
    draggable,
    regionId,
    icon,
    onChevronToggle,
    onRowPointerDown,
    onRowDoubleClick,
    onRowContextMenu,
    onRenameCommit,
    onRenameCancel,
  } = props;

  const id = row.node.id;
  const folder = isFolder(row.node);

  // Dnd ids are namespaced per region so two Explorer instances under one
  // `SfDndProvider` can't collide; the real node id travels in the data.
  const draggableHook = useDraggable({
    id: `${regionId}:${id}`,
    disabled: !draggable || isEditing,
    data: { [SF_REGION_KEY]: regionId, nodeId: id },
  });
  const droppableHook = useDroppable({
    id: `${regionId}:row-${id}`,
    data: { [SF_REGION_KEY]: regionId, rowIndex },
  });

  const setRef = (el: HTMLDivElement | null) => {
    draggableHook.setNodeRef(el);
    droppableHook.setNodeRef(el);
  };

  // dnd-kit's PointerSensor activator is `listeners.onPointerDown`; the row's
  // own handler must CALL it rather than sit alongside it in JSX — a later
  // `onPointerDown` prop would silently replace the spread listener and drags
  // would never start.
  const dndPointerDown = draggableHook.listeners?.onPointerDown as
    | ((e: ReactPointerEvent<HTMLDivElement>) => void)
    | undefined;

  const rowStyle: CSSProperties = {
    top: `${top}px`,
    height: `${rowHeight}px`,
    gridTemplateColumns: gridTemplate,
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: rendering a treegrid row as a div, not a table tr
    // dnd-kit's `attributes` are deliberately NOT spread: they announce a
    // Space/Enter pickup that can never activate on a tabIndex=-1 row (rows
    // are pointer-drag-only).
    <div
      ref={setRef}
      role="row"
      tabIndex={-1}
      aria-level={row.depth + 1}
      aria-selected={isSelected}
      aria-expanded={folder ? isExpanded : undefined}
      data-row-id={id}
      data-selected={isSelected}
      data-focused={isFocused}
      data-draggable={(draggable && !isEditing) || undefined}
      data-dragging={isDragging || undefined}
      data-drop-into={dropInto || undefined}
      data-drop-before={dropBefore || undefined}
      data-drop-after-last={dropAfterLast || undefined}
      className={styles.row}
      style={rowStyle}
      onPointerDown={(e) => {
        if (draggable && !isEditing) dndPointerDown?.(e);
        onRowPointerDown(e, row);
      }}
      onDoubleClick={() => onRowDoubleClick(row)}
      onContextMenu={(e) => onRowContextMenu(e, row)}
    >
      {columns.map((col, colIdx) => {
        const isTreeCol = colIdx === 0;
        return (
          <div
            key={col.id}
            className={styles.cell}
            data-align={col.align ?? "start"}
            {...(isTreeCol ? { "data-tree": "" } : {})}
          >
            {isTreeCol ? (
              <TreeCellContent
                node={row.node}
                depth={row.depth}
                folder={folder}
                expanded={isExpanded}
                editing={isEditing}
                icon={icon}
                onChevronToggle={() => onChevronToggle(id)}
                onRenameCommit={(next) => onRenameCommit(id, next)}
                onRenameCancel={onRenameCancel}
              />
            ) : (
              <span className={styles.cellContent}>{readCell(col, row.node)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** flatten() allocates fresh FlatRow objects on every run, so `row` is compared
 *  by content (node identity + depth + parentId — everything ExplorerRow
 *  reads), not reference; all other props compare by Object.is. */
function explorerRowPropsEqual<M>(
  prev: Readonly<ExplorerRowProps<M>>,
  next: Readonly<ExplorerRowProps<M>>,
): boolean {
  if (
    prev.row.node !== next.row.node ||
    prev.row.depth !== next.row.depth ||
    prev.row.parentId !== next.row.parentId
  ) {
    return false;
  }
  for (const key in next) {
    const k = key as keyof ExplorerRowProps<M>;
    if (k !== "row" && !Object.is(prev[k], next[k])) return false;
  }
  return true;
}

// Cast preserves the generic call signature memo() would otherwise widen away.
const MemoExplorerRow = memo(ExplorerRow, explorerRowPropsEqual) as typeof ExplorerRow;

// --- Tree cell content -----------------------------------------------------

interface TreeCellContentProps<M> {
  node: ExplorerNode<M>;
  depth: number;
  folder: boolean;
  expanded: boolean;
  editing: boolean;
  icon?: (node: ExplorerNode<M>) => ReactNode;
  onChevronToggle: () => void;
  onRenameCommit: (next: string) => void;
  onRenameCancel: () => void;
}

function TreeCellContent<M>({
  node,
  depth,
  folder,
  expanded,
  editing,
  icon,
  onChevronToggle,
  onRenameCommit,
  onRenameCancel,
}: TreeCellContentProps<M>) {
  const customIcon = icon?.(node);
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        // Each guide also doubles as the indent step (0.75u wide).
        // biome-ignore lint/suspicious/noArrayIndexKey: indent guides have no identity beyond position
        <span key={i} className={styles.indentGuide} data-indent-guide="" aria-hidden="true" />
      ))}
      <TreeChevron visible={folder} expanded={expanded} onToggle={onChevronToggle} />
      <span className={styles.icon}>
        {customIcon ??
          (folder ? (
            <Glyph slot="folder" fallback={Folder} />
          ) : (
            <Glyph slot="file" fallback={File} />
          ))}
      </span>
      {editing ? (
        <RenameField initialValue={node.name} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span className={styles.cellContent}>{node.name}</span>
      )}
    </>
  );
}

// --- Viewport droppable -----------------------------------------------------

/** Registers the scroll viewport itself as a droppable (attached to the
 *  already-rendered node via `viewportRef`), so append-to-root fires only for
 *  drops inside the tree but below the rows. Rendered inside the viewport so
 *  the hook sits under the owning DndContext in own-context mode.
 *
 *  Disabled unless one of THIS tree's rows is being dragged: the viewport rect
 *  spans the whole tree, so under closestCenter (foreign drags, whose collision
 *  detection this widget does not own) its center would outrank a row's center
 *  for drops near the tree's vertical middle and steal row-targeted drops. */
function ViewportDroppable({
  regionId,
  viewportRef,
  disabled,
}: {
  regionId: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `${regionId}:viewport`,
    disabled,
    data: { [SF_REGION_KEY]: regionId, viewport: true },
  });
  // Attach once per mount: setNodeRef is identity-stable, and re-attaching per
  // render would re-fire dnd-kit's node-change handler (a rect recompute).
  useLayoutEffect(() => {
    setNodeRef(viewportRef.current);
    return () => setNodeRef(null);
  }, [setNodeRef, viewportRef]);
  return null;
}

// --- Drag overlay ----------------------------------------------------------

function DragOverlayContent({ name, height }: { name: string; height: number }) {
  return (
    <div className={styles.dragOverlay} style={{ height: `${height}px` }}>
      {name}
    </div>
  );
}

// --- Context menu ---------------------------------------------------------

interface ContextMenuProps {
  ctx: { x: number; y: number; targetId: string | null } | null;
  hasTarget: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ContextMenu(props: ContextMenuProps) {
  const { ctx, hasTarget, onClose, onNewFile, onNewFolder, onRename, onDelete } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu.Root open={ctx != null} onOpenChange={(open) => !open && onClose()}>
      <Menu.Trigger
        ref={triggerRef}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "fixed",
          left: ctx?.x ?? 0,
          top: ctx?.y ?? 0,
          width: 0,
          height: 0,
          padding: 0,
          margin: 0,
          border: 0,
          background: "transparent",
          pointerEvents: "none",
        }}
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start">
          <Menu.Popup>
            <Menu.Item onClick={onNewFile}>New file</Menu.Item>
            <Menu.Item onClick={onNewFolder}>New folder</Menu.Item>
            {hasTarget ? (
              <>
                <Menu.Separator />
                <Menu.Item onClick={onRename}>Rename</Menu.Item>
                <Menu.Item onClick={onDelete}>Delete</Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
