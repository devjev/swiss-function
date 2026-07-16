/* CT harness (Playwright components cannot be defined in the spec file). */
import { RadioTable } from "./RadioTable";

export function RadioTableHarness({ onChange }: { onChange?: (v: string) => void }) {
  return (
    <RadioTable defaultValue="pro" onValueChange={(v) => onChange?.(String(v))}>
      <RadioTable.Option value="starter" label="Starter" description="For small teams." />
      <RadioTable.Option value="pro" label="Pro" description="Adds SSO and audit logs." />
      <RadioTable.Option value="team" label="Team" description="Shared workspaces." />
      <RadioTable.Option value="off" label="Enterprise" description="Contact sales." disabled />
    </RadioTable>
  );
}
