import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { formatNumber } from "../../lib/format";
import { mergeRefs } from "../../lib/mergeRefs";
import styles from "./ChatTable.module.css";

export type ChatTableAlign = "start" | "center" | "end";

/** One cell's value. A number prints in Swiss format and ends its column. */
export type ChatTableValue = ReactNode;

export interface ChatTableColumn {
  /** The row property this column reads. */
  key: string;
  /** The heading. Default: the key. */
  label?: ReactNode;
  /** Default: `"end"` when every value in the column is a number, else
   *  `"start"`. */
  align?: ChatTableAlign;
  /** Print a value yourself (a unit, a date, a mark). */
  format?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

export interface ChatTableProps extends HTMLAttributes<HTMLDivElement> {
  columns: ChatTableColumn[];
  rows: Record<string, unknown>[];
  /** A line above the table; also its accessible name. */
  caption?: string;
}

function printCell(value: unknown): ReactNode {
  if (value == null) return "";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value as ReactNode;
}

/** A table in a chat transcript, drawn as a terminal draws one: monospace,
 *  one line per row, ruled like box drawing, the heading bold. It is a real
 *  `<table>`, so it selects, copies and reads as one. Numbers print in Swiss
 *  format and end their column. A table wider than the transcript scrolls
 *  inside itself: a figure is never cut. For sorting, selection or thousands
 *  of rows a host renders a `DataTable` (or a `TableWidget`) from `renderPart`
 *  instead. */
export const ChatTable = forwardRef<HTMLDivElement, ChatTableProps>(function ChatTable(
  { columns, rows, caption, className, ...rest },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // A region that scrolls must be reachable by keyboard, and only then.
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const aligns = columns.map((col) => {
    if (col.align) return col.align;
    let numeric = false;
    for (const row of rows) {
      const v = row[col.key];
      if (v == null) continue;
      if (typeof v !== "number") return "start";
      numeric = true;
    }
    return numeric ? "end" : "start";
  });

  return (
    <div
      ref={mergeRefs(ref, scrollRef)}
      {...rest}
      className={cx(styles.root, className)}
      {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": caption ?? "Table" } : null)}
    >
      <table className={styles.table}>
        {caption ? <caption className={styles.caption}>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col, c) => (
              <th key={col.key} scope="col" data-align={aligns[c]}>
                {col.label ?? col.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional data with no identity of their own.
            <tr key={r}>
              {columns.map((col, c) => (
                <td key={col.key} data-align={aligns[c]}>
                  {col.format ? col.format(row[col.key], row) : printCell(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
