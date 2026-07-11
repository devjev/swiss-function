/**
 * Spike version of the fromArrow boundary (milestone findings: Arrow rows are
 * proxies, timestamps are epoch numbers, DuckDB aggregates return BigInt /
 * HUGEINT). Converts an Arrow-shaped table to plain row objects that sf's
 * DataTable can take, coercing temporal columns to Date and BigInt to number.
 * Typed structurally so nothing here depends on apache-arrow.
 */

export interface ArrowFieldLike {
  name: string;
  type?: {toString?: () => string};
}

export interface ArrowTableLike {
  schema: {fields: ArrowFieldLike[]};
  numRows: number;
  toArray: () => Array<{toJSON?: () => Record<string, unknown>}>;
}

export function isArrowTableLike(value: unknown): value is ArrowTableLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "schema" in value &&
    "numRows" in value &&
    typeof (value as ArrowTableLike).toArray === "function"
  );
}

const TEMPORAL = /^(Timestamp|Date)/i;

export function fromArrow(table: ArrowTableLike): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const columns = table.schema.fields.map((f) => f.name);
  const temporal = new Set(
    table.schema.fields.filter((f) => TEMPORAL.test(f.type?.toString?.() ?? "")).map((f) => f.name)
  );
  const rows = table.toArray().map((proxy) => {
    const raw: Record<string, unknown> =
      typeof proxy.toJSON === "function" ? proxy.toJSON() : {...(proxy as Record<string, unknown>)};
    for (const key of columns) {
      const value = raw[key];
      if (typeof value === "bigint") {
        raw[key] = Number(value);
      } else if (temporal.has(key) && typeof value === "number") {
        raw[key] = new Date(value);
      }
    }
    return raw;
  });
  return {columns, rows};
}
