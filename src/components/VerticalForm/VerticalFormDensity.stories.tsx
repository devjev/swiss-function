import type { Story } from "@ladle/react";
import { useState } from "react";
import { Input } from "../Input";
import { Radio, RadioGroup } from "../Radio";
import { TableInput, type TableInputColumn } from "../TableInput";
import { TextEdit } from "../TextEdit";
import { VerticalForm } from "./VerticalForm";

// Repro for issue #87: a mixed form (radio group, textarea, inputs, one
// TableInput) with `bare nav minBlock={1}`. The rail should read as contiguous
// filled blocks proportional to each field's height (the density read), with
// the tall TableInput capped so it doesn't dominate — not every field flattened
// to a label rule.

interface Row {
  a: string;
  b: string;
}
const COLS: TableInputColumn<Row>[] = [
  { key: "a", header: "A", edit: { type: "text" } },
  { key: "b", header: "B", edit: { type: "text" } },
];
const ROWS: Row[] = [
  { a: "one", b: "1" },
  { a: "two", b: "2" },
  { a: "three", b: "3" },
];

export const Density: Story = () => {
  const [rows, setRows] = useState(ROWS);
  return (
    <div style={{ height: "26rem", width: "40rem", border: "1px solid var(--sf-color-border)" }}>
      <VerticalForm bare nav side="left" minBlock={1}>
        <VerticalForm.Field label="Name">
          <Input placeholder="Name" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Size">
          <RadioGroup defaultValue="m">
            <Radio value="s" /> Small
            <Radio value="m" /> Medium
            <Radio value="l" /> Large
            <Radio value="xl" /> Extra large
          </RadioGroup>
        </VerticalForm.Field>
        <VerticalForm.Field label="Notes">
          <TextEdit rows={4} placeholder="Notes" />
        </VerticalForm.Field>
        <VerticalForm.Field label="Rows">
          <TableInput columns={COLS} value={rows} onChange={setRows} />
        </VerticalForm.Field>
        <VerticalForm.Field label="Owner">
          <Input placeholder="Owner" />
        </VerticalForm.Field>
      </VerticalForm>
    </div>
  );
};
