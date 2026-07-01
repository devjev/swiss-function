import type { ColumnFiltersState } from "@tanstack/react-table";
import type { HTMLAttributes, ReactNode } from "react";
import type { EffectName } from "../../lib/effects";
import type { FilterOption } from "../../lib/filter/ColumnFilter";

export type ExplorerNode<M = unknown> = {
  id: string;
  name: string;
  /** Folder iff `children` is defined (even empty []). File if undefined. */
  children?: ExplorerNode<M>[];
  /** User payload, addressable by columns. */
  meta?: M;
};

export interface ExplorerColumn<M = unknown> {
  id: string;
  header: string;
  /** Read a value from the node. Default reads `node.meta[id]`. */
  accessor?: (node: ExplorerNode<M>) => unknown;
  /** Override how the cell renders. Receives the node. */
  render?: (node: ExplorerNode<M>) => ReactNode;
  /** CSS grid track value for this column. Default "auto". */
  width?: number | string;
  /** Cell text alignment. Default "start". */
  align?: "start" | "end";

  // --- Resizing (only when Explorer's `resizableColumns` is on) ---
  /** Lower bound in px the column can be dragged to. Default 48. */
  minWidth?: number;
  /** Allow this column to be drag-resized. Default true; set false to lock. */
  resizable?: boolean;

  // --- Sorting (only when the column opts in) ---
  /** Click the header to sort each sibling group by this column. */
  sortable?: boolean;
  /** How to compare values when sorting. Inferred from the data if omitted. */
  sortType?: "string" | "number" | "date";
  /** Full override of the sort comparison (asc order); wins over `sortType`. */
  sortComparator?: (a: ExplorerNode<M>, b: ExplorerNode<M>) => number;

  // --- Filtering (only when Explorer's `filterableColumns` is on) ---
  /** Show a filter funnel for this column. Default true when filtering is on. */
  filterable?: boolean;
  /** Force the filter UI kind and (for checklist) its options, skipping
   *  inference from the column's values. */
  filter?: { kind: "checklist" | "range"; options?: FilterOption[] };
}

/** Active sort: a column id and direction. `null` means unsorted. */
export type ExplorerSort = { columnId: string; dir: "asc" | "desc" };

/** Dither filler for the space to the right of fixed-width columns. Mirrors
 *  DataTable's `columnFill`. A no-op when the last column already stretches
 *  (the default), so it only bites when every column declares a fixed `width`. */
export type ExplorerColumnFill =
  | boolean
  | {
      animated?: boolean;
      effect?: EffectName;
      color?: string;
      density?: number;
      speed?: number;
    };

export interface ExplorerProps<M = unknown>
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  nodes: ExplorerNode<M>[];
  /** First column auto-becomes the tree column (chevron + indent + name). */
  columns: ExplorerColumn<M>[];

  // --- Controlled state (Explorer owns nothing internal except keyboard cursor) ---
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  expandedIds?: Set<string>;
  onExpandedChange?: (ids: Set<string>) => void;
  editingId?: string | null;
  onEditingChange?: (id: string | null) => void;

  // --- Edit mode ---
  editable?: boolean;
  onRename?: (id: string, newName: string) => void;
  onAdd?: (parentId: string | null, kind: "file" | "folder") => void;
  onMove?: (id: string, newParentId: string | null, beforeId?: string | null) => void;
  onDelete?: (ids: string[]) => void;

  // --- Column resizing ---
  /** Enable drag-to-resize on column borders. Default false (the plain file-tree
   *  use doesn't want handles). Widths are raw px overrides, keyed by column id. */
  resizableColumns?: boolean;
  columnWidths?: Record<string, number>;
  defaultColumnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;

  // --- Column reordering ---
  /** Enable drag-to-reorder on metadata column headers. Default false. The tree
   *  column is pinned at index 0; `columnOrder` lists only the non-tree ids. */
  reorderableColumns?: boolean;
  columnOrder?: string[];
  defaultColumnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;

  // --- Sorting ---
  /** Controlled sort; pass with `onSortChange`. `null` = unsorted. */
  sort?: ExplorerSort | null;
  defaultSort?: ExplorerSort | null;
  onSortChange?: (sort: ExplorerSort | null) => void;
  /** Keep folders above files within each sibling group when sorting.
   *  Default true (the file-explorer convention). */
  sortFoldersFirst?: boolean;

  // --- Filtering ---
  /** Show per-column filter funnels. Default false. */
  filterableColumns?: boolean;
  columnFilters?: ColumnFiltersState;
  defaultColumnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;

  /** Override the default folder/file glyph for a node. */
  icon?: (node: ExplorerNode<M>) => ReactNode;

  /** Show the column-header row. Default true. Set false for plain
   *  file-tree usage where the header would just be visual noise. */
  showHeader?: boolean;

  /** Shown in place of the rows when there are no nodes (or a filter pruned
   *  everything). Default "No data". */
  empty?: ReactNode;

  /** Dithered fade at the bottom scroll edge, signalling more rows below.
   *  `true` for defaults, or tune `rows` (fade height) / `density`. */
  edgeFade?: boolean | { rows?: number; density?: number };

  /** Dither filler for space right of fixed-width columns. See
   *  {@link ExplorerColumnFill}. */
  columnFill?: ExplorerColumnFill;

  /** Row height in px. Default 32 (≈ unit * 4/3). */
  rowHeight?: number;
  /** Viewport height. Default `"100%"` — fills the parent (the common case
   *  in a real app layout). Pass a number for pixels (`height={500}`) or a
   *  CSS string for a cap (`height="60vh"`). */
  height?: number | string;
}

export function isFolder<M>(node: ExplorerNode<M>): boolean {
  return Array.isArray(node.children);
}
