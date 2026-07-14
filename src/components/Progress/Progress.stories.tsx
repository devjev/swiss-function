import type { Story } from "@ladle/react";
import { useEffect, useState } from "react";
import type { EffectName } from "../../lib/effects";
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

// Square the corners to sit with the blocky dither family, via the
// component-scoped `--sf-progress-radius` token (0 here) — no need to override
// the broad `--sf-radius-default`.
export const Squared: Story = () => (
  <div style={{ ...row, ["--sf-progress-radius" as string]: "0" }}>
    <Progress value={62} fill="color" showValue />
    <Progress value={62} fill="dither" />
    <Progress value={62} fill="animated" />
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
// same one behind NonIdealState / Skeleton). The first group are the
// evenly-covered effects that stay legible on a thin bar; the second are the
// large-area effects, which have more vertical structure to read but thin out
// on a short track (shown at `lg` here). `shimmer` is the default.
const evenlyCoveredEffects = [
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

const largeAreaEffects = [
  "ripple",
  "scan",
  "plasma",
  "rain",
  "wave",
  "cascade",
  "crosswave",
  "spiral",
  "radar",
  "tunnel",
  "fire",
  "bars",
  "metaballs",
  "rotozoom",
  "twister",
  "copper",
  "voronoi",
  "grid",
  "kaleidoscope",
  "bobs",
  "swirl",
  "helix",
  "checker",
  "droplets",
  "glitch",
  "life",
] as const;

// A value that fills 0 -> 100 over `durationMs`, then loops, so the effects are
// shown as the bar actually fills rather than frozen at one width. Respects
// reduced motion: holds a static two-thirds fill instead of animating.
function useSlowFill(durationMs = 9000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(66);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      setValue(Math.round((((t - start) % durationMs) / durationMs) * 100));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);
  return value;
}

function EffectRow({
  effect,
  value,
  size,
}: {
  effect: EffectName;
  value: number;
  size: "md" | "lg";
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "7rem 1fr",
        gap: "var(--sf-unit)",
        alignItems: "center",
      }}
    >
      <code style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-fg)" }}>
        {effect}
      </code>
      <Progress value={value} fill="animated" effect={effect} size={size} />
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sf-font-size-sm)",
  fontWeight: "var(--sf-font-weight-medium)",
  color: "var(--sf-color-muted)",
};

export const AnimatedEffects: Story = () => {
  const value = useSlowFill();
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", maxWidth: "34rem" }}>
      <span style={sectionLabel}>Evenly covered (legible on a thin bar)</span>
      {evenlyCoveredEffects.map((effect) => (
        <EffectRow key={effect} effect={effect} value={value} size="md" />
      ))}
      <span style={{ ...sectionLabel, marginTop: "var(--sf-unit)" }}>
        Large area (more structure, shown taller)
      </span>
      {largeAreaEffects.map((effect) => (
        <EffectRow key={effect} effect={effect} value={value} size="lg" />
      ))}
    </div>
  );
};
