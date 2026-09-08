import type { Story } from "@ladle/react";
import { useState } from "react";
import { Box } from "../Box";
import { Field } from "../Field";
import { Switch } from "../Switch";
import { Knob, type KnobProps } from "./Knob";

const row: React.CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  justifyContent: "start",
  alignItems: "end",
  gap: "calc(var(--sf-unit) * 2)",
};

const caption: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg)",
  textAlign: "center",
};

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: "calc(var(--sf-unit) / 2)" }}>
      {children}
      <span style={caption}>{label}</span>
    </div>
  );
}

export const Playground: Story<KnobProps> = (args) => <Knob {...args} />;
Playground.args = {
  defaultValue: 40,
  min: 0,
  max: 100,
  step: 1,
  size: "md",
  tone: "primary",
  fill: "color",
  fillOrigin: "start",
  surface: "dome",
  finish: "knurled",
  drag: "rotate",
  valueLabel: "hover",
  sweep: 270,
  marks: true,
  wheel: false,
  disabled: false,
};
Playground.argTypes = {
  size: { options: ["sm", "md", "lg"], control: { type: "radio" } },
  tone: {
    options: ["neutral", "primary", "success", "warning", "danger"],
    control: { type: "radio" },
  },
  fill: { options: ["color", "dither", "none"], control: { type: "radio" } },
  fillOrigin: { options: ["start", "center"], control: { type: "radio" } },
  surface: { options: ["dome", "dish", "flat"], control: { type: "radio" } },
  finish: { options: ["knurled", "plain"], control: { type: "radio" } },
  drag: { options: ["rotate", "vertical"], control: { type: "radio" } },
  valueLabel: { options: ["hover", "always", "off"], control: { type: "radio" } },
  sweep: { control: { type: "range", min: 90, max: 360, step: 10 } },
  marks: { control: { type: "boolean" } },
  wheel: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
};

export const Default: Story = () => {
  const [value, setValue] = useState(6);
  return (
    <div style={row}>
      <Knob
        value={value}
        onValueChange={setValue}
        min={0}
        max={10}
        marks
        valueLabel="always"
        aria-label="Volume"
      />
      <span style={caption}>value: {value}</span>
    </div>
  );
};

export const Sizes: Story = () => (
  <div style={row}>
    <Labelled label="sm">
      <Knob size="sm" defaultValue={30} aria-label="Small" />
    </Labelled>
    <Labelled label="md">
      <Knob size="md" defaultValue={50} aria-label="Medium" />
    </Labelled>
    <Labelled label="lg">
      <Knob size="lg" defaultValue={70} aria-label="Large" />
    </Labelled>
  </div>
);

export const Tones: Story = () => (
  <div style={row}>
    {(["neutral", "primary", "success", "warning", "danger"] as const).map((tone) => (
      <Labelled key={tone} label={tone}>
        <Knob tone={tone} defaultValue={65} aria-label={tone} />
      </Labelled>
    ))}
  </div>
);

export const DitherFill: Story = () => (
  <div style={row}>
    <Knob fill="dither" defaultValue={65} aria-label="Dither" />
    <Knob fill="dither" tone="success" size="lg" defaultValue={80} aria-label="Dither large" />
    <Knob fill="none" defaultValue={65} aria-label="No fill" />
  </div>
);

export const Balance: Story = () => {
  const [value, setValue] = useState(0);
  return (
    <div style={row}>
      <Knob
        value={value}
        onValueChange={setValue}
        min={-50}
        max={50}
        fillOrigin="center"
        marks={[
          { value: -50, label: "L" },
          { value: 0, label: "0" },
          { value: 50, label: "R" },
        ]}
        valueLabel="always"
        formatValue={(v) => (v === 0 ? "centre" : v < 0 ? `L ${-v}` : `R ${v}`)}
        aria-label="Balance"
      />
    </div>
  );
};

export const Marks: Story = () => (
  <div style={row}>
    <Labelled label="one per step">
      <Knob min={0} max={10} defaultValue={7} marks aria-label="Stepped" />
    </Labelled>
    <Labelled label="labelled">
      <Knob
        min={0}
        max={10}
        defaultValue={7}
        marks={[
          { value: 0, label: "0" },
          { value: 2, label: "2" },
          { value: 4, label: "4" },
          { value: 6, label: "6" },
          { value: 8, label: "8" },
          { value: 10, label: "10" },
        ]}
        aria-label="Labelled"
      />
    </Labelled>
    <Labelled label="full turn">
      <Knob
        min={0}
        max={360}
        step={15}
        sweep={360}
        defaultValue={90}
        marks={[0, 90, 180, 270]}
        formatValue={(v) => `${v}°`}
        valueLabel="always"
        aria-label="Angle"
      />
    </Labelled>
  </div>
);

