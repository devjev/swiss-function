/** TableInput — a compact, editable table as a form control, for entering an
 *  array of objects (one row per object). Each column names a property on the
 *  row and picks a cell editor via the same `edit` config DataTable uses
 *  (text / number / boolean / select / date). Rows are added and removed with
 *  icon buttons, and can be dragged to reorder. Drop it inside a `Field` like
 *  any other control.
 *
 *  Controlled only: pass `value` (the rows) and `onChange` (the next rows).
 */

import type { HTMLAttributes, ReactNode } from "react";
import { lazy, Suspense, useMemo } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import type { EditConfig } from "../DataTable";
import { DatePicker } from "../DatePicker";
import { DigitInputMicro } from "../DigitInputMicro";
import { Plus, Trash } from "../Icon";
import { Picker } from "../Picker";
import { TextEditInline } from "../TextEditInline";
import styles from "./TableInput.module.css";

/** Reorderable rows pull in dnd-kit; load that only when asked. */
const SortableRows = lazy(() => import("./SortableRows"));

export type TableInputSize = "sm" | "md";

export interface TableInputColumn<T = Record<string, unknown>> {
  /** The row property this column reads and writes. */
  key: keyof T & string;
  /** Column heading. Defaults to the key. */
  header?: ReactNode;
  /** Which cell editor to use (the DataTable `edit` config). */
  edit: EditConfig;
  /** Preferred column width in `--sf-unit` multiples. Omit to share the slack.
   *  The column may still shrink toward its `minWidth` so the table fits. */
  width?: number;
  /** Minimum column width in `--sf-unit` multiples: the column never shrinks
   *  below this. Once every column is at its minimum and they still don't fit,
   *  the table scrolls horizontally instead of collapsing. Defaults to a
   *  per-editor floor (checkbox/number are narrow, text/select/date use
   *  `minColumnWidth`), capped at `width`. */
  minWidth?: number;
  /** Cell text alignment. Default `"start"`. */
  align?: "start" | "center" | "end";
}

export interface TableInputProps<T = Record<string, unknown>>
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Column definitions: which properties to edit and how. */
  columns: TableInputColumn<T>[];
  /** The rows (controlled). */
  value: T[];
  /** Called with the next rows after any edit, add, delete or reorder. */
  onChange: (rows: T[]) => void;
  /** Build a blank row when "add" is pressed. Defaults to empty cells derived
   *  from each column's edit type ("" / null / false). */
  newRow?: () => T;
  /** Show the header row. Default `true`. */
  showHeader?: boolean;
  /** Minimum row count: the delete button is disabled at or below it. Default 0. */
  minRows?: number;
  /** Maximum row count: the add button is disabled at or above it. */
  maxRows?: number;
  /** Give every data column an equal share of the width, ignoring per-column
   *  `width`. Default `false` (a `width` is the preferred size, a width-less
   *  column flexes). */
  equalColumns?: boolean;
  /** Default minimum width (in `--sf-unit` multiples) for text/select/date
   *  columns that don't set their own `minWidth`. The table scrolls
   *  horizontally once the columns can't all fit at their minimums, rather than
   *  letting them collapse and overlap. Default `6`. */
  minColumnWidth?: number;
  /** Let rows be dragged to reorder (loads dnd-kit lazily). Default `false`. */
  reorderable?: boolean;
  /** Add-button label. Default `"Add row"`. */
  addLabel?: ReactNode;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Cell size, mirroring the inner controls. Default `"sm"` (tight). */
  size?: TableInputSize;
}

/** The empty value a fresh cell holds, by editor type. */
function emptyCell(config: EditConfig): unknown {
  switch (config.type) {
    case "number":
    case "date":
      return null;
    case "boolean":
      return false;
    default:
      return "";
  }
}

/** A number reads right-aligned by default so decimals line up; other types read
 *  from the start. An explicit `align` on the column always wins. */
function alignFor<T>(column: TableInputColumn<T>): "start" | "center" | "end" {
  return column.align ?? (column.edit.type === "number" ? "end" : "start");
}

