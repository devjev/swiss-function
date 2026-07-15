import type { Story } from "@ladle/react";
import { useCallback, useState } from "react";
import { DataTable } from "./DataTable";
import type { CellChange, ColumnDef } from "./types";

type Person = {
  id: string;
  name: string;
  age: number;
  active: boolean;
  role: string;
  score: number;
  joined: Date;
};

/** ISO date for the read view of a date column. */
const iso = (d: Date | null | undefined) => (d instanceof Date ? d.toISOString().slice(0, 10) : "");

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
  { value: "guest", label: "Guest" },
];

const baseColumns: ColumnDef<Person>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true, edit: { type: "text" } },
  {
    id: "age",
    header: "Age",
    accessor: "age",
    align: "end",
    sortable: true,
    edit: { type: "number" },
    width: 6,
  },
  {
    id: "active",
    header: "Active",
    accessor: "active",
    align: "center",
    edit: { type: "boolean" },
    width: 6,
  },
  {
    id: "role",
    header: "Role",
    accessor: "role",
    edit: { type: "select", options: ROLES },
    width: 10,
  },
];

function seed(n: number): Person[] {
  const firstNames = ["Ada", "Bo", "Cai", "Dani", "Em", "Fae", "Gus", "Hal", "Ila", "Jin"];
  const out: Person[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `r${i}`,
      name: `${firstNames[i % firstNames.length]} ${i}`,
      age: 20 + (i % 40),
      active: i % 3 !== 0,
      role: ROLES[i % ROLES.length]?.value ?? "user",
      score: Math.round((40 + ((i * 37) % 600) / 10) * 10) / 10,
      joined: new Date(2022, i % 12, 1 + (i % 27)),
    });
  }
  return out;
}

function applyChanges(data: Person[], changes: CellChange[]): Person[] {
  const next = data.slice();
  for (const c of changes) {
    const row = next[c.rowIndex];
    if (!row) continue;
    next[c.rowIndex] = { ...row, [c.columnId]: c.value } as Person;
  }
  return next;
}

export const ReadOnly: Story = () => (
  <DataTable data={seed(50)} columns={baseColumns} height={360} />
);

// Per-column header filters (funnel). Text/select/boolean get a value checklist;
// number gets a min/max range. Filters apply live and compose with sorting.
export const Filterable: Story = () => (
  <DataTable data={seed(80)} columns={baseColumns} height={360} filterableColumns />
);

// Drag a column header onto a neighbour to reorder; order persists via
// onColumnOrderChange. Clicking a header still sorts; the right edge still resizes.
export const Reorderable: Story = () => {
  const [order, setOrder] = useState<string[]>([]);
  return (
    <DataTable
      data={seed(50)}
      columns={baseColumns}
      height={360}
      reorderableColumns
      columnOrder={order}
      onColumnOrderChange={setOrder}
    />
  );
};

// columnFill: fixed-width columns that don't stretch; the leftover space to the
// right shows a static dither (so a sparse table doesn't read as unfinished).
// Resize a column (incl. the last) — widths persist via onColumnWidthsChange,
// and the filler grows/shrinks with the last column.
const fewColumns = baseColumns.slice(0, 2);

export const ColumnFillStatic: Story = () => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  return (
    <DataTable
      data={seed(50)}
      columns={fewColumns}
      height={360}
      defaultColumnWidth={10}
      columnFill
      columnWidths={widths}
      onColumnWidthsChange={setWidths}
    />
  );
};

// Same, but the filler is the animated WebGL dither (reduced-motion → static).
export const ColumnFillAnimated: Story = () => (
  <DataTable
    data={seed(50)}
    columns={fewColumns}
    height={360}
    defaultColumnWidth={10}
    columnFill={{ animated: true, effect: "noise", density: 0.5, speed: 0.5 }}
  />
);

// Elastic row snapping + a dithered fade at the bottom scroll edge.
export const SnapAndEdgeFade: Story = () => (
  <DataTable data={seed(50)} columns={baseColumns} height={240} scrollSnap="rows" edgeFade />
);

// A taller, gentler fade — 4 rows deep with a lower peak dot density.
export const EdgeFadeTuned: Story = () => (
  <DataTable
    data={seed(50)}
    columns={baseColumns}
    height={240}
    edgeFade={{ rows: 4, density: 0.6 }}
  />
);