export const Surfaces: Story = () => (
  <div style={row}>
    {(["dome", "dish", "flat"] as const).map((surface) => (
      <Labelled key={surface} label={surface}>
        <Knob surface={surface} size="lg" defaultValue={55} aria-label={surface} />
      </Labelled>
    ))}
    <Labelled label="dome, curve 3">
      <Knob surface="dome" curve={3} size="lg" defaultValue={55} aria-label="Deep dome" />
    </Labelled>
  </div>
);

export const Finish: Story = () => (
  <div style={row}>
    <Labelled label="knurled">
      <Knob finish="knurled" size="lg" defaultValue={55} aria-label="Knurled" />
    </Labelled>
    <Labelled label="plain">
      <Knob finish="plain" size="lg" defaultValue={55} aria-label="Plain" />
    </Labelled>
  </div>
);

export const Elevation: Story = () => (
  <div style={row}>
    {([0, 1, 2, 3, 4, 5] as const).map((elevation) => (
      <Labelled key={elevation} label={`elevation ${elevation}`}>
        <Knob elevation={elevation} defaultValue={45} aria-label={`Elevation ${elevation}`} />
      </Labelled>
    ))}
  </div>
);

export const VerticalDrag: Story = () => (
  <div style={row}>
    <Labelled label="drag up / down, Shift for fine">
      <Knob drag="vertical" wheel defaultValue={45} valueLabel="always" aria-label="Gain" />
    </Labelled>
  </div>
);

export const InField: Story = () => (
  <div style={row}>
    <Field orientation="vertical">
      <Field.Label>Volume</Field.Label>
      <Knob defaultValue={30} min={0} max={10} step={0.5} marks valueLabel="always" />
      <Field.Description>0 to 10 in half steps.</Field.Description>
    </Field>
  </div>
);

export const Disabled: Story = () => (
  <div style={row}>
    <Knob disabled defaultValue={40} aria-label="Disabled" />
    <Knob disabled fill="dither" size="lg" defaultValue={70} aria-label="Disabled large" />
  </div>
);

/** A hi-fi front panel: four channels of tone control and a loudness switch. */
export const Stereo: Story = () => {
  const [volume, setVolume] = useState(4);
  const [balance, setBalance] = useState(0);
  const [bass, setBass] = useState(0);
  const [treble, setTreble] = useState(2);
  const toneMarks = [
    { value: -10, label: "-10" },
    { value: 0, label: "0" },
    { value: 10, label: "+10" },
  ];
  return (
    <Box elevation={1} style={{ display: "inline-grid", padding: "calc(var(--sf-unit) * 1.5)" }}>
      <div style={{ ...row, alignItems: "end", gap: "calc(var(--sf-unit) * 2.5)" }}>
        <Labelled label="Volume">
          <Knob
            size="lg"
            value={volume}
            onValueChange={setVolume}
            min={0}
            max={10}
            step={0.5}
            marks={[
              { value: 0, label: "0" },
              { value: 2, label: "2" },
              { value: 4, label: "4" },
              { value: 6, label: "6" },
              { value: 8, label: "8" },
              { value: 10, label: "10" },
            ]}
            valueLabel="always"
            aria-label="Volume"
          />
        </Labelled>
        <Labelled label="Balance">
          <Knob
            value={balance}
            onValueChange={setBalance}
            min={-10}
            max={10}
            fillOrigin="center"
            tone="neutral"
            marks={[
              { value: -10, label: "L" },
              { value: 0, label: "0" },
              { value: 10, label: "R" },
            ]}
            aria-label="Balance"
          />
        </Labelled>
        <Labelled label="Bass">
          <Knob
            value={bass}
            onValueChange={setBass}
            min={-10}
            max={10}
            fillOrigin="center"
            tone="neutral"
            marks={toneMarks}
            aria-label="Bass"
          />
        </Labelled>
        <Labelled label="Treble">
          <Knob
            value={treble}
            onValueChange={setTreble}
            min={-10}
            max={10}
            fillOrigin="center"
            tone="neutral"
            marks={toneMarks}
            aria-label="Treble"
          />
        </Labelled>
        <Labelled label="Loudness">
          <Switch defaultChecked aria-label="Loudness" />
        </Labelled>
      </div>
    </Box>
  );
};
