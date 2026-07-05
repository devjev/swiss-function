import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import {
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Header,
  type SortingState,
  type ColumnDef as TSColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, UIEvent } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type HeaderDnd, SortableHeaderCell } from "../../lib/columns/SortableHeaderCell";
import { useColumnOrder } from "../../lib/columns/useColumnOrder";
import { useColumnWidths } from "../../lib/columns/useColumnWidths";
import { cx } from "../../lib/cx";
import type { EffectName } from "../../lib/effects";
import { useDitheredFill } from "../../lib/effects";
import { ColumnFilter, type FilterOption } from "../../lib/filter/ColumnFilter";
import { useColumnFilters } from "../../lib/filter/useColumnFilters";
import { TreeChevron } from "../../lib/TreeChevron";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { computeMergeMap, type MergeMap } from "./cellSpans";
import {
  buildColumnTemplate,
  COLUMN_MIN_UNITS,
  frozenLeftOffsets,
  frozenTotalWidth,
  resizeBoundary,
} from "./columnWidths";
import styles from "./DataTable.module.css";
import { CellEditor } from "./editors";
import { Pagination } from "./Pagination";
import { computeRowOrder, getCellValue } from "./rowOrder";
import { buildTreeMeta } from "./treeRows";
import type {
  AdvanceHint,
  Cell,
  CellChange,
  CellRange,
  CellSpanFn,
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
  /** Freeze the first N columns so they stay pinned to the left while the rest
   *  scroll horizontally (the column analogue of the sticky header). Counts leaf
   *  columns in display order (the tree/chevron column included). Frozen columns
   *  keep a fixed width and never shrink. A column group is pinned only when its
   *  whole span is inside the frozen region. Default `0` (off). */
  frozenColumns?: number;
  /** Elastically snap scrolling to row and/or column edges (CSS `proximity`
   *  snap, so it only nudges when you release near a boundary). Default `"none"`. */
  scrollSnap?: "none" | "rows" | "columns" | "both";
  /** Fade the rows nearest the bottom scroll edge with a dithered mask, hinting
   *  there's more to scroll. The sticky header is never faded. `true` uses the
   *  defaults; pass an object to tune it:
   *   - `rows`: how many rows tall the fade is (default 2)
   *   - `density`: peak dot opacity at the very bottom, 0–1 (default 1)
   *  Default `false`. */
  edgeFade?: boolean | { rows?: number; density?: number };
  /** Visually merge cells. Return e.g. `{ rowSpan: 3 }` at the top-left ("lead")
   *  cell of a region; the cells it covers are blanked and the internal borders
   *  erased so the region reads as one cell. Spans are by visible position, so
   *  recompute from the current sort order if needed. */
  getCellSpan?: CellSpanFn<T>;

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

  /** Standard preferred width (in `--sf-unit` multiples) for columns that don't
   *  declare their own `width`. Default 8. */
  defaultColumnWidth?: number;
  /** Controlled px width overrides keyed by column id. Pass with
   *  `onColumnWidthsChange`. */
  columnWidths?: Record<string, number>;
  /** Initial px width overrides when uncontrolled (e.g. restored from storage). */
  defaultColumnWidths?: Record<string, number>;
  /** Fired with the full override map whenever a column is resized or auto-fit —
   *  persist it to "save" the user's widths. */
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  /** Don't stretch the last column to the right edge; instead keep all columns at
   *  their fixed widths and fill the leftover space with a dither panel (so a
   *  sparse table doesn't read as unfinished). `true` uses a static CSS dither;
   *  pass an object to animate it or tune the look. Default `false`. */
  columnFill?: ColumnFill;
  /** Allow leaf columns to be reordered by dragging their headers. Default false. */
  reorderableColumns?: boolean;
  /** Controlled column order (leaf column ids). Pass with `onColumnOrderChange`. */
  columnOrder?: string[];
  /** Initial column order when uncontrolled (e.g. restored from storage). */
  defaultColumnOrder?: string[];
  /** Fired with the full order array whenever a column is dragged to a new spot. */
  onColumnOrderChange?: (order: string[]) => void;
  /** Show a per-column header filter (funnel) on leaf columns. The control type
   *  follows the column's `edit.type` (text/select/boolean → value checklist;
   *  number → min/max range). Exclude a column with `filterable: false`.
   *  Default false. */
  filterableColumns?: boolean;
  /** Controlled column filters (TanStack `ColumnFiltersState`). Pass with
   *  `onColumnFiltersChange`. */
  columnFilters?: ColumnFiltersState;
  /** Initial filters when uncontrolled. */
  defaultColumnFilters?: ColumnFiltersState;
  /** Fired with the full filter array whenever a filter changes. */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
}

export type ColumnFill =
  | boolean
  | {
      /** Use the animated WebGL dither instead of the static CSS one. */
      animated?: boolean;
      /** Animated effect name (default `"noise"`). */
      effect?: EffectName;
      /** Dither colour (any CSS colour). Defaults to a muted token. */
      color?: string;
      /** Animated coverage density 0–1 (default 0.5). */
      density?: number;
      /** Animation speed multiplier (1 = normal, 2 = twice as fast). Animated only. */
      speed?: number;
    };

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

/** Checklist filter: keep rows whose stringified value is in the allowed set.
 *  Only runs when a filter entry exists, so an empty set is treated as "keep". */
const includesFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  const allowed = filterValue as string[] | undefined;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(String(row.getValue(columnId)));
};

/** Shared collator for the funnel's option sort. The default (non-numeric)
 *  collator matches bare `a.localeCompare(b)` ordering exactly — do NOT swap
 *  in Explorer's numeric naturalCompare, which changes option order (#17). */
const optionCollator = new Intl.Collator();

/** Numeric range filter: keep rows within [min, max]; a blank bound is open. */
const rangeFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  const [min, max] = (filterValue as [number | undefined, number | undefined]) ?? [];
  const v = Number(row.getValue(columnId));
  if (min != null && !(v >= min)) return false;
  if (max != null && !(v <= max)) return false;
  return true;
};

