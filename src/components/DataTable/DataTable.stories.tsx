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
};

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

export const Editable: Story = () => {
  const [data, setData] = useState<Person[]>(() => seed(20));
  const onCellChange = useCallback(
    (changes: CellChange[]) => setData((d) => applyChanges(d, changes)),
    [],
  );
  return (
    <div>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Double-click, F2, or Enter on a focused cell to edit. Enter / Tab commits, Esc cancels.
      </p>
      <DataTable
        data={data}
        columns={baseColumns}
        editable
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
      <p style={{ fontSize: "var(--sf-font-size-xs)", fontFamily: "var(--sf-font-mono)" }}>
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
