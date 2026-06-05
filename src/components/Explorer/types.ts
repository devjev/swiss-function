import type { HTMLAttributes, ReactNode } from "react";

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
}

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

  /** Override the default folder/file glyph for a node. */
  icon?: (node: ExplorerNode<M>) => ReactNode;

  /** Show the column-header row. Default true. Set false for plain
   *  file-tree usage where the header would just be visual noise. */
  showHeader?: boolean;

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