// Narrow container: columns shrink toward their minimums to fit (no horizontal
// scroll) until even the minimums don't fit, at which point the table scrolls.
export const NarrowContainer: Story = () => (
  <div style={{ width: 360 }}>
    <DataTable data={seed(30)} columns={baseColumns} height={240} />
  </div>
);

// Excel-style column resizing (on by default). Drag a header's trailing edge,
// double-click it to auto-fit content, or focus it and use Arrow keys
// (Shift = larger step). The "Active" column is locked with resizable: false.
export const ResizableColumns: Story = () => {
  const columns: ColumnDef<Person>[] = [
    { id: "name", header: "Name", accessor: "name", sortable: true },
    { id: "age", header: "Age", accessor: "age", align: "end", sortable: true, width: 6 },
    {
      id: "active",
      header: "Active (locked)",
      accessor: "active",
      align: "center",
      resizable: false,
    },
    { id: "role", header: "Role", accessor: "role", width: 10 },
  ];
  return <DataTable data={seed(50)} columns={columns} height={360} />;
};

/** Columns showing all four rich cell editors: text → TextEditInline,
 *  number → DigitInputMicro, date → DatePicker, boolean → Checkbox, select. */
const richColumns: ColumnDef<Person>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true, edit: { type: "text" } },
  {
    id: "score",
    header: "Score",
    accessor: "score",
    align: "end",
    sortable: true,
    edit: { type: "number", decimals: 1, slots: 4, unit: "%" },
    cell: ({ value }) => (typeof value === "number" ? `${value}%` : ""),
    width: 8,
  },
  {
    id: "joined",
    header: "Joined",
    accessor: "joined",
    sortable: true,
    edit: { type: "date" },
    cell: ({ value }) => iso(value as Date),
    width: 10,
  },
  {
    id: "active",
    header: "Active",
    accessor: "active",
    align: "center",
    edit: { type: "boolean" },
    width: 6,
  },
  {
    id: "role",
    header: "Role",
    accessor: "role",
    edit: { type: "select", options: ROLES },
    width: 10,
  },
];

export const Editable: Story = () => {
  const [data, setData] = useState<Person[]>(() => seed(20));
  const onCellChange = useCallback(
    (changes: CellChange[]) => setData((d) => applyChanges(d, changes)),
    [],
  );
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Double-click, F2, or Enter on a focused cell to edit. Enter / Tab commits, Esc cancels. Text
        uses the inline text editor, numbers a DigitInputMicro, dates a DatePicker.
      </p>
      <DataTable
        data={data}
        columns={richColumns}
        editable
        height={360}
        onCellChange={onCellChange}
      />
    </div>
  );
};

/** `editOn="single"` opens the editor on a single click (double-click / F2 /
 *  Enter still work). Set it per column with `editOn` on the column, or per cell
 *  with `getEditActivation`. */
export const SingleClickEdit: Story = () => {
  const [data, setData] = useState<Person[]>(() => seed(20));
  const onCellChange = useCallback(
    (changes: CellChange[]) => setData((d) => applyChanges(d, changes)),
    [],
  );
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Single click opens the editor (<code>editOn="single"</code>).
      </p>
      <DataTable
        data={data}
        columns={richColumns}
        editable
        editOn="single"
        height={360}
        onCellChange={onCellChange}
      />
    </div>
  );
};

/** Per-cell control via `getEditActivation`: only active rows edit on a single
 *  click; inactive rows keep the double-click default. */
export const PerCellEditActivation: Story = () => {
  const [data, setData] = useState<Person[]>(() => seed(20));
  const onCellChange = useCallback(
    (changes: CellChange[]) => setData((d) => applyChanges(d, changes)),
    [],
  );
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Active rows edit on a single click; inactive rows still need a double click.
      </p>
      <DataTable
        data={data}
        columns={richColumns}
        editable
        getEditActivation={({ row }) => (row.active ? "single" : "double")}
        height={360}
        onCellChange={onCellChange}
      />
    </div>
  );
};

