import { useCallback } from "react";
import type { Cell, CellChange, CellRange, EditConfig, LeafColumnDef, Selection } from "./types";

interface UseTableClipboardParams<T> {
  editable: boolean;
  data: T[];
  /** Visible leaf columns in display order — groups already flattened. */
  columns: LeafColumnDef<T>[];
  selection: Selection;
  onCellChange?: (changes: CellChange[]) => void;
  getCellValue: (rowIndex: number, columnIndex: number) => unknown;
}

function coerce(raw: string, edit: EditConfig): unknown | typeof SKIP {
  switch (edit.type) {
    case "text":
      return raw;
    case "number": {
      const n = Number(raw);
      return Number.isNaN(n) ? SKIP : n;
    }
    case "boolean": {
      const lower = raw.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(lower)) return true;
      if (["false", "0", "no", "n", ""].includes(lower)) return false;
      return SKIP;
    }
    case "select":
      return edit.options.some((o) => o.value === raw) ? raw : SKIP;
  }
}

const SKIP = Symbol("skip");

function serializeSelection(
  range: CellRange | null,
  active: Cell | null,
  getCellValue: (r: number, c: number) => unknown,
): string {
  const r = range ?? (active ? { start: active, end: active } : null);
  if (!r) return "";
  const lines: string[] = [];
  for (let row = r.start.row; row <= r.end.row; row++) {
    const cells: string[] = [];
    for (let col = r.start.col; col <= r.end.col; col++) {
      const v = getCellValue(row, col);
      const s = v == null ? "" : String(v);
      // Escape tabs/newlines minimally to keep the TSV grid intact.
      cells.push(s.replace(/[\t\n\r]/g, " "));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

export function useTableClipboard<T>({
  editable,
  data,
  columns,
  selection,
  onCellChange,
  getCellValue,
}: UseTableClipboardParams<T>) {
  const handleCopy = useCallback(
    async (ev: KeyboardEvent): Promise<boolean> => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "c") return false;
      if (!selection.active && !selection.range) return false;
      const tsv = serializeSelection(selection.range, selection.active, getCellValue);
      try {
        await navigator.clipboard.writeText(tsv);
      } catch {
        // Permission denied or unsupported — silently fail.
      }
      return true;
    },
    [selection, getCellValue],
  );

  const handlePaste = useCallback(
    async (ev: KeyboardEvent): Promise<boolean> => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "v") return false;
      if (!editable || !selection.active) return false;

      let text = "";
      try {
        text = await navigator.clipboard.readText();
      } catch {
        return false;
      }
      if (!text) return false;

      const rows = text.split(/\r?\n/);
      // Drop trailing empty line that many clipboards include.
      if (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();

      const startRow = selection.active.row;
      const startCol = selection.active.col;
      const changes: CellChange[] = [];

      rows.forEach((line, r) => {
        const cells = line.split("\t");
        cells.forEach((raw, c) => {
          const rowIdx = startRow + r;
          const colIdx = startCol + c;
          if (rowIdx >= data.length || colIdx >= columns.length) return;
          const col = columns[colIdx];
          if (!col?.edit) return;
          const coerced = coerce(raw, col.edit);
          if (coerced === SKIP) return;
          changes.push({ rowIndex: rowIdx, columnId: col.id, value: coerced });
        });
      });

      if (changes.length > 0) onCellChange?.(changes);
      return true;
    },
    [editable, selection.active, data.length, columns, onCellChange],
  );

  return { handleCopy, handlePaste };
}
