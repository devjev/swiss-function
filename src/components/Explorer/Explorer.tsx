import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { resizeBoundary } from "../../lib/columns/resizeBoundary";
import { useColumnOrder } from "../../lib/columns/useColumnOrder";
import { useColumnWidths } from "../../lib/columns/useColumnWidths";
import { cx } from "../../lib/cx";
import { useDitheredFill } from "../../lib/effects";
import {
  ColumnFilter,
  type ColumnFilterKind,
  type FilterOption,
} from "../../lib/filter/ColumnFilter";
import { useColumnFilters } from "../../lib/filter/useColumnFilters";
import { TreeChevron } from "../../lib/TreeChevron";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { Menu } from "../Menu";
import type { FlatRow } from "./dnd";
import { findNode, flatten, wouldCycle } from "./dnd";
import styles from "./Explorer.module.css";
import { RenameField } from "./RenameField";
import {
  checklistTest,
  collectKeptFolderIds,
  filterTree,
  makeComparator,
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

type DropZone =
  | { kind: "into"; folderId: string }
  | { kind: "before"; flatIndex: number }
  | { kind: "after-all" };

/** Inferred filter UI for a column: its kind and (checklist) selectable values. */
type FilterMeta = { kind: ColumnFilterKind; options: FilterOption[] };

// --- Default folder / file glyphs ------------------------------------------

function FolderGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <title>Folder</title>
      <path d="M1.5 4 H6 L7 5.25 H14.5 V13 H1.5 Z" fill="none" stroke="currentColor" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <title>File</title>
      <path d="M3 1.5 H10 L13 4.5 V14.5 H3 Z" fill="none" stroke="currentColor" />
      <path d="M10 1.5 V4.5 H13" fill="none" stroke="currentColor" />
    </svg>
  );
}

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

/** Build the `grid-template-columns` string shared by the header and every row.
 *  Without resizing it keeps Explorer's original semantics (number→px, string
 *  as-is, undefined→`1fr`). With resizing on it mirrors DataTable: every track
 *  is `minmax(min, preferred)` and the last stretches, so `resizeBoundary`'s px
 *  overrides cascade into the flexible filler. */
