import {
  type Active,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type Over,
  PointerSensor,
  rectIntersection,
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
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, Ref, UIEvent } from "react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  cellLines,
  combineFloor,
  contentInlineSize,
  type GroupConstraint,
  groupFloorFor,
  measureHeaderNeed,
  raiseForGroups,
} from "../../lib/columns/headerFloor";
import {
  COLUMN_MAX_PX,
  describeColumnWidth,
  formatColumnWidth,
  KEY_RESIZE_STEP_COARSE_PX,
  KEY_RESIZE_STEP_PAGE_PX,
  KEY_RESIZE_STEP_PX,
  READOUT_FADE_MS,
  READOUT_HOLD_MS,
} from "../../lib/columns/resizeBoundary";
import { type HeaderDnd, SortableHeaderCell } from "../../lib/columns/SortableHeaderCell";
import { useColumnOrder } from "../../lib/columns/useColumnOrder";
import { useColumnWidths } from "../../lib/columns/useColumnWidths";
import { cx } from "../../lib/cx";
import { useSfDnd, useSfDndRegion } from "../../lib/dnd";
import type { EffectName } from "../../lib/effects";
import { useDitheredFill } from "../../lib/effects";
import { ColumnFilter, type FilterOption } from "../../lib/filter/ColumnFilter";
import { useColumnFilters } from "../../lib/filter/useColumnFilters";
import type { ControlSurface } from "../../lib/surface";
import { surfaceClass } from "../../lib/surface";
import { TreeChevron } from "../../lib/TreeChevron";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { computeMergeMap, type MergeMap } from "./cellSpans";
import { allFixed, buildColumnTemplate, frozenLeftOffsets, frozenTotalWidth } from "./columnWidths";
import styles from "./DataTable.module.css";
import { resolveEditActivation } from "./editActivation";
import { CellEditor, formatEditDisplay } from "./editors";
import { Pagination } from "./Pagination";
import { computeRowOrder, getCellValue } from "./rowOrder";
import { buildTreeMeta } from "./treeRows";
import type {
  AdvanceHint,
  Cell,
  CellBackgroundFn,
  CellChange,
  CellOverflow,
  CellRange,
  CellSpanFn,
  ColumnDef,
  DataTableHighlight,
  EditActivation,
  ExpandedState,
  LeafColumnDef,
  PaginateConfig,
  Selection,
} from "./types";
import { isGroup, resolveCellBackground } from "./types";
import {
  expandPlaceholderOrder,
  toEffectiveOrder,
  useColumnGroupCollapse,
} from "./useColumnGroupCollapse";
import { useTableClipboard } from "./useTableClipboard";
import { useTableEdit } from "./useTableEdit";
import { useTableSelection } from "./useTableSelection";
import { useTreeExpansion } from "./useTreeExpansion";

/** A host element dropped onto a column header (only fires under `SfDndProvider`). */
export interface DataTableExternalDrop {
  /** The dnd-kit active for the dragged host item; read your data off it. */
  active: Active;
  /** Id of the leaf column it was dropped on, or `null` if not over a header. */
  overColumnId: string | null;
}

/** Imperative controls exposed through `apiRef`, for a host that drives the grid from outside (a
 *  formula bar, a central hotkey layer): move the active cell and focus it, open an editor, read the
 *  selection. Coordinates are visible row/column positions, as in `Selection`. */
export interface DataTableHandle {
  /** Make `cell` the active cell (`null` clears the selection) and focus it. */
  setActive: (cell: Cell | null) => void;
  /** Open the editor on `cell`; a no-op on a non-editable column. `initialText` seeds the editor. */
  startEdit: (cell: Cell, initialText?: string) => void;
  /** The current active cell and range. */
  getSelection: () => Selection;
  /** Auto-fit columns to their content (the double-click's programmatic twin):
   *  the given column ids, else every resizable column (Excel's select-all
   *  then double-click any edge). Each fits its own content, never under its
   *  floor or a group title over it. */
  autoFitColumns: (ids?: string[]) => void;
}

export interface DataTableProps<T>
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "onChange"> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Turn on click-to-edit + paste-to-update. Default false (read-only). */
  editable?: boolean;
  /** How editing starts on an editable cell. `"double"` (default) opens the
   *  editor on double-click (F2 / Enter also work); `"single"` also opens it on
   *  a single click. Override per column via `LeafColumnDef.editOn`, or per cell
   *  via `getEditActivation`. */
  editOn?: EditActivation;
  /** Per-cell override for the edit trigger — wins over the column and table
   *  settings. Return `undefined` to fall through to them. */
  getEditActivation?: (ctx: {
    rowIndex: number;
    columnId: string;
    row: T;
  }) => EditActivation | undefined;
  /** Paint a body cell's whole background (issue #99). Unlike `highlights`,
   *  which mark a positional range and stay put when the grid is sorted, this
   *  is data driven: it receives the row and the value, so the colour travels
   *  with the row through sorting and filtering. Return `undefined` to leave a
   *  cell alone. The fill sits under the range tint and the highlight overlay,
   *  so selection and highlights stay legible on a coloured cell. Memoize it
   *  (`useCallback`) to keep the virtualized rows' re-render bail-out. */
  cellBackground?: CellBackgroundFn<T>;
  /** Called when cell values change (edit or paste). Consumer mutates/replaces data. */
  onCellChange?: (changes: CellChange[]) => void;
  /** Prepend a row of the selected columns' header names when copying cells to
   *  the clipboard (Cmd/Ctrl+C), so a paste into a spreadsheet or document is
   *  self-labelling. Default true. Set false for a raw values-only copy (e.g. to
   *  paste straight back into the table's editable cells without a header row). */
  copyWithHeaders?: boolean;
  /** Horizontal padding inside cells — the cell "margins". `md` is the default;
   *  `xs`/`sm` tighten a dense grid, `lg` loosens it. Applies to header + body. */
  cellPadding?: "xs" | "sm" | "md" | "lg";
  /** Cell text size. `md` is the default; `xs`/`sm` shrink it for dense financial
   *  grids, `lg` enlarges it. Applies to header + body. Independent of `cellPadding`. */
  cellFontSize?: "xs" | "sm" | "md" | "lg";
  /** Lines a column title may take (default 1); a column's own `headerLines`
   *  overrides it. A title never wraps past its count: the column cannot be
   *  narrowed below the width at which the title would need one more line, and
   *  the header row grows to hold the lines (issue #102). */
  headerLines?: number;
  /** How body cells show a value that does not fit its column, the default for
   *  every column (a column's own `overflow` wins). `clamp` cuts with an
   *  ellipsis; `wrap` wraps within the lines the row height holds (36px is
   *  one line, 60px two, 84px three) and clamps there; `hash` fills the cell
   *  with `#` while the value does not fit, Excel's rule for numbers and dates,
   *  so a cut number is never read as a different one (issue #102). */
  cellOverflow?: CellOverflow;
  /** Called when active cell / range selection changes. */
  onSelectionChange?: (selection: Selection) => void;
  /** Excel-style row-number gutter: a slim, frozen leading track numbering the
   *  visible rows (1-based display order, so numbers stay put on sort/filter).
   *  Clicking a number selects the whole row, dragging sweeps a span of rows,
   *  Shift+click extends, and the corner cell above the gutter selects the
   *  whole grid. The gutter is not a data column: it doesn't shift `col`
   *  coordinates in selections, highlights, or spans. Default `false`. */
  rowNumbers?: boolean;
  /** What a plain cell click selects. `"cell"` (default) is the spreadsheet
   *  model. `"row"` widens every cell-driven selection to the full row (the
   *  list/master-detail reading: click anywhere in a row, get the row) and
   *  `"column"` to the full column — click, drag, Shift+click, and arrow keys
   *  all produce full-axis ranges; the active cell stays the clicked cell.
   *  Explicit gestures (row-number gutter, header select zones, Cmd/Ctrl+A)
   *  keep their own shapes in every mode. */
  selectionMode?: "cell" | "row" | "column";
  /** Persistent coloured range overlays (the Excel "coloured range reference"
   *  look). Positional, in visible coordinates. Use several distinct colours to
   *  mark separate ranges (e.g. charting series). Drive it yourself: capture the
   *  mouse selection via `onSelectionChange` and push a highlight with a colour. */
  highlights?: DataTableHighlight[];
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
  /** The face of the column-header keys (`lib/surface`): `"concave"` (default),
   *  a slight scoop at 0.6 of the system amplitude, `"dome"`, `"dish"` or
   *  `"flat"`. Set `--sf-curve-scale` on the table to retune the amplitude. */
  headerSurface?: ControlSurface;
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
  /** Hold the full `height` even when there aren't enough rows to fill it (instead
   *  of shrinking to content), and render the empty band below the last row as the
   *  same dither surface as `columnFill` — so a sparse table reads as one filled
   *  panel rather than data plus blank space. Uses `columnFill`'s look when it's
   *  set, else a static dither. Default `false`. */
  fillHeight?: boolean;
  /** Allow leaf columns to be reordered by dragging their headers. Default false. */
  reorderableColumns?: boolean;
  /** Controlled column order (leaf column ids). Pass with `onColumnOrderChange`. */
  columnOrder?: string[];
  /** Initial column order when uncontrolled (e.g. restored from storage). */
  defaultColumnOrder?: string[];
  /** Fired with the full order array whenever a column is dragged to a new spot. */
  onColumnOrderChange?: (order: string[]) => void;
  /** Fires when a foreign element (dragged from the host under a shared
   *  `SfDndProvider`) is dropped onto a column header. Only the header row is a
   *  drop target; body rows are not droppable. Requires `reorderableColumns` and
   *  a provider. */
  onExternalDrop?: (drop: DataTableExternalDrop) => void;
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
  /** Imperative handle (`setActive`, `startEdit`, `getSelection`), for a host that moves the cursor or
   *  opens an editor from outside the grid, e.g. a formula bar committing and stepping down. */
  apiRef?: Ref<DataTableHandle>;
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