/** One always-on cell editor, chosen by the column's edit config. */
function Cell({
  config,
  value,
  onChange,
  size,
  align,
}: {
  config: EditConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  size: TableInputSize;
  align: "start" | "center" | "end";
}) {
  switch (config.type) {
    case "number":
      return (
        <DigitInputMicro
          className={styles.control}
          size={size}
          align={align === "end" ? "end" : "start"}
          value={(value as number | null) ?? null}
          onValueChange={onChange}
          decimals={config.decimals}
          slots={config.slots}
          unit={config.unit}
        />
      );
    case "boolean":
      return <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />;
    case "select":
      return (
        <Picker
          className={styles.control}
          size={size}
          items={config.options}
          value={(value as string) ?? ""}
          onChange={onChange}
        />
      );
    case "date":
      return (
        <DatePicker
          className={styles.control}
          size={size}
          value={(value as Date | null) ?? null}
          onChange={onChange}
          minDate={config.minDate}
          maxDate={config.maxDate}
        />
      );
    default:
      return (
        <TextEditInline
          className={styles.control}
          size={size}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

/** A row's cells + its trailing delete button. Shared by the plain and the
 *  sortable row so the two render identically. `lead` is the drag handle slot
 *  (null when not reorderable). */
function RowCells<T>({
  row,
  rowIndex,
  columns,
  size,
  lead,
  onCell,
  onDelete,
  canDelete,
}: {
  row: T;
  rowIndex: number;
  columns: TableInputColumn<T>[];
  size: TableInputSize;
  lead?: ReactNode;
  onCell: (rowIndex: number, key: string, value: unknown) => void;
  onDelete: (rowIndex: number) => void;
  canDelete: boolean;
}) {
  return (
    <>
      {lead}
      {columns.map((column) => (
        <div
          key={column.key}
          className={styles.cell}
          data-align={alignFor(column)}
          data-type={column.edit.type}
        >
          <Cell
            config={column.edit}
            value={(row as Record<string, unknown>)[column.key]}
            onChange={(value) => onCell(rowIndex, column.key, value)}
            size={size}
            align={alignFor(column)}
          />
        </div>
      ))}
      <div className={cx(styles.cell, styles.actionCell)}>
        <Button
          type="button"
          variant="ghost"
          size={size}
          tight
          elevation={0}
          aria-label="Delete row"
          disabled={!canDelete}
          onClick={() => onDelete(rowIndex)}
        >
          <Trash />
        </Button>
      </div>
    </>
  );
}

export function TableInput<T = Record<string, unknown>>({
  columns,
  value,
  onChange,
  newRow,
  showHeader = true,
  minRows = 0,
  maxRows = Number.POSITIVE_INFINITY,
  equalColumns = false,
  minColumnWidth = 6,
  reorderable = false,
  addLabel = "Add row",
  disabled = false,
  size = "sm",
  className,
  style,
  ...rest
}: TableInputProps<T>) {
  // The grid columns are shared by the header and every row (subgrid), so the
  // cells line up like a table: [handle?] data… [delete]. Each data column is
  // `minmax(floor, preferred)`: it shrinks toward its floor to fit, and once
  // every column is at its floor and they still don't fit, the root scrolls
  // horizontally (see the CSS) instead of collapsing columns into each other.
  const gridTemplate = useMemo(() => {
    const u = (n: number) => `calc(var(--sf-unit) * ${n})`;
    const floorFor = (c: TableInputColumn<T>) => {
      if (c.minWidth != null) return Math.min(c.minWidth, c.width ?? c.minWidth);
      // Narrow controls (checkbox, micro number) get a tight floor; the rest use
      // minColumnWidth. Never exceed a set preferred width.
      const base =
        c.edit.type === "boolean"
          ? 2.5
          : c.edit.type === "number"
            ? 4
            : c.edit.type === "date"
              ? 7
              : minColumnWidth;
      return c.width != null ? Math.min(base, c.width) : base;
    };
    const tracks = [
      reorderable ? "auto" : null,
      ...columns.map((c) => {
        const preferred = equalColumns || c.width == null ? "1fr" : u(c.width);
        return `minmax(${u(floorFor(c))}, ${preferred})`;
      }),
      "auto",
    ].filter(Boolean);
    return tracks.join(" ");
  }, [columns, reorderable, equalColumns, minColumnWidth]);

  const makeRow = (): T => {
    if (newRow) return newRow();
    const row: Record<string, unknown> = {};
    for (const column of columns) row[column.key] = emptyCell(column.edit);
    return row as T;
  };

  const setCell = (rowIndex: number, key: string, cellValue: unknown) => {
    onChange(
      value.map((row, i) =>
        i === rowIndex ? { ...(row as Record<string, unknown>), [key]: cellValue } : row,
      ) as T[],
    );
  };

  const addRow = () => {
    if (value.length >= maxRows) return;
    onChange([...value, makeRow()]);
  };

  const deleteRow = (rowIndex: number) => {
    if (value.length <= minRows) return;
    onChange(value.filter((_, i) => i !== rowIndex));
  };

  const canDelete = value.length > minRows;
  const canAdd = value.length < maxRows;

  const rowProps = {
    columns,
    size,
    onCell: setCell,
    onDelete: deleteRow,
    canDelete,
  };

  return (
    // A plain grid container. It takes a consumer `role`/`aria-label` via
    // ...rest; a <fieldset> can't be the subgrid container this layout needs.
    <div
      {...rest}
      className={cx(styles.root, className)}
      style={{ ...style, gridTemplateColumns: gridTemplate }}
      data-disabled={disabled || undefined}
    >
      {showHeader ? (
        <div className={styles.headerRow}>
          {reorderable ? <div className={cx(styles.headerCell, styles.handleCell)} /> : null}
          {columns.map((column) => (
            <div
              key={column.key}
              className={styles.headerCell}
              data-align={alignFor(column)}
              title={typeof column.header === "string" ? column.header : column.key}
            >
              {column.header ?? column.key}
            </div>
          ))}
          <div className={cx(styles.headerCell, styles.actionCell)} />
        </div>
      ) : null}

      {/* The rows subtree is `inert` when disabled: non-focusable and
          non-interactive across every editor type, in one place. */}
      <div className={styles.body} inert={disabled || undefined}>
        {reorderable ? (
          <Suspense
            fallback={value.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
              <div className={styles.row} key={rowIndex}>
                <RowCells
                  row={row}
                  rowIndex={rowIndex}
                  lead={<div className={styles.handleCell} />}
                  {...rowProps}
                />
              </div>
            ))}
          >
            <SortableRows
              rows={value}
              onReorder={onChange as (rows: unknown[]) => void}
              rowClassName={styles.row}
              handleClassName={styles.handle}
            >
              {(row, rowIndex, handle) => (
                <RowCells row={row as T} rowIndex={rowIndex} lead={handle} {...rowProps} />
              )}
            </SortableRows>
          </Suspense>
        ) : (
          value.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <div className={styles.row} key={rowIndex}>
              <RowCells row={row} rowIndex={rowIndex} {...rowProps} />
            </div>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <Button
          type="button"
          variant="ghost"
          size={size}
          tight
          elevation={0}
          disabled={disabled || !canAdd}
          onClick={addRow}
        >
          <Plus />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
