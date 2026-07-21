import type { Story } from "@ladle/react";
import { useState } from "react";
import { Popover } from "../Popover";
import { ColorPicker } from "./ColorPicker";
import { ColorSwatch } from "./ColorSwatch";

const readout: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg)",
};

export const Default: Story = () => {
  const [color, setColor] = useState("#3b82f6");
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <ColorPicker value={color} onChange={setColor} />
      <span style={readout}>value: {color}</span>
    </div>
  );
};

// OKLCH output regardless of the editing space.
export const OklchOutput: Story = () => {
  const [color, setColor] = useState("oklch(0.62 0.19 258)");
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <ColorPicker value={color} onChange={setColor} format="oklch" />
      <span style={readout}>value: {color}</span>
    </div>
  );
};

// Start on an OKLCH colour outside sRGB to show the gamut chip + Clamp.
export const OutOfGamut: Story = () => {
  const [color, setColor] = useState("oklch(0.7 0.37 30)");
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <ColorPicker value={color} onChange={setColor} format="oklch" />
      <span style={readout}>value: {color}</span>
    </div>
  );
};

export const WithSwatches: Story = () => {
  const [color, setColor] = useState("#16a34a");
  return (
    <ColorPicker
      value={color}
      onChange={setColor}
      swatches={["#0a0a0a", "#dc2626", "#d97706", "#16a34a", "#2563eb", "#7c3aed", "#ffffff"]}
    />
  );
};

export const NoAlpha: Story = () => <ColorPicker defaultValue="#d97706" alpha={false} />;

export const RgbOnly: Story = () => (
  <ColorPicker defaultValue="#3b82f6" defaultSpace="rgb" spaces={["rgb", "hsl"]} />
);

export const Sizes: Story = () => (
  <div
    style={{ display: "flex", gap: "var(--sf-unit)", alignItems: "flex-start", flexWrap: "wrap" }}
  >
    <ColorPicker defaultValue="#2563eb" size="sm" />
    <ColorPicker defaultValue="#2563eb" size="md" />
    <ColorPicker defaultValue="#2563eb" size="lg" />
  </div>
);

// The triggered form: a ColorSwatch opens the picker in a Popover.
export const InPopover: Story = () => {
  const [color, setColor] = useState("#7c3aed");
  return (
    <Popover.Root>
      <Popover.Trigger
        style={{ padding: 0, background: "none", border: "none", cursor: "pointer" }}
        aria-label="Choose colour"
      >
        <ColorSwatch color={color} size="lg" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6}>
          <Popover.Popup>
            <ColorPicker value={color} onChange={setColor} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

export const Swatches: Story = () => (
  <div style={{ display: "flex", gap: "var(--sf-unit)", alignItems: "center" }}>
    <ColorSwatch color="#2563eb" size="sm" />
    <ColorSwatch color="#16a34a" size="md" />
    <ColorSwatch color="#dc262680" size="lg" />
    <ColorSwatch color="oklch(0.7 0.2 150)" size="lg" />
  </div>
);
