import type { Story } from "@ladle/react";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { DigitInput } from "../components/DigitInput";
import { Input } from "../components/Input";
import { Kbd } from "../components/Kbd";
import { LaunchButton } from "../components/LaunchButton";
import { Radio, RadioGroup } from "../components/Radio";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { cx } from "../lib/cx";
import type { ControlSurface } from "../lib/surface";
import { surfaceClass } from "../lib/surface";

// The material layer (tokens.css → "Material layer"): one light for every
// control, and the tactile recipes derived from it. This story lays the raw
// recipes out on plain boxes, then the controls that wear them, so a change to
// a token can be read across the whole lattice in one screenshot, in either
// theme.

const surfaces: ControlSurface[] = ["flat", "dish", "dome", "concave"];

const label: React.CSSProperties = {
  font: "var(--sf-font-size-sm) var(--sf-font-mono)",
  fontSizeAdjust: "var(--sf-font-mono-adjust)",
  color: "var(--sf-color-fg)",
  textAlign: "center",
};

const cell: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  alignContent: "start",
  gap: "calc(var(--sf-unit) / 3)",
};

const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "start",
  gap: "var(--sf-unit)",
};

const heading: React.CSSProperties = {
  margin: "0 0 calc(var(--sf-unit) / 2)",
  fontSize: "var(--sf-font-size-md)",
  fontWeight: "var(--sf-font-weight-semibold)",
};

function Swatch({ shadow, surface }: { shadow?: string; surface?: ControlSurface }) {
  return (
    <div
      className={surface ? surfaceClass[surface] : undefined}
      style={
        {
          inlineSize: "calc(var(--sf-unit) * 3)",
          blockSize: "calc(var(--sf-unit) * 1.5)",
          "--sf-cap": "var(--sf-color-bg-subtle)",
          backgroundColor: "var(--sf-cap)",
          border: "1px solid var(--sf-color-border)",
          borderRadius: "var(--sf-radius-default)",
          boxShadow: shadow,
        } as React.CSSProperties
      }
    />
  );
}

/** The recipes on bare boxes: what each token paints, with nothing else on top. */
export const Recipes: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <section>
      <h2 style={heading}>Edges, groove and caps (box-shadow tokens)</h2>
      <div style={row}>
        {[
          ["--sf-edge", "var(--sf-edge)"],
          ["--sf-edge-soft", "var(--sf-edge-soft)"],
          ["--sf-groove", "var(--sf-groove)"],
          ["--sf-cap-rest", "var(--sf-cap-rest)"],
          ["--sf-cap-pressed", "var(--sf-cap-pressed)"],
          ["--sf-cap-rest-round", "var(--sf-cap-rest-round)"],
          ["--sf-elevation-2", "var(--sf-elevation-2)"],
          ["--sf-recess-2", "var(--sf-recess-2)"],
        ].map(([name, value]) => (
          <div key={name} style={cell}>
            <Swatch shadow={value} />
            <span style={label}>{name}</span>
          </div>
        ))}
      </div>
    </section>
    <section>
      <h2 style={heading}>Faces (lib/surface classes over --sf-cap)</h2>
      <div style={row}>
        {surfaces.map((s) => (
          <div key={s} style={cell}>
            <Swatch surface={s} shadow="var(--sf-edge)" />
            <span style={label}>{s}</span>
          </div>
        ))}
        {surfaces.map((s) => (
          <div key={`${s}-primary`} style={cell}>
            <div
              className={cx(surfaceClass[s])}
              style={
                {
                  inlineSize: "calc(var(--sf-unit) * 3)",
                  blockSize: "calc(var(--sf-unit) * 1.5)",
                  "--sf-cap": "var(--sf-color-primary)",
                  backgroundColor: "var(--sf-cap)",
                  borderRadius: "var(--sf-radius-default)",
                  boxShadow: "var(--sf-edge)",
                } as React.CSSProperties
              }
            />
            <span style={label}>{s}, primary</span>
          </div>
        ))}
      </div>
    </section>
  </div>
);

