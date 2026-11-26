import type { Story } from "@ladle/react";
import type { CSSProperties } from "react";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { Chip } from "../components/Chip";
import { DatePicker } from "../components/DatePicker";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { Picker } from "../components/Picker";
import { Radio, RadioGroup } from "../components/Radio";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { Tabs } from "../components/Tabs";
import { ToggleGroup } from "../components/ToggleGroup";

// The touch tokens (tokens.css → "Pointer"), shown on any device. A phone gets
// them from `@media (pointer: coarse)`; here the second panel sets the same
// values by hand, which is also how an app forces them (a kiosk whose touch
// screen reports a mouse). The dashed outlines are the hit areas: the
// invisible pseudo-elements of `lib/hitArea`, drawn for this story only.

const touch = {
  "--sf-hit-min": "2.75rem",
  "--sf-hit-tight": "1.5rem",
  "--sf-text-entry-min": "1rem",
} as CSSProperties;

const OUTLINE = `
  [data-show-hit] *::after,
  [data-show-hit] *::before {
    outline: 1px dashed var(--sf-color-primary);
    outline-offset: -1px;
  }
`;

function Sample() {
  return (
    <div
      style={{ display: "grid", gap: "var(--sf-unit)", alignContent: "start", minInlineSize: 0 }}
    >
      <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)", flexWrap: "wrap" }}>
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button variant="secondary">Cancel</Button>
      </div>
      <ToggleGroup defaultValue={["week"]} aria-label="View">
        <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
        <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
        <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
      </ToggleGroup>
      <div
        style={{ display: "flex", gap: "var(--sf-unit)", alignItems: "center", flexWrap: "wrap" }}
      >
        <Checkbox aria-label="Agree" defaultChecked />
        <RadioGroup defaultValue="a" aria-label="Choice" style={{ flexDirection: "row" }}>
          <Radio value="a" aria-label="A" />
          <Radio value="b" aria-label="B" />
        </RadioGroup>
        <Switch aria-label="Notify" defaultChecked />
        <Chip onRemove={() => {}}>Filter</Chip>
      </div>
      <Slider defaultValue={40} aria-label="Level" />
      <Field orientation="vertical">
        <Field.Label>Small field</Field.Label>
        <Input inputSize="sm" placeholder="12px for a mouse, 16px for a finger" />
      </Field>
      <Picker
        items={["Equity", "Bond", "Cash"]}
        defaultValue="Equity"
        aria-label="Asset class"
        size="sm"
      />
      <DatePicker aria-label="Date" />
      <Tabs.Root defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a">Overview</Tabs.Tab>
          <Tabs.Tab value="b">Holdings</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    </div>
  );
}

const heading: CSSProperties = {
  margin: 0,
  fontSize: "var(--sf-font-size-lg)",
  fontWeight: "var(--sf-font-weight-semibold)",
};

/** A mouse beside a finger: the same controls, with the touch tokens and the
 *  comfortable density on the right. The controls keep their look; the dashed
 *  boxes show how far each one answers a finger. */
export const HitAreas: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
      gap: "calc(var(--sf-unit) * 2)",
    }}
  >
    <style>{OUTLINE}</style>
    <section style={{ display: "grid", gap: "var(--sf-unit)", alignContent: "start" }}>
      <h3 style={heading}>Mouse</h3>
      <div
        data-density="compact"
        data-show-hit=""
        style={
          {
            "--sf-hit-min": "0px",
            "--sf-hit-tight": "0px",
            "--sf-text-entry-min": "0px",
          } as CSSProperties
        }
      >
        <Sample />
      </div>
    </section>
    <section style={{ display: "grid", gap: "var(--sf-unit)", alignContent: "start" }}>
      <h3 style={heading}>Finger</h3>
      <div data-density="comfortable" data-show-hit="" style={touch}>
        <Sample />
      </div>
    </section>
  </div>
);

/** The same touch tokens on the compact density: `data-density="compact"` on
 *  the root keeps the dense metrics on a phone, and the hit areas still grow. */
export const CompactOnTouch: Story = () => (
  <div data-density="compact" data-show-hit="" style={touch}>
    <style>{OUTLINE}</style>
    <Sample />
  </div>
);
