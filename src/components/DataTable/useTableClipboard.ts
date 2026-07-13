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
  /** Prepend the selected columns' header names as the first copied row. */
  copyWithHeaders: boolean;
}

/** A column's header as plain clipboard text: the string header, else its id
 *  (a non-string ReactNode header can't be serialized, so the id stands in). */
function headerText<T>(col: LeafColumnDef<T> | undefined): string {
  if (!col) return "";
  return typeof col.header === "string" ? col.header : col.id;
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

/** Minimal escape so tabs/newlines in a value don't break the TSV grid. */
function clean(s: string): string {
  return s.replace(/[\t\n\r]/g, " ");
}

/** Serialize the selected cell rectangle as TSV. When `getHeader` is given, the
 *  selected columns' header names are prepended as the first row. Exported for
 *  unit testing. */
export function serializeSelection(
  range: CellRange | null,
  active: Cell | null,
  getCellValue: (r: number, c: number) => unknown,
  getHeader?: (col: number) => string,
): string {
  const r = range ?? (active ? { start: active, end: active } : null);
  if (!r) return "";
  const lines: string[] = [];
  if (getHeader) {
    const header: string[] = [];
    for (let col = r.start.col; col <= r.end.col; col++) header.push(clean(getHeader(col)));
    lines.push(header.join("\t"));
  }
  for (let row = r.start.row; row <= r.end.row; row++) {
    const cells: string[] = [];
    for (let col = r.start.col; col <= r.end.col; col++) {
      const v = getCellValue(row, col);
      cells.push(clean(v == null ? "" : String(v)));
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
  copyWithHeaders,
}: UseTableClipboardParams<T>) {
  const handleCopy = useCallback(
    async (ev: KeyboardEvent): Promise<boolean> => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "c") return false;
      if (!selection.active && !selection.range) return false;
      const getHeader = copyWithHeaders ? (col: number) => headerText(columns[col]) : undefined;
      const tsv = serializeSelection(selection.range, selection.active, getCellValue, getHeader);
      try {
        await navigator.clipboard.writeText(tsv);
      } catch {
        // Permission denied or unsupported — silently fail.
      }
      return true;
    },
    [selection, getCellValue, copyWithHeaders, columns],
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
