// Parity suite for tree-mode pruning (issue #18): a table-core instance fed
// buildTreeMeta's pruned getSubRows must produce exactly the same VISIBLE
// (expanded-model) rows — ids, order, depth, index, originals — as a stock
// instance fed the raw tree, while materializing far fewer Row objects.
// Expansion state is keyed by TanStack row id, so the id scheme is pinned
// against table-core's default getRowId too.
import {
  createTable,
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  type Table,
  type ColumnDef as TSColumnDef,
} from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { buildTreeMeta, filteredTreeMeta, filterTreeRows, sourceIndex } from "./treeRows";

type Node = { name: string; num: number; children?: Node[] };

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
  { id: "name", accessorFn: (r: Node) => r.name, enableSorting: true },
  { id: "num", accessorFn: (r: Node) => r.num, enableSorting: true },
];

function makeTable(
  data: Node[],
  subRows: (r: Node) => Node[] | undefined,
  expanded: ExpandedState,
  sorting: SortingState = [],
  getRowId?: (row: Node, index: number, parent?: { id: string }) => string,
): Table<Node> {
  const table = createTable<Node>({
    data,
    columns,
    state: {},
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: subRows,
    ...(getRowId ? { getRowId } : {}),
  });
  table.setOptions((prev) => ({
    ...prev,
    state: { ...table.initialState, expanded, sorting },
  }));
  return table;
}

/** The flat visible list DataTable renders (`table.getRowModel().rows`). */
function visible(table: Table<Node>) {
  return table
    .getRowModel()
    .rows.map((r) => ({ id: r.id, depth: r.depth, index: r.index, original: r.original }));
}

function expectParity(expanded: Record<string, boolean>, sorting: SortingState = []) {
  const stock = makeTable(DATA, getSubRows, expanded, sorting);
  const meta = buildTreeMeta(DATA, getSubRows, expanded);
  const pruned = makeTable(DATA.slice(), meta.getSubRows, expanded, sorting);
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

  it("ignores expanded entries for rows hidden under a collapsed ancestor", () => {
    // "0.0" expanded while "0" is collapsed: neither table shows the subtree.
    const { pruned } = expectParity({ "0.0": true });
    expect(pruned.getCoreRowModel().flatRows.length).toBe(6);
  });
});

// --- Filtered trees (issue #108) ----------------------------------------------

/** A table-core instance over a filtered tree, as DataTable builds it. */
function filteredTable(
  matches: (row: Node) => boolean,
  expanded: ExpandedState,
  sorting: SortingState = [],
) {
  const tree = filterTreeRows(DATA, getSubRows, matches);
  const meta = filteredTreeMeta(tree, expanded);
  return { tree, table: makeTable(meta.data, meta.getSubRows, expanded, sorting, meta.getRowId) };
}

// Seeded names repeat across the tree, so match the rows themselves.
const rowIs =
  (...keep: Node[]) =>
  (row: Node) =>
    keep.includes(row);

describe("filterTreeRows + filteredTreeMeta", () => {
  // DATA[0] has children 0.0 (with grandchildren 0.0.0, 0.0.1), 0.1, 0.2.
  const root = DATA[0] as Node;
  const mid = root.children?.[0] as Node;
  const leaf = mid.children?.[1] as Node;
  const sibling = root.children?.[2] as Node;

  it("finds a match under collapsed parents and keeps the path to it", () => {
    const { tree } = filteredTable(rowIs(leaf), {});
    expect(tree.roots).toEqual([root]);
    expect(tree.nodes.get(leaf)?.id).toBe("0.0.1");
    expect([...tree.paths]).toEqual(["0.0", "0"]);
  });

  it("names each row by its unfiltered id, so the expanded state keeps its meaning", () => {
    // The path rows open; the leaf sits at its original id, not at "0.0.0".
    const { table } = filteredTable(rowIs(leaf, sibling), { "0": true, "0.0": true });
    expect(visible(table).map((r) => [r.id, r.depth, r.original])).toEqual([
      ["0", 0, root],
      ["0.0", 1, mid],
      ["0.0.1", 2, leaf],
      ["0.2", 1, sibling],
    ]);
  });

  it("filters below a match: a matching parent drops its failing children", () => {
    const { tree, table } = filteredTable(rowIs(root, sibling), { "0": true });
    expect(tree.paths.size).toBe(0);
    expect(visible(table).map((r) => r.id)).toEqual(["0", "0.2"]);
    // hasChildren counts the kept children only.
    expect(tree.nodes.get(root)?.hasChildren).toBe(true);
    expect(tree.nodes.get(sibling)?.hasChildren).toBe(false);
  });

  it("withholds the children of a collapsed row from the row model", () => {
    const { table } = filteredTable(rowIs(leaf), {});
    expect(table.getCoreRowModel().flatRows.map((r) => r.id)).toEqual(["0"]);
  });

  it("expands everything under `true`", () => {
    const { table } = filteredTable(rowIs(leaf, sibling), true);
    expect(visible(table).map((r) => r.id)).toEqual(["0", "0.0", "0.0.1", "0.2"]);
  });

  it("sorts the kept rows per level", () => {
    const keep = (row: Node) => row.num % 2 === 1;
    const { table } = filteredTable(keep, true, [{ id: "num", desc: false }]);
    const rows = table.getRowModel().rows;
    for (const parent of [null, ...rows]) {
      const siblings = rows.filter((r) => (r.getParentRow() ?? null) === parent);
      const nums = siblings.map((r) => r.original.num);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }
  });
});

describe("sourceIndex", () => {
  it("reads a row's index among its unfiltered siblings from its id", () => {
    expect(sourceIndex({ id: "0.0.1", index: 0 })).toBe(1);
    expect(sourceIndex({ id: "4", index: 0 })).toBe(4);
  });

  it("falls back to table-core's index for an id outside the scheme", () => {
    expect(sourceIndex({ id: "custom", index: 3 })).toBe(3);
  });
});
