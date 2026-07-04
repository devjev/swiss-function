import { DataTable } from "./DataTable";
import type { CellChange, ColumnDef } from "./types";

type SortRow = { name: string; value: number; kind: string };

// Deterministic shuffled order (12 rows, so table-core's auto-sort sniff of
// rows [10..] sees the numeric suffixes and picks the alphanumeric fn). The
// first row is neither the asc winner ("Row 1") nor the desc winner
// ("Row 12"), so every state of the sort cycle is distinguishable.
const ORDER = [7, 3, 11, 1, 9, 5, 12, 2, 10, 6, 8, 4];
const DATA: SortRow[] = ORDER.map((n) => ({
  name: `Row ${n}`,
  value: n * 10,
  kind: n % 2 === 1 ? "alpha" : "beta",
}));

// Sortable-columns harness for the sort-cycle / filter+sort / rowIndex CT
// tests (the base DataTableHarness has no sortable columns).
export function SortHarness({
  filterable,
  editable,
  customCell,
  onCellChange,
}: {
  filterable?: boolean;
  editable?: boolean;
  /** Render name cells as `value#rowIndex` to expose the custom-cell rowIndex
   *  contract (rowIndex = ORIGINAL data index, not display index). */
  customCell?: boolean;
  onCellChange?: (changes: CellChange[]) => void;
}) {
  const columns: ColumnDef<SortRow>[] = [
    {
      id: "name",
      header: "name",
      accessor: "name",
      sortable: true,
      edit: { type: "text" },
      ...(customCell
        ? {
            cell: ({ value, rowIndex }: { value: unknown; rowIndex: number }) =>
              `${value}#${rowIndex}`,
          }
        : null),
    },
    { id: "value", header: "value", accessor: "value", sortable: true, edit: { type: "number" } },
    { id: "kind", header: "kind", accessor: "kind" },
  ];
  return (
    <DataTable<SortRow>
      data={DATA}
      columns={columns}
      height={500}
      editable={editable}
      filterableColumns={filterable}
      onCellChange={onCellChange}
    />
  );
}
