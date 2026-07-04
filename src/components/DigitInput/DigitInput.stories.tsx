import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Field } from "../Field";
import type { DigitInputProps } from "./DigitInput";
import { DigitInput } from "./DigitInput";

export default { title: "DigitInput" };

/** Calculator model: digits push in from the right (type 4 → 000.04), Backspace
 *  pops, Delete clears to the pristine `_` mask, ArrowUp/Down step the last
 *  place. Paste understands separators and units ("42 %", "1,234.56"). */
export const Playground: Story<DigitInputProps> = (args) => <DigitInput {...args} />;
Playground.args = {
  digits: 3,
  decimals: 2,
  unit: "%",
  disabled: false,
  readOnly: false,
};
Playground.argTypes = {
  mode: { options: ["push", "mask"], control: { type: "radio" }, defaultValue: "push" },
  size: { options: ["sm", "md", "lg"], control: { type: "radio" }, defaultValue: "md" },
  decimalSeparator: { control: { type: "text" }, defaultValue: "." },
};

/** The issue sketch: `(_ _ _._ _ %)`. */
export const Percent: Story = () => <DigitInput digits={3} decimals={2} unit="%" />;

/** Comma display separator; the form value stays canonical ("1234.50"). */
export const Money: Story = () => (
  <DigitInput digits={4} decimals={2} decimalSeparator="," unit="CHF" />
);

/** With decimals=0 and no unit it reads as a numeric code entry. */
export const Pin: Story = () => <DigitInput digits={6} />;

/** mode="mask" is the 2FA feel: each cell is a focus stop, typing fills
 *  left-to-right with auto-advance, and the value stays null until every cell
 *  is filled. Pasting "12.34" fills positionally (012.34). */
export const Mask: Story = () => <DigitInput mode="mask" digits={3} decimals={2} unit="%" />;

/** A classic six-cell code entry in mask mode. */
export const MaskPin: Story = () => <DigitInput mode="mask" digits={6} />;

export const AllSizes: Story = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--sf-space-4)" }}>
    <DigitInput size="sm" digits={3} decimals={2} unit="%" defaultValue={42.5} />
    <DigitInput size="md" digits={3} decimals={2} unit="%" defaultValue={42.5} />
    <DigitInput size="lg" digits={3} decimals={2} unit="%" defaultValue={42.5} />
  </div>
);

/** Controlled: external changes render zero-padded; null renders the mask. */
export const Controlled: Story = () => {
  const [value, setValue] = useState<number | null>(19.5);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sf-space-4)" }}>
      <DigitInput digits={2} decimals={1} unit="°C" value={value} onValueChange={setValue} />
      <Button size="sm" onClick={() => setValue(21)}>
        21°
      </Button>
      <Button size="sm" onClick={() => setValue(null)}>
        Clear
      </Button>
      <span style={{ fontFamily: "var(--sf-font-mono)" }}>{value === null ? "null" : value}</span>
    </div>
  );
};

/** Field wires the label/description to the hidden input automatically. */
export const InField: Story = () => (
  <Field required style={{ maxWidth: "20rem" }}>
    <Field.Label>Discount</Field.Label>
    <DigitInput digits={2} decimals={1} unit="%" name="discount" required />
    <Field.Description>Applied at checkout; steps of 0.1.</Field.Description>
  </Field>
);
