import { DataTable, type DataTableProps } from "./DataTable";
import type { CellChange, ColumnDef, EditActivation, PaginateConfig } from "./types";

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
  reorderableColumns?: boolean;
  filterableColumns?: boolean;
  onCellChange?: DataTableProps<Row>["onCellChange"];
  /** Table-level edit trigger. */
  editOn?: EditActivation;
  /** Column ids that opt into single-click editing (`editOn: "single"`). */
  singleClickCols?: string[];
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
  reorderableColumns,
  filterableColumns,
  onCellChange,
  editOn,
  singleClickCols,
}: HarnessProps) {
  const columns: ColumnDef<Row>[] = cols.map((id) => {
    const locked = lockedCols?.includes(id) ? { resizable: false as const } : null;
    const width = widths?.[id] != null ? { width: widths[id] } : null;
    const colEditOn = singleClickCols?.includes(id) ? { editOn: "single" as const } : null;
    if (id === "age")
      return {
        id,
        header: id,
        accessor: "age",
        edit: { type: "number" },
        ...colEditOn,
        ...locked,
        ...width,
      };
    if (id === "active")
      return { id, header: id, accessor: "active", edit: { type: "boolean" }, ...locked, ...width };
    return {
      id,
      header: id,
      accessor: id as keyof Row,
      edit: { type: "text" },
      ...colEditOn,
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
      reorderableColumns={reorderableColumns}
      filterableColumns={filterableColumns}
      editOn={editOn}
      height={300}
      onCellChange={onCellChange as ((changes: CellChange[]) => void) | undefined}
    />
  );
  return containerWidth != null ? <div style={{ width: containerWidth }}>{table}</div> : table;
}

// --- Rich cell-editors harness (text / number / date) ---

type EditRow = { name: string; score: number; joined: Date };

const EDIT_DATA: EditRow[] = [{ name: "Alice", score: 40, joined: new Date(2022, 2, 3) }];

export function EditorsHarness({ onCellChange }: { onCellChange?: (c: CellChange[]) => void }) {
  const columns: ColumnDef<EditRow>[] = [
    { id: "name", header: "Name", accessor: "name", edit: { type: "text" } },
    {
      id: "score",
      header: "Score",
      accessor: "score",
      align: "end",
      edit: { type: "number", decimals: 1, unit: "%" },
      width: 8,
    },
    {
      id: "joined",
      header: "Joined",
      accessor: "joined",
      edit: { type: "date" },
      cell: ({ value }) => (value instanceof Date ? value.toISOString().slice(0, 10) : ""),
      width: 10,
    },
  ];
  return (
    <DataTable<EditRow>
      data={EDIT_DATA}
      columns={columns}
      editable
      height={200}
      onCellChange={onCellChange as ((changes: CellChange[]) => void) | undefined}
    />
  );
}

// --- Frozen-columns harness ---

// Many narrow columns in a fixed-width wrapper so the table overflows
// horizontally, with the first N frozen (pinned left).
export function FrozenHarness({
  width = 360,
  frozenColumns = 2,
}: {
  width?: number;
  frozenColumns?: number;
}) {
  const columns: ColumnDef<Row>[] = [
    { id: "name", header: "Name", accessor: "name", width: 10 },
    { id: "age", header: "Age", accessor: "age", align: "end", width: 6 },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      header: `Col ${i}`,
      accessor: () => i,
      align: "end" as const,
      width: 6,
    })),
  ];
  const data: Row[] = Array.from({ length: 20 }, (_, i) => ({
    name: `Name ${i}`,
    age: 20 + i,
    active: i % 2 === 0,
  }));
  return (
    <div style={{ width }}>
      <DataTable<Row> data={data} columns={columns} height={240} frozenColumns={frozenColumns} />
    </div>
  );
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

// --- High-cardinality filter harness ---

// One filterable text column with `count` distinct values (V0000, V0001, …) so
// the funnel checklist's windowing + search can be exercised (issue #17).
export function ManyValuesHarness({ count = 500 }: { count?: number }) {
  const data: Row[] = Array.from({ length: count }, (_, i) => ({
    name: `V${String(i).padStart(4, "0")}`,
    age: i % 60,
    active: i % 2 === 0,
  }));
  const columns: ColumnDef<Row>[] = [
    { id: "name", header: "name", accessor: "name" },
    { id: "age", header: "age", accessor: "age", align: "end" },
  ];
  return <DataTable<Row> data={data} columns={columns} height={300} filterableColumns />;
}
