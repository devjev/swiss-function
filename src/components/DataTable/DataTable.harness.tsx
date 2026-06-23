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
  scrollSnap?: DataTableProps<Row>["scrollSnap"];
  edgeFade?: boolean;
  columnFill?: DataTableProps<Row>["columnFill"];
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
  scrollSnap,
  edgeFade,
  columnFill,
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
      scrollSnap={scrollSnap}
      edgeFade={edgeFade}
      columnFill={columnFill}
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

// --- Merged-cell harness ---

type TeamRow = { id: string; dept: string; name: string; q1: number; q2: number };

// Fixed dataset: the first three rows share a department, so the Department
// column merges into a 3-row span; the rest are singletons.
const TEAM_DATA: TeamRow[] = [
  { id: "1", dept: "Engineering", name: "Ada", q1: 12, q2: 15 },
  { id: "2", dept: "Engineering", name: "Bo", q1: 9, q2: 11 },
  { id: "3", dept: "Engineering", name: "Cai", q1: 14, q2: 13 },
  { id: "4", dept: "Design", name: "Dani", q1: 7, q2: 8 },
];

export function MergeHarness() {
  const columns: ColumnDef<TeamRow>[] = [
    { id: "dept", header: "Department", accessor: "dept", width: 10 },
    { id: "name", header: "Name", accessor: "name" },
    {
      id: "y2026",
      header: "2026",
      columns: [
        { id: "q1", header: "Q1", accessor: "q1", align: "end", width: 5 },
        { id: "q2", header: "Q2", accessor: "q2", align: "end", width: 5 },
      ],
    },
  ];
  return (
    <DataTable<TeamRow>
      data={TEAM_DATA}
      columns={columns}
      height={300}
      getCellSpan={({ rowIndex, colIndex }) => {
        if (colIndex !== 0) return undefined;
        const dept = TEAM_DATA[rowIndex]?.dept;
        if (dept == null) return undefined;
        if (TEAM_DATA[rowIndex - 1]?.dept === dept) return undefined;
        let rowSpan = 1;
        while (TEAM_DATA[rowIndex + rowSpan]?.dept === dept) rowSpan++;
        return rowSpan > 1 ? { rowSpan } : undefined;
      }}
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
