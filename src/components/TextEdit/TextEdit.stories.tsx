import type { Story } from "@ladle/react";
import { useState } from "react";
import { TextEdit, type TextEditProps } from "./TextEdit";

export const Playground: Story<TextEditProps> = (args) => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <TextEdit {...args} />
  </div>
);
Playground.args = { placeholder: "Type something…", rows: 4, disabled: false };
Playground.argTypes = {
  rows: { control: { type: "number" } },
  disabled: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <TextEdit placeholder="Write a note…" />
  </div>
);

export const Controlled: Story = () => {
  const [value, setValue] = useState("Hello.\nThis is multi-line.\n");
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 22)" }}>
      <TextEdit value={value} onChange={(e) => setValue(e.target.value)} rows={6} />
      <p style={{ fontSize: "var(--sf-font-size-xs)", color: "var(--sf-color-muted)" }}>
        {value.length} chars
      </p>
    </div>
  );
};

export const Tall: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 24)" }}>
    <TextEdit rows={10} placeholder="Lots of room." />
  </div>
);

export const Disabled: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <TextEdit disabled defaultValue="Read-only content" rows={3} />
  </div>
);
