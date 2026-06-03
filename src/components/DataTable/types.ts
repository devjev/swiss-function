import type { ReactNode } from "react";

export type Cell = { row: number; col: number };

export type CellRange = { start: Cell; end: Cell };

export type Selection = {
  active: Cell | null;
  range: CellRange | null;
};

export type EditorType = "text" | "number" | "boolean" | "select";

export type SelectOption = { value: string; label: string };

export type EditConfig =
  | { type: "text" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "select"; options: SelectOption[] };

export type CellRenderProps<T> = {
  value: unknown;
  row: T;
  rowIndex: number;
};

/** A regular column that owns data. */
export interface LeafColumnDef<T> {
  id: string;
  header: string | ReactNode;
  accessor: keyof T | ((row: T) => unknown);
  /** Custom cell renderer; defaults to String(value). */
  cell?: (props: CellRenderProps<T>) => ReactNode;
  /** Column width in --sf-unit multiples. Omit for auto-sized fluid column. */
  width?: number;
  align?: "start" | "center" | "end";
  /** Per-column edit config. Omit to make column read-only even when table.editable. */
  edit?: EditConfig;
  /** Click header to sort. Default false. */
  sortable?: boolean;
}

/** A header that groups several columns. Has no data of its own. */
export interface GroupColumnDef<T> {
  id: string;
  header: string | ReactNode;
  /** Children — leaf or nested group. Presence makes this a group. */
  columns: ColumnDef<T>[];
  /** Initial state of the group on first mount. Default `false` (expanded). */
  defaultCollapsed?: boolean;
  /** Renderer for cells of the placeholder column when group is collapsed.
   *  Default `() => "—"`. */
  collapsedCell?: (props: { row: T; rowIndex: number }) => ReactNode;
}

export type ColumnDef<T> = LeafColumnDef<T> | GroupColumnDef<T>;

/** Type guard — true when the column is a header group. */
export function isGroup<T>(col: ColumnDef<T>): col is GroupColumnDef<T> {
  return "columns" in col && Array.isArray((col as GroupColumnDef<T>).columns);
}

export type CellChange = {
  rowIndex: number;
  columnId: string;
  value: unknown;
};

/** Where to move the active cell after an editor commits. */
export type AdvanceHint = "down" | "up" | "rightWrap" | "leftWrap";

export type PaginateConfig = {
  pageSize: number;
  /** Controlled page index. Omit for internal state. */
  pageIndex?: number;
  /** Called when user navigates pages (controlled mode). */
  onPageChange?: (pageIndex: number) => void;
  /** Total row count for server-side mode. Defaults to data.length. */
  totalRows?: number;
};

/** Expansion state for tree rows. Keyed by TanStack row id (e.g. "0.1.3"). */
export type ExpandedState = true | Record<string, boolean>;