export const Selection: Story = () => {
  const [sel, setSel] = useState<string>("none");
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Click cells; shift+click extends a range; arrow keys move; Cmd/Ctrl+A selects all;
        Cmd/Ctrl+C copies.
      </p>
      <p style={{ fontSize: "var(--sf-font-size-sm)", fontFamily: "var(--sf-font-mono)" }}>
        Selection: {sel}
      </p>
      <DataTable
        data={seed(30)}
        columns={baseColumns}
        height={360}
        onSelectionChange={(s) => setSel(JSON.stringify(s))}
      />
    </div>
  );
};

export const PasteIntoRange: Story = () => {
  const [data, setData] = useState<Person[]>(() => seed(10));
  const sample = "Pasty\t99\ttrue\tadmin\nNew\t30\tfalse\tuser";
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        1. Copy this TSV:{" "}
        <code style={{ fontFamily: "var(--sf-font-mono)" }}>
          {sample.replace(/\t/g, "↦").replace(/\n/g, "↵")}
        </code>
        <br />
        2. Click a cell to anchor.
        <br />
        3. Cmd/Ctrl+V — the 2×4 block updates from the active cell.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(sample);
        }}
      >
        Copy sample to clipboard
      </button>
      <DataTable
        data={data}
        columns={baseColumns}
        editable
        height={320}
        onCellChange={(c) => setData((d) => applyChanges(d, c))}
      />
    </div>
  );
};

export const Virtualized100k: Story = () => {
  const [data] = useState<Person[]>(() => seed(100_000));
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        100,000 rows. Scrolling should stay smooth; ~30 row elements are mounted at once.
      </p>
      <DataTable data={data} columns={baseColumns} height={480} />
    </div>
  );
};

export const Paginated: Story = () => (
  <DataTable data={seed(120)} columns={baseColumns} paginate={{ pageSize: 25 }} height={360} />
);

export const Empty: Story = () => (
  <DataTable
    data={[]}
    columns={baseColumns}
    height={200}
    empty={<span>No people. Add one to get started.</span>}
  />
);

// ---------- Tree rows ----------

type TreeNode = { id: string; name: string; role: string; value: number; children?: TreeNode[] };

const treeData: TreeNode[] = [
  {
    id: "1",
    name: "Engineering",
    role: "Department",
    value: 240,
    children: [
      { id: "1.1", name: "Alice", role: "Senior", value: 130 },
      { id: "1.2", name: "Bob", role: "Junior", value: 110 },
    ],
  },
  {
    id: "2",
    name: "Sales",
    role: "Department",
    value: 180,
    children: [
      { id: "2.1", name: "Carol", role: "Senior", value: 100 },
      { id: "2.2", name: "Dan", role: "Junior", value: 80 },
    ],
  },
  {
    id: "3",
    name: "Design",
    role: "Department",
    value: 120,
    children: [{ id: "3.1", name: "Em", role: "Senior", value: 120 }],
  },
];

const treeColumns: ColumnDef<TreeNode>[] = [
  { id: "name", header: "Name", accessor: "name", width: 14 },
  { id: "role", header: "Role", accessor: "role", width: 10 },
  { id: "value", header: "Value", accessor: "value", align: "end", width: 6 },
];

export const Tree: Story = () => (
  <div>
    <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
      Click the chevron on a parent row to expand/collapse children. Selection clears on toggle.
    </p>
    <DataTable<TreeNode>
      data={treeData}
      columns={treeColumns}
      getSubRows={(r) => r.children}
      defaultExpanded
      height={360}
    />
  </div>
);

function buildDeepTree(depth: number, breadth: number, prefix = "n"): TreeNode {
  return {
    id: prefix,
    name: `Node ${prefix}`,
    role: `depth ${prefix.split(".").length - 1}`,
    value: depth * 10,
    children:
      depth === 0
        ? undefined
        : Array.from({ length: breadth }, (_, i) =>
            buildDeepTree(depth - 1, breadth, `${prefix}.${i + 1}`),
          ),
  };
}

export const TreeDeep: Story = () => {
  const data: TreeNode[] = [buildDeepTree(5, 2)];
  return (
    <DataTable<TreeNode>
      data={data}
      columns={treeColumns}
      getSubRows={(r) => r.children}
      defaultExpanded
      height={480}
    />
  );
};

// ---------- Column groups ----------

