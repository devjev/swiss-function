/* CT harnesses for the shared drag-and-drop context (Playwright components
   can't be defined in the spec file). */
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useId, useState } from "react";
import { TableInput, type TableInputColumn } from "../../components/TableInput";
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
