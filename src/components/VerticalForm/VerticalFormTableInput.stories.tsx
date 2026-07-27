import type { Story } from "@ladle/react";
import { useState } from "react";
import { Input } from "../Input";
import { TableInput, type TableInputColumn } from "../TableInput";
import { VerticalForm } from "./VerticalForm";

// Repro for the Minimap-vs-TableInput marker alignment bug (consumer report):
// tall, reorderable TableInput fields between plain fields. The rail markers
// must line up with where each field actually sits in the scroll body.

interface ShareClass {
  short: string;
  long: string;
  isin: string;
  ccy: string;
}
const CLASS_COLUMNS: TableInputColumn<ShareClass>[] = [
  { key: "short", header: "Short name", edit: { type: "text" }, width: 8 },
  { key: "long", header: "Long name", edit: { type: "text" } },
  { key: "isin", header: "ISIN", edit: { type: "text" }, width: 14 },
  { key: "ccy", header: "Ccy", edit: { type: "text" }, width: 5 },
];
const CLASSES: ShareClass[] = [
  { short: "A-CHF", long: "Class A CHF", isin: "LU6879030496", ccy: "CHF" },
  { short: "A-USD", long: "Class A USD", isin: "LU2058330509", ccy: "USD" },
  { short: "I-CHF", long: "Class I CHF", isin: "LU3922504053", ccy: "CHF" },
];

interface Schedule {
  tags: string;
  start: string;
  end: string;
}
const SCHEDULE_COLUMNS: TableInputColumn<Schedule>[] = [
  { key: "tags", header: "Tags", edit: { type: "text" } },
  { key: "start", header: "Window start", edit: { type: "text" } },
  { key: "end", header: "Window end", edit: { type: "text" } },
];
const SCHEDULES: Schedule[] = [
  { tags: "monthly-file", start: "every month on 1st day", end: "every month on last day" },
];

export const WithTableInputs: Story = () => {
  const [classes, setClasses] = useState(CLASSES);
  const [schedules, setSchedules] = useState(SCHEDULES);
  return (
    <div style={{ height: "30rem", width: "60rem", border: "1px solid var(--sf-color-border)" }}>
      <VerticalForm>
        <VerticalForm.Field label="Share classes">
          <TableInput columns={CLASS_COLUMNS} value={classes} onChange={setClasses} reorderable />
        </VerticalForm.Field>
        <VerticalForm.Field label="Schedules">
          <TableInput
            columns={SCHEDULE_COLUMNS}
            value={schedules}
            onChange={setSchedules}
            reorderable
          />
        </VerticalForm.Field>
        <VerticalForm.Field label="Exclude">
          <Input placeholder="Excluded tickers" />
        </VerticalForm.Field>
        <VerticalForm.Field label="People">
          <Input placeholder="Owners" />
        </VerticalForm.Field>
      </VerticalForm>
    </div>
  );
};
