/** Default tabular result rendering: sf DataTable over materialized rows. */
import {DataTable} from "@tarassov-ch/swiss-function/data-table";
import {useMemo} from "react";

export function ResultTable({columns, rows}: {columns: string[]; rows: Record<string, unknown>[]}) {
  const defs = useMemo(
    () =>
      columns.map((name) => ({
        id: name,
        header: name,
        accessor: name,
        cell:
          name === "ts" || rows.some((r) => r[name] instanceof Date)
            ? ({value}: {value: unknown}) =>
                value instanceof Date ? value.toISOString().slice(0, 19).replace("T", " ") : String(value ?? "")
            : undefined,
      })),
    [columns, rows]
  );
  const height = Math.min(22, 3 + rows.length * 2);
  return (
    <div style={{height: `calc(var(--sf-unit) * ${height})`}} data-testid="result-table" data-rows={rows.length}>
      <DataTable data={rows} columns={defs} />
    </div>
  );
}
