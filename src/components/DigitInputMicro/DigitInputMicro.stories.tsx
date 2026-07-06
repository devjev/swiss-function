import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Field } from "../Field";
import type { DigitInputMicroProps } from "./DigitInputMicro";
import { DigitInputMicro } from "./DigitInputMicro";

export default { title: "DigitInputMicro" };

/** A regular, variable-length numeric input. At rest it shows a few faded
 *  placeholder digit slots (the "mask" hint); they recede as you type and the
 *  field keeps growing past them. Value is `number | null`. */
export const Playground: Story<DigitInputMicroProps> = (args) => <DigitInputMicro {...args} />;
Playground.args = {
  slots: 4,
  decimals: 0,
  unit: "",
  disabled: false,
  readOnly: false,
};
Playground.argTypes = {
  size: { options: ["sm", "md", "lg"], control: { type: "radio" }, defaultValue: "md" },
};

/** Integer entry with four placeholder slots. */
export const Default: Story = () => <DigitInputMicro slots={4} />;

/** Decimals enabled: one decimal point, capped to two places. */
export const Decimals: Story = () => <DigitInputMicro slots={4} decimals={2} />;

/** A unit suffix reads as metadata after the digits. */
export const WithUnit: Story = () => (
  <DigitInputMicro slots={3} decimals={2} unit="%" defaultValue={42.5} />
);

/** Bounded input — clamps to [0, 100] on blur. */
export const Bounded: Story = () => <DigitInputMicro slots={3} min={0} max={100} />;

export const AllSizes: Story = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--sf-space-4)" }}>
    <DigitInputMicro size="sm" slots={4} decimals={2} unit="%" defaultValue={42.5} />
    <DigitInputMicro size="md" slots={4} decimals={2} unit="%" defaultValue={42.5} />
    <DigitInputMicro size="lg" slots={4} decimals={2} unit="%" defaultValue={42.5} />
  </div>
);

/** In a Field, with label, description and validation slots. */
export const InField: Story = () => (
  <Field>
    <Field.Label>Quantity</Field.Label>
    <DigitInputMicro slots={5} />
    <Field.Description>Whole units only.</Field.Description>
  </Field>
);

/** Controlled: an external button sets the value; clearing sends `null`. */
export const Controlled: Story = () => {
  const [value, setValue] = useState<number | null>(1234);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sf-space-4)" }}>
      <DigitInputMicro slots={4} value={value} onValueChange={setValue} />
      <Button size="sm" onClick={() => setValue(9999)}>
        Set 9999
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setValue(null)}>
        Clear
      </Button>
      <code>{value == null ? "null" : value}</code>
    </div>
  );
};

export const Disabled: Story = () => <DigitInputMicro slots={4} defaultValue={42} disabled />;
export const ReadOnly: Story = () => <DigitInputMicro slots={4} defaultValue={42} readOnly />;
