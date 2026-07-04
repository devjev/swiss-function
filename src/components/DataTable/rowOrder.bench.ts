import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { computeRowOrder } from "./rowOrder";
import type { LeafColumnDef } from "./types";

type Row = { name: string; value: number; kind: string };

function makeRows(n: number, rand: () => number): Row[] {
  return Array.from({ length: n }, () => ({
    name: `Row ${Math.floor(rand() * n)}`,
    value: Math.floor(rand() * 1e6),
    kind: rand() > 0.5 ? "alpha" : "beta",
  }));
}

const LEAVES: LeafColumnDef<Row>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true },
  { id: "value", header: "Value", accessor: "value", sortable: true, edit: { type: "number" } },
  { id: "kind", header: "Kind", accessor: "kind" },
];

const rows10k = makeRows(10_000, seededRandom(21));
const rows100k = makeRows(100_000, seededRandom(22));
const byName: SortingState = [{ id: "name", desc: false }];
const byValueDesc: SortingState = [{ id: "value", desc: true }];
const alphaOnly: ColumnFiltersState = [{ id: "kind", value: ["alpha"] }];

describe("DataTable computeRowOrder", () => {
  bench(
    "identity fast path (100k, no sort/filter)",
    () => {
      computeRowOrder(rows100k, LEAVES, [], []);
    },
    BENCH,
  );

  bench(
    "sort by name — alphanumeric (10k)",
    () => {
      computeRowOrder(rows10k, LEAVES, byName, []);
    },
    BENCH,
  );

  bench(
    "sort by name — alphanumeric (100k)",
    () => {
      computeRowOrder(rows100k, LEAVES, byName, []);
    },
    BENCH,
  );

  bench(
    "sort by value desc (100k)",
    () => {
      computeRowOrder(rows100k, LEAVES, byValueDesc, []);
    },
    BENCH,
  );

  bench(
    "checklist filter + sort by value (100k)",
    () => {
      computeRowOrder(rows100k, LEAVES, byValueDesc, alphaOnly);
    },
    BENCH,
  );
});