type AddrPerson = {
  name: string;
  street: string;
  city: string;
  zip: string;
  age: number;
};

const addrData: AddrPerson[] = [
  { name: "Ada", street: "12 Main St", city: "NYC", zip: "10001", age: 30 },
  { name: "Bo", street: "34 Oak Ave", city: "SFO", zip: "94110", age: 27 },
  { name: "Cai", street: "78 Park Rd", city: "BOS", zip: "02110", age: 41 },
];

const addrColumns: ColumnDef<AddrPerson>[] = [
  { id: "name", header: "Name", accessor: "name", width: 8 },
  {
    id: "address",
    header: "Address",
    columns: [
      { id: "street", header: "Street", accessor: "street", width: 10 },
      { id: "city", header: "City", accessor: "city", width: 6 },
      { id: "zip", header: "Zip", accessor: "zip", width: 6 },
    ],
  },
  { id: "age", header: "Age", accessor: "age", align: "end", width: 6 },
];

export const ColumnGroups: Story = () => (
  <div>
    <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
      Click the chevron next to "Address" in the header to collapse the group. Leaves are replaced
      by a single placeholder column (—).
    </p>
    <DataTable<AddrPerson> data={addrData} columns={addrColumns} height={240} />
  </div>
);

// ---------- Both together ----------

type OrgNode = {
  id: string;
  name: string;
  role: string;
  city: string;
  zip: string;
  value: number;
  children?: OrgNode[];
};

const orgData: OrgNode[] = [
  {
    id: "1",
    name: "Engineering",
    role: "Dept",
    city: "—",
    zip: "—",
    value: 240,
    children: [
      { id: "1.1", name: "Alice", role: "Senior", city: "NYC", zip: "10001", value: 130 },
      { id: "1.2", name: "Bob", role: "Junior", city: "SFO", zip: "94110", value: 110 },
    ],
  },
  {
    id: "2",
    name: "Sales",
    role: "Dept",
    city: "—",
    zip: "—",
    value: 180,
    children: [{ id: "2.1", name: "Carol", role: "Senior", city: "BOS", zip: "02110", value: 100 }],
  },
];

const orgColumns: ColumnDef<OrgNode>[] = [
  { id: "name", header: "Name", accessor: "name", width: 14 },
  { id: "role", header: "Role", accessor: "role", width: 8 },
  {
    id: "location",
    header: "Location",
    columns: [
      { id: "city", header: "City", accessor: "city", width: 6 },
      { id: "zip", header: "Zip", accessor: "zip", width: 6 },
    ],
  },
  { id: "value", header: "Value", accessor: "value", align: "end", width: 6 },
];

export const TreeAndColumnGroups: Story = () => (
  <DataTable<OrgNode>
    data={orgData}
    columns={orgColumns}
    getSubRows={(r) => r.children}
    defaultExpanded
    height={320}
  />
);

// Visually merged cells. The "Department" column merges down across consecutive
// rows that share a value (rowspan), and the grouped "2026" header spans its two
// quarter columns (colspan) while the ungrouped Department/Name headers fill the
// full header height (rowspan) instead of leaving a hollow box on top.
type TeamRow = { id: string; dept: string; name: string; q1: number; q2: number };

const teamData: TeamRow[] = [
  { id: "1", dept: "Engineering", name: "Ada", q1: 12, q2: 15 },
  { id: "2", dept: "Engineering", name: "Bo", q1: 9, q2: 11 },
  { id: "3", dept: "Engineering", name: "Cai", q1: 14, q2: 13 },
  { id: "4", dept: "Design", name: "Dani", q1: 7, q2: 8 },
  { id: "5", dept: "Design", name: "Em", q1: 10, q2: 12 },
  { id: "6", dept: "Sales", name: "Fae", q1: 20, q2: 22 },
];

