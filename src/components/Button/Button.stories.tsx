import type { Story } from "@ladle/react";
import { useState } from "react";
import { Box } from "../Box";
import { Play, Power } from "../Icon";
import { Knob } from "../Knob";
import { Switch } from "../Switch";
import { Button, type ButtonProps } from "./Button";

export const Playground: Story<ButtonProps> = (args) => <Button {...args}>Click me</Button>;
Playground.args = {
  variant: "primary",
  size: "md",
  build: "sheet",
  finish: "brushed",
  round: false,
  tight: false,
  disabled: false,
};
Playground.argTypes = {
  variant: {
    options: ["primary", "secondary", "ghost", "danger"],
    control: { type: "select" },
  },
  size: {
    options: ["sm", "md", "lg"],
    control: { type: "radio" },
  },
  build: { options: ["sheet", "solid"], control: { type: "radio" } },
  surface: { options: ["dish", "dome", "flat", "concave"], control: { type: "radio" } },
  finish: { options: ["brushed", "plain"], control: { type: "radio" } },
  round: { control: { type: "boolean" } },
  tight: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
};

export const AllVariants: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Danger</Button>
  </div>
);

export const AllSizes: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);

// Tight: 3/16u inline padding + 0.25u icon/text gap, same height as the size.
// Good for dense toolbar buttons. Composes with size (font) and variant (colour).
export const Tight: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
    <Button tight aria-label="Add">
      ＋
    </Button>
    <Button tight>
      <span aria-hidden="true">＋</span>
      Add
    </Button>
    <Button tight variant="secondary" size="sm">
      <span aria-hidden="true">↻</span>
      Refresh
    </Button>
    <Button tight variant="ghost" size="lg">
      Tight large
    </Button>
  </div>
);

export const Disabled: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem" }}>
    <Button disabled>Primary disabled</Button>
    <Button variant="secondary" disabled>
      Secondary disabled
    </Button>
  </div>
);

const panelRow: React.CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  justifyContent: "start",
  alignItems: "center",
  gap: "calc(var(--sf-unit) * 1.5)",
};

/** The solid build across the variants and sizes: a cap over a visible side
 *  wall, the cast on the wall, the label engraved, a press that travels the
 *  key's full height. Ghost stays a sheet. */
export const SolidBuild: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    {(["sm", "md", "lg"] as const).map((size) => (
      <div key={size} style={panelRow}>
        <Button build="solid" size={size}>
          Primary
        </Button>
        <Button build="solid" size={size} variant="secondary">
          Secondary
        </Button>
        <Button build="solid" size={size} variant="danger">
          Danger
        </Button>
        <Button build="solid" size={size} variant="ghost">
          Ghost
        </Button>
        <Button build="solid" size={size} disabled>
          Disabled
        </Button>
      </div>
    ))}
  </div>
);

/** `round` makes a circular key of the size's height: the power button. Each
 *  label is centred on its own ink, measured at mount: a capital, a symbol,
 *  a fallback glyph and an `Icon` all land on the visual centre. */
export const SolidRound: Story = () => (
  <div style={panelRow}>
    <Button build="solid" round aria-label="Power" size="lg">
      <Power />
    </Button>
    <Button build="solid" round aria-label="Play" size="lg" variant="secondary">
      <Play />
    </Button>
    <Button build="solid" round variant="secondary" aria-label="Mute">
      M
    </Button>
    <Button build="solid" round variant="danger" aria-label="Record">
      ●
    </Button>
    <Button build="solid" round variant="secondary" size="sm" aria-label="Add">
      +
    </Button>
    <Button round variant="secondary" aria-label="Sheet round">
      S
    </Button>
  </div>
);

/** The same faces as Knob on a solid key: `dome` (default), `dish`, `flat` and
 *  `concave`, on each colour and as a round key, all lit from the one light. */
