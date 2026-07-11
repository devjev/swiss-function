import { useMemo } from "react";
import { DataTable, type LeafColumnDef } from "../DataTable";
import styles from "./Notebook.module.css";

/** Default tabular result rendering: a DataTable over materialized rows with
 *  a height bounded by the row count, so small results stay compact and big
 *  ones scroll inside the cell instead of stretching the page. */
export function ArrowResultTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  const defs = useMemo<LeafColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((name) => ({
        id: name,
        header: name,
        accessor: name,
        cell: ({ value }) =>
          value instanceof Date
            ? value.toISOString().slice(0, 19).replace("T", " ")
            : String(value ?? ""),
      })),
    [columns],
  );
  const units = Math.min(22, 3.5 + rows.length * 2);
  return (
    <div
      className={styles.resultTable}
      style={{ height: `calc(var(--sf-unit) * ${units})` }}
      data-testid="notebook-result-table"
      data-rows={rows.length}
    >
      <DataTable data={rows} columns={defs} />
    </div>
  );
}
