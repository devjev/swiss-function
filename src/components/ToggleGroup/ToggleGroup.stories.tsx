import type { Story } from "@ladle/react";
import { useState } from "react";
import { ToggleGroup } from "./ToggleGroup";

export const SingleSelect: Story = () => {
  const [value, setValue] = useState<string[]>(["list"]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--sf-unit) / 2)" }}>
      <ToggleGroup value={value} onValueChange={(v) => setValue(v as string[])}>
        <ToggleGroup.Item value="list">List</ToggleGroup.Item>
        <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
        <ToggleGroup.Item value="table">Table</ToggleGroup.Item>
      </ToggleGroup>
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        value: [{value.join(", ")}]
      </div>
    </div>
  );
};

export const MultiSelect: Story = () => {
  const [marks, setMarks] = useState<string[]>(["bold"]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--sf-unit) / 2)" }}>
      <ToggleGroup multiple value={marks} onValueChange={(v) => setMarks(v as string[])}>
        <ToggleGroup.Item value="bold">
          <strong>B</strong>
        </ToggleGroup.Item>
        <ToggleGroup.Item value="italic">
          <em>I</em>
        </ToggleGroup.Item>
        <ToggleGroup.Item value="underline">
          <span style={{ textDecoration: "underline" }}>U</span>
        </ToggleGroup.Item>
      </ToggleGroup>
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        marks: [{marks.join(", ")}]
      </div>
    </div>
  );
};

export const Sizes: Story = () => {
  const [value, setValue] = useState<string[]>(["b"]);
  const handleChange = (v: unknown) => setValue(v as string[]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--sf-unit) / 2)" }}>
      <ToggleGroup size="sm" value={value} onValueChange={handleChange}>
        <ToggleGroup.Item value="a">Small A</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Small B</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Small C</ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup size="md" value={value} onValueChange={handleChange}>
        <ToggleGroup.Item value="a">Medium A</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Medium B</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Medium C</ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup size="lg" value={value} onValueChange={handleChange}>
        <ToggleGroup.Item value="a">Large A</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Large B</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Large C</ToggleGroup.Item>
      </ToggleGroup>
    </div>
  );
};

export const DisabledOne: Story = () => {
  const [value, setValue] = useState<string[]>(["list"]);
  return (
    <ToggleGroup value={value} onValueChange={(v) => setValue(v as string[])}>
      <ToggleGroup.Item value="list">List</ToggleGroup.Item>
      <ToggleGroup.Item value="grid" disabled>
        Grid (disabled)
      </ToggleGroup.Item>
      <ToggleGroup.Item value="table">Table</ToggleGroup.Item>
    </ToggleGroup>
  );
};
