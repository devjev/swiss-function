import type { Story } from "@ladle/react";
import { useState } from "react";
import { TextEditInline, type TextEditInlineProps } from "./TextEditInline";

const LONG =
  "Ship the release notes, then reconcile the changelog against the tags. " +
  "The v1.10.1 line still references a filler regression that we already fixed.";

export const Playground: Story<TextEditInlineProps> = (args) => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <TextEditInline {...args} />
  </div>
);
Playground.args = { defaultValue: LONG, placeholder: "Add a note…", size: "md", maxRows: 8 };
Playground.argTypes = {
  size: { control: { type: "radio" }, options: ["sm", "md", "lg"] },
  maxRows: { control: { type: "number" } },
};

/** Rests as one line; hover to peek the full text, click to edit. */
export const Default: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <TextEditInline defaultValue={LONG} placeholder="Add a note…" />
    {/* Following content stays put — the expanded overlay hovers above it. */}
    <p style={{ fontSize: "var(--sf-font-size-sm)", marginBlockStart: "var(--sf-unit)" }}>
      This paragraph does not move when the field above expands.
    </p>
  </div>
);

/** The three heights line up with Input (`sm` 1u / `md` 1.5u / `lg` 2u). */
export const Sizes: Story = () => (
  <div
    style={{
      display: "grid",
      gap: "var(--sf-unit)",
      maxWidth: "calc(var(--sf-unit) * 20)",
    }}
  >
    <TextEditInline size="sm" defaultValue={LONG} />
    <TextEditInline size="md" defaultValue={LONG} />
    <TextEditInline size="lg" defaultValue={LONG} />
  </div>
);

/** Empty shows the placeholder; a short value never overflows (no ellipsis). */
export const States: Story = () => (
  <div
    style={{
      display: "grid",
      gap: "var(--sf-unit)",
      maxWidth: "calc(var(--sf-unit) * 20)",
    }}
  >
    <TextEditInline placeholder="Empty — placeholder only…" />
    <TextEditInline defaultValue="Fits on one line." />
    <TextEditInline defaultValue={LONG} />
  </div>
);

export const Controlled: Story = () => {
  const [value, setValue] = useState(LONG);
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 22)" }}>
      <TextEditInline value={value} onChange={(e) => setValue(e.target.value)} />
      <p style={{ fontSize: "var(--sf-font-size-sm)", marginBlockStart: "var(--sf-unit)" }}>
        {value.length} chars
      </p>
    </div>
  );
};
