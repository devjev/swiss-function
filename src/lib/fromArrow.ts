/**
 * Convert an Arrow-shaped query result (e.g. a DuckDB-WASM table) into the
 * plain `{ columns, rows }` shape sf components such as DataTable consume.
 *
 * Arrow tables can't be handed to the UI directly, for three reasons this
 * module exists to absorb:
 *
 * - `toArray()` yields per-row proxy objects whose data is only reliably
 *   reachable through `toJSON()`. Rows without a `toJSON` method are
 *   shallow-spread instead.
 * - Temporal columns surface as epoch-milliseconds numbers. Coercion to real
 *   `Date` objects is schema-driven: a field whose type's `toString()` starts
 *   with `Timestamp`, `Date` (covers `Date32`/`Date64`) or `Datetime` —
 *   case-insensitive — is treated as temporal. `options.dates` force-includes
 *   columns the schema doesn't mark (e.g. an epoch stored as a plain number).
 * - DuckDB aggregates surface as `bigint` (HUGEINT/int128; DECIMAL types may
 *   too), and `JSON.stringify` throws on BigInt. Policy: a BigInt whose
 *   absolute value fits `Number.MAX_SAFE_INTEGER` always becomes a `number`;
 *   larger values follow `options.bigints` — `"string"` (default; exact
 *   decimal string), `"number"` (lossy `Number()` conversion), or `"throw"`
 *   (a descriptive `RangeError`).
 *
 * `null` / `undefined` cell values pass through untouched. Typed structurally
 * (`ArrowTableLike`) so nothing here imports apache-arrow — zero dependencies.
 */

export interface ArrowFieldLike {
  name: string;
  type?: { toString?: () => string };
}

export interface ArrowTableLike {
  schema: { fields: ArrowFieldLike[] };
  numRows: number;
  toArray: () => Array<{ toJSON?: () => Record<string, unknown> }>;
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

/** How to coerce a BigInt that doesn't fit the safe integer range. */
export type FromArrowBigIntPolicy = "string" | "number" | "throw";

export interface FromArrowOptions {
  /** Columns to coerce to `Date` even when the schema type isn't temporal. */
  dates?: string[];
  /** Policy for BigInt values beyond `Number.MAX_SAFE_INTEGER`. Default `"string"`. */
  bigints?: FromArrowBigIntPolicy;
}

export interface FromArrowResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

const TEMPORAL = /^(timestamp|datetime|date)/i;

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = -MAX_SAFE;

function coerceBigInt(
  value: bigint,
  column: string,
  policy: FromArrowBigIntPolicy,
): number | string {
  if (value >= MIN_SAFE && value <= MAX_SAFE) return Number(value);
  switch (policy) {
    case "number":
      return Number(value);
    case "throw":
      throw new RangeError(
        `fromArrow: BigInt ${value} in column "${column}" exceeds Number.MAX_SAFE_INTEGER; ` +
          `set options.bigints to "string" (exact decimal string) or "number" (lossy) to coerce it`,
      );
    default:
      return value.toString();
  }
}

export function fromArrow(table: ArrowTableLike, options?: FromArrowOptions): FromArrowResult {
  const bigints = options?.bigints ?? "string";
  const columns = table.schema.fields.map((f) => f.name);
  const temporal = new Set(options?.dates ?? []);
  for (const field of table.schema.fields) {
    if (TEMPORAL.test(field.type?.toString?.() ?? "")) temporal.add(field.name);
  }
  const rows = table.toArray().map((proxy) => {
    const raw: Record<string, unknown> =
      typeof proxy.toJSON === "function"
        ? proxy.toJSON()
        : { ...(proxy as Record<string, unknown>) };
    for (const key of columns) {
      const value = raw[key];
      let next = value;
      if (typeof next === "bigint") next = coerceBigInt(next, key, bigints);
      if (temporal.has(key) && typeof next === "number") next = new Date(next);
      if (next !== value) raw[key] = next;
    }
    return raw;
  });
  return { columns, rows };
}
