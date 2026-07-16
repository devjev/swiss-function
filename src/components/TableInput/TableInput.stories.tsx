import type { Story } from "@ladle/react";
import { useState } from "react";
import { Field } from "../Field";
import { TableInput, type TableInputColumn } from "./TableInput";

/* Deterministic fixtures: fixed rows, no randomness or `new Date()` at module
   scope, so the stories are stable. */

interface Holding {
  ticker: string;
  shares: number | null;
  assetClass: string;
  active: boolean;
}

const HOLDING_COLUMNS: TableInputColumn<Holding>[] = [
  { key: "ticker", header: "Ticker", edit: { type: "text" } },
  {
    key: "shares",
    header: "Shares",
    edit: { type: "number", decimals: 0 },
    width: 6,
    align: "end",
  },
  {
    key: "assetClass",
    header: "Class",
    edit: {
      type: "select",
      options: [
        { value: "equity", label: "Equity" },
        { value: "bond", label: "Bond" },
        { value: "cash", label: "Cash" },
      ],
    },
    width: 8,
  },
  { key: "active", header: "Active", edit: { type: "boolean" }, width: 4, align: "center" },
];

const INITIAL: Holding[] = [
  { ticker: "AAPL", shares: 120, assetClass: "equity", active: true },
  { ticker: "TLT", shares: 50, assetClass: "bond", active: true },
  { ticker: "USD", shares: null, assetClass: "cash", active: false },
];

export const Playground: Story = () => {
  const [rows, setRows] = useState<Holding[]>(INITIAL);
  return (
    <div style={{ maxWidth: "40rem" }}>
      <TableInput columns={HOLDING_COLUMNS} value={rows} onChange={setRows} />
    </div>
  );
};

export const InAField: Story = () => {
  const [rows, setRows] = useState<Holding[]>(INITIAL);
  return (
    <div style={{ maxWidth: "40rem" }}>
      <Field orientation="vertical">
        <Field.Label>Holdings</Field.Label>
        <TableInput columns={HOLDING_COLUMNS} value={rows} onChange={setRows} />
        <Field.Description>One row per position. Add or remove as needed.</Field.Description>
      </Field>
    </div>
  );
};

export const Reorderable: Story = () => {
  const [rows, setRows] = useState<Holding[]>(INITIAL);
  return (
    <div style={{ maxWidth: "40rem" }}>
      <TableInput columns={HOLDING_COLUMNS} value={rows} onChange={setRows} reorderable />
    </div>
  );
};

export const MinMaxRows: Story = () => {
  const [rows, setRows] = useState<Holding[]>(INITIAL);
  return (
    <div style={{ maxWidth: "40rem" }}>
      {/* Can't drop below 1 row; can't grow past 5. */}
      <TableInput
        columns={HOLDING_COLUMNS}
        value={rows}
        onChange={setRows}
        minRows={1}
        maxRows={5}
      />
    </div>
  );
};

interface Milestone {
  name: string;
  due: Date | null;
  done: boolean;
}

const MILESTONE_COLUMNS: TableInputColumn<Milestone>[] = [
  { key: "name", header: "Milestone", edit: { type: "text" } },
  { key: "due", header: "Due", edit: { type: "date" } },
  { key: "done", header: "Done", edit: { type: "boolean" }, align: "center" },
];

export const DatesAndText: Story = () => {
  const [rows, setRows] = useState<Milestone[]>([
    { name: "Draft spec", due: new Date(2026, 6, 20), done: true },
    { name: "Ship M1", due: new Date(2026, 7, 3), done: false },
  ]);
  return (
    // `equalColumns`: every column gets the same share, so a wide date editor
    // doesn't crowd out the text one.
    <div style={{ maxWidth: "40rem" }}>
      <TableInput
        columns={MILESTONE_COLUMNS}
        value={rows}
        onChange={setRows}
        equalColumns
        reorderable
      />
    </div>
  );
};

export const Disabled: Story = () => (
  <div style={{ maxWidth: "40rem" }}>
    <TableInput columns={HOLDING_COLUMNS} value={INITIAL} onChange={() => {}} disabled />
  </div>
);

/** Narrow container: columns shrink toward their minimum widths, and once they
 *  can't all fit the table scrolls horizontally rather than collapsing columns
 *  into each other. Each control fills its cell (numbers stay right-aligned). */
export const Narrow: Story = () => {
  const [rows, setRows] = useState<Holding[]>(INITIAL);
  return (
    <div style={{ width: "18rem" }}>
      <TableInput columns={HOLDING_COLUMNS} value={rows} onChange={setRows} />
    </div>
  );
};
