import type { Story } from "@ladle/react";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { Chip } from "../components/Chip";
import { DataTable } from "../components/DataTable";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { Switch } from "../components/Switch";

// The two densities (tokens.css → "Density") side by side: the same controls
// and the same table under the default compact metrics (14px on a 20px unit)
// and under `data-density="comfortable"` (16px on 24px). Each region carries
// its own attribute, which is how an app sets it.

const rows = [
  { fund: "Global Equity", weight: 42.5, change: 1.2 },
  { fund: "Swiss Bonds", weight: 31, change: -0.4 },
  { fund: "Real Estate", weight: 16.5, change: 0.3 },
  { fund: "Cash", weight: 10, change: -1.1 },
];

const columns = [
  { id: "fund", header: "Fund", accessor: "fund" as const },
  { id: "weight", header: "Weight %", accessor: "weight" as const },
  { id: "change", header: "Change", accessor: "change" as const },
];

function Sample({ density }: { density: "compact" | "comfortable" }) {
  return (
    <section
      data-density={density}
      style={{ display: "grid", gap: "var(--sf-unit)", alignContent: "start", minInlineSize: 0 }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "var(--sf-font-size-lg)",
          fontWeight: "var(--sf-font-weight-semibold)",
        }}
      >
        {density}
      </h3>
      <Field orientation="vertical">
        <Field.Label>Portfolio</Field.Label>
        <Input defaultValue="Balanced CHF" />
        <Field.Description>One line of copy at this density's text size.</Field.Description>
      </Field>
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          justifyContent: "start",
          alignItems: "center",
          gap: "calc(var(--sf-unit) / 2)",
        }}
      >
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="secondary" size="sm">
          Small
        </Button>
        <Checkbox defaultChecked aria-label="Active" />
        <Switch defaultChecked aria-label="Live" />
        <Chip tone="success" dot>
          settled
        </Chip>
      </div>
      <DataTable data={rows} columns={columns} />
    </section>
  );
}

export const Compare: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "calc(var(--sf-unit) * 2)",
      maxInlineSize: "64rem",
    }}
  >
    <Sample density="compact" />
    <Sample density="comfortable" />
  </div>
);
