import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef as TSColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { TreeChevron } from "../../lib/TreeChevron";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { buildColumnTemplate, COLUMN_MIN_UNITS, resizeBoundary } from "./columnWidths";
import styles from "./DataTable.module.css";
import { CellEditor } from "./editors";
import { Pagination } from "./Pagination";
import type {
  AdvanceHint,
  Cell,
  CellChange,
  ColumnDef,
  ExpandedState,
  LeafColumnDef,
  PaginateConfig,
  Selection,
} from "./types";
import { isGroup } from "./types";
import { useColumnGroupCollapse } from "./useColumnGroupCollapse";
import { useTableClipboard } from "./useTableClipboard";
import { useTableEdit } from "./useTableEdit";
import { useTableSelection } from "./useTableSelection";
import { useTreeExpansion } from "./useTreeExpansion";

export interface DataTableProps<T>
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "onChange"> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Turn on click-to-edit + paste-to-update. Default false (read-only). */
  editable?: boolean;
  /** Called when cell values change (edit or paste). Consumer mutates/replaces data. */
  onCellChange?: (changes: CellChange[]) => void;
  /** Called when active cell / range selection changes. */
  onSelectionChange?: (selection: Selection) => void;
  /** Opt into pagination instead of virtualization. */
  paginate?: PaginateConfig;
  /** Row height in px. Default 36 (matches --sf-unit * 1.5). */
  rowHeight?: number;
  /** Viewport upper bound. Table sizes to content when content fits;
   *  caps and scrolls when it doesn't. Default 400px. */
  height?: number | string;
  /** Empty-state slot when data is empty. */
  empty?: ReactNode;
  /** Allow leaf columns to be drag/keyboard-resized (Excel-style). Default true.
   *  Lock individual columns with `resizable: false` on their column def. */
  resizableColumns?: boolean;
  /** Elastically snap scrolling to row and/or column edges (CSS `proximity`
   *  snap, so it only nudges when you release near a boundary). Default `"none"`. */
  scrollSnap?: "none" | "rows" | "columns" | "both";
  /** Fade the rows nearest the bottom scroll edge with a dithered mask, hinting
   *  there's more to scroll. The sticky header is never faded. Default `false`. */
  edgeFade?: boolean;

  /** Return child rows for a parent. Omit for flat tables. */
  getSubRows?: (row: T) => T[] | undefined;
  /** Which column owns the tree chevron + depth indent. Default: first visible leaf. */
  treeColumn?: string;
  /** Initial expanded state on first mount. `true` = expand everything. */
  defaultExpanded?: ExpandedState;
  /** Controlled expanded state. */
  expanded?: Record<string, boolean>;
  onExpandedChange?: (state: Record<string, boolean>) => void;

  /** Controlled column-group collapse state. */
  columnGroupsCollapsed?: Record<string, boolean>;
  onColumnGroupsCollapsedChange?: (state: Record<string, boolean>) => void;
}

const DEFAULT_ROW_HEIGHT = 36;
const DEFAULT_HEIGHT = 400;

/** Resolve a CSS length (e.g. `var(--sf-datatable-col-min)`) to px in the
 *  context of `parent`, so JS clamping matches the token the CSS uses. */