function buildGridTemplate<M>(
  columns: ExplorerColumn<M>[],
  overrides: Record<string, number>,
  resizable: boolean,
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
      if (i === lastIdx) return `minmax(${min}, 1fr)`;
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
    columnFill = false,
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
  const gridTemplate = useMemo(
    () => buildGridTemplate(orderedColumns, columnWidths, resizableColumns),
    [orderedColumns, columnWidths, resizableColumns],
  );

  // --- Filtering: infer each filterable column's UI + build active filters ---
  const filterCols = useMemo(
    () => (filterableColumns ? orderedColumns.filter((c) => c.filterable !== false) : []),
    [filterableColumns, orderedColumns],
  );

  const filterMeta = useMemo(() => {
    const map = new Map<string, FilterMeta>();
    for (const col of filterCols) {
      const read = makeRead(col, col.id === treeColId);
      if (col.filter) {
        map.set(col.id, { kind: col.filter.kind, options: col.filter.options ?? [] });
        continue;
      }
      const values: unknown[] = [];
      forEachNode(nodes, (n) => values.push(read(n)));
      const present = values.filter((v) => v != null);
      const allNumeric = present.length > 0 && present.every((v) => typeof v === "number");
      if (allNumeric) {
        map.set(col.id, { kind: "range", options: [] });
      } else {
        const distinct = [...new Set(present.map((v) => String(v)))].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        );
        map.set(col.id, {
          kind: "checklist",
          options: distinct.map((v) => ({ value: v, label: v })),
        });
      }
    }
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

  // --- Virtualization -----------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  // --- State setters that always go through the controlled callbacks -----
  const setSelection = (ids: Set<string>) => onSelectionChange?.(ids);
  const setExpanded = (ids: Set<string>) => onExpandedChange?.(ids);
  const setEditing = (id: string | null) => onEditingChange?.(id);

  const toggleExpand = (id: string) => {
    // Toggle against the raw controlled set (not the filter-effective one), so
    // user collapses persist and are restored when the filter clears.
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  // --- Column resizing ------------------------------------------------------
  const measureHeaderWidths = (): number[] | null => {
    const row = headerRowRef.current;
    if (!row) return null;
    return Array.from(row.children).map((el) => (el as HTMLElement).getBoundingClientRect().width);
  };

  const applyResize = (idx: number, startWidths: number[], dx: number, minPx: number) => {
    const resizable = orderedColumns.map((c) => c.resizable !== false);
    const out = resizeBoundary(startWidths, resizable, idx, dx, minPx);
    setColumnWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (let k = 0; k < out.length - 1; k++) {
        const col = orderedColumns[k];
        if (!col) continue;
        const v = Math.round(out[k] as number);
        if (next[col.id] !== v) {
          next[col.id] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const resizeRef = useRef<{
    idx: number;
    startWidths: number[];
    minPx: number;
    handle: HTMLElement;
  } | null>(null);
  const { onPointerDown: onColumnResizeDown } = usePointerDrag({
    onStart: (_origin, event) => {
      const handle = event.currentTarget as HTMLElement;
      const id = handle.dataset.columnId;
      if (!id) return;
      const idx = orderedColumns.findIndex((c) => c.id === id);
      const startWidths = measureHeaderWidths();
      if (idx < 0 || !startWidths) return;
      handle.dataset.dragging = "true";
      resizeRef.current = {
        idx,
        startWidths,
        minPx: orderedColumns[idx]?.minWidth ?? MIN_COL_PX,
        handle,
      };
    },
    onMove: (delta) => {
      const r = resizeRef.current;
      if (r) applyResize(r.idx, r.startWidths, delta.dx, r.minPx);
    },
    onEnd: () => {
      const r = resizeRef.current;
      if (r) delete r.handle.dataset.dragging;
      resizeRef.current = null;
    },
  });

  const nudgeResize = (colId: string, delta: number) => {
    const idx = orderedColumns.findIndex((c) => c.id === colId);
    const widths = measureHeaderWidths();
    if (idx < 0 || !widths) return;
    applyResize(idx, widths, delta, orderedColumns[idx]?.minWidth ?? MIN_COL_PX);
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
  const onColDragEnd = (e: DragEndEvent) => {
    setDraggingColId(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const from = nonTreeIds.indexOf(activeId);
    const to = nonTreeIds.indexOf(overId);
    if (from < 0 || to < 0) return;
    setColumnOrder(arrayMove(nonTreeIds, from, to));
  };

  // --- Column-fill dither ---------------------------------------------------
  const fillOn = columnFill !== false;
  const fillOpts = typeof columnFill === "object" ? columnFill : {};
  const fillAnimated = fillOpts.animated === true;
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
  const handleRowPointerDown = (e: MouseEvent, row: FlatRow<M>) => {
    // Right-click is handled in onContextMenu; don't disturb selection here for it.
    if (e.button === 2) return;
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
        setSelection(next);
      }
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(next);
      setAnchorId(id);
    } else {
      setSelection(new Set([id]));
      setAnchorId(id);
    }
    setFocusedId(id);
  };

  const handleRowDoubleClick = (row: FlatRow<M>) => {
    if (!editable) return;
    setEditing(row.node.id);
  };

  const handleRowContextMenu = (e: MouseEvent, row: FlatRow<M>) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.has(row.node.id)) {
      setSelection(new Set([row.node.id]));
      setAnchorId(row.node.id);
    }
    setFocusedId(row.node.id);
    setCtx({ x: e.clientX, y: e.clientY, targetId: row.node.id });
  };

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

  const computeDropZone = (e: DragMoveEvent | DragEndEvent): DropZone | null => {
    if (!draggingId) return null;
    if (!e.over) return { kind: "after-all" };

    const data = e.over.data.current as { rowIndex?: number } | undefined;
    const rowIdx = data?.rowIndex;
    if (rowIdx == null) return null;

    const overRect = e.over.rect;
    const activator = e.activatorEvent as PointerEvent | null;
    if (!activator) return null;
    const currentY = activator.clientY + e.delta.y;
    const yWithin = currentY - overRect.top;
    const q = rowHeight / 4;
    const targetRow = flatRows[rowIdx];
    if (!targetRow) return null;

    const draggedNode = findNode(nodes, draggingId);
    if (!draggedNode) return null;

    let zone: DropZone;
    if (yWithin < q) {
      zone = { kind: "before", flatIndex: rowIdx };
    } else if (yWithin > rowHeight - q) {
      zone = { kind: "before", flatIndex: rowIdx + 1 };
    } else if (isFolder(targetRow.node)) {
      zone = { kind: "into", folderId: targetRow.node.id };
    } else {
      zone = { kind: "before", flatIndex: rowIdx };
    }

    // Cycle prevention: compute prospective parent and reject if it's the
    // dragged node itself or any of its descendants.
    let prospectiveParent: string | null = null;
    if (zone.kind === "into") prospectiveParent = zone.folderId;
    else if (zone.kind === "before") {
      const tgt = flatRows[zone.flatIndex];
      prospectiveParent = tgt ? tgt.parentId : null;
    }
    if (wouldCycle(draggedNode, prospectiveParent)) return null;
    return zone;
  };

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));

  const onDragMove = (e: DragMoveEvent) => {
    if (!editable) return;
    setDropZone(computeDropZone(e));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const zone = computeDropZone(e);
    const id = draggingId;
    setDropZone(null);
    setDraggingId(null);
    if (!zone || !id) return;
    // A reorder while sorted would compute `beforeId` from the sorted order,
    // not the persisted one — ignore drops until the sort is cleared.
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
    return (
      <div
        key={col.id}
        ref={dnd?.ref}
        className={cx(styles.headerCell, dnd?.dragging && styles.headerDragging)}
        data-align={col.align ?? "start"}
        data-sortable={col.sortable || undefined}
        style={dnd?.style}
        onClick={col.sortable ? () => cycleSort(col.id) : undefined}
        {...(dnd?.attributes ?? {})}
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
        {resizableColumns && !isLast && col.resizable !== false ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${col.header}`}
            tabIndex={0}
            data-column-id={col.id}
            className={styles.resizeHandle}
            onPointerDown={(e: ReactPointerEvent) => {
              e.stopPropagation();
              onColumnResizeDown(e);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              e.stopPropagation();
              const step = (e.shiftKey ? 1 : 8) * (e.key === "ArrowRight" ? 1 : -1);
              nudgeResize(col.id, step);
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
        id={col.id}
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
        <DndContext
          sensors={colSensors}
          onDragStart={(e) => setDraggingColId(String(e.active.id))}
          onDragEnd={onColDragEnd}
          onDragCancel={() => setDraggingColId(null)}
        >
          <SortableContext items={nonTreeIds} strategy={horizontalListSortingStrategy}>
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
      {...rest}
    >
      {header}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
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
          {showEmpty ? (
            <div className={styles.empty}>{empty}</div>
          ) : (
            <div className={styles.body} style={{ height: `${virtualizer.getTotalSize()}px` }}>
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
                return (
                  <ExplorerRow<M>
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
                    dropZone={dropZone}
                    isLastRow={isLast}
                    draggable={editable}
                    icon={icon}
                    onChevronToggle={() => toggleExpand(id)}
                    onPointerDown={(e) => handleRowPointerDown(e, row)}
                    onDoubleClick={() => handleRowDoubleClick(row)}
                    onContextMenu={(e) => handleRowContextMenu(e, row)}
                    onRenameCommit={(name) => {
                      onRename?.(id, name);
                      setEditing(null);
                    }}
                    onRenameCancel={() => setEditing(null)}
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

        <DragOverlay dropAnimation={null}>
          {draggingId ? (
            <DragOverlayContent name={findNode(nodes, draggingId)?.name ?? ""} />
          ) : null}
        </DragOverlay>

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
      </DndContext>
    </div>
  );
}

// --- Sortable header cell (column reorder) --------------------------------

interface HeaderDnd {
  ref: (node: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  style: CSSProperties;
  dragging: boolean;
}

function SortableHeaderCell({ id, render }: { id: string; render: (dnd: HeaderDnd) => ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
  });
  return render({
    ref: setNodeRef,
    attributes: attributes as unknown as Record<string, unknown>,
    listeners: listeners as Record<string, unknown> | undefined,
    style: { transform: CSS.Transform.toString(transform), transition },
    dragging: isDragging,
  });
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
  isLastRow: boolean;
  dropZone: DropZone | null;
  draggable: boolean;
  icon?: (node: ExplorerNode<M>) => ReactNode;
  onChevronToggle: () => void;
  onPointerDown: (e: MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onRenameCommit: (next: string) => void;
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
    isLastRow,
    dropZone,
    draggable,
    icon,
    onChevronToggle,
    onPointerDown,
    onDoubleClick,
    onContextMenu,
    onRenameCommit,
    onRenameCancel,
  } = props;

  const id = row.node.id;
  const folder = isFolder(row.node);

  const draggableHook = useDraggable({ id, disabled: !draggable || isEditing });
  const droppableHook = useDroppable({ id: `row-${id}`, data: { rowIndex } });

  const setRef = (el: HTMLDivElement | null) => {
    draggableHook.setNodeRef(el);
    droppableHook.setNodeRef(el);
  };

  // Drop indicator flags
  const dropIntoMe = dropZone?.kind === "into" && dropZone.folderId === id;
  const dropBeforeMe = dropZone?.kind === "before" && dropZone.flatIndex === rowIndex;
  const dropAfterMeIsLast =
    isLastRow && dropZone?.kind === "before" && dropZone.flatIndex === rowIndex + 1;
  const dropAfterAllAndLast = isLastRow && dropZone?.kind === "after-all";

  const rowStyle: CSSProperties = {
    top: `${top}px`,
    height: `${rowHeight}px`,
    gridTemplateColumns: gridTemplate,
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: rendering a treegrid row as a div, not a table tr
    <div
      ref={setRef}
      {...(draggable && !isEditing ? draggableHook.listeners : {})}
      {...(draggable && !isEditing ? draggableHook.attributes : {})}
      role="row"
      tabIndex={-1}
      aria-level={row.depth + 1}
      aria-selected={isSelected}
      aria-expanded={folder ? isExpanded : undefined}
      data-row-id={id}
      data-selected={isSelected}
      data-focused={isFocused}
      data-dragging={isDragging || undefined}
      data-drop-into={dropIntoMe || undefined}
      data-drop-before={dropBeforeMe || undefined}
      data-drop-after-last={dropAfterMeIsLast || dropAfterAllAndLast || undefined}
      className={styles.row}
      style={rowStyle}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
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
                onChevronToggle={onChevronToggle}
                onRenameCommit={onRenameCommit}
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
        {customIcon ?? (folder ? <FolderGlyph /> : <FileGlyph />)}
      </span>
      {editing ? (
        <RenameField initialValue={node.name} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span className={styles.cellContent}>{node.name}</span>
      )}
    </>
  );
}

// --- Drag overlay ----------------------------------------------------------

function DragOverlayContent({ name }: { name: string }) {
  return (
    <div
      className={styles.dragOverlay}
      style={{
        padding: "0 calc(var(--sf-unit) / 2)",
        height: "32px",
        boxShadow: "var(--sf-elevation-3)",
        border: "1px solid var(--sf-color-border-subtle)",
      }}
    >
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
