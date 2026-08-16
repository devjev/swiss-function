// Stories for the shared drag-and-drop context. Two things to see:
//  1. Several library widgets reorder inside ONE dnd-kit context (open React
//     DevTools: a single DndContext in the subtree, not one per widget).
//  2. A host element (not a library widget) dragged onto an Explorer node, with
//     the drop reported through Explorer's `onExternalDrop`.

import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { Box } from "../../components/Box";
import { Chip } from "../../components/Chip";
import type { ColumnDef } from "../../components/DataTable";
import { DataTable } from "../../components/DataTable";
import type { ExplorerColumn, ExplorerNode } from "../../components/Explorer";
import { Explorer } from "../../components/Explorer";
import type { TableInputColumn } from "../../components/TableInput";
import { TableInput } from "../../components/TableInput";
import { SfDndProvider } from "./index";

export default {
  title: "lib/SfDndProvider",
};

// --- Shared context: two widgets, one dnd-kit runtime ----------------------

interface Row {
  ticker: string;
  weight: number;
}

const tableColumns: ColumnDef<Row>[] = [
  { id: "ticker", header: "Ticker", accessor: "ticker" },
  { id: "weight", header: "Weight", accessor: "weight" },
];

const tableData: Row[] = [
  { ticker: "AAPL", weight: 12 },
  { ticker: "MSFT", weight: 9 },
  { ticker: "NVDA", weight: 7 },
];

const inputColumns: TableInputColumn<Row>[] = [
  { key: "ticker", header: "Ticker", edit: { type: "text" } },
  { key: "weight", header: "Weight", edit: { type: "number" } },
];

export function SharedContext() {
  const [rows, setRows] = useState<Row[]>([
    { ticker: "AMZN", weight: 5 },
    { ticker: "GOOG", weight: 4 },
    { ticker: "META", weight: 3 },
  ]);

  return (
    <SfDndProvider>
      <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 2)", maxWidth: 640 }}>
        <div>
          <p>DataTable — drag a column header to reorder:</p>
          <DataTable data={tableData} columns={tableColumns} reorderableColumns />
        </div>
        <div>
          <p>TableInput — drag a row grip to reorder:</p>
          <TableInput columns={inputColumns} value={rows} onChange={setRows} reorderable />
        </div>
      </div>
    </SfDndProvider>
  );
}

// --- Host item dropped into a library widget --------------------------------

const explorerColumns: ExplorerColumn[] = [{ id: "name", header: "Name" }];

const tree: ExplorerNode[] = [
  {
    id: "src",
    name: "src",
    children: [
      { id: "index", name: "index.ts" },
      { id: "app", name: "app.tsx" },
    ],
  },
  { id: "readme", name: "README.md" },
];

/** A host-owned draggable, not a library widget. It carries no region id, so the
 *  provider treats it as foreign and routes its drop to the widget it lands on. */
function PaletteChip({ id, label }: { id: string; label: string }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id,
    data: { label },
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
    >
      <Chip>{label}</Chip>
    </span>
  );
}

export function HostItemIntoExplorer() {
  const [log, setLog] = useState<string[]>([]);

  return (
    <SfDndProvider renderOverlay={(id) => <Chip>{id}</Chip>}>
      <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 2)", maxWidth: 520 }}>
        <div style={{ display: "flex", gap: "var(--sf-unit)" }}>
          <PaletteChip id="task-42" label="task-42" />
          <PaletteChip id="doc-7" label="doc-7" />
        </div>
        <Box elevation={1} style={{ height: 220 }}>
          <Explorer
            nodes={tree}
            columns={explorerColumns}
            editable
            onExternalDrop={({ active, overNode }) => {
              setLog((l) => [`dropped ${String(active.id)} onto ${overNode?.name ?? "—"}`, ...l]);
            }}
          />
        </Box>
        <ol style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
          {log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
    </SfDndProvider>
  );
}