function measureCssWidth(parent: HTMLElement, value: string): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;width:${value};`;
  parent.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
}

function getCellValue<T>(row: T, accessor: LeafColumnDef<T>["accessor"]): unknown {
  if (typeof accessor === "function") return accessor(row);
  return (row as Record<string, unknown>)[accessor as string];
}

/** Walk a ColumnDef tree, returning leaf defs in display order. */
function flatLeaves<T>(defs: ColumnDef<T>[]): LeafColumnDef<T>[] {
  return defs.flatMap((d) => (isGroup(d) ? flatLeaves(d.columns) : [d]));
}

/** Map our ColumnDef (recursive) to TanStack's ColumnDef (also recursive).
 *  Preserves `meta.collapsedGroupId` on placeholder leaves so the header
 *  renderer can wire the chevron back to the right group. */
function toTSColumn<T>(def: ColumnDef<T>): TSColumnDef<T> {
  const header = typeof def.header === "string" ? def.header : () => def.header;
  if (isGroup(def)) {
    return {
      id: def.id,
      header,
      columns: def.columns.map(toTSColumn),
    } as TSColumnDef<T>;
  }
  const meta = (def as { meta?: unknown }).meta;
  return {
    id: def.id,
    header,
    accessorFn: (row: T) => getCellValue(row, def.accessor),
    enableSorting: def.sortable ?? false,
    ...(meta ? { meta } : {}),
    cell: def.cell
      ? ({ getValue, row }) =>
          def.cell?.({ value: getValue(), row: row.original, rowIndex: row.index })
      : ({ getValue }) => {
          const v = getValue();
          return v == null ? "" : String(v);
        },
  };
}

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    data,
    columns,
    editable = false,
    onCellChange,
    onSelectionChange,
    paginate,
    rowHeight = DEFAULT_ROW_HEIGHT,
    height = DEFAULT_HEIGHT,
    empty,
    resizableColumns = true,
    scrollSnap = "none",
    edgeFade = false,
    getSubRows,
    treeColumn,
    defaultExpanded,
    expanded: controlledExpanded,
    onExpandedChange,
    columnGroupsCollapsed: controlledGroupsCollapsed,
    onColumnGroupsCollapsedChange,
    className,
    style,
    ...rest
  } = props;

  // --- Column-group collapse ---
  const {
    toggle: toggleGroup,
    effectiveColumns,
    version: groupsVersion,
  } = useColumnGroupCollapse({
    columns,
    controlled: controlledGroupsCollapsed,
    onChange: onColumnGroupsCollapsedChange,
  });

  /** Flat visible leaf columns in display order. Drives cell indexing everywhere. */
  const visibleLeaves = useMemo(() => flatLeaves(effectiveColumns), [effectiveColumns]);

  // --- Tree expansion ---
  const {
    expanded: expandedState,
    setExpanded,
    version: treeVersion,
  } = useTreeExpansion({
    defaultExpanded,
    expanded: controlledExpanded,
    onExpandedChange,
  });

  // --- TanStack Table setup ---
  const tsColumns = useMemo<TSColumnDef<T>[]>(
    () => effectiveColumns.map(toTSColumn),
    [effectiveColumns],
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns: tsColumns,
    state: { sorting, expanded: expandedState },
    onSortingChange: setSorting,
    onExpandedChange: (updater) =>
      setExpanded(
        (typeof updater === "function" ? updater(expandedState) : updater) as ExpandedState,
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    ...(getSubRows ? { getSubRows: (row: T) => getSubRows(row) ?? undefined } : {}),
  });
  const rows = table.getRowModel().rows;

  // --- Pagination state ---
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const pageIndex = paginate?.pageIndex ?? internalPageIndex;
  const setPageIndex = useCallback(
    (idx: number) => {
      paginate?.onPageChange ? paginate.onPageChange(idx) : setInternalPageIndex(idx);
    },
    [paginate],
  );
  const pageCount = paginate
    ? Math.max(1, Math.ceil((paginate.totalRows ?? rows.length) / paginate.pageSize))
    : 1;
  const pageRows = paginate
    ? rows.slice(pageIndex * paginate.pageSize, (pageIndex + 1) * paginate.pageSize)
    : rows;

  // --- Virtualization ---
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRowCount = paginate ? pageRows.length : rows.length;
  const rowVirtualizer = useVirtualizer({
    count: paginate ? 0 : rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // --- Selection ---
  const colCount = visibleLeaves.length;
  const {
    selection,
    isActive,
    isInRange,
    handleCellPointerDown,
    handleCellPointerEnter,
    handleKeyDown: handleSelectionKey,
    setActive,
  } = useTableSelection({
    rowCount: visibleRowCount,
    colCount,
    onSelectionChange,
  });

  // Move the active cell after an editor commits. Mirrors Excel's commit-then-advance.
  const advanceCell = useCallback(
    (advance: AdvanceHint) => {
      if (!selection.active) return;
      const { row, col } = selection.active;
      let nextRow = row;
      let nextCol = col;
      switch (advance) {
        case "down":
          nextRow = row + 1;
          break;
        case "up":
          nextRow = row - 1;
          break;
        case "rightWrap":
          nextCol = col + 1;
          if (nextCol >= colCount) {
            nextCol = 0;
            nextRow = row + 1;
          }
          break;
        case "leftWrap":
          nextCol = col - 1;
          if (nextCol < 0) {
            nextCol = colCount - 1;
            nextRow = row - 1;
          }
          break;
      }
      nextRow = Math.max(0, Math.min(nextRow, visibleRowCount - 1));
      nextCol = Math.max(0, Math.min(nextCol, colCount - 1));
      setActive({ row: nextRow, col: nextCol });
    },
    [selection.active, colCount, visibleRowCount, setActive],
  );

  // --- Edit (operates on visible leaves) ---
  const {
    editing,
    isColumnEditable,
    startEdit,
    cancelEdit,
    commitEdit: rawCommitEdit,
  } = useTableEdit({
    editable,
    columns: visibleLeaves,
    onCellChange,
  });

  const commitEdit = useCallback(
    (value: unknown, advance?: AdvanceHint) => {
      rawCommitEdit(value);
      if (advance) advanceCell(advance);
    },
    [rawCommitEdit, advanceCell],
  );

  // --- Clipboard ---
  const visibleRows = paginate ? pageRows : rows;
  const getValueAt = useCallback(
    (rowIdx: number, colIdx: number): unknown => {
      const tsRow = visibleRows[rowIdx];
      const col = visibleLeaves[colIdx];
      if (!tsRow || !col) return null;
      return getCellValue(tsRow.original, col.accessor);
    },
    [visibleRows, visibleLeaves],
  );
  const { handleCopy, handlePaste } = useTableClipboard({
    editable,
    data,
    columns: visibleLeaves,
    selection,
    onCellChange,
    getCellValue: getValueAt,
  });

  // --- Clear selection when the visible matrix shape changes (tree / group toggle) ---
  const lastStructuralVersion = useRef<string>(`${treeVersion}|${groupsVersion}`);
  useEffect(() => {
    const v = `${treeVersion}|${groupsVersion}`;
    if (lastStructuralVersion.current !== v) {
      setActive(null);
      lastStructuralVersion.current = v;
    }
  }, [treeVersion, groupsVersion, setActive]);

  // --- Cell focus management (programmatic) ---
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cellKey = (r: number, c: number) => `${r}:${c}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: cellKey is a pure helper
  useEffect(() => {
    if (!selection.active || editing) return;
    const el = cellRefs.current.get(cellKey(selection.active.row, selection.active.col));
    el?.focus({ preventScroll: false });
  }, [selection.active, editing]);

  // Auto-fit: size a column to its widest currently-mounted content. `scrollWidth`
  // reports the full natural width even though cells clip with ellipsis.
  const autoFitColumn = useCallback(
    (columnId: string, headerCell: HTMLElement) => {
      const colIndex = visibleLeaves.findIndex((c) => c.id === columnId);
      if (colIndex < 0) return;
      // Header label is the first <span> in the header cell.
      const headerLabel = headerCell.querySelector("span");
      let widest = headerLabel ? headerLabel.scrollWidth : 0;
      for (const [key, el] of cellRefs.current) {
        if (Number(key.split(":")[1]) !== colIndex) continue;
        const body = el.querySelector<HTMLElement>(`.${styles.cellBody}`);
        widest = Math.max(widest, body ? body.scrollWidth : el.scrollWidth);
      }
      // Header + cell horizontal padding (calc(--sf-unit / 2) each side) plus slack.
      const PADDING = 24 + 8;
      const minPx = measureCssWidth(headerCell, "var(--sf-datatable-col-min)");
      const next = Math.max(minPx, Math.ceil(widest + PADDING));
      setColumnWidths((prev) => (prev[columnId] === next ? prev : { ...prev, [columnId]: next }));
    },
    [visibleLeaves],
  );

  // Keyboard resize on a focused handle. Arrow keys nudge by a step; Shift = larger.
  // --- Top-level keyboard router ---
  const handleKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLDivElement>) => {
      if (editing) return; // editor owns the keys

      const active = selection.active;

      if (active && isColumnEditable(active.col) && (ev.key === "F2" || ev.key === "Enter")) {
        ev.preventDefault();
        startEdit(active);
        return;
      }

      const native = ev.nativeEvent;
      if ((native.metaKey || native.ctrlKey) && native.key.toLowerCase() === "c") {
        ev.preventDefault();
        void handleCopy(native);
        return;
      }
      if ((native.metaKey || native.ctrlKey) && native.key.toLowerCase() === "v") {
        ev.preventDefault();
        void handlePaste(native);
        return;
      }

      handleSelectionKey(native);
    },
    [
      editing,
      selection.active,
      isColumnEditable,
      startEdit,
      handleCopy,
      handlePaste,
      handleSelectionKey,
    ],
  );

  // --- Column-width overrides (px), set by dragging the resize handle ---
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  /** Leaf column ids that may be resized (table opt-in × per-column opt-out). */
  const resizableColumnIds = useMemo(() => {
    const ids = new Set<string>();
    if (resizableColumns) {
      for (const c of visibleLeaves) if (c.resizable !== false) ids.add(c.id);
    }
    return ids;
  }, [resizableColumns, visibleLeaves]);

  // Snapshot the column widths from the (bottom) header row a handle lives in,
  // indexed to match `visibleLeaves`.
  const measureLeafWidths = useCallback((headerCell: HTMLElement): number[] | null => {
    const row = headerCell.parentElement;
    if (!row) return null;
    return Array.from(row.children).map((el) => el.getBoundingClientRect().width);
  }, []);

  // The last column is resized via the boundary on its left — normally that's
  // the previous column's trailing handle. But if the previous column is locked
  // it has no handle, so the last column would be stuck. In that case give the
  // last column its own leading-edge handle that trades width with the nearest
  // resizable column to the left (the locked ones in between just shift).
  const lastColLeadingTarget = useMemo(() => {
    const last = visibleLeaves[colCount - 1];
    const prev = visibleLeaves[colCount - 2];
    if (!last || !resizableColumnIds.has(last.id)) return null;
    if (!prev || resizableColumnIds.has(prev.id)) return null; // prev's handle already serves
    for (let k = colCount - 2; k >= 0; k--) {
      const leaf = visibleLeaves[k];
      if (leaf && resizableColumnIds.has(leaf.id)) return leaf.id;
    }
    return null;
  }, [visibleLeaves, colCount, resizableColumnIds]);

  // The handle id → the column its drag actually grows. A leading handle (on the
  // last column) is remapped to the nearest resizable column on the left; every
  // other handle resizes its own column.
  const resolveResizeIdx = useCallback(
    (id: string): number => {
      const idx = visibleLeaves.findIndex((c) => c.id === id);
      if (idx === colCount - 1 && lastColLeadingTarget) {
        return visibleLeaves.findIndex((c) => c.id === lastColLeadingTarget);
      }
      return idx;
    },
    [visibleLeaves, colCount, lastColLeadingTarget],
  );

  // Apply a boundary move starting from `startWidths`: cascade the change
  // through the right-hand columns and write the new widths as px overrides
  // (the last column stays its `1fr` filler, so it's left untouched).
  const applyResize = useCallback(
    (idx: number, startWidths: number[], dx: number, minPx: number) => {
      const resizable = visibleLeaves.map((c) => resizableColumnIds.has(c.id));
      const out = resizeBoundary(startWidths, resizable, idx, dx, minPx);
      setColumnWidths((prev) => {
        let changed = false;
        const nextWidths = { ...prev };
        for (let k = 0; k < out.length - 1; k++) {
          const leaf = visibleLeaves[k];
          if (!leaf) continue;
          const v = Math.round(out[k] as number);
          if (nextWidths[leaf.id] !== v) {
            nextWidths[leaf.id] = v;
            changed = true;
          }
        }
        return changed ? nextWidths : prev;
      });
    },
    [visibleLeaves, resizableColumnIds],
  );

  // A single drag instance serves every handle; onStart reads which column is
  // being resized (and the start geometry of the whole row) off the handle.
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
      const headerCell = handle.parentElement as HTMLElement | null;
      if (!id || !headerCell) return;
      const startWidths = measureLeafWidths(headerCell);
      const idx = resolveResizeIdx(id);
      if (!startWidths || idx < 0) return;
      handle.dataset.dragging = "true";
      resizeRef.current = {
        idx,
        startWidths,
        minPx: measureCssWidth(headerCell, "var(--sf-datatable-col-min)"),
        handle,
      };
    },
    onMove: (delta) => {
      const r = resizeRef.current;
      if (!r) return;
      applyResize(r.idx, r.startWidths, delta.dx, r.minPx);
    },
    onEnd: () => {
      const r = resizeRef.current;
      if (r) delete r.handle.dataset.dragging;
      resizeRef.current = null;
    },
  });

  // Keyboard resize on a focused handle: arrows nudge the boundary (Shift =
  // larger step), cascading through the same logic as a drag.
  const resizeColumnByKey = useCallback(
    (columnId: string, headerCell: HTMLElement, ev: KeyboardEvent<HTMLDivElement>) => {
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      const startWidths = measureLeafWidths(headerCell);
      const idx = resolveResizeIdx(columnId);
      if (!startWidths || idx < 0) return;
      const minPx = measureCssWidth(headerCell, "var(--sf-datatable-col-min)");
      const dx = (ev.key === "ArrowRight" ? 1 : -1) * (ev.shiftKey ? 24 : 8);
      applyResize(idx, startWidths, dx, minPx);
    },
    [measureLeafWidths, applyResize, resolveResizeIdx],
  );

  // --- Grid template (from visible leaves + runtime width overrides) ---
  const gridTemplateColumns = useMemo(
    () => buildColumnTemplate(visibleLeaves, columnWidths),
    [visibleLeaves, columnWidths],
  );

  // --- Tree column index (where the chevron + indent live) ---
  const treeColIdx = useMemo(() => {
    if (!getSubRows) return -1;
    if (treeColumn) return visibleLeaves.findIndex((c) => c.id === treeColumn);
    return 0;
  }, [getSubRows, treeColumn, visibleLeaves]);

  // --- Cell renderer ---
  const renderCell = (row: (typeof visibleRows)[number], rowIndex: number, colIndex: number) => {
    const tsCell = row.getVisibleCells()[colIndex];
    const colDef = visibleLeaves[colIndex];
    if (!tsCell || !colDef) return null;

    const cell: Cell = { row: rowIndex, col: colIndex };
    const active = isActive(cell);
    const inRange = isInRange(cell);
    const isEditing = editing?.cell.row === rowIndex && editing?.cell.col === colIndex;
    const align = colDef.align ?? "start";
    const isTreeCell = colIndex === treeColIdx;
    // A column explicitly opted out of resizing (only meaningful when the table
    // is otherwise resizable) — gets a subtle "fixed width" hint.
    const isLocked = resizableColumns && colDef.resizable === false;

    const content = (
      <>
        {isTreeCell && (
          <span
            className={styles.cellTreeGutter}
            style={{
              paddingInlineStart: `calc(var(--sf-unit) / 2 * ${row.depth})`,
            }}
          >
            <TreeChevron
              visible={row.getCanExpand()}
              expanded={row.getIsExpanded()}
              onToggle={() => row.toggleExpanded()}
              ariaLabel={row.getIsExpanded() ? "Collapse row" : "Expand row"}
            />
          </span>
        )}
        <span className={styles.cellBody}>
          {flexRender(tsCell.column.columnDef.cell, tsCell.getContext())}
        </span>
      </>
    );

    return (
      <div
        key={tsCell.id}
        ref={(el) => {
          if (el) cellRefs.current.set(cellKey(rowIndex, colIndex), el);
          else cellRefs.current.delete(cellKey(rowIndex, colIndex));
        }}
        role="gridcell"
        tabIndex={active ? 0 : -1}
        data-active={active || undefined}
        data-in-range={inRange || undefined}
        data-align={align}
        data-tree-cell={isTreeCell || undefined}
        data-locked={isLocked || undefined}
        className={styles.cell}
        onPointerDown={(e) => handleCellPointerDown(cell, { shiftKey: e.shiftKey })}
        onPointerEnter={() => handleCellPointerEnter(cell)}
        onDoubleClick={() => isColumnEditable(colIndex) && startEdit(cell)}
      >
        {isEditing && colDef.edit ? (
          <CellEditor
            value={getValueAt(rowIndex, colIndex)}
            config={colDef.edit}
            initialText={editing?.initialText}
            onCommit={commitEdit}
            onCancel={cancelEdit}
          />
        ) : (
          content
        )}
      </div>
    );
  };

  // --- Render ---
  const headerGroups = table.getHeaderGroups();
  const showEmpty = data.length === 0;

  return (
    <div className={cx(styles.wrapper, className)} style={style} {...rest}>
      <div
        ref={containerRef}
        role="grid"
        tabIndex={-1}
        className={styles.viewport}
        style={{ maxHeight: height, "--sf-row-height": `${rowHeight}px` } as CSSProperties}
        onKeyDown={handleKeyDown}
        data-snap-rows={scrollSnap === "rows" || scrollSnap === "both" ? "" : undefined}
        data-snap-cols={scrollSnap === "columns" || scrollSnap === "both" ? "" : undefined}
      >
        {/* Headers — one row per header group; parent groups span their leaves. */}
        {headerGroups.map((hg) => (
          <div key={hg.id} className={styles.headerRow} style={{ gridTemplateColumns }} role="row">
            {hg.headers.map((header) => {
              const span = header.colSpan;
              const isGroupHeader = header.subHeaders.length > 0;
              const def = header.column.columnDef;
              const colMeta = (def as { meta?: { collapsedGroupId?: string } }).meta;
              // For placeholder leaves (collapsed groups), pull the original
              // group id back out so the chevron toggles the right thing.
              const collapsedGroupId = colMeta?.collapsedGroupId;
              const canSort = header.column.getCanSort();
              const sortDir = header.column.getIsSorted();
              const isLeafHeader = !isGroupHeader && !header.isPlaceholder;
              // The last column is the flexible filler — it has no trailing
              // handle (its width is set by resizing the column on its left).
              const isLastLeaf = header.column.id === visibleLeaves[colCount - 1]?.id;
              const showTrailingHandle =
                isLeafHeader && resizableColumnIds.has(header.column.id) && !isLastLeaf;
              // Leading-edge handle for the last column when its locked neighbour
              // leaves it with no grip; it trades width with `lastColLeadingTarget`.
              const showLeadingHandle = isLeafHeader && isLastLeaf && lastColLeadingTarget != null;
              const showResizeHandle = showTrailingHandle || showLeadingHandle;
              // A leaf that opted out of resizing while the table is resizable —
              // gets the "fixed width" hint (dashed edge + muted hover hairline).
              const isLocked =
                isLeafHeader && resizableColumns && !resizableColumnIds.has(header.column.id);
              return (
                <div
                  key={header.id}
                  role="columnheader"
                  className={cx(styles.headerCell, isGroupHeader && styles.headerCellGroup)}
                  style={{ gridColumn: `span ${span}` }}
                  data-align={isGroupHeader ? "center" : "start"}
                  data-sortable={canSort || undefined}
                  data-locked={isLocked || undefined}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                >
                  {!header.isPlaceholder && (
                    <>
                      <span>{flexRender(def.header, header.getContext())}</span>
                      {sortDir === "asc" && <span aria-hidden="true"> ▲</span>}
                      {sortDir === "desc" && <span aria-hidden="true"> ▼</span>}
                      {(isGroupHeader || collapsedGroupId) && (
                        <TreeChevron
                          expanded={isGroupHeader}
                          onToggle={() => toggleGroup(collapsedGroupId ?? header.column.id)}
                          ariaLabel={isGroupHeader ? "Collapse group" : "Expand group"}
                        />
                      )}
                    </>
                  )}
                  {showResizeHandle && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${typeof def.header === "string" ? def.header : header.column.id} column`}
                      aria-valuenow={Math.round(columnWidths[header.column.id] ?? 0)}
                      aria-valuemin={COLUMN_MIN_UNITS * 24}
                      tabIndex={0}
                      data-column-id={header.column.id}
                      className={cx(
                        styles.resizeHandle,
                        showLeadingHandle && styles.resizeHandleStart,
                      )}
                      onPointerDown={onColumnResizeDown}
                      // Don't let a click on the handle toggle column sorting.
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Auto-fit only makes sense for a trailing handle (it
                        // fits the column it sits on); skip it for leading ones.
                        if (!showLeadingHandle) {
                          autoFitColumn(
                            header.column.id,
                            e.currentTarget.parentElement as HTMLElement,
                          );
                        }
                      }}
                      onKeyDown={(e) =>
                        resizeColumnByKey(
                          header.column.id,
                          e.currentTarget.parentElement as HTMLElement,
                          e,
                        )
                      }
                    />
                  )}
                  {isLocked && <div aria-hidden="true" className={styles.lockedEdge} />}
                </div>
              );
            })}
          </div>
        ))}

        {/* Body */}
        {showEmpty ? (
          <div className={styles.empty}>{empty ?? "No data"}</div>
        ) : paginate ? (
          <div className={styles.body}>
            {pageRows.map((row, rowIndex) => (
              <div
                key={row.id}
                role="row"
                className={styles.row}
                style={{ gridTemplateColumns, height: rowHeight }}
              >
                {row.getVisibleCells().map((_, colIndex) => renderCell(row, rowIndex, colIndex))}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={styles.body}
            style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualRows.map((vr) => {
              const row = rows[vr.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  role="row"
                  className={styles.row}
                  style={{
                    gridTemplateColumns,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: vr.size,
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((_, colIndex) => renderCell(row, vr.index, colIndex))}
                </div>
              );
            })}
          </div>
        )}

        {/* Dithered fade at the bottom scroll edge. Sticky + negative margin so
            it overlays the last rows without adding layout space; the sticky
            header stays above it and is never faded. */}
        {edgeFade && !showEmpty ? <div className={styles.edgeFade} aria-hidden="true" /> : null}
      </div>

      {paginate && (
        <Pagination pageIndex={pageIndex} pageCount={pageCount} onPageChange={setPageIndex} />
      )}
    </div>
  );
}