const teamColumns: ColumnDef<TeamRow>[] = [
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

export const MergedCells: Story = () => (
  <DataTable<TeamRow>
    data={teamData}
    columns={teamColumns}
    height={320}
    getCellSpan={({ rowIndex, colIndex }) => {
      // Only the Department column merges, and only at the top of each run.
      if (colIndex !== 0) return undefined;
      const dept = teamData[rowIndex]?.dept;
      if (dept == null) return undefined;
      if (teamData[rowIndex - 1]?.dept === dept) return undefined;
      let rowSpan = 1;
      while (teamData[rowIndex + rowSpan]?.dept === dept) rowSpan++;
      return rowSpan > 1 ? { rowSpan } : undefined;
    }}
  />
);

// Freeze the first N columns (here 2) so they stay pinned to the left while the
// rest scroll horizontally — the column analogue of the sticky header. A soft
// shadow marks the frozen boundary once you scroll right. The narrow wrapper
// forces horizontal overflow so there's something to scroll.
const wideColumns: ColumnDef<Person>[] = [
  { id: "name", header: "Name", accessor: "name", width: 10, sortable: true },
  { id: "role", header: "Role", accessor: "role", width: 8 },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `m${i}`,
    header: `Month ${i + 1}`,
    accessor: (r: Person) => r.age + i,
    align: "end" as const,
    width: 6,
  })),
];

export const FrozenColumns: Story = () => (
  <div style={{ width: 520 }}>
    <DataTable data={seed(60)} columns={wideColumns} height={360} frozenColumns={2} />
  </div>
);

// Cell density + text size, independent 4-rung scales (issue: dense grids).
export const Density: Story = () => {
  const levels = ["xs", "sm", "md", "lg"] as const;
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
      {levels.map((s) => (
        <div key={s}>
          <p
            style={{
              fontSize: "var(--sf-font-size-sm)",
              color: "var(--sf-color-muted)",
              margin: "0 0 4px",
            }}
          >
            cellPadding={s} · cellFontSize={s}
          </p>
          <DataTable
            data={seed(6)}
            columns={baseColumns}
            height={200}
            cellPadding={s}
            cellFontSize={s}
          />
        </div>
      ))}
    </div>
  );
};

// Hold a fixed height with too few rows: the empty band below the last row (and
// the right gutter, with columnFill) render as the same dither — a filled panel.
export const FillHeight: Story = () => (
  <div style={{ display: "flex", gap: "var(--sf-unit)" }}>
    <DataTable data={seed(4)} columns={baseColumns} height={320} fillHeight columnFill />
    <DataTable data={seed(4)} columns={baseColumns} height={320} fillHeight />
  </div>
);

// Coloured range highlights (the Excel "coloured range reference" look): a light
// fill plus a solid border around each block. Positional and declarative — use
// several colours to mark separate ranges, e.g. charting series.
export const Highlights: Story = () => (
  <DataTable
    data={seed(12)}
    columns={baseColumns}
    height={360}
    highlights={[
      // The Age column as one series (default palette colour 0).
      { id: "age", range: { start: { row: 0, col: 1 }, end: { row: 11, col: 1 } } },
      // The Score column as a second series (default palette colour 1).
      { id: "score", range: { start: { row: 0, col: 5 }, end: { row: 11, col: 5 } } },
      // A block of rows flagged in an explicit colour.
      {
        id: "flag",
        range: { start: { row: 3, col: 3 }, end: { row: 6, col: 4 } },
        color: "var(--sf-color-danger)",
      },
    ]}
  />
);

// Select-to-highlight: drag a range with the mouse, then "Mark range" turns the
// live selection into a persistent coloured highlight. This is the declarative
// pattern — the DataTable renders `highlights`; you own the list and add to it
// from `onSelectionChange` (e.g. to pick charting ranges the way Excel does).
export const SelectToHighlight: Story = () => {
  const [sel, setSel] = useState<import("./types").CellRange | null>(null);
  const [highlights, setHighlights] = useState<import("./types").DataTableHighlight[]>([]);
  const add = () => {
    if (!sel) return;
    setHighlights((prev) => [...prev, { id: `h${prev.length}`, range: sel }]);
  };
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
      <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)", alignItems: "center" }}>
        <button type="button" onClick={add} disabled={!sel}>
          Mark range ({highlights.length})
        </button>
        <button type="button" onClick={() => setHighlights([])} disabled={!highlights.length}>
          Clear
        </button>
        <span style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
          Drag to select cells, then Mark range.
        </span>
      </div>
      <DataTable
        data={seed(12)}
        columns={baseColumns}
        height={320}
        highlights={highlights}
        onSelectionChange={(s) => setSel(s.range)}
      />
    </div>
  );
};
