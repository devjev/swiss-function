/* CT harnesses for the shared drag-and-drop context (Playwright components
   can't be defined in the spec file). */
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useId, useState } from "react";
import { type ColumnDef, DataTable } from "../../components/DataTable";
import { Explorer, type ExplorerColumn, type ExplorerNode } from "../../components/Explorer";
import { TableInput, type TableInputColumn } from "../../components/TableInput";
import { WindowArray } from "../../components/WindowArray";
import { SF_REGION_KEY, SfDndProvider, useSfDnd, useSfDndRegion } from "./index";

interface Row {
  name: string;
}

const COLUMNS: TableInputColumn<Row>[] = [{ key: "name", header: "Name", edit: { type: "text" } }];

/** Reports whether it can see the shared registry (drives the auto-detect test). */
function Probe({ id }: { id: string }) {
  const shared = useSfDnd();
  return <output data-testid={id}>{shared ? "shared" : "own"}</output>;
}

/** The same probe rendered inside and outside a provider. */
export function ProbeHarness() {
  return (
    <div>
      <SfDndProvider>
        <Probe id="inside" />
      </SfDndProvider>
      <Probe id="outside" />
    </div>
  );
}

/** A reorderable TableInput inside a provider — proves reordering works when the
 *  widget joins the shared context instead of owning its own. */
export function ReorderHarness() {
  const [rows, setRows] = useState<Row[]>([
    { name: "First" },
    { name: "Second" },
    { name: "Third" },
  ]);
  return (
    <SfDndProvider>
      <div style={{ width: 360 }}>
        <TableInput columns={COLUMNS} value={rows} onChange={setRows} reorderable />
        <output data-testid="order">{rows.map((r) => r.name).join("|")}</output>
      </div>
    </SfDndProvider>
  );
}

function HostChip() {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: "host-item", data: { k: "v" } });
  return (
    <button type="button" data-testid="chip" ref={setNodeRef} {...listeners} {...attributes}>
      host-item
    </button>
  );
}

/** A self-contained region built on the public low-level API: it registers with
 *  the provider, renders one region-stamped draggable and one region-stamped
 *  droppable, and reports whether its OWN internal `onDragEnd` fired vs a foreign
 *  item arriving through `onExternalDrop`. Two of these prove cross-region
 *  routing without leaning on any one widget's id scheme. */
function TestRegion({ label }: { label: string }) {
  const registry = useSfDnd();
  const regionId = useId();
  const [event, setEvent] = useState("none");
  // Transient drag state, like Explorer's `draggingId`: set on start, reset on
  // end / cancel. If the provider never resets it on a cross-region drag-out,
  // this stays "dragging" (the ghosted-source-row leak).
  const [dragState, setDragState] = useState("idle");
  useSfDndRegion(registry, {
    id: regionId,
    onDragStart: () => setDragState("dragging"),
    // A drop that stays in-region routes here (should NOT fire for a drag out).
    onDragEnd: (e) => {
      setDragState("idle");
      setEvent(`internal:${String(e.active.id)}`);
    },
    // The provider calls this on the SOURCE region of a cross-region drag-out.
    onDragCancel: () => setDragState("idle"),
    // A foreign item (host or another region) dropped over this region.
    onExternalDrop: (e) => setEvent(`external:${String(e.active.id)}`),
  });
  const drag = useDraggable({ id: `${label}-item`, data: { [SF_REGION_KEY]: regionId } });
  const drop = useDroppable({ id: `${label}-drop`, data: { [SF_REGION_KEY]: regionId } });
  return (
    <div
      ref={drop.setNodeRef}
      data-testid={`region-${label}`}
      style={{ width: 200, height: 120, border: "1px solid #ccc", padding: 8 }}
    >
      <button
        type="button"
        data-testid={`drag-${label}`}
        ref={drag.setNodeRef}
        {...drag.listeners}
        {...drag.attributes}
      >
        {label}-item
      </button>
      <output data-testid={`event-${label}`}>{event}</output>
      <output data-testid={`drag-state-${label}`}>{dragState}</output>
    </div>
  );
}

/** Two independent regions in one provider — for the widget-to-widget drag-out. */
export function CrossWidgetHarness() {
  return (
    <SfDndProvider>
      <div style={{ display: "flex", gap: 40 }}>
        <TestRegion label="a" />
        <TestRegion label="b" />
      </div>
    </SfDndProvider>
  );
}

/** Two reorderable TableInputs in one provider — proves their (formerly
 *  colliding, index-based) row ids are namespaced per region, so a drag within
 *  one table reorders IT and never spuriously drops on the other. */
