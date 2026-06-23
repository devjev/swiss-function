import type { Story } from "@ladle/react";
import { useState } from "react";
import { Selector, type SelectorProps } from "./Selector";

const cities = [
  "Amsterdam",
  "Berlin",
  "Bern",
  "Geneva",
  "London",
  "Madrid",
  "Oslo",
  "Paris",
  "Tokyo",
  "Zurich",
];

export const Playground: Story<SelectorProps> = (args) => {
  const [value, setValue] = useState<string[]>(["Paris", "Tokyo"]);
  return <Selector {...args} value={value} onChange={setValue} />;
};
Playground.args = {
  items: cities,
  placeholder: "Search cities…",
  layout: "panel",
  disabled: false,
};
Playground.argTypes = {
  layout: {
    options: ["panel", "inline", "compact"],
    control: { type: "radio" },
  },
  size: {
    options: ["sm", "md", "lg"],
    control: { type: "radio" },
  },
  disabled: { control: { type: "boolean" } },
};

export const Panel: Story = () => {
  const [value, setValue] = useState<string[]>(["Paris", "Tokyo", "Oslo"]);
  return <Selector items={cities} value={value} onChange={setValue} placeholder="Search cities…" />;
};

export const Inline: Story = () => {
  const [value, setValue] = useState<string[]>(["Berlin"]);
  return (
    <Selector
      layout="inline"
      items={cities}
      value={value}
      onChange={setValue}
      placeholder="Search cities…"
    />
  );
};

// Compact: collapses to "N selected" + Clear, sized to its content so it tucks
// into a toolbar. The dropdown is where you review and uncheck the full set.
export const Compact: Story = () => {
  const [value, setValue] = useState<string[]>(["Paris", "Tokyo", "Oslo"]);
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <Selector
        layout="compact"
        items={cities}
        value={value}
        onChange={setValue}
        placeholder="Filter…"
      />
      <Selector
        layout="compact"
        items={cities}
        value={value}
        onChange={setValue}
        placeholder="Filter…"
        compactLabel={(n) => `${n} cities`}
      />
      <span style={{ fontSize: "0.875rem" }}>← custom wording via compactLabel</span>
    </div>
  );
};

const languages = [
  { value: "ts", label: "TypeScript" },
  { value: "rs", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "py", label: "Python" },
  { value: "ex", label: "Elixir" },
];

export const InlineOverflow: Story = () => {
  const [value, setValue] = useState<string[]>(cities.slice(0, 8));
  return (
    <div style={{ maxWidth: "20rem" }}>
      <Selector
        layout="inline"
        items={cities}
        value={value}
        onChange={setValue}
        placeholder="Search cities…"
      />
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
        Collapsed to one row with a “+N” pill; click it to expand the chips as an overlay.
      </p>
    </div>
  );
};

export const Sizes: Story = () => {
  const [sm, setSm] = useState<string[]>(["Paris"]);
  const [md, setMd] = useState<string[]>(["Paris"]);
  const [lg, setLg] = useState<string[]>(["Paris"]);
  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: "24rem" }}>
      <Selector size="sm" layout="inline" items={cities} value={sm} onChange={setSm} />
      <Selector size="md" layout="inline" items={cities} value={md} onChange={setMd} />
      <Selector size="lg" layout="inline" items={cities} value={lg} onChange={setLg} />
    </div>
  );
};

export const ObjectItems: Story = () => {
  const [value, setValue] = useState<string[]>(["ts", "rs"]);
  return (
    <Selector
      items={languages}
      value={value}
      onChange={setValue}
      placeholder="Search languages…"
      bucketLabel="Stack"
    />
  );
};
