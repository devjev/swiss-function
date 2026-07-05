import type { Story } from "@ladle/react";
import { useState } from "react";
import { DatePicker } from "../DatePicker";
import { Input } from "../Input";
import { TextEdit } from "../TextEdit";
import { ToggleGroup } from "../ToggleGroup";
import { FieldLayout } from "./FieldLayout";

export default { title: "FieldLayout" };

/** A resizable frame so you can drag the container across the wrap thresholds
 *  and watch rows carry fewer fields — the gradual, breakpoint-free collapse. */
function Frame({ children, width = 720 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      style={{
        inlineSize: width,
        minInlineSize: 260,
        maxInlineSize: 1100,
        resize: "horizontal",
        overflow: "auto",
        border: "1px solid var(--sf-color-border)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * The whole model in one form. Two sections (2u apart, no headings — hierarchy
 * from the rhythm alone). Each row mixes rigid + flexible + filler so it always
 * justifies. Drag the frame's corner across the wrap thresholds.
 */
export const Playground: Story = () => {
  const [from, setFrom] = useState<Date | null>(new Date(2026, 6, 1));
  return (
    <Frame>
      <FieldLayout>
        <FieldLayout.Section>
          <FieldLayout.Field label="Name">
            <Input defaultValue="Gilt-edged Fund" />
          </FieldLayout.Field>
          <FieldLayout.Field label="Ticker" kind="rigid" width={8}>
            <Input defaultValue="GEF" />
          </FieldLayout.Field>
          <FieldLayout.Field
            label="Valid from"
            kind="rigid"
            width={8}
            hint="When the gating right comes into force."
          >
            <DatePicker value={from} onChange={setFrom} />
          </FieldLayout.Field>
        </FieldLayout.Section>

        <FieldLayout.Section>
          <FieldLayout.Field label="Strategy" kind="rigid" width={10}>
            <ToggleGroup defaultValue={["hold"]}>
              <ToggleGroup.Item value="hold">Hold</ToggleGroup.Item>
              <ToggleGroup.Item value="sell">Sell</ToggleGroup.Item>
            </ToggleGroup>
          </FieldLayout.Field>
          <FieldLayout.Field label="Threshold" preferred={14}>
            <Input defaultValue="0.05" />
          </FieldLayout.Field>
          <FieldLayout.Field label="Notes" kind="prose">
            <TextEdit rows={4} defaultValue="Long-form rationale…" />
          </FieldLayout.Field>
        </FieldLayout.Section>
      </FieldLayout>
    </Frame>
  );
};

/**
 * The three kinds side by side: rigid holds 8u, flexible flexes 10–36u,
 * filler absorbs the slack so the row justifies to the right padding.
 */
export const Kinds: Story = () => (
  <Frame>
    <FieldLayout>
      <FieldLayout.Section>
        <FieldLayout.Field label="Rigid (8u)" kind="rigid" width={8}>
          <Input defaultValue="fixed" />
        </FieldLayout.Field>
        <FieldLayout.Field label="Flexible">
          <Input defaultValue="10–36u" />
        </FieldLayout.Field>
        <FieldLayout.Filler />
      </FieldLayout.Section>
    </FieldLayout>
  </Frame>
);

/**
 * A visible dither filler marks emptiness after a short hint, rather than
 * leaving blank space. Reduced motion draws a single static frame.
 */
export const DitherFiller: Story = () => (
  <Frame>
    <FieldLayout>
      <FieldLayout.Section>
        <FieldLayout.Field label="Valid from" kind="rigid" width={8} hint="Effective date.">
          <DatePicker defaultValue={new Date(2026, 6, 1)} />
        </FieldLayout.Field>
        <FieldLayout.Filler dither />
      </FieldLayout.Section>
    </FieldLayout>
  </Frame>
);

/** Narrow container: rows collapse gradually until each field stands alone. */
export const Collapsed: Story = () => (
  <Frame width={320}>
    <FieldLayout>
      <FieldLayout.Section>
        <FieldLayout.Field label="Name">
          <Input defaultValue="Gilt-edged Fund" />
        </FieldLayout.Field>
        <FieldLayout.Field label="Ticker" kind="rigid" width={8}>
          <Input defaultValue="GEF" />
        </FieldLayout.Field>
        <FieldLayout.Field label="Threshold">
          <Input defaultValue="0.05" />
        </FieldLayout.Field>
      </FieldLayout.Section>
    </FieldLayout>
  </Frame>
);
