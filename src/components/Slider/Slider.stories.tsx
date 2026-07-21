import type { Story } from "@ladle/react";
import { useState } from "react";
import { Slider, type SliderProps, type SliderValue } from "./Slider";

const row: React.CSSProperties = {
  display: "grid",
  gap: "calc(var(--sf-unit) * 1.5)",
  maxWidth: "28rem",
};

const readout: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg)",
};

export const Playground: Story<SliderProps> = (args) => <Slider {...args} />;
Playground.args = {
  defaultValue: 40,
  min: 0,
  max: 100,
  step: 1,
  size: "md",
  tone: "primary",
  fill: "color",
  valueLabel: "hover",
  disabled: false,
};
Playground.argTypes = {
  size: { options: ["sm", "md", "lg"], control: { type: "radio" } },
  tone: {
    options: ["neutral", "primary", "success", "warning", "danger"],
    control: { type: "radio" },
  },
  fill: { options: ["color", "dither"], control: { type: "radio" } },
  valueLabel: { options: ["hover", "always", "off"], control: { type: "radio" } },
  disabled: { control: { type: "boolean" } },
};

export const Default: Story = () => {
  const [value, setValue] = useState<SliderValue>(40);
  return (
    <div style={row}>
      <Slider value={value} onValueChange={setValue} />
      <span style={readout}>value: {String(value)}</span>
    </div>
  );
};

export const Sizes: Story = () => (
  <div style={row}>
    <Slider defaultValue={40} size="sm" />
    <Slider defaultValue={40} size="md" />
    <Slider defaultValue={40} size="lg" />
  </div>
);

export const Tones: Story = () => (
  <div style={row}>
    <Slider defaultValue={60} tone="neutral" />
    <Slider defaultValue={60} tone="primary" />
    <Slider defaultValue={60} tone="success" />
    <Slider defaultValue={60} tone="warning" />
    <Slider defaultValue={60} tone="danger" />
  </div>
);

export const DitherFill: Story = () => (
  <div style={row}>
    <Slider defaultValue={62} fill="color" />
    <Slider defaultValue={62} fill="dither" />
    <Slider defaultValue={62} fill="dither" tone="success" />
  </div>
);

export const Range: Story = () => {
  const [value, setValue] = useState<SliderValue>([25, 70]);
  return (
    <div style={row}>
      <Slider
        value={value}
        onValueChange={setValue}
        minStepsBetweenValues={5}
        valueLabel="always"
      />
      <span style={readout}>range: {JSON.stringify(value)}</span>
    </div>
  );
};

// `marks={true}` auto-ticks each step; an array places labelled ticks.
export const Marks: Story = () => (
  <div style={row}>
    <Slider defaultValue={5} min={0} max={10} step={1} marks />
    <Slider
      defaultValue={50}
      marks={[
        { value: 0, label: "0" },
        { value: 25, label: "¼" },
        { value: 50, label: "½" },
        { value: 75, label: "¾" },
        { value: 100, label: "1" },
      ]}
    />
  </div>
);

// The value bubble: revealed on hover/drag, pinned, or hidden.
export const ValueLabel: Story = () => (
  <div style={row}>
    <Slider defaultValue={40} valueLabel="hover" />
    <Slider defaultValue={40} valueLabel="always" />
    <Slider defaultValue={40} valueLabel="off" />
  </div>
);

// A percentage read via `formatValue` (0..1 domain).
export const Formatted: Story = () => (
  <div style={row}>
    <Slider
      defaultValue={0.42}
      min={0}
      max={1}
      step={0.01}
      valueLabel="always"
      formatValue={(v) => `${Math.round(v * 100)}%`}
    />
  </div>
);

export const Vertical: Story = () => (
  <div style={{ display: "flex", gap: "calc(var(--sf-unit) * 2)", height: "16rem" }}>
    <Slider orientation="vertical" defaultValue={40} />
    <Slider orientation="vertical" defaultValue={40} tone="success" fill="dither" />
    <Slider
      orientation="vertical"
      defaultValue={[20, 80]}
      marks={[
        { value: 0, label: "0" },
        { value: 50, label: "50" },
        { value: 100, label: "100" },
      ]}
    />
  </div>
);

export const Disabled: Story = () => (
  <div style={row}>
    <Slider defaultValue={40} disabled />
    <Slider defaultValue={[25, 70]} disabled />
  </div>
);

export const Elevation: Story = () => (
  <div style={row}>
    <Slider defaultValue={40} elevation={0} />
    <Slider defaultValue={40} elevation={2} />
    <Slider defaultValue={40} elevation={5} />
  </div>
);

// An explicit colour overrides the tone (for a brand or data-series colour).
export const CustomColor: Story = () => (
  <div style={row}>
    <Slider defaultValue={48} color="var(--sf-color-fg)" />
    <Slider defaultValue={48} color="#7c3aed" fill="dither" />
  </div>
);

// Square the corners to sit with the blocky dither family, via the
// component-scoped `--sf-slider-radius` token (no global radius override).
export const Squared: Story = () => (
  <div style={{ ...row, ["--sf-slider-radius" as string]: "0" }}>
    <Slider defaultValue={62} fill="color" />
    <Slider defaultValue={62} fill="dither" />
  </div>
);

// A gradient track with the fill hidden — the building block ColorPicker uses for
// colour-channel sliders. Set `--sf-slider-track-bg` (a gradient), `fill="none"`,
// and flatten the recess via `--sf-slider-track-shadow`.
export const ChannelTrack: Story = () => (
  <div style={row}>
    <Slider
      defaultValue={210}
      min={0}
      max={360}
      valueLabel="off"
      fill="none"
      style={
        {
          "--sf-slider-track-bg":
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          "--sf-slider-track-shadow": "inset 0 0 0 1px var(--sf-color-border)",
        } as React.CSSProperties
      }
    />
    <Slider
      defaultValue={50}
      valueLabel="off"
      fill="none"
      style={
        {
          "--sf-slider-track-bg": "linear-gradient(to right, #000, #3b82f6)",
          "--sf-slider-track-shadow": "inset 0 0 0 1px var(--sf-color-border)",
        } as React.CSSProperties
      }
    />
  </div>
);