export function TwoTableHarness() {
  const [rowsA, setRowsA] = useState<Row[]>([{ name: "A1" }, { name: "A2" }, { name: "A3" }]);
  const [rowsB, setRowsB] = useState<Row[]>([{ name: "B1" }, { name: "B2" }]);
  const [bExternal, setBExternal] = useState("none");
  return (
    <SfDndProvider>
      <div style={{ display: "flex", gap: 40 }}>
        <div style={{ width: 300 }} data-testid="table-a">
          <TableInput columns={COLUMNS} value={rowsA} onChange={setRowsA} reorderable />
          <output data-testid="order-a">{rowsA.map((r) => r.name).join("|")}</output>
        </div>
        <div style={{ width: 300 }} data-testid="table-b">
          <TableInput
            columns={COLUMNS}
            value={rowsB}
            onChange={setRowsB}
            reorderable
            onExternalDrop={({ active }) => setBExternal(String(active.id))}
          />
          <output data-testid="order-b">{rowsB.map((r) => r.name).join("|")}</output>
          <output data-testid="b-external">{bExternal}</output>
        </div>
      </div>
    </SfDndProvider>
  );
}

// --- The widgets that load dnd-kit lazily (issue #93), inside a provider ------

const TREE: ExplorerNode[] = [
  { id: "docs", name: "docs", children: [{ id: "guide", name: "guide.md" }] },
  { id: "readme", name: "README.md" },
  { id: "license", name: "LICENSE" },
];
const TREE_COLUMNS: ExplorerColumn[] = [{ id: "name", header: "Name" }];
type TableRow = { name: string; size: number };
const TABLE_DATA: TableRow[] = [
  { name: "a", size: 1 },
  { name: "b", size: 2 },
];
const TABLE_COLUMNS: ColumnDef<TableRow>[] = [
  { id: "name", header: "Name", accessor: "name" },
  { id: "size", header: "Size", accessor: "size" },
];

/** A host chip, an editable Explorer, a reorderable DataTable and a movable
 *  WindowArray under one provider, each reporting what reached it. */
export function SharedWidgetsHarness() {
  const [treeDrop, setTreeDrop] = useState("none");
  const [move, setMove] = useState("none");
  const [tableDrop, setTableDrop] = useState("none");
  const [order, setOrder] = useState(["name", "size"]);
  const [windowDrop, setWindowDrop] = useState("none");
  const [windowMove, setWindowMove] = useState("none");
  return (
    <SfDndProvider>
      <div style={{ display: "grid", gap: 24, width: 900 }}>
        <div>
          <HostChip />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "300px 400px", gap: 40 }}>
          <div data-testid="tree" style={{ height: 160 }}>
            <Explorer
              nodes={TREE}
              columns={TREE_COLUMNS}
              editable
              expandedIds={new Set(["docs"])}
              onMove={(id, parentId) => setMove(`${id}->${parentId ?? "root"}`)}
              onExternalDrop={({ active, overNode }) =>
                setTreeDrop(`${String(active.id)}@${overNode?.id ?? "none"}`)
              }
            />
          </div>
          <div data-testid="table">
            <DataTable
              data={TABLE_DATA}
              columns={TABLE_COLUMNS}
              reorderableColumns
              columnOrder={order}
              onColumnOrderChange={setOrder}
              onExternalDrop={({ active, overColumnId }) =>
                setTableDrop(`${String(active.id)}@${overColumnId ?? "none"}`)
              }
            />
          </div>
        </div>
        <div style={{ inlineSize: 600, blockSize: 200 }}>
          <WindowArray
            aria-label="Shared strip"
            onWindowMove={(m) => setWindowMove(`${m.windowId}->${JSON.stringify(m.to)}`)}
            onExternalDrop={({ active, over }) =>
              setWindowDrop(`${String(active.id)}@${JSON.stringify(over)}`)
            }
          >
            <WindowArray.Column id="c1" defaultWidth={220}>
              <WindowArray.Window id="w1" title="One">
                <p>one</p>
              </WindowArray.Window>
            </WindowArray.Column>
            <WindowArray.Column id="c2" defaultWidth={220}>
              <WindowArray.Window id="w2" title="Two">
                <p>two</p>
              </WindowArray.Window>
            </WindowArray.Column>
          </WindowArray>
        </div>
        <output data-testid="tree-drop">{treeDrop}</output>
        <output data-testid="tree-move">{move}</output>
        <output data-testid="table-drop">{tableDrop}</output>
        <output data-testid="table-order">{order.join("|")}</output>
        <output data-testid="window-drop">{windowDrop}</output>
        <output data-testid="window-move">{windowMove}</output>
      </div>
    </SfDndProvider>
  );
}

/** A host draggable plus a reorderable TableInput that reports external drops. */
export function ExternalDropHarness() {
  const [rows, setRows] = useState<Row[]>([{ name: "First" }, { name: "Second" }]);
  const [drop, setDrop] = useState("none");
  return (
    <SfDndProvider>
      <div style={{ width: 360 }}>
        <HostChip />
        <TableInput
          columns={COLUMNS}
          value={rows}
          onChange={setRows}
          reorderable
          onExternalDrop={({ active, overIndex }) => setDrop(`${String(active.id)}@${overIndex}`)}
        />
        <output data-testid="drop">{drop}</output>
        <output data-testid="order">{rows.map((r) => r.name).join("|")}</output>
      </div>
    </SfDndProvider>
  );
}
