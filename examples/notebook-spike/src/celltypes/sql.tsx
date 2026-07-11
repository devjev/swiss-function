/**
 * The SQL cell type factory: the flagship engine adapter. The executor is
 * injected by the host app (DuckDB-WASM here, anything elsewhere); this file
 * owns the ${name} reference syntax, interpolation, and result rendering.
 */
import {sql as sqlLang} from "@codemirror/lang-sql";
import type {CellType} from "../contract";
import {fromArrow, isArrowTableLike} from "../fromArrow";
import {ResultTable} from "../notebook/ResultTable";

export type SqlExecutor = (sql: string, signal: AbortSignal) => Promise<unknown>;

/** `${name}` references, skipped inside '…' strings and -- / block comments. */
export function findSqlDependencies(source: string): string[] {
  const names = new Set<string>();
  const stripped = source
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of stripped.matchAll(/\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g)) {
    names.add(match[1] as string);
  }
  return [...names];
}

/** Inline a dependency value into SQL text: scalars and IN-lists only (spike scope). */
function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `TIMESTAMP '${value.toISOString().replace("T", " ").slice(0, 23)}'`;
  if (Array.isArray(value)) return `(${value.map(literal).join(", ")})`;
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  throw new Error(`cannot interpolate a ${typeof value} into SQL (tables are not interpolable in the spike)`);
}

export function interpolateSql(source: string, inputs: Record<string, unknown>): string {
  return source.replace(/\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, (_, name: string) => literal(inputs[name]));
}

export function createSqlCellType(executor: SqlExecutor): CellType {
  return {
    type: "sql",
    label: "SQL",
    editorExtensions: () => [sqlLang()],
    findDependencies: (source) => findSqlDependencies(source),
    execute: async ({source, inputs, signal}) => executor(interpolateSql(source, inputs), signal),
    renderResult: (value) => {
      if (isArrowTableLike(value)) {
        const {columns, rows} = fromArrow(value);
        return <ResultTable columns={columns} rows={rows} />;
      }
      return <code>{String(value)}</code>;
    },
  };
}
