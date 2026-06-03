import { useCallback, useState } from "react";
import type { Cell, CellChange, LeafColumnDef } from "./types";

interface UseTableEditParams<T> {
  editable: boolean;
  /** Visible leaf columns in display order — groups already flattened. */
  columns: LeafColumnDef<T>[];
  onCellChange?: (changes: CellChange[]) => void;
}

interface EditingState {
  cell: Cell;
  initialText?: string;
}

export function useTableEdit<T>({ editable, columns, onCellChange }: UseTableEditParams<T>) {
  const [editing, setEditing] = useState<EditingState | null>(null);

  const isColumnEditable = useCallback(
    (col: number): boolean => Boolean(editable && columns[col]?.edit),
    [editable, columns],
  );

  const startEdit = useCallback(
    (cell: Cell, initialText?: string) => {
      if (!isColumnEditable(cell.col)) return;
      setEditing({ cell, initialText });
    },
    [isColumnEditable],
  );

  const cancelEdit = useCallback(() => setEditing(null), []);

  const commitEdit = useCallback(
    (value: unknown) => {
      if (!editing) return;
      const col = columns[editing.cell.col];
      if (!col) return;
      onCellChange?.([{ rowIndex: editing.cell.row, columnId: col.id, value }]);
      setEditing(null);
    },
    [editing, columns, onCellChange],
  );

  return {
    editing,
    isColumnEditable,
    startEdit,
    cancelEdit,
    commitEdit,
  };
}
