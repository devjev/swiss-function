import { DataTable, type DataTableProps } from "./DataTable";
import type { CellChange, ColumnDef, PaginateConfig } from "./types";

type Row = { name: string; age: number; active: boolean };

interface HarnessProps {
  data: Row[];
  cols: string[];
  editable?: boolean;
  paginate?: PaginateConfig;
  resizableColumns?: boolean;
  /** Column ids to lock with `resizable: false`. */
  lockedCols?: string[];
  /** Fixed widths (in --sf-unit multiples) per column id. */
  widths?: Record<string, number>;
  /** Fixed wrapper width in px, for deterministic layout in tests. */
  containerWidth?: number;
  onCellChange?: DataTableProps<Row>["onCellChange"];
}

// Playwright CT mounts must be top-level component invocations (no inline closures),
// so the spec passes plain serializable props and this harness assembles the columns.
export function DataTableHarness({
  data,
  cols,
  editable,
  paginate,
  resizableColumns,
  lockedCols,
  widths,
  containerWidth,
  onCellChange,
}: HarnessProps) {
  const columns: ColumnDef<Row>[] = cols.map((id) => {
    const locked = lockedCols?.includes(id) ? { resizable: false as const } : null;
    const width = widths?.[id] != null ? { width: widths[id] } : null;
    if (id === "age")
      return { id, header: id, accessor: "age", edit: { type: "number" }, ...locked, ...width };
    if (id === "active")
      return { id, header: id, accessor: "active", edit: { type: "boolean" }, ...locked, ...width };
    return {
      id,
      header: id,
      accessor: id as keyof Row,
      edit: { type: "text" },
      ...locked,
      ...width,
    };
  });
  const table = (
    <DataTable<Row>
      data={data}
      columns={columns}
      editable={editable}
      paginate={paginate}
      resizableColumns={resizableColumns}
      height={300}
      onCellChange={onCellChange as ((changes: CellChange[]) => void) | undefined}
    />
  );
  return containerWidth != null ? <div style={{ width: containerWidth }}>{table}</div> : table;
}

// --- Tree harness ---

type TreeRow = { id: string; name: string; value: number; children?: TreeRow[] };

export function TreeHarness({
  data,
  defaultExpanded,
}: {
  data: TreeRow[];
  defaultExpanded?: true | Record<string, boolean>;
}) {
  const columns: ColumnDef<TreeRow>[] = [
    { id: "name", header: "Name", accessor: "name" },
    { id: "value", header: "Value", accessor: "value", align: "end" },
  ];
  return (
    <DataTable<TreeRow>
      data={data}
      columns={columns}
      getSubRows={(r) => r.children}
      defaultExpanded={defaultExpanded}
      height={300}
    />
  );
}

// --- Column-group harness ---

type AddrRow = { name: string; street: string; city: string; zip: string; age: number };

export function GroupsHarness({ defaultCollapsed }: { defaultCollapsed?: boolean }) {
  const data: AddrRow[] = [
    { name: "Alice", street: "12 Main", city: "NYC", zip: "10001", age: 30 },
    { name: "Bob", street: "34 Oak", city: "SFO", zip: "94110", age: 25 },
  ];
  const columns: ColumnDef<AddrRow>[] = [
    { id: "name", header: "Name", accessor: "name" },
    {
      id: "address",
      header: "Address",
      defaultCollapsed,
      columns: [
        { id: "street", header: "Street", accessor: "street" },
        { id: "city", header: "City", accessor: "city" },
        { id: "zip", header: "Zip", accessor: "zip" },
      ],
    },
    { id: "age", header: "Age", accessor: "age", align: "end" },
  ];
  return <DataTable<AddrRow> data={data} columns={columns} height={300} />;
}