/** Walk a ColumnDef tree, returning leaf defs in display order. */
function flatLeaves<T>(defs: ColumnDef<T>[]): LeafColumnDef<T>[] {
  return defs.flatMap((d) => (isGroup(d) ? flatLeaves(d.columns) : [d]));
}

/** Reorder leaf defs by an `order` array of ids; ids absent from `order` keep
 *  their natural position at the tail. Empty order = natural order. */
function applyOrder<T>(leaves: LeafColumnDef<T>[], order: string[]): LeafColumnDef<T>[] {
  if (order.length === 0) return leaves;
  const byId = new Map(leaves.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const out: LeafColumnDef<T>[] = [];
  for (const id of order) {
    const leaf = byId.get(id);
    if (leaf && !seen.has(id)) {
      out.push(leaf);
      seen.add(id);
    }
  }
  for (const leaf of leaves) if (!seen.has(leaf.id)) out.push(leaf);
  return out;
}

/** Map each leaf column id → its parent group id (or null at the top level), so
 *  reorder drops can be rejected when they'd move a leaf out of its group. */
function leafParentMap<T>(
  defs: ColumnDef<T>[],
  parent: string | null = null,
  out = new Map<string, string | null>(),
): Map<string, string | null> {
  for (const d of defs) {
    if (isGroup(d)) leafParentMap(d.columns, d.id, out);
    else out.set(d.id, parent);
  }
  return out;
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
    // Filter kind follows the edit type: numbers use a range, everything else a
    // value checklist. Harmless on unfiltered columns (only runs with an entry).
    filterFn: (def.edit?.type === "number" ? rangeFilter : includesFilter) as FilterFn<T>,
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

/** Mirror of useTableSelection's editing shape (not exported there). */
interface RowEditingState {
  cell: Cell;
  initialText?: string;
}

function cellInRange(row: number, col: number, range: CellRange | null): boolean {
  if (!range) return false;
  return (
    row >= range.start.row && row <= range.end.row && col >= range.start.col && col <= range.end.col
  );
}

interface DataTableRowProps<T> {
  original: T;
  /** Original data index — row key + custom-cell `rowIndex` (parity with
   *  TanStack's `row.index`, which is the pre-sort/-filter position). */
  dataIdx: number;
  /** Display row index — the selection/edit/merge coordinate space. */
  displayIndex: number;
  height: number;
  /** Virtualized translateY offset; undefined in the paginated (flow) branch. */
  start?: number;
  visibleLeaves: LeafColumnDef<T>[];
  frozenCount: number;
  /** null when nothing is frozen, so unfrozen rows bail out during a resize
   *  (the offsets recompute from columnWidths on every step). */
  frozenLefts: string[] | null;
  resizableColumns: boolean;
  mergeMap: MergeMap | null;
  editing: RowEditingState | null;
  selectionActive: Cell | null;
  selectionRange: CellRange | null;
  registerCell: (row: number, col: number, el: HTMLDivElement | null) => void;
  onCellPointerDown: (cell: Cell, ev: { shiftKey: boolean }) => void;
  onCellPointerEnter: (cell: Cell) => void;
  isColumnEditable: (col: number) => boolean;
  startEdit: (cell: Cell, initialText?: string) => void;
  getValueAt: (rowIdx: number, colIdx: number) => unknown;
  commitEdit: (value: unknown, advance?: AdvanceHint) => void;
  cancelEdit: () => void;
}

/** One flat-mode body row, rendered straight from the raw data row (no
 *  TanStack Row object — see computeRowOrder). Every prop is stable-or-
 *  primitive so the memo bails out when only the column template changes
 *  (a resize step then re-renders the header alone). Tree tables keep the
 *  unmemoized TanStack path: expanded state lives inside the Row objects,
 *  which a memo here would render stale. */
function DataTableRowInner<T>({
  original,
  dataIdx,
  displayIndex,
  height,
  start,
  visibleLeaves,
  frozenCount,
  frozenLefts,
  resizableColumns,
  mergeMap,
  editing,
  selectionActive,
  selectionRange,
  registerCell,
  onCellPointerDown,
  onCellPointerEnter,
  isColumnEditable,
  startEdit,
  getValueAt,
  commitEdit,
  cancelEdit,
}: DataTableRowProps<T>) {
  return (
    <div
      role="row"
      className={styles.row}
      style={
        start !== undefined
          ? {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height,
              transform: `translateY(${start}px)`,
            }
          : { height }
      }
    >
      {visibleLeaves.map((colDef, colIndex) => {
        const cell: Cell = { row: displayIndex, col: colIndex };
        const active = selectionActive?.row === displayIndex && selectionActive?.col === colIndex;
        const inRange = cellInRange(displayIndex, colIndex, selectionRange);
        const isEditing = editing?.cell.row === displayIndex && editing?.cell.col === colIndex;
        const align = colDef.align ?? "start";
        const isFrozen = colIndex < frozenCount;
        const isLocked = resizableColumns && colDef.resizable === false;

        const key = `${displayIndex}:${colIndex}`;
        const isCovered = mergeMap?.covered.has(key) ?? false;
        const mergeRight = mergeMap?.suppressRight.has(key) || undefined;
        const mergeBottom = mergeMap?.suppressBottom.has(key) || undefined;

        const value = getCellValue(original, colDef.accessor);

        return (
          <div
            key={colDef.id}
            ref={(el) => registerCell(displayIndex, colIndex, el)}
            role="gridcell"
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            data-in-range={inRange || undefined}
            data-align={align}
            data-locked={isLocked || undefined}
            data-frozen={isFrozen || undefined}
            data-frozen-edge={(isFrozen && colIndex === frozenCount - 1) || undefined}
            data-merge-right={mergeRight}
            data-merge-bottom={mergeBottom}
            className={styles.cell}
            style={isFrozen && frozenLefts ? { left: frozenLefts[colIndex] } : undefined}
            onPointerDown={(e) => onCellPointerDown(cell, { shiftKey: e.shiftKey })}
            onPointerEnter={() => onCellPointerEnter(cell)}
            onDoubleClick={() => isColumnEditable(colIndex) && startEdit(cell)}
          >
            {/* Covered cells render blank — the lead cell carries the content. */}
            {isCovered ? null : isEditing && colDef.edit ? (
              <CellEditor
                value={getValueAt(displayIndex, colIndex)}
                config={colDef.edit}
                initialText={editing?.initialText}
                onCommit={commitEdit}
                onCancel={cancelEdit}
              />
            ) : (
              <span className={styles.cellBody}>
                {colDef.cell
                  ? colDef.cell({ value, row: original, rowIndex: dataIdx })
                  : value == null
                    ? ""
                    : String(value)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DataTableRow = memo(DataTableRowInner) as typeof DataTableRowInner;

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
    frozenColumns = 0,
    scrollSnap = "none",
    edgeFade = false,
    getCellSpan,
    getSubRows,
    treeColumn,
    defaultExpanded,
    expanded: controlledExpanded,
    onExpandedChange,
    columnGroupsCollapsed: controlledGroupsCollapsed,
    onColumnGroupsCollapsedChange,
    defaultColumnWidth,
    columnWidths: controlledColumnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
    columnFill = false,
    reorderableColumns = false,
    columnOrder: controlledColumnOrder,
    defaultColumnOrder,
    onColumnOrderChange,
    filterableColumns = false,
    columnFilters: controlledColumnFilters,
    defaultColumnFilters,
    onColumnFiltersChange,
    className,
    style,
    ...rest
  } = props;

  // Column-fill mode: fixed columns + a dither filler in the leftover space.
  const fillOn = columnFill !== false;
  const fillOpts = typeof columnFill === "object" ? columnFill : {};
  const fillAnimated = fillOpts.animated === true;

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

  // --- Column order (drag-to-reorder) ---
  const { columnOrder, setColumnOrder } = useColumnOrder({
    columnOrder: controlledColumnOrder,
    defaultColumnOrder,
    onColumnOrderChange,
  });

  // --- Column filters ---
  const { columnFilters, setColumnFilters } = useColumnFilters({
    columnFilters: controlledColumnFilters,
    defaultColumnFilters,
    onColumnFiltersChange,
  });

  /** Flat visible leaf columns in display order (with any drag-reorder applied).
   *  Drives cell indexing everywhere; the TanStack `columnOrder` state below keeps
   *  the header in lockstep. */
  const visibleLeaves = useMemo(
    () => applyOrder(flatLeaves(effectiveColumns), columnOrder),
    [effectiveColumns, columnOrder],
  );

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
  // Flat tables (no getSubRows) never materialize TanStack Row objects — at
  // ~3KB per Row that's the 100k-row heap cost of issue #11. TanStack then
  // only powers headers, sort toggles and filter funnels: it gets a single
  // sniff row (manualSorting/manualFiltering on) so getAutoSortDir still sees
  // data[0] and keeps asc-first-for-strings toggling, while the body renders
  // straight from `data` in computeRowOrder's display order. Accepted drift:
  // stock TanStack sniffs the first *filtered* row, so with an active filter
  // that excludes row 0 on a mixed-type column the first toggle direction can
  // differ. Tree tables keep the row-model path, pruned to the visible tree.
  const flatMode = !getSubRows;
  const sniffData = useMemo(() => data.slice(0, 1), [data]);

  // --- Tree mode: prune collapsed subtrees before TanStack sees them ---
  // TanStack materializes a Row (~2.6KB) for EVERY node getSubRows exposes —
  // 50k collapsed nodes cost ~132MB while only the roots can render (#18).
  // buildTreeMeta withholds children of collapsed rows so hidden subtrees are
  // never materialized. The core row model memoizes on data identity alone,
  // so hand TanStack a fresh array whenever the visible tree changes (an
  // O(roots) copy). `expanded === true` prunes nothing — skip the walk and
  // keep the raw inputs (which also keeps toggleExpanded's true→record
  // conversion over rowsById complete). Accepted drift (cf. the flat-mode
  // note above): sorting/filtering only ever see visible rows, so the
  // auto-sort type sniff can pick a different fn while the type-revealing
  // rows sit in a collapsed subtree. Inline getSubRows lambdas change
  // identity every parent render; the walk depends only on its behaviour, so
  // it's read through a ref to keep the memo keyed on data + expansion.
  const getSubRowsRef = useRef(getSubRows);
  getSubRowsRef.current = getSubRows;
  // biome-ignore lint/correctness/useExhaustiveDependencies: getSubRows is read through a ref (see above)
  const treeMeta = useMemo(() => {
    const getSub = getSubRowsRef.current;
    if (flatMode || !getSub) return null;
    if (expandedState === true) {
      return { info: null, data, getSubRows: (row: T) => getSub(row) ?? undefined };
    }
    const { info, getSubRows: pruned } = buildTreeMeta(data, getSub, expandedState);
    return { info, data: data.slice(), getSubRows: pruned };
  }, [flatMode, data, expandedState]);
  const treeInfo = treeMeta?.info ?? null;

  const table = useReactTable({
    data: treeMeta ? treeMeta.data : sniffData,
    columns: tsColumns,
    state: { sorting, expanded: expandedState, columnOrder, columnFilters },
    manualSorting: flatMode,
    manualFiltering: flatMode,
    onSortingChange: setSorting,
    onColumnOrderChange: (updater) =>
      setColumnOrder((typeof updater === "function" ? updater(columnOrder) : updater) as string[]),
    onColumnFiltersChange: (updater) =>
      setColumnFilters(
        (typeof updater === "function" ? updater(columnFilters) : updater) as ColumnFiltersState,
      ),
    onExpandedChange: (updater) =>
      setExpanded(
        (typeof updater === "function" ? updater(expandedState) : updater) as ExpandedState,
      ),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    ...(treeMeta ? { getSubRows: treeMeta.getSubRows } : {}),
  });
  const rows = table.getRowModel().rows;

  // Flat mode: display-order → original-data-index permutation, computed on
  // the raw data with table-core sorting/filtering parity (see rowOrder.ts).
  // Null on tree tables, which render from the TanStack row model.
  const order = useMemo(
    () => (getSubRows ? null : computeRowOrder(data, visibleLeaves, sorting, columnFilters)),
    [getSubRows, data, visibleLeaves, sorting, columnFilters],
  );
  const totalRowCount = order ? order.length : rows.length;

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
    ? Math.max(1, Math.ceil((paginate.totalRows ?? totalRowCount) / paginate.pageSize))
    : 1;
  const pageRows = paginate
    ? rows.slice(pageIndex * paginate.pageSize, (pageIndex + 1) * paginate.pageSize)
    : rows;
  // Flat mode's visible window of `order`: the current page when paginated,
  // the whole permutation otherwise. Row/display indices below are relative
  // to this window (matching pageRows semantics).
  const pageSize = paginate?.pageSize;
  const displayOrder = useMemo(
    () =>
      order && pageSize != null
        ? order.subarray(pageIndex * pageSize, (pageIndex + 1) * pageSize)
        : order,
    [order, pageSize, pageIndex],
  );

  // --- Virtualization ---
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRowCount = displayOrder
    ? displayOrder.length
    : paginate
      ? pageRows.length
      : rows.length;
  const rowVirtualizer = useVirtualizer({
    count: paginate ? 0 : totalRowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // The header (a real grid) sizes to the columns' total width via
  // `min-width: min-content`; the virtualized body's rows are abs-positioned and
  // don't, so mirror the header's measured width onto the body to keep rows and
  // separators aligned across the full content when scrolled horizontally.
  const headerRowRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  useEffect(() => {
    const vp = containerRef.current;
    const hr = headerRowRef.current;
    if (!vp || !hr) return;
    const measure = () => setContentWidth(Math.round(hr.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(hr);
    return () => ro.disconnect();
  }, []);

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
      const col = visibleLeaves[colIdx];
      if (!col) return null;
      if (displayOrder) {
        const dataIdx = displayOrder[rowIdx];
        return dataIdx === undefined ? null : getCellValue(data[dataIdx] as T, col.accessor);
      }
      const tsRow = visibleRows[rowIdx];
      if (!tsRow) return null;
      return getCellValue(tsRow.original, col.accessor);
    },
    [displayOrder, data, visibleRows, visibleLeaves],
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
  // Stable ref-registration callback so memoized flat rows keep their identity.
  const registerCell = useCallback((row: number, col: number, el: HTMLDivElement | null) => {
    if (el) cellRefs.current.set(`${row}:${col}`, el);
    else cellRefs.current.delete(`${row}:${col}`);
  }, []);
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

  // Left edges of every leaf column (plus the trailing right edge), in content
  // px, read off any fully-mounted body row. Used to snap arrow-key scrolling to
  // column boundaries. Null until a complete row is mounted.
  const getColumnEdges = useCallback((): number[] | null => {
    const byRow = new Map<number, Map<number, HTMLDivElement>>();
    for (const [k, el] of cellRefs.current) {
      const [rs, cs] = k.split(":");
      const r = Number(rs);
      const c = Number(cs);
      let cols = byRow.get(r);
      if (!cols) {
        cols = new Map();
        byRow.set(r, cols);
      }
      cols.set(c, el);
    }
    for (const cols of byRow.values()) {
      if (cols.size !== colCount) continue;
      const edges: number[] = [];
      for (let c = 0; c < colCount; c++) edges.push(cols.get(c)?.offsetLeft ?? 0);
      const last = cols.get(colCount - 1);
      if (last) edges.push(last.offsetLeft + last.offsetWidth);
      return edges;
    }
    return null;
  }, [colCount]);

  // Scroll the viewport exactly one row / one column in the arrow's direction,
  // snapping to the row-height grid (block) and leaf-column boundaries (inline)
  // so each press advances a single cell. Used only when no cell is selected —
  // an active cell handles arrows itself (it moves + scrolls into view).
  const scrollByArrow = useCallback(
    (key: string) => {
      const vp = containerRef.current;
      if (!vp) return;
      if (key === "ArrowUp" || key === "ArrowDown") {
        const dir = key === "ArrowDown" ? 1 : -1;
        const aligned = Math.round(vp.scrollTop / rowHeight) * rowHeight;
        vp.scrollTo({ top: aligned + dir * rowHeight });
        return;
      }
      const dir = key === "ArrowRight" ? 1 : -1;
      const edges = getColumnEdges();
      if (!edges) {
        vp.scrollBy({ left: dir * rowHeight });
        return;
      }
      // Index of the column currently snapped to (or just past) the left edge.
      let idx = 0;
      for (let i = 0; i < edges.length; i++) if ((edges[i] ?? 0) <= vp.scrollLeft + 1) idx = i;
      const target = Math.max(0, Math.min(idx + dir, edges.length - 1));
      vp.scrollTo({ left: edges[target] ?? 0 });
    },
    [rowHeight, getColumnEdges],
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

      // No selected cell: arrow keys scroll the viewport one row/column at a
      // time (snapped to boundaries) instead of the browser's line-scroll.
      if (!active && native.key.startsWith("Arrow")) {
        ev.preventDefault();
        scrollByArrow(native.key);
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
      scrollByArrow,
    ],
  );

  // --- Column-width overrides (px), set by dragging the resize handle ---
  // Controlled/uncontrolled with an onChange so resized widths can be persisted.
  const { columnWidths, setColumnWidths } = useColumnWidths({
    columnWidths: controlledColumnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
  });

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
    // In fill mode the last column has its own trailing handle, so the
    // leading-edge workaround never applies.
    if (fillOn) return null;
    const last = visibleLeaves[colCount - 1];
    const prev = visibleLeaves[colCount - 2];
    if (!last || !resizableColumnIds.has(last.id)) return null;
    if (!prev || resizableColumnIds.has(prev.id)) return null; // prev's handle already serves
    for (let k = colCount - 2; k >= 0; k--) {
      const leaf = visibleLeaves[k];
      if (leaf && resizableColumnIds.has(leaf.id)) return leaf.id;
    }
    return null;
  }, [visibleLeaves, colCount, resizableColumnIds, fillOn]);

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
      // Fill mode: columns are independent (the dither filler / scroll absorbs
      // slack), so a drag just sets that one column's width — no cascade.
      if (fillOn) {
        const leaf = visibleLeaves[idx];
        if (!leaf) return;
        const v = Math.max(minPx, Math.round((startWidths[idx] ?? 0) + dx));
        setColumnWidths((prev) => (prev[leaf.id] === v ? prev : { ...prev, [leaf.id]: v }));
        return;
      }
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
    [visibleLeaves, resizableColumnIds, fillOn, setColumnWidths],
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
  // larger step), cascading through the same logic as a drag. The col-min
  // token can't change mid-burst, so it's measured once per handle focus
  // (the probe forces a layout per keystroke otherwise) — the handle's
  // onBlur drops the cache.
  const keyResizeMinPx = useRef<number | null>(null);
  const resizeColumnByKey = useCallback(
    (columnId: string, headerCell: HTMLElement, ev: KeyboardEvent<HTMLDivElement>) => {
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      const startWidths = measureLeafWidths(headerCell);
      const idx = resolveResizeIdx(columnId);
      if (!startWidths || idx < 0) return;
      if (keyResizeMinPx.current == null) {
        keyResizeMinPx.current = measureCssWidth(headerCell, "var(--sf-datatable-col-min)");
      }
      const minPx = keyResizeMinPx.current;
      const dx = (ev.key === "ArrowRight" ? 1 : -1) * (ev.shiftKey ? 24 : 8);
      applyResize(idx, startWidths, dx, minPx);
    },
    [measureLeafWidths, applyResize, resolveResizeIdx],
  );

  // --- Frozen (pinned-left) columns ---
  // Clamp so at least one column still scrolls; counts leaf columns.
  const frozenCount = Math.max(0, Math.min(frozenColumns, visibleLeaves.length - 1));
  // CSS `left` per frozen column + the region's total width, as calc() strings so
  // they track the consumer's --sf-unit without resolving px in JS.
  const frozenLefts = useMemo(
    () =>
      frozenLeftOffsets(visibleLeaves, columnWidths, frozenCount, {
        defaultWidth: defaultColumnWidth,
      }),
    [visibleLeaves, columnWidths, frozenCount, defaultColumnWidth],
  );
  const frozenWidth = useMemo(
    () =>
      frozenTotalWidth(visibleLeaves, columnWidths, frozenCount, {
        defaultWidth: defaultColumnWidth,
      }),
    [visibleLeaves, columnWidths, frozenCount, defaultColumnWidth],
  );
  // Toggle a boundary shadow on the frozen edge once the body is scrolled right.
  const [frozenScrolled, setFrozenScrolled] = useState(false);
  const handleViewportScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (frozenCount === 0) return;
      const next = e.currentTarget.scrollLeft > 0;
      setFrozenScrolled((prev) => (prev === next ? prev : next));
    },
    [frozenCount],
  );

  // --- Grid template (from visible leaves + runtime width overrides) ---
  const gridTemplateColumns = useMemo(
    () =>
      buildColumnTemplate(visibleLeaves, columnWidths, {
        stretchLast: !fillOn,
        defaultWidth: defaultColumnWidth,
        frozenCount,
      }),
    [visibleLeaves, columnWidths, fillOn, defaultColumnWidth, frozenCount],
  );

  // --- Column-fill filler ---
  // Total px width of the columns (sum of the resolved grid tracks), used to
  // place the dither filler. Unlike `contentWidth` (the header element, which is
  // 100% of the viewport in fill mode) this is the columns' real trailing edge.
  const [columnsWidth, setColumnsWidth] = useState(0);
  // Full scrollable content height (header + body), so the filler spans the whole
  // leftover column rather than only the body.
  const [fillHeight, setFillHeight] = useState(0);
  useLayoutEffect(() => {
    if (!fillOn) return;
    const hr = headerRowRef.current;
    const vp = containerRef.current;
    if (hr) {
      const tracks = getComputedStyle(hr).gridTemplateColumns.split(" ");
      setColumnsWidth(tracks.reduce((sum, t) => sum + (Number.parseFloat(t) || 0), 0));
    }
    if (vp) setFillHeight(vp.scrollHeight);
  }, [fillOn, gridTemplateColumns, contentWidth, data.length, rowHeight, paginate]);

  // The animated variant renders a WebGL dither canvas; the hook is inert until
  // a canvas mounts (static mode), mirroring Skeleton's usage.
  const { rootRef: fillRootRef, canvasRef: fillCanvasRef } = useDitheredFill({
    effect: fillOpts.effect ?? "noise",
    density: fillOpts.density ?? 0.5,
    color: fillOpts.color,
    speed: fillOpts.speed,
  });

  // --- Visual cell merge (blank covered cells + erase internal seams) ---
  // O(rows × cols), and only when `getCellSpan` is set — intended for the modest
  // tables that use merging, not huge virtualized datasets.
  const mergeMap = useMemo(() => {
    if (!getCellSpan) return null;
    return computeMergeMap({
      rowCount: visibleRowCount,
      colCount,
      getSpan: (r, c) => {
        const col = visibleLeaves[c];
        if (!col) return undefined;
        let rowData: T | undefined;
        if (displayOrder) {
          const dataIdx = displayOrder[r];
          rowData = dataIdx === undefined ? undefined : data[dataIdx];
        } else {
          rowData = visibleRows[r]?.original;
        }
        if (rowData === undefined) return undefined;
        return getCellSpan({ rowIndex: r, colIndex: c, row: rowData, column: col });
      },
    });
  }, [getCellSpan, displayOrder, data, visibleRows, visibleRowCount, colCount, visibleLeaves]);

  // --- Tree column index (where the chevron + indent live) ---
  const treeColIdx = useMemo(() => {
    if (!getSubRows) return -1;
    if (treeColumn) return visibleLeaves.findIndex((c) => c.id === treeColumn);
    return 0;
  }, [getSubRows, treeColumn, visibleLeaves]);

  // Props shared by every flat-mode row. Each one is identity-stable across a
  // resize step (only the viewport's --sf-datatable-template changes), so the
  // memoized rows bail out and a step re-renders the header alone.
  const flatRowProps = {
    visibleLeaves,
    frozenCount,
    frozenLefts: frozenCount > 0 ? frozenLefts : null,
    resizableColumns,
    mergeMap,
    editing,
    selectionActive: selection.active,
    selectionRange: selection.range,
    registerCell,
    onCellPointerDown: handleCellPointerDown,
    onCellPointerEnter: handleCellPointerEnter,
    isColumnEditable,
    startEdit,
    getValueAt,
    commitEdit,
    cancelEdit,
  };

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
    const isFrozen = colIndex < frozenCount;
    // A column explicitly opted out of resizing (only meaningful when the table
    // is otherwise resizable) — gets a subtle "fixed width" hint.
    const isLocked = resizableColumns && colDef.resizable === false;

    // Visual merge: covered cells render blank; internal seams are erased via the
    // data-merge-* attributes (see `.cell` in the stylesheet).
    const key = cellKey(rowIndex, colIndex);
    const isCovered = mergeMap?.covered.has(key) ?? false;
    const mergeRight = mergeMap?.suppressRight.has(key) || undefined;
    const mergeBottom = mergeMap?.suppressBottom.has(key) || undefined;

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
              // A collapsed row's subRows are withheld from TanStack (pruned —
              // see buildTreeMeta), so getCanExpand() is wrong there; the walk
              // records hasChildren for every reachable node instead.
              visible={
                treeInfo ? (treeInfo.get(row.original)?.hasChildren ?? false) : row.getCanExpand()
              }
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
        data-frozen={isFrozen || undefined}
        data-frozen-edge={(isFrozen && colIndex === frozenCount - 1) || undefined}
        data-merge-right={mergeRight}
        data-merge-bottom={mergeBottom}
        className={styles.cell}
        style={isFrozen ? { left: frozenLefts[colIndex] } : undefined}
        onPointerDown={(e) => handleCellPointerDown(cell, { shiftKey: e.shiftKey })}
        onPointerEnter={() => handleCellPointerEnter(cell)}
        onDoubleClick={() => isColumnEditable(colIndex) && startEdit(cell)}
      >
        {/* Covered cells render blank — the lead cell carries the content. */}
        {isCovered ? null : isEditing && colDef.edit ? (
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
  // Empty when there's no data OR filters narrowed everything away.
  const showEmpty = totalRowCount === 0;

  // --- Column filters (filterableColumns) ---
  // Per-column filter kind + selectable values: number → range; select uses its
  // defined options; boolean → true/false; text/other → distinct values from
  // data, computed lazily on funnel open (`options: null` here). The distinct
  // scan+sort used to run eagerly in this memo — ~7ms per data identity change
  // at 10k rows even with every funnel closed (#17).
  const filterMeta = useMemo(() => {
    const map = new Map<string, { kind: "checklist" | "range"; options: FilterOption[] | null }>();
    if (!filterableColumns) return map;
    for (const leaf of visibleLeaves) {
      if (leaf.filterable === false) continue;
      const type = leaf.edit?.type;
      if (type === "number") {
        map.set(leaf.id, { kind: "range", options: [] });
        continue;
      }
      let options: FilterOption[] | null;
      if (type === "boolean") {
        options = [
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ];
      } else if (leaf.edit?.type === "select") {
        options = leaf.edit.options;
      } else {
        options = null; // distinct values — resolved on demand below
      }
      map.set(leaf.id, { kind: "checklist", options });
    }
    return map;
  }, [filterableColumns, visibleLeaves]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: identity-keyed cache — swaps (and so empties) whenever the scanned inputs change
  const distinctOptionsCache = useMemo(
    () => new Map<string, FilterOption[]>(),
    [data, visibleLeaves],
  );
  /** Distinct values of a text column as checklist options, computed on first
   *  funnel open and cached until `data`/columns change. */
  const getDistinctOptions = useCallback(
    (columnId: string): FilterOption[] => {
      const hit = distinctOptionsCache.get(columnId);
      if (hit) return hit;
      const leaf = visibleLeaves.find((l) => l.id === columnId);
      if (!leaf) return [];
      const seen = new Set<string>();
      for (const row of data) {
        const v = getCellValue(row, leaf.accessor);
        seen.add(v == null ? "" : String(v));
      }
      const options = [...seen]
        .sort(optionCollator.compare)
        .map((s) => ({ value: s, label: s === "" ? "(empty)" : s }));
      distinctOptionsCache.set(columnId, options);
      return options;
    },
    [distinctOptionsCache, data, visibleLeaves],
  );

  // --- Column drag-to-reorder (reorderableColumns) ---
  const orderedLeafIds = useMemo(() => visibleLeaves.map((l) => l.id), [visibleLeaves]);
  const leafParents = useMemo(() => leafParentMap(columns), [columns]);
  const reorderSensors = useSensors(
    // 4px threshold so a plain click still sorts and the resize handle still resizes.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const draggingLeaf = draggingColId
    ? visibleLeaves.find((l) => l.id === draggingColId)
    : undefined;

  const onColumnDragStart = useCallback((e: DragStartEvent) => {
    setDraggingColId(String(e.active.id));
  }, []);
  const onColumnDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDraggingColId(null);
      const activeId = String(e.active.id);
      const overId = e.over ? String(e.over.id) : null;
      if (!overId || activeId === overId) return;
      // A leaf may only reorder within its own parent group.
      if (leafParents.get(activeId) !== leafParents.get(overId)) return;
      const from = orderedLeafIds.indexOf(activeId);
      const to = orderedLeafIds.indexOf(overId);
      if (from < 0 || to < 0) return;
      setColumnOrder(arrayMove(orderedLeafIds, from, to));
    },
    [leafParents, orderedLeafIds, setColumnOrder],
  );

  // Dither panel filling the space right of the last column (columnFill mode).
  // Lives inside `.body` so it spans the full body height and scrolls vertically
  // with the rows; collapses to ~0 width when the columns overflow the viewport.
  const columnFiller =
    fillOn && !showEmpty ? (
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
            height: fillHeight,
            "--sf-columns-width": `${columnsWidth}px`,
            ...(fillOpts.color ? { "--sf-columnfill-color": fillOpts.color } : null),
          } as CSSProperties
        }
      >
        {/* aria-hidden lives on the parent .columnFill; canvas is decorative. */}
        {fillAnimated ? <canvas ref={fillCanvasRef} className={styles.columnFillCanvas} /> : null}
      </div>
    ) : null;

  /** Render one header cell. `dnd` (from `SortableHeaderCell`) makes it a draggable
   *  sortable item; omitted for group/placeholder/non-reorderable headers. */
  const renderHeaderCell = (header: Header<T, unknown>, dnd?: HeaderDnd): ReactNode => {
    const span = header.colSpan;
    // Freeze a header cell only when its whole leaf span sits inside the frozen
    // region (a group straddling the boundary scrolls — documented).
    const firstLeafId = header.getLeafHeaders()[0]?.column.id;
    const leafStart =
      firstLeafId != null ? visibleLeaves.findIndex((c) => c.id === firstLeafId) : -1;
    const isFrozen = leafStart >= 0 && leafStart + span <= frozenCount;
    const isFrozenEdge = isFrozen && leafStart + span === frozenCount;
    const isGroupHeader = header.subHeaders.length > 0;
    const def = header.column.columnDef;
    const colMeta = (def as { meta?: { collapsedGroupId?: string } }).meta;
    // For placeholder leaves (collapsed groups), pull the original group id back
    // out so the chevron toggles the right thing.
    const collapsedGroupId = colMeta?.collapsedGroupId;
    const canSort = header.column.getCanSort();
    const sortDir = header.column.getIsSorted();
    const isLeafHeader = !isGroupHeader && !header.isPlaceholder;
    const isLastLeaf = header.column.id === visibleLeaves[colCount - 1]?.id;
    const showTrailingHandle =
      isLeafHeader && resizableColumnIds.has(header.column.id) && (!isLastLeaf || fillOn);
    const showLeadingHandle = isLeafHeader && isLastLeaf && lastColLeadingTarget != null;
    const showResizeHandle = showTrailingHandle || showLeadingHandle;
    const isLocked = isLeafHeader && resizableColumns && !resizableColumnIds.has(header.column.id);
    const fmeta = isLeafHeader ? filterMeta.get(header.column.id) : undefined;
    const filterValue = fmeta ? header.column.getFilterValue() : undefined;
    const isFiltered = filterValue != null;
    return (
      <div
        key={header.id}
        ref={dnd?.ref}
        role="columnheader"
        className={cx(
          styles.headerCell,
          isGroupHeader && styles.headerCellGroup,
          dnd?.listeners && styles.headerDraggable,
          dnd?.dragging && styles.headerDragging,
        )}
        style={{
          gridColumn: `span ${span}`,
          ...(isFrozen ? { left: frozenLefts[leafStart] } : {}),
          ...dnd?.style,
        }}
        data-align={isGroupHeader ? "center" : "start"}
        data-sortable={canSort || undefined}
        data-locked={isLocked || undefined}
        data-frozen={isFrozen || undefined}
        data-frozen-edge={isFrozenEdge || undefined}
        data-filtered={isFiltered || undefined}
        // A placeholder sits above an ungrouped leaf's real header — erase the seam
        // below it so the column reads as one full-height header.
        data-merge-bottom={header.isPlaceholder || undefined}
        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        {...(dnd?.listeners ?? {})}
      >
        {!header.isPlaceholder && (
          <>
            <span>{flexRender(def.header, header.getContext())}</span>
            {sortDir === "asc" && (
              <span aria-hidden="true" className={styles.sortArrow}>
                ↑
              </span>
            )}
            {sortDir === "desc" && (
              <span aria-hidden="true" className={styles.sortArrow}>
                ↓
              </span>
            )}
            {(isGroupHeader || collapsedGroupId) && (
              <TreeChevron
                expanded={isGroupHeader}
                onToggle={() => toggleGroup(collapsedGroupId ?? header.column.id)}
                ariaLabel={isGroupHeader ? "Collapse group" : "Expand group"}
              />
            )}
            {fmeta ? (
              <ColumnFilter
                label={typeof def.header === "string" ? def.header : header.column.id}
                kind={fmeta.kind}
                options={fmeta.options ?? (() => getDistinctOptions(header.column.id))}
                value={filterValue}
                active={isFiltered}
                onChange={(v) => header.column.setFilterValue(v)}
              />
            ) : null}
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
            className={cx(styles.resizeHandle, showLeadingHandle && styles.resizeHandleStart)}
            // Stop the drag/reorder + sort from firing when grabbing the resizer.
            onPointerDown={(e) => {
              e.stopPropagation();
              onColumnResizeDown(e);
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!showLeadingHandle) {
                autoFitColumn(header.column.id, e.currentTarget.parentElement as HTMLElement);
              }
            }}
            onKeyDown={(e) =>
              resizeColumnByKey(header.column.id, e.currentTarget.parentElement as HTMLElement, e)
            }
            onBlur={() => {
              keyResizeMinPx.current = null;
            }}
          />
        )}
        {isLocked && <div aria-hidden="true" className={styles.lockedEdge} />}
      </div>
    );
  };

  return (
    <div className={cx(styles.wrapper, className)} style={style} {...rest}>
      <div
        ref={containerRef}
        role="grid"
        tabIndex={-1}
        className={styles.viewport}
        style={
          {
            maxHeight: height,
            "--sf-row-height": `${rowHeight}px`,
            "--sf-header-rows": headerGroups.length,
            // INTERNAL variable (like --sf-columns-width above), not a consumer
            // token: the single writer for every row's grid-template-columns,
            // so a resize step mutates one element instead of every row.
            "--sf-datatable-template": gridTemplateColumns,
            ...(frozenCount > 0 ? { scrollPaddingInlineStart: frozenWidth } : {}),
          } as CSSProperties
        }
        onKeyDown={handleKeyDown}
        onScroll={frozenCount > 0 ? handleViewportScroll : undefined}
        data-snap-rows={scrollSnap === "rows" || scrollSnap === "both" ? "" : undefined}
        data-snap-cols={scrollSnap === "columns" || scrollSnap === "both" ? "" : undefined}
        data-column-fill={fillOn || undefined}
        data-frozen={frozenCount > 0 || undefined}
        data-frozen-scrolled={frozenScrolled || undefined}
      >
        {/* Headers — one row per header group; parent groups span their leaves.
            With `reorderableColumns`, leaf headers are sortable (drag to reorder). */}
        {(() => {
          const headerRows = headerGroups.map((hg, hgIndex) => (
            <div
              key={hg.id}
              ref={hgIndex === 0 ? headerRowRef : undefined}
              className={styles.headerRow}
              role="row"
            >
              {hg.headers.map((header) => {
                const isLeaf = header.subHeaders.length === 0 && !header.isPlaceholder;
                return reorderableColumns && isLeaf ? (
                  <SortableHeaderCell
                    key={header.id}
                    id={header.column.id}
                    render={(dnd) => renderHeaderCell(header, dnd)}
                  />
                ) : (
                  renderHeaderCell(header)
                );
              })}
            </div>
          ));
          if (!reorderableColumns) return headerRows;
          return (
            <DndContext
              sensors={reorderSensors}
              onDragStart={onColumnDragStart}
              onDragEnd={onColumnDragEnd}
              onDragCancel={() => setDraggingColId(null)}
            >
              <SortableContext items={orderedLeafIds} strategy={horizontalListSortingStrategy}>
                {headerRows}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {draggingLeaf ? (
                  <div className={styles.headerDragOverlay}>
                    {typeof draggingLeaf.header === "string"
                      ? draggingLeaf.header
                      : draggingLeaf.id}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          );
        })()}

        {/* Body */}
        {showEmpty ? (
          <div className={styles.empty}>{empty ?? "No data"}</div>
        ) : paginate ? (
          <div className={styles.body}>
            {displayOrder
              ? Array.from(displayOrder, (dataIdx, rowIndex) => (
                  <DataTableRow
                    key={dataIdx}
                    {...flatRowProps}
                    original={data[dataIdx] as T}
                    dataIdx={dataIdx}
                    displayIndex={rowIndex}
                    height={rowHeight}
                  />
                ))
              : pageRows.map((row, rowIndex) => (
                  <div key={row.id} role="row" className={styles.row} style={{ height: rowHeight }}>
                    {row
                      .getVisibleCells()
                      .map((_, colIndex) => renderCell(row, rowIndex, colIndex))}
                  </div>
                ))}
          </div>
        ) : (
          <div
            className={styles.body}
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
              // In fill mode pin the virtualized body to the columns' real total
              // (`columnsWidth`). Its rows are absolutely positioned, so they
              // don't establish `max-content`; without this the CSS
              // `min-width: max-content` collapses to ~0 and `width:100%` shrinks
              // the body to the viewport when it's narrower than the columns,
              // misaligning it from the header (issue #3). When the viewport is
              // wider, `width:100%` (≥ columnsWidth) still wins, so the dither
              // filler keeps its room.
              minWidth: fillOn ? columnsWidth || undefined : (contentWidth ?? undefined),
            }}
          >
            {virtualRows.map((vr) => {
              if (order) {
                const dataIdx = order[vr.index];
                if (dataIdx === undefined) return null;
                return (
                  <DataTableRow
                    key={dataIdx}
                    {...flatRowProps}
                    original={data[dataIdx] as T}
                    dataIdx={dataIdx}
                    displayIndex={vr.index}
                    height={vr.size}
                    start={vr.start}
                  />
                );
              }
              const row = rows[vr.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  role="row"
                  className={styles.row}
                  style={{
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
        {columnFiller}

        {/* Dithered fade at the bottom scroll edge. Sticky + negative margin so
            it overlays the last rows without adding layout space; the sticky
            header stays above it and is never faded. */}
        {edgeFade && !showEmpty ? (
          <div
            className={styles.edgeFade}
            aria-hidden="true"
            style={
              typeof edgeFade === "object"
                ? ({
                    "--sf-datatable-fade-rows": edgeFade.rows,
                    "--sf-datatable-fade-density": edgeFade.density,
                  } as CSSProperties)
                : undefined
            }
          />
        ) : null}
      </div>

      {paginate && (
        <Pagination pageIndex={pageIndex} pageCount={pageCount} onPageChange={setPageIndex} />
      )}
    </div>
  );
}
