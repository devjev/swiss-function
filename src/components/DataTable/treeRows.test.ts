// Parity suite for tree-mode pruning (issue #18): a table-core instance fed
// buildTreeMeta's pruned getSubRows must produce exactly the same VISIBLE
// (expanded-model) rows — ids, order, depth, index, originals — as a stock
// instance fed the raw tree, while materializing far fewer Row objects.
// Expansion state is keyed by TanStack row id, so the id scheme is pinned
// against table-core's default getRowId too.
import {
  type ColumnFiltersState,
  createTable,
  type ExpandedState,
  type FilterFn,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  type Table,
  type ColumnDef as TSColumnDef,
} from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { buildTreeMeta } from "./treeRows";

type Node = { name: string; num: number; children?: Node[] };

// Same checklist filter DataTable's toTSColumn attaches (module-private there).
const includesFilter: FilterFn<Node> = (row, columnId, filterValue) => {
  const allowed = filterValue as string[] | undefined;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(String(row.getValue(columnId)));
};

// 6 roots × 3 children, plus 2 grandchildren under each even root's first
// child. Names carry shuffled numeric suffixes so per-level sorting is
// observable and the auto-sort sniff picks the alphanumeric fn in both
// tables (values are string-typed throughout — no type-sniff drift).
function seedTree(): Node[] {
  let n = 0;
  const next = () => {
    n += 1;
    return ((n * 7) % 23) + 1;
  };
  return Array.from({ length: 6 }, (_, i) => ({
    name: `Row ${next()}`,
    num: next(),
    children: Array.from({ length: 3 }, (_, j) => ({
      name: `Row ${next()}`,
      num: next(),
      children:
        i % 2 === 0 && j === 0
          ? Array.from({ length: 2 }, () => ({ name: `Row ${next()}`, num: next() }))
          : undefined,
    })),
  }));
}

const DATA = seedTree();
const getSubRows = (r: Node) => r.children;

const columns: TSColumnDef<Node>[] = [
  { id: "name", accessorFn: (r: Node) => r.name, enableSorting: true, filterFn: includesFilter },
  { id: "num", accessorFn: (r: Node) => r.num, enableSorting: true, filterFn: includesFilter },
];

function makeTable(
  data: Node[],
  subRows: (r: Node) => Node[] | undefined,
  expanded: ExpandedState,
  sorting: SortingState = [],
  filters: ColumnFiltersState = [],
): Table<Node> {
  const table = createTable<Node>({
    data,
    columns,
    state: {},
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: subRows,
  });
  table.setOptions((prev) => ({
    ...prev,
    state: { ...table.initialState, expanded, sorting, columnFilters: filters },
  }));
  return table;
}

/** The flat visible list DataTable renders (`table.getRowModel().rows`). */
function visible(table: Table<Node>) {
  return table
    .getRowModel()
    .rows.map((r) => ({ id: r.id, depth: r.depth, index: r.index, original: r.original }));
}

function expectParity(
  expanded: Record<string, boolean>,
  sorting: SortingState = [],
  filters: ColumnFiltersState = [],
) {
  const stock = makeTable(DATA, getSubRows, expanded, sorting, filters);
  const meta = buildTreeMeta(DATA, getSubRows, expanded);
  const pruned = makeTable(DATA.slice(), meta.getSubRows, expanded, sorting, filters);
  expect(visible(pruned)).toEqual(visible(stock));
  return { stock, pruned, meta };
}

describe("buildTreeMeta — table-core parity for the visible tree", () => {
  it("all collapsed: only roots materialize, visible rows match", () => {
    const { stock, pruned } = expectParity({});
    // 6 roots + 18 children + 6 grandchildren in the stock core model…
    expect(stock.getCoreRowModel().flatRows.length).toBe(30);
    // …but the pruned model materializes the 6 visible roots alone.
    expect(pruned.getCoreRowModel().flatRows.length).toBe(6);
  });

  it("partial expansion: ids/order/depth/index match, including grandchildren", () => {
    const expanded = { "0": true, "0.0": true, "3": true };
    const { stock, pruned } = expectParity(expanded);
    expect(visible(pruned).map((r) => r.id)).toContain("0.0.1");
    // Materialized = visible rows + the collapsed frontier's roots only.
    expect(pruned.getCoreRowModel().flatRows.length).toBeLessThan(
      stock.getCoreRowModel().flatRows.length,
    );
  });

  it("reproduces table-core's default row-id scheme for every visible row", () => {
    const expanded = { "2": true, "2.0": true, "5": true };
    const { stock, meta } = expectParity(expanded);
    for (const row of stock.getRowModel().rows) {
      const info = meta.info.get(row.original);
      expect(info?.id).toBe(row.id);
      // hasChildren mirrors what stock getCanExpand() reports — the pruned
      // Row can't know (its subRows are withheld while collapsed).
      expect(info?.hasChildren).toBe(row.getCanExpand());
    }
  });

  it("sorts per level with parity, asc and desc, multi-column", () => {
    const expanded = { "0": true, "0.0": true, "1": true, "2": true, "4": true };
    expectParity(expanded, [{ id: "name", desc: false }]);
    expectParity(expanded, [{ id: "name", desc: true }]);
    expectParity(expanded, [
      { id: "num", desc: false },
      { id: "name", desc: true },
    ]);
  });

  it("filters with parity — a failing ancestor removes its matching descendants too", () => {
    const expanded = { "0": true, "0.0": true, "1": true };
    // Keep only some names; ancestors that fail drop their whole subtree in
    // stock table-core (parent-down filtering), and must in the pruned one.
    const names = DATA.flatMap((r) => [r.name, ...(r.children ?? []).map((c) => c.name)]);
    const keep = names.filter((_, i) => i % 2 === 0);
    expectParity(expanded, [], [{ id: "name", value: keep }]);
    expectParity(expanded, [{ id: "name", desc: false }], [{ id: "name", value: keep }]);
  });

  it("ignores expanded entries for rows hidden under a collapsed ancestor", () => {
    // "0.0" expanded while "0" is collapsed: neither table shows the subtree.
    const { pruned } = expectParity({ "0.0": true });
    expect(pruned.getCoreRowModel().flatRows.length).toBe(6);
  });
});
