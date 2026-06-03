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

  // --- Grid template (from visible leaves) ---
  const gridTemplateColumns = useMemo(
    () =>
      visibleLeaves
        .map((col) =>
          col.width != null
            ? `calc(var(--sf-unit) * ${col.width})`
            : "minmax(calc(var(--sf-unit) * 5), 1fr)",
        )
        .join(" "),
    [visibleLeaves],
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
        className={styles.cell}
        onPointerDown={(e) => handleCellPointerDown(cell, { shiftKey: e.shiftKey })}
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
              return (
                <div
                  key={header.id}
                  role="columnheader"
                  className={cx(styles.headerCell, isGroupHeader && styles.headerCellGroup)}
                  style={{ gridColumn: `span ${span}` }}
                  data-align={isGroupHeader ? "center" : "start"}
                  data-sortable={canSort || undefined}
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
      </div>

      {paginate && (
        <Pagination pageIndex={pageIndex} pageCount={pageCount} onPageChange={setPageIndex} />
      )}
    </div>
  );
}
