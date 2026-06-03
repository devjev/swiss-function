import type { Story } from "@ladle/react";
import { Radio, RadioGroup } from "./Radio";

export const Group: Story = () => (
  <RadioGroup defaultValue="medium">
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Radio value="small" /> Small
    </label>
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Radio value="medium" /> Medium
    </label>
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Radio value="large" /> Large
    </label>
  </RadioGroup>
);
