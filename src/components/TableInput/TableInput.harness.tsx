/* CT harness (Playwright components can't be defined in the spec file). A
   controlled TableInput whose current rows are mirrored into an <output> for
   assertions. */
import { useState } from "react";
import { TableInput, type TableInputColumn } from "./TableInput";

interface Row {
  name: string;
  qty: number | null;
  kind: string;
  ok: boolean;
}

const COLUMNS: TableInputColumn<Row>[] = [
  { key: "name", header: "Name", edit: { type: "text" } },
  { key: "qty", header: "Qty", edit: { type: "number", decimals: 0 }, width: 6, align: "end" },
  {
    key: "kind",
    header: "Kind",
    edit: {
      type: "select",
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
    },
    width: 8,
  },
  { key: "ok", header: "OK", edit: { type: "boolean" }, width: 4, align: "center" },
];

const INITIAL: Row[] = [
  { name: "First", qty: 1, kind: "a", ok: true },
  { name: "Second", qty: 2, kind: "b", ok: false },
];

export function TableInputHarness({
  reorderable,
  minRows,
  maxRows,
}: {
  reorderable?: boolean;
  minRows?: number;
  maxRows?: number;
}) {
  const [rows, setRows] = useState<Row[]>(INITIAL);
  return (
    <div style={{ width: 560 }}>
      <TableInput
        columns={COLUMNS}
        value={rows}
        onChange={setRows}
        reorderable={reorderable}
        minRows={minRows}
        maxRows={maxRows}
      />
      <output data-testid="rows">{rows.map((r) => r.name).join("|")}</output>
    </div>
  );
}
