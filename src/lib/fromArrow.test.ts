import { describe, expect, it } from "vitest";
import { type ArrowTableLike, fromArrow, isArrowTableLike } from "./fromArrow";

interface FixtureField {
  name: string;
  /** The string the schema field's `type.toString()` returns; omit for a typeless field. */
  type?: string;
}

/**
 * Builds an ArrowTableLike from field descriptors + plain row data. By default
 * rows are proxy-like (data reachable only through `toJSON`, mirroring what
 * apache-arrow's `toArray()` yields); `proxyRows: false` yields bare objects.
 */
function makeTable(
  fields: FixtureField[],
  data: Record<string, unknown>[],
  { proxyRows = true }: { proxyRows?: boolean } = {},
): ArrowTableLike {
  return {
    schema: {
      fields: fields.map(({ name, type }) =>
        type === undefined ? { name } : { name, type: { toString: () => type } },
      ),
    },
    numRows: data.length,
    toArray: () =>
      data.map((row) =>
        proxyRows
          ? { toJSON: () => ({ ...row }) }
          : ({ ...row } as { toJSON?: () => Record<string, unknown> }),
      ),
  };
}

describe("isArrowTableLike", () => {
  it("accepts a table-shaped object", () => {
    expect(isArrowTableLike(makeTable([{ name: "a" }], []))).toBe(true);
  });

  it("rejects null, primitives, and objects missing the shape", () => {
    expect(isArrowTableLike(null)).toBe(false);
    expect(isArrowTableLike(42)).toBe(false);
    expect(isArrowTableLike({ schema: {}, numRows: 0 })).toBe(false);
    expect(isArrowTableLike({ schema: {}, numRows: 0, toArray: [] })).toBe(false);
  });
});

describe("fromArrow", () => {
  it("passes plain columns through untouched, including null values", () => {
    const table = makeTable(
      [
        { name: "id", type: "Int32" },
        { name: "label", type: "Utf8" },
      ],
      [
        { id: 1, label: "alpha" },
        { id: null, label: "beta" },
      ],
    );
    expect(fromArrow(table)).toEqual({
      columns: ["id", "label"],
      rows: [
        { id: 1, label: "alpha" },
        { id: null, label: "beta" },
      ],
    });
  });

  it("reads proxy rows through toJSON, not by spreading the proxy", () => {
    const table: ArrowTableLike = {
      schema: { fields: [{ name: "a" }] },
      numRows: 1,
      // The proxy has no own enumerable data property; only toJSON reveals it.
      toArray: () => [{ toJSON: () => ({ a: 7 }) }],
    };
    expect(fromArrow(table).rows).toEqual([{ a: 7 }]);
  });

  it("coerces a Timestamp column's epoch-ms numbers to Date", () => {
    const epoch = Date.UTC(2026, 6, 11, 12, 30);
    const table = makeTable(
      [{ name: "ts", type: "Timestamp<MICROSECOND, UTC>" }],
      [{ ts: epoch }, { ts: null }],
    );
    const { rows } = fromArrow(table);
    expect(rows[0]?.ts).toBeInstanceOf(Date);
    expect((rows[0]?.ts as Date).getTime()).toBe(epoch);
    expect(rows[1]?.ts).toBeNull();
  });

  it("coerces Date32/Date64-style type strings", () => {
    const epoch = Date.UTC(2026, 0, 1);
    const table = makeTable(
      [
        { name: "d32", type: "Date32<DAY>" },
        { name: "d64", type: "Date64<MILLISECOND>" },
      ],
      [{ d32: epoch, d64: epoch }],
    );
    const { rows } = fromArrow(table);
    expect(rows[0]?.d32).toBeInstanceOf(Date);
    expect(rows[0]?.d64).toBeInstanceOf(Date);
  });

  it("matches temporal type names case-insensitively", () => {
    const table = makeTable(
      [
        { name: "ts", type: "timestamp[us]" },
        { name: "dt", type: "DATETIME" },
      ],
      [{ ts: 1000, dt: 2000 }],
    );
    const { rows } = fromArrow(table);
    expect(rows[0]?.ts).toBeInstanceOf(Date);
    expect(rows[0]?.dt).toBeInstanceOf(Date);
  });

  it("options.dates forces coercion of columns the schema doesn't mark temporal", () => {
    const epoch = Date.UTC(2025, 11, 31);
    const table = makeTable(
      [
        { name: "created", type: "Float64" },
        { name: "amount", type: "Float64" },
      ],
      [{ created: epoch, amount: 12.5 }],
    );
    const { rows } = fromArrow(table, { dates: ["created"] });
    expect(rows[0]?.created).toBeInstanceOf(Date);
    expect((rows[0]?.created as Date).getTime()).toBe(epoch);
    expect(rows[0]?.amount).toBe(12.5);
  });

  it("converts BigInt within the safe integer range to number", () => {
    const table = makeTable(
      [{ name: "n", type: "Int64" }],
      [{ n: 42n }, { n: -9007199254740991n }],
    );
    const { rows } = fromArrow(table);
    expect(rows[0]?.n).toBe(42);
    expect(rows[1]?.n).toBe(-9007199254740991);
  });

  it("converts an unsafe BigInt to a decimal string by default", () => {
    const table = makeTable(
      [{ name: "big", type: "Int128" }],
      [{ big: 12345678901234567890n }, { big: -12345678901234567890n }],
    );
    const { rows } = fromArrow(table);
    expect(rows[0]?.big).toBe("12345678901234567890");
    expect(rows[1]?.big).toBe("-12345678901234567890");
  });

  it('converts an unsafe BigInt lossily with bigints: "number"', () => {
    const table = makeTable([{ name: "big", type: "Int128" }], [{ big: 12345678901234567890n }]);
    const { rows } = fromArrow(table, { bigints: "number" });
    expect(rows[0]?.big).toBe(Number(12345678901234567890n));
  });

  it('throws a descriptive error on an unsafe BigInt with bigints: "throw"', () => {
    const table = makeTable([{ name: "big", type: "Int128" }], [{ big: 12345678901234567890n }]);
    expect(() => fromArrow(table, { bigints: "throw" })).toThrow(/column "big".*MAX_SAFE_INTEGER/);
  });

  it("produces rows JSON.stringify can serialize under the default policy", () => {
    const table = makeTable(
      [
        { name: "huge", type: "Int128" },
        { name: "small", type: "Int64" },
        { name: "ts", type: "Timestamp<MILLISECOND>" },
      ],
      [{ huge: 2n ** 100n, small: 7n, ts: Date.UTC(2026, 6, 11) }],
    );
    const { rows } = fromArrow(table);
    expect(() => JSON.stringify(rows)).not.toThrow();
  });

  it("falls back to spreading rows that lack toJSON, still applying coercions", () => {
    const epoch = Date.UTC(2026, 2, 3);
    const table = makeTable(
      [
        { name: "ts", type: "Timestamp<MILLISECOND>" },
        { name: "n", type: "Int64" },
      ],
      [{ ts: epoch, n: 5n }],
      { proxyRows: false },
    );
    const { rows } = fromArrow(table);
    expect(rows[0]?.ts).toBeInstanceOf(Date);
    expect(rows[0]?.n).toBe(5);
  });

  it("returns the column list and zero rows for an empty table", () => {
    const table = makeTable(
      [
        { name: "a", type: "Int32" },
        { name: "b", type: "Utf8" },
      ],
      [],
    );
    expect(fromArrow(table)).toEqual({ columns: ["a", "b"], rows: [] });
  });
});