export const SolidSurfaces: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    {(["dome", "dish", "flat", "concave"] as const).map((surface) => (
      <div key={surface} style={panelRow}>
        <span
          style={{
            inlineSize: "calc(var(--sf-unit) * 3)",
            fontFamily: "var(--sf-font-mono)",
            fontSize: "var(--sf-font-size-sm)",
          }}
        >
          {surface}
        </span>
        <Button build="solid" size="lg" surface={surface}>
          Primary
        </Button>
        <Button build="solid" size="lg" surface={surface} variant="secondary">
          Secondary
        </Button>
        <Button build="solid" size="lg" surface={surface} variant="danger">
          Danger
        </Button>
        <Button
          build="solid"
          size="lg"
          surface={surface}
          round
          variant="secondary"
          aria-label={surface}
        >
          <Power />
        </Button>
      </div>
    ))}
  </div>
);

/** The cap finish and face: brushed (default) or plain, on a dome, a dish or
 *  a flat top. */
export const SolidFinish: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <div style={panelRow}>
      <Button build="solid" variant="secondary" size="lg">
        Brushed dome
      </Button>
      <Button build="solid" variant="secondary" size="lg" finish="plain">
        Plain dome
      </Button>
      <Button build="solid" variant="secondary" size="lg" surface="dish">
        Brushed dish
      </Button>
      <Button build="solid" variant="secondary" size="lg" surface="flat" finish="plain">
        Plain flat
      </Button>
    </div>
    <div style={panelRow}>
      <Button build="solid" size="lg">
        Brushed dome
      </Button>
      <Button build="solid" size="lg" finish="plain">
        Plain dome
      </Button>
      <Button build="solid" size="lg" curve={3}>
        Curve 3
      </Button>
      <Button build="solid" size="lg" elevation={4}>
        Elevation 4
      </Button>
    </div>
  </div>
);

/** A latched key: `aria-pressed="true"` sits down on its wall, the way a
 *  locking push button stays in. */
export const SolidPressed: Story = () => {
  const [on, setOn] = useState<Record<string, boolean>>({ loudness: true, mono: false });
  return (
    <div style={panelRow}>
      {(["loudness", "mono"] as const).map((key) => (
        <Button
          key={key}
          build="solid"
          variant="secondary"
          aria-pressed={on[key]}
          onClick={() => setOn((s) => ({ ...s, [key]: !s[key] }))}
        >
          {key === "loudness" ? "Loudness" : "Mono"}
        </Button>
      ))}
    </div>
  );
};

/** A hi-fi front panel: a round power key, a source selector of latching keys,
 *  the Knob for volume, a Switch for loudness, all in one light. */
export const FrontPanel: Story = () => {
  const [source, setSource] = useState("Phono");
  const [power, setPower] = useState(true);
  const [volume, setVolume] = useState(4);
  return (
    <Box elevation={1} style={{ display: "inline-grid", padding: "calc(var(--sf-unit) * 1.5)" }}>
      <div style={{ ...panelRow, gap: "calc(var(--sf-unit) * 2)" }}>
        <Button
          build="solid"
          round
          size="lg"
          variant={power ? "primary" : "secondary"}
          aria-pressed={power}
          aria-label="Power"
          onClick={() => setPower((p) => !p)}
        >
          <Power />
        </Button>
        <div style={{ ...panelRow, gap: "calc(var(--sf-unit) / 2)" }}>
          {["Phono", "Tuner", "CD", "Tape", "Aux"].map((s) => (
            <Button
              key={s}
              build="solid"
              variant="secondary"
              aria-pressed={source === s}
              onClick={() => setSource(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <Knob
          size="lg"
          value={volume}
          onValueChange={setVolume}
          min={0}
          max={10}
          step={0.5}
          marks={[
            { value: 0, label: "0" },
            { value: 5, label: "5" },
            { value: 10, label: "10" },
          ]}
          aria-label="Volume"
        />
        <Switch defaultChecked aria-label="Loudness" />
      </div>
    </Box>
  );
};
