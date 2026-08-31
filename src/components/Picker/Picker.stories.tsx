import type { Story } from "@ladle/react";
import { useState } from "react";
import { Picker, type PickerProps } from "./Picker";

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

export const Playground: Story<PickerProps> = (args) => {
  const [value, setValue] = useState("Zurich");
  return <Picker {...args} value={value} onChange={setValue} />;
};
Playground.args = {
  items: cities,
  placeholder: "Search cities…",
  clearable: true,
  disabled: false,
};
Playground.argTypes = {
  size: {
    options: ["sm", "md", "lg"],
    control: { type: "radio" },
  },
  clearable: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
};

export const Default: Story = () => {
  const [value, setValue] = useState("");
  return (
    <div style={{ maxWidth: "20rem" }}>
      <Picker items={cities} value={value} onChange={setValue} placeholder="Search cities…" />
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
        Selected: <code>{value || "—"}</code>
      </p>
    </div>
  );
};

export const Sizes: Story = () => {
  const [sm, setSm] = useState("Paris");
  const [md, setMd] = useState("Paris");
  const [lg, setLg] = useState("Paris");
  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: "24rem" }}>
      <Picker size="sm" items={cities} value={sm} onChange={setSm} />
      <Picker size="md" items={cities} value={md} onChange={setMd} />
      <Picker size="lg" items={cities} value={lg} onChange={setLg} />
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

// Object items: the field shows the `label`, while `value` is the stable id.
export const ObjectItems: Story = () => {
  const [value, setValue] = useState("ts");
  return (
    <div style={{ maxWidth: "20rem" }}>
      <Picker items={languages} value={value} onChange={setValue} placeholder="Search languages…" />
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
        value: <code>{value || "—"}</code>
      </p>
    </div>
  );
};

export const Disabled: Story = () => (
  <div style={{ maxWidth: "20rem" }}>
    <Picker items={cities} defaultValue="Bern" disabled />
  </div>
);

const groupedCities = [
  { value: "bern", label: "Bern", group: "Switzerland" },
  { value: "geneva", label: "Geneva", group: "Switzerland" },
  { value: "zurich", label: "Zurich", group: "Switzerland" },
  { value: "berlin", label: "Berlin", group: "Germany" },
  { value: "hamburg", label: "Hamburg", group: "Germany" },
  { value: "lyon", label: "Lyon", group: "France" },
  { value: "paris", label: "Paris", group: "France" },
  { value: "remote", label: "Remote" },
];

/** Grouped items: a `group` on an item files it under that section header in
 *  the dropdown. Groups appear in first-appearance order; ungrouped items list
 *  first, headerless. Filtering hides a group along with its last matching
 *  item; keyboard navigation skips the headers. */
export const Grouped: Story = () => {
  const [value, setValue] = useState("");
  return (
    <div style={{ maxWidth: "20rem" }}>
      <Picker
        items={groupedCities}
        value={value}
        onChange={setValue}
        placeholder="Search offices…"
      />
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
        value: <code>{value || "—"}</code>
      </p>
    </div>
  );
};