/** The data-attribute + custom properties a coloured cell carries. One helper
 *  so the virtualized row and the inline path paint identically (issue #99). */
function cellBackgroundProps<T>(
  fn: CellBackgroundFn<T> | undefined,
  ctx: { value: unknown; row: T; rowIndex: number; column: LeafColumnDef<T> },
): { "data-bg"?: ""; style?: CSSProperties } {
  if (!fn) return {};
  const resolved = resolveCellBackground(
    fn({
      value: ctx.value,
      row: ctx.row,
      rowIndex: ctx.rowIndex,
      columnId: ctx.column.id,
      column: ctx.column,
    }),
  );
  if (!resolved) return {};
  return {
    "data-bg": "",
    style: {
      "--sf-cell-bg": resolved.color,
      ...(resolved.textColor != null ? { "--sf-cell-ink": resolved.textColor } : {}),
    } as CSSProperties,
  };
}

/** The px floor a column may be resized to: its own `minWidth` (in `--sf-unit`
 *  multiples) when it declares one, else the global `--sf-datatable-col-min`.
 *  Resolved through the same probe as the token so the JS clamp and the grid
 *  template's `minmax` floor agree by construction (issue #100). */
function columnMinWidthPx(parent: HTMLElement, minWidthUnits: number | undefined): number {
  return measureCssWidth(
    parent,
    minWidthUnits != null
      ? `calc(var(--sf-unit) * ${minWidthUnits})`
      : "var(--sf-datatable-col-min)",
  );
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
 *  renderer can wire the chevron back to the right group, and `meta.color` on
 *  both kinds so a heading can tint its key (issue #99). */
function toTSColumn<T>(def: ColumnDef<T>): TSColumnDef<T> {
  const header = typeof def.header === "string" ? def.header : () => def.header;
  if (isGroup(def)) {
    return {
      id: def.id,
      header,
      columns: def.columns.map(toTSColumn),
      ...(def.color != null || def.headerLines != null
        ? {
            meta: {
              ...(def.color != null ? { color: def.color } : {}),
              ...(def.headerLines != null ? { headerLines: def.headerLines } : {}),
            },
          }
        : {}),
    } as TSColumnDef<T>;
  }
  const ownMeta = (def as { meta?: Record<string, unknown> }).meta;
  const meta =
    def.color != null || def.headerLines != null
      ? {
          ...(ownMeta ?? {}),
          ...(def.color != null ? { color: def.color } : {}),
          ...(def.headerLines != null ? { headerLines: def.headerLines } : {}),
        }
      : ownMeta;
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

/** Default highlight colours: the semantic tokens, cycled by array position, so
 *  `highlights` with no explicit `color` still read as distinct ranges without
 *  introducing a new multi-hue palette (the palette stays small). */
const HIGHLIGHT_PALETTE = [
  "var(--sf-color-primary)",
  "var(--sf-color-success)",
  "var(--sf-color-warning)",
  "var(--sf-color-danger)",
];

/** A highlight with its range normalised (start <= end) and colour resolved. */
type ResolvedHighlight = {
  id: string;
  color: string;
  start: Cell;
  end: Cell;
};

/** The coloured-range overlays covering one cell: one absolutely-positioned div
 *  per highlight, bordered only on the range's perimeter edges. Shared by both
 *  row renderers so they stay in lockstep. */
function highlightOverlays(highlights: ResolvedHighlight[], row: number, col: number): ReactNode {
  if (highlights.length === 0) return null;
  return highlights.map((h) =>
    row >= h.start.row && row <= h.end.row && col >= h.start.col && col <= h.end.col ? (
      <div
        key={h.id}
        className={styles.highlight}
        aria-hidden="true"
        style={{ "--sf-highlight-color": h.color } as CSSProperties}
        data-edge-top={row === h.start.row || undefined}
        data-edge-bottom={row === h.end.row || undefined}
        data-edge-start={col === h.start.col || undefined}
        data-edge-end={col === h.end.col || undefined}
      />
    ) : null,
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
  highlights: ResolvedHighlight[];
  registerCell: (row: number, col: number, el: HTMLDivElement | null) => void;
  onCellPointerDown: (cell: Cell, ev: { shiftKey: boolean }) => void;
  onCellPointerEnter: (cell: Cell) => void;
  /** Row-number gutter (Excel row headers); null when `rowNumbers` is off. */
  rowNumberHandlers: {
    onPointerDown: (row: number, ev: { shiftKey: boolean }) => void;
    onPointerEnter: (row: number) => void;
  } | null;
  isColumnEditable: (col: number) => boolean;
  startEdit: (cell: Cell, initialText?: string) => void;
  resolveActivation: (
    rowIndex: number,
    columnId: string,
    row: T,
    columnEditOn?: EditActivation,
  ) => EditActivation;
  getValueAt: (rowIdx: number, colIdx: number) => unknown;
  commitEdit: (value: unknown, advance?: AdvanceHint) => void;
  cancelEdit: () => void;
  /** Paints a cell's whole background; see `DataTableProps.cellBackground`. */
  cellBackground?: CellBackgroundFn<T>;
  /** The table's default overflow mode; a column's `overflow` wins. */
  cellOverflow: CellOverflow;
}

/** The row-number gutter cell: 1-based display index, sticky left, whole-row
 *  selection on click / Shift+click / drag (Excel's row header). Shared by the
 *  flat and tree row paths. */
function RowNumberCell({
  displayIndex,
  selected,
  frozenEdge,
  onPointerDown,
  onPointerEnter,
}: {
  displayIndex: number;
  selected: boolean;
  /** The gutter is the frozen region's edge when no data columns are frozen. */
  frozenEdge: boolean;
  onPointerDown: (row: number, ev: { shiftKey: boolean }) => void;
  onPointerEnter: (row: number) => void;
}) {
  return (
    <div
      role="rowheader"
      aria-label={`Select row ${displayIndex + 1}`}
      className={styles.rowNumberCell}
      data-selected={selected || undefined}
      data-frozen-edge={frozenEdge || undefined}
      onPointerDown={(e) => {
        if (e.button === 0) onPointerDown(displayIndex, { shiftKey: e.shiftKey });
      }}
      onPointerEnter={() => onPointerEnter(displayIndex)}
    >
      {displayIndex + 1}
    </div>
  );
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
  highlights,
  registerCell,
  onCellPointerDown,
  onCellPointerEnter,
  rowNumberHandlers,
  isColumnEditable,
  startEdit,
  resolveActivation,
  getValueAt,
  commitEdit,
  cancelEdit,
  cellBackground,
  cellOverflow,
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
      {rowNumberHandlers && (
        <RowNumberCell
          displayIndex={displayIndex}
          selected={
            selectionRange != null &&
            selectionRange.start.col === 0 &&
            selectionRange.end.col === visibleLeaves.length - 1 &&
            displayIndex >= selectionRange.start.row &&
            displayIndex <= selectionRange.end.row
          }
          frozenEdge={frozenCount === 0}
          onPointerDown={rowNumberHandlers.onPointerDown}
          onPointerEnter={rowNumberHandlers.onPointerEnter}
        />
      )}
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
        const bg = cellBackgroundProps(cellBackground, {
          value,
          row: original,
          rowIndex: dataIdx,
          column: colDef,
        });

        return (
          <div
            key={colDef.id}
            {...(bg["data-bg"] != null ? { "data-bg": "" } : {})}
            ref={(el) => registerCell(displayIndex, colIndex, el)}
            role="gridcell"
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            data-editing={isEditing || undefined}
            data-in-range={inRange || undefined}
            data-align={align}
            data-locked={isLocked || undefined}
            data-frozen={isFrozen || undefined}
            data-frozen-edge={(isFrozen && colIndex === frozenCount - 1) || undefined}
            data-merge-right={mergeRight}
            data-merge-bottom={mergeBottom}
            data-wrap={(colDef.overflow ?? cellOverflow) === "wrap" || undefined}
            data-hash={(colDef.overflow ?? cellOverflow) === "hash" || undefined}
            className={styles.cell}
            style={
              isFrozen && frozenLefts ? { left: frozenLefts[colIndex], ...bg.style } : bg.style
            }
            onPointerDown={(e) => onCellPointerDown(cell, { shiftKey: e.shiftKey })}
            onPointerEnter={() => onCellPointerEnter(cell)}
            onClick={(e) => {
              // Single-click activation. A cross-cell drag doesn't fire `click`
              // (down + up must land on the same element), so range-drag can't
              // trip this; modifier clicks are selection gestures.
              if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
              if (isEditing || !isColumnEditable(colIndex)) return;
              if (resolveActivation(dataIdx, colDef.id, original, colDef.editOn) === "single") {
                startEdit(cell);
              }
            }}
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
              <>
                <span className={styles.cellBody}>
                  {colDef.cell
                    ? colDef.cell({ value, row: original, rowIndex: dataIdx })
                    : colDef.edit
                      ? formatEditDisplay(value, colDef.edit)
                      : value == null
                        ? ""
                        : String(value)}
                </span>
                {(colDef.overflow ?? cellOverflow) === "hash" && (
                  <span aria-hidden="true" className={styles.hashFill} />
                )}
              </>
            )}
            {highlightOverlays(highlights, displayIndex, colIndex)}
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
    editOn = "double",
    getEditActivation,
    cellBackground,
    onCellChange,
    copyWithHeaders = true,
    cellPadding = "md",
    cellFontSize = "md",
    headerLines: tableHeaderLines = 1,
    cellOverflow = "clamp",
    onSelectionChange,
    rowNumbers = false,
    selectionMode = "cell",
    highlights,
    paginate,
    rowHeight = DEFAULT_ROW_HEIGHT,
    height = DEFAULT_HEIGHT,
    empty,
    resizableColumns = true,
    frozenColumns = 0,
    headerSurface = "concave",
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
    fillHeight = false,
    reorderableColumns = false,
    columnOrder: controlledColumnOrder,
    defaultColumnOrder,
    onColumnOrderChange,
    onExternalDrop,
    filterableColumns = false,
    columnFilters: controlledColumnFilters,
    defaultColumnFilters,
    onColumnFiltersChange,
    apiRef,
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
    collapsed: groupsCollapsed,
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
   *  the header in lockstep. `columnOrder` holds REAL leaf ids only, so it is
   *  first projected onto the effective tree (a collapsed group's leaf ids
   *  become its placeholder id) before positions are applied. */
  const visibleLeaves = useMemo(
    () =>
      applyOrder(
        flatLeaves(effectiveColumns),
        toEffectiveOrder(columnOrder, columns, groupsCollapsed),
      ),
    [effectiveColumns, columnOrder, columns, groupsCollapsed],
  );
  /** Effective leaf ids in display order. Feeds the TanStack `columnOrder`
   *  state (so its header groups track `visibleLeaves`, placeholders included)
   *  and the drag-reorder index math. */
  const orderedLeafIds = useMemo(() => visibleLeaves.map((l) => l.id), [visibleLeaves]);

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
    // TanStack orders its (effective) leaf columns, so it gets the derived
    // effective order, not the raw real-id state (which a collapsed group's
    // placeholder is absent from).
    state: { sorting, expanded: expandedState, columnOrder: orderedLeafIds, columnFilters },
    manualSorting: flatMode,
    manualFiltering: flatMode,
    onSortingChange: setSorting,
    onColumnOrderChange: (updater) =>
      // Persisted order carries real leaf ids only (see expandPlaceholderOrder).
      setColumnOrder(
        expandPlaceholderOrder(
          (typeof updater === "function" ? updater(orderedLeafIds) : updater) as string[],
          columns,
          columnOrder,
        ),
      ),
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

  // Row scroll-snap needs the snap origin (`scroll-padding-top`) to clear the
  // sticky header; otherwise row 1's `start` snap point lands behind it and
  // proximity snap parks the table with the first row half-hidden, unrecoverably
  // (issue #88). The CSS fallback assumes each header group is one 1.5u row, which
  // a consumer-grown header (a two-line label, a taller cell) breaks. Measure
  // the real header block and publish it as `--sf-header-block-size`, which the
  // snap padding reads. A layout effect, so the correct padding is in place
  // before the browser computes the initial rest position.
  const [headerBlockSize, setHeaderBlockSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const snapRows = scrollSnap === "rows" || scrollSnap === "both";
    const block = headerRowRef.current;
    if (!snapRows || !block) {
      setHeaderBlockSize(null);
      return;
    }
    // The whole header is one grid (every header group a row of it), so its
    // own box is the block height, and it stays correct while the sticky
    // header is pinned mid-scroll.
    const measure = () => setHeaderBlockSize(Math.round(block.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(block);
    return () => ro.disconnect();
  }, [scrollSnap]);

  // --- Selection ---
  const colCount = visibleLeaves.length;
  const {
    selection,
    isActive,
    isInRange,
    handleCellPointerDown,
    handleCellPointerEnter,
    handleRowHeaderPointerDown,
    handleRowHeaderPointerEnter,
    handleColumnHeaderPointerDown,
    handleColumnHeaderPointerEnter,
    selectAll,
    handleKeyDown: handleSelectionKey,
    setActive,
  } = useTableSelection({
    rowCount: visibleRowCount,
    colCount,
    mode: selectionMode === "column" ? "col" : selectionMode,
    onSelectionChange,
  });

  // Whether the current range spans the full width / height — the state the
  // row-number gutter and header select zones tint as "this line is selected".
  const fullWidthRange =
    selection.range != null &&
    selection.range.start.col === 0 &&
    selection.range.end.col === colCount - 1;
  const fullHeightRange =
    selection.range != null &&
    selection.range.start.row === 0 &&
    selection.range.end.row === visibleRowCount - 1;

  // One stable object so the memoized flat rows don't re-render per selection
  // tick just because the handler pair was rebuilt.
  const rowNumberHandlers = useMemo(
    () =>
      rowNumbers
        ? {
            onPointerDown: handleRowHeaderPointerDown,
            onPointerEnter: handleRowHeaderPointerEnter,
          }
        : null,
    [rowNumbers, handleRowHeaderPointerDown, handleRowHeaderPointerEnter],
  );

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

  // Effective edit trigger for a cell: cell fn → column → table → "double".
  const resolveActivation = useCallback(
    (rowIndex: number, columnId: string, row: T, columnEditOn?: EditActivation): EditActivation =>
      resolveEditActivation({
        cell: getEditActivation?.({ rowIndex, columnId, row }),
        column: columnEditOn,
        table: editOn,
      }),
    [getEditActivation, editOn],
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
    copyWithHeaders,
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

  // The imperative handle: what a host needs to drive the cursor from outside (a formula bar that
  // commits and steps down, a hotkey layer). Focus follows the active cell through the effect above;
  // an already-active cell is focused here directly, since the effect would not re-run for it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: cellKey is a pure helper
  useImperativeHandle(
    apiRef,
    () => ({
      setActive: (cell) => {
        setActive(cell);
        if (cell)
          cellRefs.current.get(cellKey(cell.row, cell.col))?.focus({ preventScroll: false });
      },
      startEdit: (cell, initialText) => {
        setActive(cell);
        startEdit(cell, initialText);
      },
      getSelection: () => selection,
      autoFitColumns: (ids) => autoFitColumnsRef.current(ids),
    }),
    [setActive, startEdit, selection],
  );
  // The fit needs the header refs and floors, which are set up below; the
  // handle reads the latest through a ref so its identity stays stable.
  const autoFitColumnsRef = useRef<(ids?: string[]) => void>(() => {});

  // --- Column-width overrides (px), set by dragging the resize handle ---
  // Controlled/uncontrolled with an onChange so resized widths can be persisted.
  const { columnWidths, setColumnWidths } = useColumnWidths({
    columnWidths: controlledColumnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
  });

  // --- Header floors (issue #102) ---
  // A column is never narrower than its header needs. The floor is measured
  // off each rendered leaf header (its padding, its chrome, its label on one
  // line) and raises the declared minimum on every path: the template's
  // minmax() (so a container squeeze scrolls instead of wrapping a title),
  // the drag, the keyboard step, auto-fit, and the handle's aria-valuemin.
  const headerCellRefs = useRef(new Map<string, HTMLElement>());
  const registerHeaderCell = useCallback((id: string, el: HTMLElement | null) => {
    if (el) headerCellRefs.current.set(id, el);
    else headerCellRefs.current.delete(id);
  }, []);
  // Group headers too: a group title must not wrap either, and its need is a
  // constraint on the sum of its leaves (the JS paths clamp by it; under a
  // container squeeze the label ellipsizes, since a template cannot express a
  // sum).
  const groupCellRefs = useRef(new Map<string, HTMLElement>());
  const registerGroupCell = useCallback((id: string, el: HTMLElement | null) => {
    if (el) groupCellRefs.current.set(id, el);
    else groupCellRefs.current.delete(id);
  }, []);
  const [headerFloors, setHeaderFloors] = useState<Record<string, number>>({});
  const [groupNeeds, setGroupNeeds] = useState<Record<string, number>>({});
  // The webfont changes the metrics when it lands: measure once more then.
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) setFontsTick((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the density props and the font tick change what the header measures
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const leaf of visibleLeaves) {
      const cell = headerCellRefs.current.get(leaf.id);
      const label = cell?.querySelector<HTMLElement>(`.${styles.headerLabel}`);
      if (!cell || !label) continue;
      next[leaf.id] = measureHeaderNeed(cell, {
        label,
        lines: Math.max(1, Math.floor(leaf.headerLines ?? tableHeaderLines)),
      });
    }
    setHeaderFloors((prev) => {
      const keys = Object.keys(next);
      const same =
        keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
    const groups: Record<string, number> = {};
    for (const [id, cell] of groupCellRefs.current) {
      const label = cell.querySelector<HTMLElement>(`.${styles.headerLabel}`);
      if (!label) continue;
      const lines = Number(label.dataset.lines ?? 1) || 1;
      groups[id] = measureHeaderNeed(cell, { label, lines });
    }
    setGroupNeeds((prev) => {
      const keys = Object.keys(groups);
      const same =
        keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === groups[k]);
      return same ? prev : groups;
    });
    // The label text, the chrome and the font all live on the leaves and the
    // two density props; the tick re-runs it after the webfont loads.
  }, [visibleLeaves, cellFontSize, cellPadding, fontsTick, tableHeaderLines]);

  /** Every group header's need as a constraint on its visible leaves, from
   *  TanStack's header tree (so a collapsed subgroup's placeholder counts as
   *  one of its parent's leaves). */
  const groupConstraints = useMemo((): GroupConstraint[] => {
    const out: GroupConstraint[] = [];
    for (const hg of table.getHeaderGroups()) {
      for (const h of hg.headers) {
        if (h.isPlaceholder || h.subHeaders.length === 0) continue;
        const need = groupNeeds[h.column.id];
        if (need == null) continue;
        const leafIndices = h
          .getLeafHeaders()
          .map((lh) => visibleLeaves.findIndex((c) => c.id === lh.column.id))
          .filter((i) => i >= 0);
        if (leafIndices.length > 0) out.push({ leafIndices, need });
      }
    }
    return out;
  }, [table, groupNeeds, visibleLeaves]);

  /** The px floor of leaf `idx`: its declared minimum (own `minWidth` or the
   *  global token, resolved in the header's context) raised to its measured
   *  header need. */
  const columnFloorPx = useCallback(
    (headerCell: HTMLElement, idx: number): number => {
      const leaf = visibleLeaves[idx];
      return combineFloor(
        columnMinWidthPx(headerCell, leaf?.minWidth),
        leaf ? headerFloors[leaf.id] : undefined,
      );
    },
    [visibleLeaves, headerFloors],
  );

  // Snapshot the column widths from the (bottom) header row a handle lives in,
  // indexed to match `visibleLeaves`. Only real header cells count: with
  // `rowNumbers` the row's first child is the select-all corner cell, which
  // would shift every measured index by one.
  const measureLeafWidths = useCallback((headerCell: HTMLElement): number[] | null => {
    const row = headerCell.parentElement;
    if (!row) return null;
    return Array.from(row.children)
      .filter((el) => el.classList.contains(styles.headerCell as string))
      .map((el) => el.getBoundingClientRect().width);
  }, []);

  /** Leaf column ids that may be resized (table opt-in × per-column opt-out). */
  const resizableColumnIds = useMemo(() => {
    const ids = new Set<string>();
    if (resizableColumns) {
      for (const c of visibleLeaves) if (c.resizable !== false) ids.add(c.id);
    }
    return ids;
  }, [resizableColumns, visibleLeaves]);

  /** Every visible leaf's floor in px (its declared minimum raised to its
   *  header need), resolved once per gesture in the header's context. */
  const measureFloors = useCallback(
    (headerCell: HTMLElement): number[] =>
      visibleLeaves.map((_, k) => columnFloorPx(headerCell, k)),
    [visibleLeaves, columnFloorPx],
  );

  /** Which columns a gesture on leaf `idx` moves: every resizable column of a
   *  full-height selection that contains it (Excel and Sheets: select the
   *  columns, drag one edge, they all take the width), else the column alone. */
  const resizeTargets = useCallback(
    (idx: number): number[] => {
      const range = selection.range;
      if (fullHeightRange && range && idx >= range.start.col && idx <= range.end.col) {
        const out: number[] = [];
        for (let k = range.start.col; k <= range.end.col; k++) {
          if (resizableColumnIds.has(visibleLeaves[k]?.id ?? "")) out.push(k);
        }
        if (out.length > 0) return out;
      }
      return [idx];
    },
    [selection.range, fullHeightRange, visibleLeaves, resizableColumnIds],
  );

  // Auto-fit: the width a column's widest currently-mounted content needs.
  // The content's run (a fractional Range width), not the body's scrollWidth:
  // a body that is not overflowing reports its box, the current column width,
  // which kept auto-fit from ever shrinking a wide column. A tree cell's
  // leading gutter (indent + chevron) counts too. The header's need is
  // already in the floor.
  const fitWidth = useCallback(
    (colIndex: number, headerCell: HTMLElement, floor: number): number => {
      let widest = 0;
      for (const [key, el] of cellRefs.current) {
        if (Number(key.split(":")[1]) !== colIndex) continue;
        const body = el.querySelector<HTMLElement>(`.${styles.cellBody}`);
        if (!body) continue;
        const gutter = el.querySelector<HTMLElement>(`.${styles.cellTreeGutter}`);
        const lead = gutter ? gutter.getBoundingClientRect().width : 0;
        widest = Math.max(widest, lead + contentInlineSize(body));
      }
      // Header + cell horizontal padding is calc(--sf-unit / 2) per side, so one
      // measured unit total (tracks a consumer-resized --sf-unit), plus slack.
      const padding = measureCssWidth(headerCell, "var(--sf-unit)") + 8;
      return Math.max(floor, Math.ceil(widest + padding));
    },
    [],
  );

  // Fit several columns in one update: each to its own content, then raised
  // so a group title over them still fits. A resize like any other: the
  // row's other columns freeze at their measured widths (see applyResize).
  const autoFitMany = useCallback(
    (indices: number[], headerCell: HTMLElement): Map<number, number> | null => {
      const startWidths = measureLeafWidths(headerCell);
      if (!startWidths) return null;
      const floors = measureFloors(headerCell);
      const widths = visibleLeaves.map(
        (c, k) => columnWidths[c.id] ?? Math.round(startWidths[k] ?? 0),
      );
      const fitted = new Set<number>();
      for (const i of indices) {
        if (!visibleLeaves[i]) continue;
        widths[i] = fitWidth(i, headerCell, floors[i] ?? 0);
        fitted.add(i);
      }
      raiseForGroups(widths, fitted, groupConstraints);
      setColumnWidths((prev) => {
        let changed = false;
        const nextWidths = { ...prev };
        visibleLeaves.forEach((c, k) => {
          const w = widths[k] as number;
          if (nextWidths[c.id] !== w) {
            nextWidths[c.id] = w;
            changed = true;
          }
        });
        return changed ? nextWidths : prev;
      });
      const out = new Map<number, number>();
      for (const i of fitted) out.set(i, widths[i] as number);
      return out;
    },
    [
      visibleLeaves,
      measureLeafWidths,
      measureFloors,
      fitWidth,
      columnWidths,
      groupConstraints,
      setColumnWidths,
    ],
  );

  // Double-click / Enter on a handle: fit that column, or every column of a
  // full-height selection that contains it (Excel: select columns, double-click
  // any edge inside the selection, each fits its own content).
  const autoFitColumn = useCallback(
    (columnId: string, headerCell: HTMLElement): number | undefined => {
      const colIndex = visibleLeaves.findIndex((c) => c.id === columnId);
      if (colIndex < 0) return undefined;
      return autoFitMany(resizeTargets(colIndex), headerCell)?.get(colIndex);
    },
    [visibleLeaves, autoFitMany, resizeTargets],
  );
  autoFitColumnsRef.current = (ids?: string[]) => {
    const indices =
      ids != null
        ? ids.map((id) => visibleLeaves.findIndex((c) => c.id === id)).filter((i) => i >= 0)
        : visibleLeaves
            .map((c, i) => (resizableColumnIds.has(c.id) ? i : -1))
            .filter((i) => i >= 0);
    const anyCell = headerCellRefs.current.values().next().value as HTMLElement | undefined;
    if (indices.length === 0 || !anyCell) return;
    autoFitMany(indices, anyCell);
  };

  // --- The width readout (issue #102) ---
  // A mono chip under the handle while a column is dragged or keyed: unit
  // multiples and px, "min" at the floor (the one place a stopped drag is
  // explained). Held briefly after a keyboard step, faded after a drag.
  const [readout, setReadout] = useState<{
    id: string;
    px: number;
    atFloor: boolean;
    leaving: boolean;
  } | null>(null);
  const readoutTimer = useRef<number | null>(null);
  const clearReadoutTimer = () => {
    if (readoutTimer.current != null) {
      window.clearTimeout(readoutTimer.current);
      readoutTimer.current = null;
    }
  };
  const hideReadout = useCallback(() => {
    clearReadoutTimer();
    setReadout((r) => (r && !r.leaving ? { ...r, leaving: true } : r));
    readoutTimer.current = window.setTimeout(() => {
      readoutTimer.current = null;
      setReadout(null);
    }, READOUT_FADE_MS);
  }, []);
  const showReadout = useCallback(
    (id: string, px: number, atFloor: boolean, hold: boolean) => {
      clearReadoutTimer();
      setReadout({ id, px: Math.round(px), atFloor, leaving: false });
      if (hold) readoutTimer.current = window.setTimeout(hideReadout, READOUT_HOLD_MS);
    },
    [hideReadout],
  );
  useEffect(() => clearReadoutTimer, []);

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

      // Delete / Backspace clear the selected block (the range, else the active cell) on editable
      // columns, as one `onCellChange` batch: text columns to "", every other editor type to null.
      if (active && (native.key === "Delete" || native.key === "Backspace")) {
        const range = selection.range ?? { start: active, end: active };
        const r0 = Math.min(range.start.row, range.end.row);
        const r1 = Math.min(Math.max(range.start.row, range.end.row), visibleRowCount - 1);
        const c0 = Math.min(range.start.col, range.end.col);
        const c1 = Math.max(range.start.col, range.end.col);
        const changes: CellChange[] = [];
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const col = visibleLeaves[c];
            if (!col?.edit || !isColumnEditable(c)) continue;
            changes.push({
              rowIndex: r,
              columnId: col.id,
              value: col.edit.type === "text" ? "" : null,
            });
          }
        }
        if (changes.length > 0) {
          ev.preventDefault();
          onCellChange?.(changes);
          return;
        }
      }

      // Type-to-edit: a printable key on an editable cell opens its editor seeded with that character
      // (Excel's "start typing to replace"). Space is left alone: Shift+Space and Ctrl+Space select
      // the row and column, and chords with Ctrl/Cmd/Alt belong to their own handlers.
      if (
        active &&
        isColumnEditable(active.col) &&
        native.key.length === 1 &&
        native.key !== " " &&
        !native.ctrlKey &&
        !native.metaKey &&
        !native.altKey
      ) {
        ev.preventDefault();
        startEdit(active, native.key);
        return;
      }
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
      selection.range,
      visibleLeaves,
      visibleRowCount,
      onCellChange,
      isColumnEditable,
      startEdit,
      handleCopy,
      handlePaste,
      handleSelectionKey,
      scrollByArrow,
    ],
  );

  // Measured px of `--sf-datatable-col-min` for the resize handles'
  // aria-valuemin: once per mount (the token is static for the table's life),
  // never per render.
  const [colMinPx, setColMinPx] = useState<number | null>(null);
  // The unit in px too, so a column's own `minWidth` (a unit multiple) can be
  // announced on its handle rather than the global floor (issue #100).
  const [unitPx, setUnitPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    const vp = containerRef.current;
    if (!vp) return;
    setColMinPx(Math.round(measureCssWidth(vp, "var(--sf-datatable-col-min)")));
    setUnitPx(measureCssWidth(vp, "var(--sf-unit)"));
    setLeadingPx(measureCssWidth(vp, "var(--sf-leading-base)"));
  }, []);

  // --- Cell overflow modes (issue #102) ---
  // The lines a row holds, for `overflow: "wrap"`: from rowHeight and the
  // measured leading, keeping half a unit of breathing (36px is one line,
  // 60px two, 84px three). Published as --sf-cell-lines for the CSS clamp.
  const [leadingPx, setLeadingPx] = useState<number | null>(null);
  const cellLineCount = useMemo(
    () => (leadingPx != null && unitPx != null ? cellLines(rowHeight, leadingPx, unitPx / 2) : 1),
    [rowHeight, leadingPx, unitPx],
  );
  const wrapWarned = useRef(false);
  useEffect(() => {
    if (wrapWarned.current || leadingPx == null || cellLineCount > 1) return;
    if (visibleLeaves.some((c) => (c.overflow ?? cellOverflow) === "wrap")) {
      wrapWarned.current = true;
      console.warn(
        `DataTable: overflow "wrap" holds one line at rowHeight ${rowHeight}; give the rows at least 60px for two lines.`,
      );
    }
  }, [visibleLeaves, cellOverflow, cellLineCount, leadingPx, rowHeight]);

  // The hash fill: a layout pass over the mounted cells of every hash-mode
  // column after each render (the mounted set, the widths and the values can
  // all change; the pass is a few dozen rect reads). A value's run (a
  // fractional Range width, since scrollWidth is an integer and misses a
  // sub-pixel overflow) against the body's box flips `data-overflow` on the
  // cell and carries the value in its title. Attributes only: a drag frame
  // still re-renders the header alone.
  const hashColumns = useMemo(() => {
    const set = new Set<number>();
    visibleLeaves.forEach((c, i) => {
      if ((c.overflow ?? cellOverflow) === "hash") set.add(i);
    });
    return set;
  }, [visibleLeaves, cellOverflow]);
  useLayoutEffect(() => {
    if (hashColumns.size === 0) return;
    for (const [key, el] of cellRefs.current) {
      if (!hashColumns.has(Number(key.split(":")[1]))) continue;
      const body = el.querySelector<HTMLElement>(`.${styles.cellBody}`);
      const over =
        body != null && contentInlineSize(body) > body.getBoundingClientRect().width + 0.5;
      if (over) {
        el.dataset.overflow = "";
        el.title = body?.textContent ?? "";
      } else if (el.dataset.overflow != null) {
        delete el.dataset.overflow;
        el.removeAttribute("title");
      }
    }
  });

  /** What a resize handle announces as its lower bound: the column's own
   *  `minWidth` in px when it declares one, else the measured global floor,
   *  either raised to the measured header need (issue #102). */
  const ariaColumnMin = useCallback(
    (leafIndex: number): number | undefined => {
      const leaf = leafIndex >= 0 ? visibleLeaves[leafIndex] : undefined;
      const min = leaf?.minWidth;
      const declared =
        min != null
          ? unitPx != null
            ? Math.round(min * unitPx)
            : undefined
          : (colMinPx ?? undefined);
      if (declared == null) return undefined;
      return Math.round(combineFloor(declared, leaf ? headerFloors[leaf.id] : undefined));
    },
    [visibleLeaves, unitPx, colMinPx, headerFloors],
  );

  // Apply a resize: the spreadsheet model. The first resize freezes every
  // column at the width it measures on screen (`startWidths`, a px override
  // each, the last column included, which ends the `1fr` filler), and from
  // then on only the dragged column changes: its neighbours keep their
  // widths and the row's total width follows the dragged edge, scrolling when
  // wider than the viewport and leaving slack when narrower.
  //
  // `floors` is every leaf's floor for the gesture (see measureFloors). The
  // moved columns are the gesture's targets (a full-height selection moves
  // together); each lands at max(its floor, the group rule, the dragged
  // width). With `neighbour` (Shift held) the next column absorbs the change
  // and the row's total holds, both floors respected. Returns the width the
  // dragged column landed at.
  const applyResize = useCallback(
    (
      idx: number,
      startWidths: number[],
      dx: number,
      floors: number[],
      neighbour = false,
    ): number => {
      const leaf = visibleLeaves[idx];
      if (!leaf) return 0;
      const targets = resizeTargets(idx);
      const declared = (k: number) => floors[k] ?? 0;
      const common = Math.max(declared(idx), groupFloorFor(targets, startWidths, groupConstraints));
      let v = Math.max(common, Math.round((startWidths[idx] ?? 0) + dx));
      const next = idx + 1;
      const pair =
        neighbour &&
        targets.length === 1 &&
        next < visibleLeaves.length &&
        resizableColumnIds.has(visibleLeaves[next]?.id ?? "");
      let nextWidth = 0;
      if (pair) {
        const total = Math.round((startWidths[idx] ?? 0) + (startWidths[next] ?? 0));
        const nextFloor = Math.max(
          declared(next),
          groupFloorFor([next], startWidths, groupConstraints),
        );
        v = Math.min(v, total - nextFloor);
        nextWidth = total - v;
      }
      setColumnWidths((prev) => {
        let changed = false;
        const nextWidths = { ...prev };
        visibleLeaves.forEach((c, k) => {
          const w = targets.includes(k)
            ? Math.max(declared(k), v)
            : pair && k === next
              ? nextWidth
              : (prev[c.id] ?? Math.round(startWidths[k] ?? 0));
          if (nextWidths[c.id] !== w) {
            nextWidths[c.id] = w;
            changed = true;
          }
        });
        return changed ? nextWidths : prev;
      });
      return v;
    },
    [visibleLeaves, setColumnWidths, resizeTargets, groupConstraints, resizableColumnIds],
  );

  // A single drag instance serves every handle; onStart reads which column is
  // being resized (and the start geometry of the whole row) off the handle.
  const resizeRef = useRef<{
    idx: number;
    startWidths: number[];
    floors: number[];
    /** Shift held at the press: the neighbour absorbs the change. */
    neighbour: boolean;
    /** Physical-direction semantics: in RTL the trailing edge sits on the
     *  column's left, so a leftward pointer move grows the column. Read once
     *  per gesture. */
    rtl: boolean;
    handle: HTMLElement;
  } | null>(null);
  const { onPointerDown: onColumnResizeDown } = usePointerDrag({
    onStart: (_origin, event) => {
      const handle = event.currentTarget as HTMLElement;
      const id = handle.dataset.columnId;
      const headerCell = handle.parentElement as HTMLElement | null;
      if (!id || !headerCell) return;
      const startWidths = measureLeafWidths(headerCell);
      const idx = visibleLeaves.findIndex((c) => c.id === id);
      if (!startWidths || idx < 0) return;
      handle.dataset.dragging = "true";
      // The pointer leaves the handle during the drag; the viewport carries
      // the resize cursor (and the one-way one at the floor) meanwhile.
      const vp = containerRef.current;
      if (vp) vp.dataset.resizing = "";
      resizeRef.current = {
        idx,
        startWidths,
        floors: measureFloors(headerCell),
        neighbour: event.shiftKey,
        rtl: getComputedStyle(handle).direction === "rtl",
        handle,
      };
    },
    onMove: (delta) => {
      const r = resizeRef.current;
      if (!r) return;
      // The edge follows the pointer: physical +dx grows the column in LTR,
      // shrinks it in RTL.
      const dx = r.rtl ? -delta.dx : delta.dx;
      const landed = applyResize(r.idx, r.startWidths, dx, r.floors, r.neighbour);
      const wanted = Math.round((r.startWidths[r.idx] ?? 0) + dx);
      // Clamped up: at a floor (its own, or a group title's).
      const atFloor = landed > wanted;
      const vp = containerRef.current;
      if (vp) {
        if (atFloor) vp.dataset.atFloor = "";
        else delete vp.dataset.atFloor;
      }
      const id = visibleLeaves[r.idx]?.id;
      if (id) showReadout(id, landed, atFloor, false);
    },
    onEnd: () => {
      const r = resizeRef.current;
      if (r) delete r.handle.dataset.dragging;
      resizeRef.current = null;
      const vp = containerRef.current;
      if (vp) {
        delete vp.dataset.resizing;
        delete vp.dataset.atFloor;
      }
      hideReadout();
    },
  });

  // Keyboard resize on a focused handle: arrows nudge the edge (Shift = larger
  // step) through the same logic as a drag. The col-min
  // token can't change mid-burst, so it's measured once per handle focus
  // (the probe forces a layout per keystroke otherwise) — the handle's
  // onBlur drops the cache.
  const keyResizeFloors = useRef<{ columnId: string; floors: number[] } | null>(null);
  // The width a handle had when it took focus, so Escape can put it back.
  const focusWidth = useRef<{ columnId: string; px: number } | null>(null);
  const rememberFocusWidth = useCallback(
    (columnId: string, headerCell: HTMLElement) => {
      const idx = visibleLeaves.findIndex((c) => c.id === columnId);
      const widths = measureLeafWidths(headerCell);
      const px = idx >= 0 ? widths?.[idx] : undefined;
      focusWidth.current = px != null ? { columnId, px: Math.round(px) } : null;
    },
    [visibleLeaves, measureLeafWidths],
  );
  // The APG Window Splitter map (the nearest pattern; the APG has none for
  // column resizing): arrows nudge (Shift coarser, Page keys a run of units),
  // Home goes to the floor, End and Enter/Space auto-fit (the splitter's
  // "collapse or restore", the keyboard twin of the double-click), Escape
  // restores the width the handle had when it took focus.
  const resizeColumnByKey = useCallback(
    (columnId: string, headerCell: HTMLElement, ev: KeyboardEvent<HTMLDivElement>) => {
      const key = ev.key;
      const isArrow = key === "ArrowLeft" || key === "ArrowRight";
      const isPage = key === "PageUp" || key === "PageDown";
      const isFit = key === "Enter" || key === " " || key === "End";
      if (!isArrow && !isPage && !isFit && key !== "Home" && key !== "Escape") return;
      ev.preventDefault();
      const startWidths = measureLeafWidths(headerCell);
      const idx = visibleLeaves.findIndex((c) => c.id === columnId);
      if (!startWidths || idx < 0) return;
      if (keyResizeFloors.current?.columnId !== columnId) {
        keyResizeFloors.current = { columnId, floors: measureFloors(headerCell) };
      }
      const floors = keyResizeFloors.current.floors;
      const minPx = floors[idx] ?? 0;
      if (isFit) {
        const fitted = autoFitColumn(columnId, headerCell);
        if (fitted != null) showReadout(columnId, fitted, fitted <= minPx, true);
        return;
      }
      const current = startWidths[idx] ?? 0;
      let target: number;
      if (key === "Home") target = minPx;
      else if (key === "Escape") {
        const remembered = focusWidth.current;
        if (!remembered || remembered.columnId !== columnId) return;
        target = remembered.px;
      } else {
        // Physical-direction semantics: the edge moves in the arrow's
        // direction, so in RTL (trailing edge on the column's left) ArrowRight
        // shrinks. Page Up is always wider, Page Down narrower.
        const rtl = getComputedStyle(headerCell).direction === "rtl";
        const step = isPage
          ? KEY_RESIZE_STEP_PAGE_PX
          : ev.shiftKey
            ? KEY_RESIZE_STEP_COARSE_PX
            : KEY_RESIZE_STEP_PX;
        const dir = isPage
          ? key === "PageUp"
            ? 1
            : -1
          : (key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1);
        target = current + dir * step;
      }
      const landed = applyResize(idx, startWidths, target - current, floors);
      showReadout(columnId, landed, landed > Math.round(target), true);
    },
    [measureLeafWidths, applyResize, visibleLeaves, measureFloors, autoFitColumn, showReadout],
  );

  // --- Row-number gutter geometry ---
  // A fixed leading track outside `visibleLeaves`, so it never shifts `col`
  // coordinates. Width grows with the digit count (1.5u covers 3 digits at the
  // sm mono size, +0.25u per further digit), as a calc() so it tracks the
  // consumer's --sf-unit.
  const gutterWidth = useMemo(() => {
    if (!rowNumbers) return null;
    const digits = String(Math.max(1, visibleRowCount)).length;
    return `calc(var(--sf-unit) * ${1.5 + Math.max(0, digits - 3) * 0.25})`;
  }, [rowNumbers, visibleRowCount]);

  // --- Frozen (pinned-left) columns ---
  // Clamp so at least one column still scrolls; counts leaf columns.
  const frozenCount = Math.max(0, Math.min(frozenColumns, visibleLeaves.length - 1));
  // CSS `left` per frozen column + the region's total width, as calc() strings so
  // they track the consumer's --sf-unit without resolving px in JS. The gutter
  // (itself sticky at 0) pushes every frozen offset right by its width.
  const frozenLefts = useMemo(() => {
    const lefts = frozenLeftOffsets(visibleLeaves, columnWidths, frozenCount, {
      defaultWidth: defaultColumnWidth,
      floors: headerFloors,
    });
    if (!gutterWidth) return lefts;
    return lefts.map((left) => (left === "0px" ? gutterWidth : `calc(${gutterWidth} + ${left})`));
  }, [visibleLeaves, columnWidths, frozenCount, defaultColumnWidth, gutterWidth, headerFloors]);
  const frozenWidth = useMemo(() => {
    const width = frozenTotalWidth(visibleLeaves, columnWidths, frozenCount, {
      defaultWidth: defaultColumnWidth,
      floors: headerFloors,
    });
    if (!gutterWidth) return width;
    return width === "0px" ? gutterWidth : `calc(${gutterWidth} + ${width})`;
  }, [visibleLeaves, columnWidths, frozenCount, defaultColumnWidth, gutterWidth, headerFloors]);
  // Toggle a boundary shadow on the frozen edge once the body is scrolled right.
  // The gutter is a frozen edge of its own when no data columns are frozen.
  const [frozenScrolled, setFrozenScrolled] = useState(false);
  const handleViewportScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (frozenCount === 0 && !rowNumbers) return;
      const next = e.currentTarget.scrollLeft > 0;
      setFrozenScrolled((prev) => (prev === next ? prev : next));
    },
    [frozenCount, rowNumbers],
  );

  // --- Grid template (from visible leaves + runtime width overrides) ---
  // Once every column carries a width (after the first resize, or from a full
  // set of persisted widths) the columns are fixed, the last one included, and
  // the header and body hold their total width (`data-fixed`) instead of
  // shrinking to the viewport: the spreadsheet model.
  const fixedColumns = allFixed(visibleLeaves, columnWidths);

  // Before the first resize a column can already sit at its floor (the
  // container squeezed it there). Measure the keys once per header resize so
  // the handle shows the one-way cursor at rest too; once every column carries
  // an override the widths are known and the observer stays quiet.
  const [restAtFloor, setRestAtFloor] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const block = headerRowRef.current;
    if (!block || fixedColumns) return;
    const measure = () => {
      const next = new Set<string>();
      visibleLeaves.forEach((leaf, i) => {
        const floor = ariaColumnMin(i);
        const cell = headerCellRefs.current.get(leaf.id);
        if (floor == null || !cell) return;
        if (cell.getBoundingClientRect().width <= floor + 0.5) next.add(leaf.id);
      });
      setRestAtFloor((prev) =>
        prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(block);
    return () => ro.disconnect();
  }, [visibleLeaves, fixedColumns, ariaColumnMin]);
  const gridTemplateColumns = useMemo(() => {
    const template = buildColumnTemplate(visibleLeaves, columnWidths, {
      stretchLast: !fillOn && !fixedColumns,
      defaultWidth: defaultColumnWidth,
      frozenCount,
      floors: headerFloors,
    });
    return gutterWidth ? `${gutterWidth} ${template}` : template;
  }, [
    visibleLeaves,
    columnWidths,
    fillOn,
    fixedColumns,
    defaultColumnWidth,
    frozenCount,
    gutterWidth,
    headerFloors,
  ]);

  // --- Fill backdrop ---
  // A single dither surface behind the grid content (see `.content` / `.fill`
  // in the CSS). The opaque cells occlude it; the empty leftover (right of the
  // fixed columns, below the last row, and the corner) reveals it as one
  // continuous surface. No geometry is measured: the content wrapper is sized
  // by the header's `max-content` and stretched to the viewport with
  // `min-width/height: 100%`, so the backdrop covers exactly the leftover.
  const fillActive = fillOn || fillHeight;

  // The animated variant renders a WebGL dither canvas; the hook is inert until
  // a canvas mounts (static mode), mirroring Skeleton's usage. One context for
  // the whole backdrop (gutter + band share it).
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

  // --- Coloured range highlights ---
  // Normalise each range (start <= end) and resolve its colour once; the per-cell
  // lookup then loops this (few) list. Overlays are per cell (no geometry
  // measured), so they align to the grid and survive virtualization/scroll.
  const resolvedHighlights = useMemo<ResolvedHighlight[]>(
    () =>
      (highlights ?? []).map((h, i) => ({
        id: h.id ?? `sf-highlight-${i}`,
        color: h.color ?? (HIGHLIGHT_PALETTE[i % HIGHLIGHT_PALETTE.length] as string),
        start: {
          row: Math.min(h.range.start.row, h.range.end.row),
          col: Math.min(h.range.start.col, h.range.end.col),
        },
        end: {
          row: Math.max(h.range.start.row, h.range.end.row),
          col: Math.max(h.range.start.col, h.range.end.col),
        },
      })),
    [highlights],
  );

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
    highlights: resolvedHighlights,
    rowNumberHandlers,
    registerCell,
    onCellPointerDown: handleCellPointerDown,
    onCellPointerEnter: handleCellPointerEnter,
    isColumnEditable,
    startEdit,
    resolveActivation,
    getValueAt,
    commitEdit,
    cancelEdit,
    cellBackground,
    cellOverflow,
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
    const bg = cellBackgroundProps(cellBackground, {
      value: getCellValue(row.original as T, colDef.accessor),
      row: row.original as T,
      rowIndex: row.index,
      column: colDef,
    });
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
        {(colDef.overflow ?? cellOverflow) === "hash" && (
          <span aria-hidden="true" className={styles.hashFill} />
        )}
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
        data-editing={isEditing || undefined}
        data-in-range={inRange || undefined}
        data-align={align}
        data-tree-cell={isTreeCell || undefined}
        data-locked={isLocked || undefined}
        data-frozen={isFrozen || undefined}
        data-frozen-edge={(isFrozen && colIndex === frozenCount - 1) || undefined}
        data-merge-right={mergeRight}
        data-merge-bottom={mergeBottom}
        data-wrap={(colDef.overflow ?? cellOverflow) === "wrap" || undefined}
        data-hash={(colDef.overflow ?? cellOverflow) === "hash" || undefined}
        className={styles.cell}
        {...(bg["data-bg"] != null ? { "data-bg": "" } : {})}
        style={isFrozen ? { left: frozenLefts[colIndex], ...bg.style } : bg.style}
        onPointerDown={(e) => handleCellPointerDown(cell, { shiftKey: e.shiftKey })}
        onPointerEnter={() => handleCellPointerEnter(cell)}
        onClick={(e) => {
          if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
          if (isEditing || !isColumnEditable(colIndex)) return;
          if (
            resolveActivation(row.index, colDef.id, row.original as T, colDef.editOn) === "single"
          ) {
            startEdit(cell);
          }
        }}
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
        {/* Coloured range overlays: one per highlight covering this cell. */}
        {highlightOverlays(resolvedHighlights, rowIndex, colIndex)}
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
  const shared = useSfDnd();
  const regionId = useId();
  // Parents from the EFFECTIVE tree, so a collapsed group's placeholder leaf has
  // a parent entry and reorders as one unit under the same-parent guard below.
  const leafParents = useMemo(() => leafParentMap(effectiveColumns), [effectiveColumns]);
  const reorderSensors = useSensors(
    // 4px threshold so a plain click still sorts and the resize handle still resizes.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const draggingLeaf = draggingColId
    ? visibleLeaves.find((l) => l.id === draggingColId)
    : undefined;

  // Header sortables carry a per-instance namespaced dnd id
  // (`${regionId}:${columnId}`), so column ids can't collide across
  // widgets/instances sharing one `SfDndProvider`; the real column id rides in
  // the sortable's `data` and every consumer-facing payload uses it.
  const sortableId = useCallback((columnId: string) => `${regionId}:${columnId}`, [regionId]);
  const sortableIds = useMemo(
    () => orderedLeafIds.map((id) => `${regionId}:${id}`),
    [orderedLeafIds, regionId],
  );
  const columnIdOf = useCallback(
    (node: Active | Over): string | null => {
      const cid = node.data.current?.columnId;
      if (typeof cid === "string") return cid;
      // Fallback for a payload without `data` (shouldn't happen for our headers).
      const raw = String(node.id);
      const prefix = `${regionId}:`;
      return raw.startsWith(prefix) ? raw.slice(prefix.length) : null;
    },
    [regionId],
  );

  const onColumnDragStart = useCallback(
    (e: DragStartEvent) => {
      setDraggingColId(columnIdOf(e.active));
    },
    [columnIdOf],
  );
  const onColumnDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDraggingColId(null);
      const activeId = columnIdOf(e.active);
      const overId = e.over ? columnIdOf(e.over) : null;
      if (!activeId || !overId || activeId === overId) return;
      // A leaf (or a collapsed group's placeholder) may only reorder within its
      // own parent group.
      if (leafParents.get(activeId) !== leafParents.get(overId)) return;
      const from = orderedLeafIds.indexOf(activeId);
      const to = orderedLeafIds.indexOf(overId);
      if (from < 0 || to < 0) return;
      // Persist REAL leaf ids only: a moved placeholder expands into the
      // group's leaves, so expanding the group later keeps it where it was
      // dropped instead of dumping its leaves at the tail.
      setColumnOrder(
        expandPlaceholderOrder(arrayMove(orderedLeafIds, from, to), columns, columnOrder),
      );
    },
    [columnIdOf, leafParents, orderedLeafIds, setColumnOrder, columns, columnOrder],
  );

  // The header list is stable during a drag, so the shared provider (which
  // renders the overlay from its own render pass, ahead of this one) can read
  // the dragged column through a ref rather than render-cycle state.
  const visibleLeavesRef = useRef(visibleLeaves);
  visibleLeavesRef.current = visibleLeaves;
  useSfDndRegion(reorderableColumns ? shared : null, {
    id: regionId,
    // dnd-kit's default collision is rectIntersection; keep it under the shared
    // context so column reordering feels identical.
    collisionDetection: rectIntersection,
    onDragStart: onColumnDragStart,
    onDragEnd: onColumnDragEnd,
    onDragCancel: () => setDraggingColId(null),
    onExternalDrop: ({ active, over }) => {
      // Unwrap the namespaced dnd id so consumers get the real column id.
      onExternalDrop?.({ active, overColumnId: over ? columnIdOf(over) : null });
    },
    renderOverlay: (activeId) => {
      // The provider hands back the namespaced dnd id; strip our prefix.
      const prefix = `${regionId}:`;
      const columnId = activeId.startsWith(prefix) ? activeId.slice(prefix.length) : activeId;
      const leaf = visibleLeavesRef.current.find((l) => l.id === columnId);
      if (!leaf) return null;
      return (
        <div className={styles.headerDragOverlay}>
          {typeof leaf.header === "string" ? leaf.header : leaf.id}
        </div>
      );
    },
  });

  // The single dither backdrop (see the `.content` / `.fill` layer notes above).
  // A `position: absolute; inset: 0` child of `.content`, painted behind the
  // cells (`z-index: -1`), so it fills the whole leftover as one surface.
  const fillBackdrop =
    fillActive && !showEmpty ? (
      <div
        ref={
          fillAnimated
            ? (node) => {
                fillRootRef.current = node;
              }
            : undefined
        }
        className={cx(styles.fill, fillAnimated && styles.fillAnimated)}
        aria-hidden="true"
        style={
          fillOpts.color ? ({ "--sf-fill-color": fillOpts.color } as CSSProperties) : undefined
        }
      >
        {fillAnimated ? <canvas ref={fillCanvasRef} className={styles.fillCanvas} /> : null}
      </div>
    ) : null;

  /** Render one header cell. `dnd` (from `SortableHeaderCell`) makes it a draggable
   *  sortable item; omitted for group/placeholder/non-reorderable headers. */
  /** Where a header cell sits in the header grid: its row (0-based) and how
   *  many rows it spans. A cell spans more than one row when TanStack put
   *  placeholder headers above it (an ungrouped leaf, a collapsed group, a
   *  shallow group in a deeper tree): the placeholders are not rendered and the
   *  real header takes their rows, so it is one key with its title, chevron and
   *  resize handle in one box (issue #101). */
  type HeaderPlacement = { row: number; rowSpan: number };

  const renderHeaderCell = (
    header: Header<T, unknown>,
    place: HeaderPlacement,
    dnd?: HeaderDnd,
  ): ReactNode => {
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
    const colMeta = (
      def as { meta?: { collapsedGroupId?: string; color?: string; headerLines?: number } }
    ).meta;
    // Lines the title may take: the column's own count, else the table's.
    const lines = Math.max(1, Math.floor(colMeta?.headerLines ?? tableHeaderLines));
    // A heading's own colour tints its key (issue #99). Carried through
    // TanStack's `meta`, since its columnDef is not ours.
    const headerColor = colMeta?.color;
    // For placeholder leaves (collapsed groups), pull the original group id back
    // out so the chevron toggles the right thing.
    const collapsedGroupId = colMeta?.collapsedGroupId;
    const canSort = header.column.getCanSort();
    const sortDir = header.column.getIsSorted();
    const isLeafHeader = !isGroupHeader && !header.isPlaceholder;
    // Every resizable leaf has its trailing handle, the last one included: in
    // the spreadsheet model the last column's edge is as movable as any other,
    // and growing it just widens the row.
    const showResizeHandle = isLeafHeader && resizableColumnIds.has(header.column.id);
    const handleWidth =
      columnWidths[header.column.id] != null
        ? Math.round(columnWidths[header.column.id] as number)
        : undefined;
    const handleMin = showResizeHandle ? ariaColumnMin(leafStart) : undefined;
    // At the floor by its override, or measured there at rest.
    const handleAtFloor =
      showResizeHandle &&
      (handleWidth != null && handleMin != null
        ? handleWidth <= handleMin + 0.5
        : restAtFloor.has(header.column.id));
    const isLocked = isLeafHeader && resizableColumns && !resizableColumnIds.has(header.column.id);
    const fmeta = isLeafHeader ? filterMeta.get(header.column.id) : undefined;
    const filterValue = fmeta ? header.column.getFilterValue() : undefined;
    const isFiltered = filterValue != null;
    const colSelected =
      isLeafHeader &&
      fullHeightRange &&
      selection.range != null &&
      leafStart >= selection.range.start.col &&
      leafStart <= selection.range.end.col;
    return (
      <div
        key={header.id}
        ref={(el) => {
          dnd?.ref(el);
          if (isLeafHeader) registerHeaderCell(header.column.id, el);
          else if (isGroupHeader) registerGroupCell(header.column.id, el);
        }}
        role="columnheader"
        className={cx(
          styles.headerCell,
          surfaceClass[headerSurface],
          isGroupHeader && styles.headerCellGroup,
          dnd?.listeners && styles.headerDraggable,
          dnd?.dragging && styles.headerDragging,
        )}
        style={
          {
            gridColumn:
              leafStart >= 0
                ? `${leafStart + 1 + (rowNumbers ? 1 : 0)} / span ${span}`
                : `span ${span}`,
            gridRow: `${place.row + 1} / span ${place.rowSpan}`,
            ...(isFrozen ? { left: frozenLefts[leafStart] } : {}),
            ...(headerColor != null ? { "--sf-header-color": headerColor } : {}),
            ...(lines > 1 ? { "--sf-header-lines": lines } : {}),
            ...dnd?.style,
          } as CSSProperties
        }
        data-align={isGroupHeader ? "center" : "start"}
        data-surface={headerSurface}
        data-tinted={headerColor != null || undefined}
        // A multi-line title: the key grows to its lines (see .headerCell[data-lines]).
        data-lines={lines > 1 ? lines : undefined}
        data-sortable={canSort || undefined}
        data-locked={isLocked || undefined}
        data-frozen={isFrozen || undefined}
        data-frozen-edge={isFrozenEdge || undefined}
        data-filtered={isFiltered || undefined}
        data-selected={colSelected || undefined}
        // Spans the rows its placeholders occupied: one tall key, one face.
        data-span-rows={place.rowSpan > 1 || undefined}
        // The sorted column's header sits pressed (see .headerCell[data-sorted]).
        data-sorted={sortDir || undefined}
        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        {...(dnd?.listeners ?? {})}
      >
        {!header.isPlaceholder && (
          <>
            <span className={styles.headerLabel} data-lines={lines > 1 ? lines : undefined}>
              {flexRender(def.header, header.getContext())}
            </span>
            {/* A sortable column carries its arrow's space at rest too (a
                hidden glyph from CSS), so sorting never moves a column edge
                and the floor does not jump with it (issue #102). */}
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
            {canSort && !sortDir && (
              <span aria-hidden="true" className={styles.sortArrow} data-reserved="" />
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
        {/* Excel's column-select zone: a slim strip along the header's top edge.
            Click selects the whole column, Shift+click extends the column span,
            drag sweeps several columns. Pointer-only (the keyboard path is
            Ctrl+Space on a cell), so it's hidden from the tree; it stops
            propagation so sort / drag-reorder don't also fire. */}
        {isLeafHeader && leafStart >= 0 && (
          <div
            aria-hidden="true"
            className={styles.selectZone}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.button === 0) {
                handleColumnHeaderPointerDown(leafStart, { shiftKey: e.shiftKey });
              }
            }}
            onPointerEnter={() => handleColumnHeaderPointerEnter(leafStart)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {showResizeHandle && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${typeof def.header === "string" ? def.header : header.column.id} column`}
            // No override yet = no known px width; omit rather than announce an
            // invalid 0 below the minimum. The min is this column's own floor.
            aria-valuenow={handleWidth}
            aria-valuemin={handleMin ?? undefined}
            aria-valuemax={COLUMN_MAX_PX}
            aria-valuetext={
              handleWidth != null ? describeColumnWidth(handleWidth, handleAtFloor) : undefined
            }
            tabIndex={0}
            data-column-id={header.column.id}
            // At the floor the cursor says "only wider" (see .resizeHandle[data-at-floor]).
            data-at-floor={handleAtFloor || undefined}
            className={styles.resizeHandle}
            // Stop the drag/reorder + sort from firing when grabbing the resizer.
            onPointerDown={(e) => {
              e.stopPropagation();
              onColumnResizeDown(e);
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              autoFitColumn(header.column.id, e.currentTarget.parentElement as HTMLElement);
            }}
            onKeyDown={(e) =>
              resizeColumnByKey(header.column.id, e.currentTarget.parentElement as HTMLElement, e)
            }
            onFocus={(e) =>
              rememberFocusWidth(header.column.id, e.currentTarget.parentElement as HTMLElement)
            }
            onBlur={() => {
              keyResizeFloors.current = null;
              focusWidth.current = null;
              hideReadout();
            }}
          />
        )}
        {readout?.id === header.column.id && (
          <span
            aria-hidden="true"
            className={styles.widthReadout}
            data-at-floor={readout.atFloor || undefined}
            data-leaving={readout.leaving || undefined}
          >
            {formatColumnWidth(readout.px, unitPx, readout.atFloor)}
          </span>
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
            // `fillHeight` holds the viewport at the full height (fills even with
            // few rows); otherwise `height` is a cap that sizes to content.
            height: fillHeight ? height : undefined,
            maxHeight: fillHeight ? undefined : height,
            "--sf-row-height": `${rowHeight}px`,
            "--sf-cell-lines": cellLineCount,
            // Measured sticky-header height for the scroll-snap origin (issue #88);
            // absent before measurement, when the CSS fallback (1.5u per group) holds.
            "--sf-header-rows": headerGroups.length,
            ...(headerBlockSize != null
              ? { "--sf-header-block-size": `${headerBlockSize}px` }
              : {}),
            // INTERNAL variable, not a consumer token: the single writer for
            // every row's grid-template-columns,
            // so a resize step mutates one element instead of every row.
            "--sf-datatable-template": gridTemplateColumns,
            ...(frozenCount > 0 || rowNumbers ? { scrollPaddingInlineStart: frozenWidth } : {}),
          } as CSSProperties
        }
        onKeyDown={handleKeyDown}
        onScroll={frozenCount > 0 || rowNumbers ? handleViewportScroll : undefined}
        data-snap-rows={scrollSnap === "rows" || scrollSnap === "both" ? "" : undefined}
        data-snap-cols={scrollSnap === "columns" || scrollSnap === "both" ? "" : undefined}
        data-column-fill={fillOn || undefined}
        data-fixed={(fixedColumns && !fillOn) || undefined}
        data-fill={fillActive || undefined}
        data-frozen={frozenCount > 0 || undefined}
        data-frozen-scrolled={frozenScrolled || undefined}
        data-cell-padding={cellPadding === "md" ? undefined : cellPadding}
        data-cell-font={cellFontSize === "md" ? undefined : cellFontSize}
      >
        {/* Grid content wrapper. `display: contents` outside fill mode (zero
            box, so the layout is identical to no wrapper); in fill mode it
            becomes the backdrop container: sized by the header's `max-content`
            and stretched to the viewport, holding the single `.fill` surface
            behind the cells. `edgeFade` stays outside so it spans the gutter. */}
        <div className={styles.content}>
          {fillBackdrop}
          {/* Headers — one row per header group; parent groups span their leaves.
            With `reorderableColumns`, leaf headers are sortable (drag to reorder). */}
          {(() => {
            // A column's real header sits directly above its children, and
            // TanStack fills the rows above it (up to the top) with placeholder
            // headers for the same column when its parent chain runs out. Those
            // placeholders are skipped and the real header spans their rows.
            const placeholderRows = new Map<string, number[]>();
            headerGroups.forEach((hg, r) => {
              for (const h of hg.headers) {
                if (!h.isPlaceholder) continue;
                const rows = placeholderRows.get(h.column.id) ?? [];
                rows.push(r);
                placeholderRows.set(h.column.id, rows);
              }
            });
            const placementOf = (header: Header<T, unknown>, r: number): HeaderPlacement => {
              const above = placeholderRows.get(header.column.id) ?? [];
              // Walk up while the row directly above is a placeholder of ours.
              let top = r;
              while (above.includes(top - 1)) top -= 1;
              return { row: top, rowSpan: r - top + 1 };
            };
            // A placeholder is absorbed when the real header below it will span
            // its row; one that is not (never, in TanStack's layout, but the
            // fallback keeps the grid intact) renders as an empty cell.
            const absorbed = (header: Header<T, unknown>, r: number): boolean => {
              if (!header.isPlaceholder) return false;
              for (let k = r + 1; k < headerGroups.length; k++) {
                const real = headerGroups[k]?.headers.find(
                  (h) => h.column.id === header.column.id && !h.isPlaceholder,
                );
                if (real) return placementOf(real, k).row <= r;
                const stillPlaceholder = headerGroups[k]?.headers.some(
                  (h) => h.column.id === header.column.id && h.isPlaceholder,
                );
                if (!stillPlaceholder) return false;
              }
              return false;
            };
            const headerRows = (
              <div ref={headerRowRef} className={styles.headerBlock} role="rowgroup">
                {/* Corner cell over the row-number gutter: one cell across every
                    header row, so the select-all target is the whole corner. */}
                {rowNumbers && (
                  <div
                    role="columnheader"
                    aria-label="Select all cells"
                    className={styles.cornerCell}
                    style={{ gridColumn: 1, gridRow: `1 / span ${headerGroups.length}` }}
                    data-frozen-edge={frozenCount === 0 || undefined}
                    onPointerDown={(e) => {
                      if (e.button === 0) selectAll();
                    }}
                  />
                )}
                {headerGroups.map((hg, hgIndex) => (
                  <div key={hg.id} className={styles.headerRow} role="row">
                    {hg.headers.map((header) => {
                      if (absorbed(header, hgIndex)) return null;
                      const place = header.isPlaceholder
                        ? { row: hgIndex, rowSpan: 1 }
                        : placementOf(header, hgIndex);
                      const isLeaf = header.subHeaders.length === 0 && !header.isPlaceholder;
                      return reorderableColumns && isLeaf ? (
                        <SortableHeaderCell
                          key={header.id}
                          // Namespaced in own-context mode too: one code path, and
                          // ids stay collision-free if a provider appears later.
                          id={sortableId(header.column.id)}
                          regionId={shared ? regionId : undefined}
                          data={{ columnId: header.column.id }}
                          render={(dnd) => renderHeaderCell(header, place, dnd)}
                        />
                      ) : (
                        renderHeaderCell(header, place)
                      );
                    })}
                  </div>
                ))}
              </div>
            );
            if (!reorderableColumns) return headerRows;
            const sortable = (
              <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                {headerRows}
              </SortableContext>
            );
            // Under a shared provider the DndContext + DragOverlay are the
            // provider's; here render only the SortableContext.
            if (shared) return sortable;
            return (
              <DndContext
                sensors={reorderSensors}
                onDragStart={onColumnDragStart}
                onDragEnd={onColumnDragEnd}
                onDragCancel={() => setDraggingColId(null)}
              >
                {sortable}
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
                    <div
                      key={row.id}
                      role="row"
                      className={styles.row}
                      style={{ height: rowHeight }}
                    >
                      {rowNumberHandlers && (
                        <RowNumberCell
                          displayIndex={rowIndex}
                          selected={
                            fullWidthRange &&
                            selection.range != null &&
                            rowIndex >= selection.range.start.row &&
                            rowIndex <= selection.range.end.row
                          }
                          frozenEdge={frozenCount === 0}
                          onPointerDown={rowNumberHandlers.onPointerDown}
                          onPointerEnter={rowNumberHandlers.onPointerEnter}
                        />
                      )}
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
                // In fill mode the `.content` wrapper (sized by the header's
                // `max-content`) pins the body width, so the virtualized body,
                // whose absolutely-positioned rows establish no `max-content`,
                // aligns with the header for free. Outside fill mode keep the
                // measured `contentWidth`.
                minWidth: fillOn ? undefined : (contentWidth ?? undefined),
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
                    {rowNumberHandlers && (
                      <RowNumberCell
                        displayIndex={vr.index}
                        selected={
                          fullWidthRange &&
                          selection.range != null &&
                          vr.index >= selection.range.start.row &&
                          vr.index <= selection.range.end.row
                        }
                        frozenEdge={frozenCount === 0}
                        onPointerDown={rowNumberHandlers.onPointerDown}
                        onPointerEnter={rowNumberHandlers.onPointerEnter}
                      />
                    )}
                    {row
                      .getVisibleCells()
                      .map((_, colIndex) => renderCell(row, vr.index, colIndex))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
