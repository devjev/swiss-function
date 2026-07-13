import type { Story } from "@ladle/react";
import { Progress, type ProgressProps } from "./Progress";

const row: React.CSSProperties = {
  display: "grid",
  gap: "var(--sf-unit)",
  maxWidth: "28rem",
};

export const Playground: Story<ProgressProps> = (args) => <Progress {...args} />;
Playground.args = {
  value: 60,
  min: 0,
  max: 100,
  fill: "color",
  size: "md",
  tone: "primary",
  showValue: true,
};
Playground.argTypes = {
  fill: { options: ["color", "dither", "animated"], control: { type: "radio" } },
  size: { options: ["xs", "sm", "md", "lg"], control: { type: "radio" } },
  tone: {
    options: ["neutral", "primary", "success", "warning", "danger"],
    control: { type: "radio" },
  },
  showValue: { control: { type: "boolean" } },
};

export const Sizes: Story = () => (
  <div style={row}>
    <Progress value={60} size="xs" />
    <Progress value={60} size="sm" />
    <Progress value={60} size="md" />
    <Progress value={60} size="lg" />
  </div>
);

export const Fills: Story = () => (
  <div style={row}>
    <Progress value={62} fill="color" showValue />
    <Progress value={62} fill="dither" showValue />
    <Progress value={62} fill="animated" showValue />
  </div>
);

export const Tones: Story = () => (
  <div style={row}>
    <Progress value={70} tone="neutral" />
    <Progress value={70} tone="primary" />
    <Progress value={70} tone="success" />
    <Progress value={70} tone="warning" />
    <Progress value={70} tone="danger" />
  </div>
);

// value={null} → indeterminate. The colour/dither fills sweep; the animated
// fill runs its effect across the whole track. Reduced motion freezes all three.
export const Indeterminate: Story = () => (
  <div style={row}>
    <Progress value={null} fill="color" />
    <Progress value={null} fill="dither" />
    <Progress value={null} fill="animated" />
  </div>
);

export const WithValue: Story = () => (
  <div style={row}>
    <Progress value={35} showValue />
    <Progress
      value={0.42}
      min={0}
      max={1}
      showValue
      formatValue={(v) => `${(v * 100).toFixed(0)}%`}
    />
    <Progress value={128} min={0} max={256} showValue formatValue={(v, max) => `${v}/${max}`} />
  </div>
);

export const Elevation: Story = () => (
  <div style={row}>
    <Progress value={55} elevation={1} />
    <Progress value={55} elevation={3} />
    <Progress value={55} elevation={5} />
  </div>
);

// An explicit colour overrides the tone, for the rare case a bar must match a
// brand or data-series colour rather than a semantic status.
export const CustomColor: Story = () => (
  <div style={row}>
    <Progress value={48} color="var(--sf-color-fg)" showValue />
    <Progress value={48} fill="animated" color="#7c3aed" />
  </div>
);

// The animated fill accepts any effect from the shared WebGL dither set (the
// same one behind NonIdealState / Skeleton). These are the evenly-covered ones
// that stay legible on a thin bar; the large-area effects (ripple, fire, radar,
// …) thin out to too few rows here. `shimmer` is the default.
const thinBarEffects = [
  "shimmer",
  "blink",
  "sparkle",
  "twinkle",
  "breathe",
  "blocks",
  "interleave",
  "rotate",
  "noise",
] as const;

export const AnimatedEffects: Story = () => (
  <div style={{ ...row, maxWidth: "32rem" }}>
    {thinBarEffects.map((effect) => (
      <div
        key={effect}
        style={{
          display: "grid",
          gridTemplateColumns: "6rem 1fr",
          gap: "var(--sf-unit)",
          alignItems: "center",
        }}
      >
        <code style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-fg)" }}>
          {effect}
        </code>
        <Progress value={68} fill="animated" effect={effect} size="md" />
      </div>
    ))}
  </div>
);
