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
    options: ["panel", "inline"],
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

const languages = [
  { value: "ts", label: "TypeScript" },
  { value: "rs", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "py", label: "Python" },
  { value: "ex", label: "Elixir" },
];

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
