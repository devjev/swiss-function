// Parity suite: computeRowOrder must produce the exact row order a real
// table-core instance produces when configured the way DataTable configures
// it (accessorFn columns, enableSorting from `sortable`, checklist/range
// filterFns from `edit.type`). Imports go through @tanstack/react-table —
// table-core is only a transitive dependency and re-exported in full.
import {
  type ColumnFiltersState,
  createTable,
  type FilterFn,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef as TSColumnDef,
} from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { computeRowOrder } from "./rowOrder";
import type { LeafColumnDef } from "./types";

// Same filter fns DataTable's toTSColumn attaches (module-private there).
const includesFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  const allowed = filterValue as string[] | undefined;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(String(row.getValue(columnId)));
};
const rangeFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  const [min, max] = (filterValue as [number | undefined, number | undefined]) ?? [];
  const v = Number(row.getValue(columnId));
  if (min != null && !(v >= min)) return false;
  if (max != null && !(v <= max)) return false;
  return true;
};

function tanstackOrder<T>(
  data: T[],
  leaves: LeafColumnDef<T>[],
  sorting: SortingState,
  filters: ColumnFiltersState,
): number[] {
  const columns: TSColumnDef<T>[] = leaves.map((def) => ({
    id: def.id,
    accessorFn: (row: T) =>
      typeof def.accessor === "function"
        ? def.accessor(row)
        : (row as Record<string, unknown>)[def.accessor as string],
    enableSorting: def.sortable ?? false,
    filterFn: (def.edit?.type === "number" ? rangeFilter : includesFilter) as FilterFn<T>,
  }));
  const table = createTable<T>({
    data,
    columns,
    state: {},
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  table.setOptions((prev) => ({
    ...prev,
    state: { ...table.initialState, sorting, columnFilters: filters },
  }));
  return table.getSortedRowModel().rows.map((r) => r.index);
}

function ourOrder<T>(
  data: T[],
  leaves: LeafColumnDef<T>[],
  sorting: SortingState = [],
  filters: ColumnFiltersState = [],
): number[] {
  return Array.from(computeRowOrder(data, leaves, sorting, filters));
}

function expectParity<T>(
  data: T[],
  leaves: LeafColumnDef<T>[],
  sorting: SortingState = [],
  filters: ColumnFiltersState = [],
): number[] {
  const ours = ourOrder(data, leaves, sorting, filters);
  expect(ours).toEqual(tanstackOrder(data, leaves, sorting, filters));
  return ours;
}

function leaf<T>(
  id: string,
  accessor: LeafColumnDef<T>["accessor"],
  extra?: Partial<LeafColumnDef<T>>,
): LeafColumnDef<T> {
  return { id, header: id, accessor, sortable: true, ...extra };
}

type Rec = {
  name: string;
  word: string;
  num: number | undefined;
  flag: boolean;
  when: Date;
  kind: string;
};

// 30 deterministic rows, shuffled by a fixed stride so no column is presorted.
// Numeric suffixes make `name` pick the alphanumeric fn; `word` is digit-free.
const WORDS = ["kilo", "alpha", "hotel", "delta", "golf", "echo", "bravo"];
const DATA: Rec[] = Array.from({ length: 30 }, (_, i) => {
  const n = ((i * 7) % 30) + 1;
  return {
    name: `Row ${n}`,
    word: WORDS[n % WORDS.length] as string,
    num: n % 4 === 0 ? undefined : (n * 37) % 50,
    flag: n % 3 === 0,
    when: new Date(2026, n % 12, (n % 27) + 1),
    kind: n % 2 === 1 ? "alpha" : "beta",
  };
});

const LEAVES: LeafColumnDef<Rec>[] = [
  leaf("name", "name"),
  leaf("word", "word"),
  leaf("num", "num", { edit: { type: "number" } }),
  leaf("flag", "flag"),
  leaf("when", (r) => r.when),
  leaf("kind", "kind", { sortable: false }),
];

const asc = (id: string): SortingState => [{ id, desc: false }];
const desc = (id: string): SortingState => [{ id, desc: true }];

describe("computeRowOrder — table-core parity", () => {
  it("sorts alphanumeric strings ('Row 2' before 'Row 10')", () => {
    const order = expectParity(DATA, LEAVES, asc("name"));
    const names = order.map((i) => (DATA[i] as Rec).name);
    expect(names.indexOf("Row 2")).toBeLessThan(names.indexOf("Row 10"));
    expectParity(DATA, LEAVES, desc("name"));
  });

  it("sorts plain text", () => {
    expectParity(DATA, LEAVES, asc("word"));
    expectParity(DATA, LEAVES, desc("word"));
  });

  it("falls back to basic compare when the sniff rows run out (≤10 rows)", () => {
    // table-core's auto fn sniffs filtered rows [10..]; with few rows that's
    // empty and strings get the lexicographic `basic` fn on both sides.
    const small = DATA.slice(0, 5);
    expectParity(small, LEAVES, asc("name"));
  });

  it("sorts numbers with undefined values (sortUndefined = 1), asc and desc", () => {
    expectParity(DATA, LEAVES, asc("num"));
    expectParity(DATA, LEAVES, desc("num"));
  });

  it("sorts booleans", () => {
    expectParity(DATA, LEAVES, asc("flag"));
    expectParity(DATA, LEAVES, desc("flag"));
  });

  it("sorts Date values via the datetime fn", () => {
    expectParity(DATA, LEAVES, asc("when"));
    expectParity(DATA, LEAVES, desc("when"));
  });

  it("applies multi-sort entries in order", () => {
    expectParity(DATA, LEAVES, [
      { id: "flag", desc: false },
      { id: "num", desc: true },
    ]);
  });

  it("applies a checklist filter", () => {
    const order = expectParity(DATA, LEAVES, [], [{ id: "word", value: ["alpha", "echo"] }]);
    expect(order.length).toBeGreaterThan(0);
    for (const i of order) expect(["alpha", "echo"]).toContain((DATA[i] as Rec).word);
  });

  it("keeps everything on an empty checklist", () => {
    expectParity(DATA, LEAVES, [], [{ id: "word", value: [] }]);
  });

  it("applies a range filter, including open bounds", () => {
    expectParity(DATA, LEAVES, [], [{ id: "num", value: [10, 40] }]);
    expectParity(DATA, LEAVES, [], [{ id: "num", value: [undefined, 25] }]);
    expectParity(DATA, LEAVES, [], [{ id: "num", value: [25, undefined] }]);
  });

  it("composes filter + sort", () => {
    expectParity(DATA, LEAVES, asc("name"), [{ id: "word", value: ["alpha", "kilo", "golf"] }]);
    expectParity(DATA, LEAVES, desc("num"), [
      { id: "word", value: ["alpha", "kilo", "golf", "echo"] },
      { id: "num", value: [5, 45] },
    ]);
  });

  it("handles empty data", () => {
    expectParity([], LEAVES, asc("name"), [{ id: "word", value: ["alpha"] }]);
    expect(ourOrder([], LEAVES)).toEqual([]);
  });

  it("ignores sorting/filter entries for missing columns (group collapse) and non-sortable columns", () => {
    // Collapsing a group swaps its leaves for a `<id>::placeholder` leaf while
    // stale sorting/filter entries for the removed ids stay in state; TanStack
    // silently drops them, so computeRowOrder must too.
    const collapsed = LEAVES.filter((l) => l.id !== "word");
    expectParity(DATA, collapsed, asc("word"));
    expectParity(DATA, collapsed, asc("name"), [{ id: "word", value: ["alpha"] }]);
    // `kind` exists but is sortable: false — its sort entry is dropped (a
    // stale filter for it still applies, matching TanStack).
    expectParity(DATA, LEAVES, asc("kind"));
    expectParity(DATA, LEAVES, [
      { id: "kind", desc: false },
      { id: "num", desc: false },
    ]);
  });

  it("returns a cached identity order when no sorting or filters apply", () => {
    const a = computeRowOrder(DATA, LEAVES, [], []);
    expect(Array.from(a)).toEqual(DATA.map((_, i) => i));
    // Stable reference across calls — and for stale-only state too.
    expect(computeRowOrder(DATA, LEAVES, [], [])).toBe(a);
    expect(computeRowOrder(DATA, LEAVES, asc("kind"), [])).toBe(a);
  });
});
