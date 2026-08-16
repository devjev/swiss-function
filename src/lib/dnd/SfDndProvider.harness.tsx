/* CT harnesses for the shared drag-and-drop context (Playwright components
   can't be defined in the spec file). */
import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { TableInput, type TableInputColumn } from "../../components/TableInput";
import { SfDndProvider, useSfDnd } from "./index";

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
