import type { Story } from "@ladle/react";
import { useState } from "react";
import { RadioTable } from "./RadioTable";

const PLANS = [
  { value: "starter", label: "Starter", description: "For small teams getting started." },
  { value: "pro", label: "Pro", description: "Adds SSO, audit logs, and priority support." },
  { value: "team", label: "Team", description: "Everything in Pro, plus shared workspaces." },
  {
    value: "enterprise",
    label: "Enterprise",
    description: "Custom limits and a dedicated contact.",
  },
];

export const Playground: Story = () => {
  const [value, setValue] = useState("pro");
  return (
    <div style={{ maxWidth: "34rem" }}>
      <RadioTable value={value} onValueChange={(v) => setValue(String(v))}>
        {PLANS.map((p) => (
          <RadioTable.Option
            key={p.value}
            value={p.value}
            label={p.label}
            description={p.description}
          />
        ))}
      </RadioTable>
    </div>
  );
};

export const Resizable: Story = () => {
  const [value, setValue] = useState("pro");
  return (
    // Drag the bottom-right corner: each description moves to the right of its
    // label when wide, and drops below it when narrow.
    <div
      style={{
        width: "34rem",
        minWidth: "12rem",
        maxWidth: "48rem",
        resize: "horizontal",
        overflow: "auto",
        padding: "1px",
      }}
    >
      <RadioTable value={value} onValueChange={(v) => setValue(String(v))}>
        {PLANS.map((p) => (
          <RadioTable.Option
            key={p.value}
            value={p.value}
            label={p.label}
            description={p.description}
          />
        ))}
      </RadioTable>
    </div>
  );
};

export const WithDisabled: Story = () => (
  <div style={{ maxWidth: "34rem" }}>
    <RadioTable defaultValue="pro">
      <RadioTable.Option value="starter" label="Starter" description="For small teams." />
      <RadioTable.Option value="pro" label="Pro" description="Adds SSO and audit logs." />
      <RadioTable.Option
        value="enterprise"
        label="Enterprise"
        description="Contact sales to enable."
        disabled
      />
    </RadioTable>
  </div>
);

export const NoDescriptions: Story = () => (
  <div style={{ maxWidth: "20rem" }}>
    <RadioTable defaultValue="medium">
      <RadioTable.Option value="small" label="Small" />
      <RadioTable.Option value="medium" label="Medium" />
      <RadioTable.Option value="large" label="Large" />
    </RadioTable>
  </div>
);