/** Every control that wears the layer, each in its three faces where it has one. */
export const Controls: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <section>
      <h2 style={heading}>Keys: Button</h2>
      <div style={row}>
        {surfaces.map((s) => (
          <div key={s} style={cell}>
            <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 3)" }}>
              <Button surface={s}>Save</Button>
              <Button surface={s} variant="secondary">
                Cancel
              </Button>
              <Button surface={s} variant="danger">
                Delete
              </Button>
              <Button surface={s} variant="ghost">
                Ghost
              </Button>
            </div>
            <span style={label}>surface="{s}"</span>
          </div>
        ))}
      </div>
    </section>
    <section>
      <h2 style={heading}>Amplitude: the curve prop (a multiple of --sf-curve)</h2>
      <div style={row}>
        {[0, 0.5, 1, 2, 3].map((k) => (
          <div key={k} style={cell}>
            <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 3)" }}>
              <Button curve={k}>Save</Button>
              <Button curve={k} variant="secondary">
                Cancel
              </Button>
              <DigitInput digits={2} decimals={0} defaultValue={42} curve={k} />
            </div>
            <span style={label}>curve={k}</span>
          </div>
        ))}
      </div>
    </section>
    <section>
      <h2 style={heading}>Keycaps: Kbd and the LaunchButton lid</h2>
      <div style={row}>
        {surfaces.map((s) => (
          <div key={s} style={cell}>
            <Kbd combo="mod+shift+k" mac={false} surface={s} />
            <span style={label}>{s}</span>
          </div>
        ))}
        {surfaces.map((s) => (
          <div key={`lb-${s}`} style={cell}>
            <LaunchButton guardLabel="ARM" surface={s} onClick={() => {}}>
              Launch
            </LaunchButton>
            <span style={label}>{s}</span>
          </div>
        ))}
      </div>
    </section>
    <section>
      <h2 style={heading}>Slots and caps: Input, Switch, Slider, Checkbox, Radio</h2>
      <div style={row}>
        <div style={{ ...cell, inlineSize: "calc(var(--sf-unit) * 8)" }}>
          <Input defaultValue="2026-09-03" />
          <span style={label}>Input (groove, flat)</span>
        </div>
        <div style={{ ...cell, inlineSize: "calc(var(--sf-unit) * 8)" }}>
          <Input defaultValue="2026-09-03" surface="concave" />
          <span style={label}>Input concave</span>
        </div>
        <div style={cell}>
          <DigitInput digits={3} decimals={2} unit="%" defaultValue={42.5} />
          <span style={label}>DigitInput (concave)</span>
        </div>
        <div style={cell}>
          <DigitInput digits={3} decimals={2} unit="%" defaultValue={42.5} surface="dome" />
          <span style={label}>DigitInput dome</span>
        </div>
        <div style={cell}>
          <DigitInput digits={3} decimals={2} unit="%" defaultValue={42.5} surface="flat" />
          <span style={label}>DigitInput flat</span>
        </div>
        {surfaces.map((s) => (
          <div key={s} style={cell}>
            <Switch defaultChecked surface={s} />
            <span style={label}>Switch {s}</span>
          </div>
        ))}
        {surfaces.map((s) => (
          <div key={s} style={{ ...cell, inlineSize: "calc(var(--sf-unit) * 6)" }}>
            <Slider defaultValue={40} surface={s} />
            <span style={label}>Slider {s}</span>
          </div>
        ))}
        <div style={cell}>
          <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 3)" }}>
            <Checkbox defaultChecked />
            <Checkbox />
          </div>
          <span style={label}>Checkbox</span>
        </div>
        <div style={cell}>
          <RadioGroup defaultValue="a" style={{ flexDirection: "row" }}>
            <Radio value="a" />
            <Radio value="b" />
          </RadioGroup>
          <span style={label}>Radio</span>
        </div>
      </div>
    </section>
  </div>
);
