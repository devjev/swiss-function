import { fromArrow, isArrowTableLike } from "../../lib/fromArrow";
import { Markdown } from "../Markdown";
import { ArrowResultTable } from "./ArrowResultTable";
import type { CellRunContext, CellType, SqlExecutor } from "./types";

/** Markdown prose, display-only: never enters the reactive graph. */
export const proseCellType: CellType = {
  type: "prose",
  label: "Prose",
  renderStatic: (source) => <Markdown value={source} measured />,
};

/** `${name}` references, skipped inside '…' strings and SQL comments. */
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

/** Inline a dependency value into SQL text. Scalars, Dates, and arrays
 *  (IN-lists) only — table values are not interpolable; aggregate upstream
 *  or restructure the query instead. */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date)
    return `TIMESTAMP '${value.toISOString().replace("T", " ").slice(0, 23)}'`;
  if (Array.isArray(value)) return `(${value.map(sqlLiteral).join(", ")})`;
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  throw new Error(
    `cannot interpolate a ${typeof value} into SQL — reference scalar cells, not table results`,
  );
}

export function interpolateSql(source: string, inputs: Record<string, unknown>): string {
  return source.replace(/\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, (_, name: string) =>
    sqlLiteral(inputs[name]),
  );
}

export interface SqlCellTypeOptions {
  /** The host app's engine (DuckDB-WASM or anything else). */
  executor: SqlExecutor;
  /** Editor language support, e.g. `() => [sql()]` from the
   *  consumer-installed `@codemirror/lang-sql`. Plain text without it. */
  extensions?: CellType["editorExtensions"];
}

/** The flagship engine adapter: SQL cells whose `${name}` interpolations
 *  reference other cells. The notebook never imports an engine — the
 *  executor is the seam. */
export function createSqlCellType({ executor, extensions }: SqlCellTypeOptions): CellType {
  return {
    type: "sql",
    label: "SQL",
    editorExtensions: extensions,
    findDependencies: (source) => findSqlDependencies(source),
    execute: async ({ source, inputs, signal }: CellRunContext) =>
      executor(interpolateSql(source, inputs), signal),
    renderResult: (value) => {
      if (isArrowTableLike(value)) {
        const { columns, rows } = fromArrow(value);
        return <ArrowResultTable columns={columns} rows={rows} />;
      }
      return <code>{String(value)}</code>;
    },
  };
}
