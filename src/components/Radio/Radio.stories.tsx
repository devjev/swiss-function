import type { Story } from "@ladle/react";
import { Radio, RadioGroup } from "./Radio";

export const Group: Story = () => (
  <RadioGroup defaultValue="medium">
    <label htmlFor="radio-small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Radio id="radio-small" value="small" /> Small
    </label>
    <label htmlFor="radio-medium" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Radio id="radio-medium" value="medium" /> Medium
    </label>
    <label htmlFor="radio-large" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Radio id="radio-large" value="large" /> Large
    </label>
  </RadioGroup>
);
