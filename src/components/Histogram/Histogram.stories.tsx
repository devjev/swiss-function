import type { Story } from "@ladle/react";
import { useState } from "react";
import { type ChartAnnotation, Histogram, type HistogramProps } from "./Histogram";

export default { title: "Chart/Histogram" };

/** Deterministic PRNG (mulberry32): story data must be stable across reloads. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` draws from a normal distribution with the given mean and standard
 *  deviation (Box-Muller). */
function normal(n: number, mean: number, sd: number, seed: number): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rand() || 1e-12;
    const v = rand();
    out.push(mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
}

/** Daily returns in percent: fat-tailed (a mix of two normals). */
function dailyReturns(n: number, seed: number): number[] {
  const calm = normal(Math.round(n * 0.85), 0.05, 0.8, seed);
  const stressed = normal(n - calm.length, -0.3, 2.4, seed + 1);
  return [...calm, ...stressed];
}

const returns = dailyReturns(750, 42);
const pct = (v: number) => `${v.toFixed(1)}%`;

const wrap: React.CSSProperties = { width: "min(40rem, 100%)" };

export const Playground: Story<HistogramProps> = (args) => (
  <div style={wrap}>
    <Histogram {...args} />
  </div>
);
Playground.args = {
  data: returns,
  normalize: "count",
  cumulative: false,
  density: false,
  showValues: false,
  scaffolding: "hover",
  zoomable: false,
  controls: false,
  frame: false,
  xLabel: "Daily return",
  yLabel: "Days",
};
Playground.argTypes = {
  normalize: { options: ["count", "percent", "density"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  cumulative: { control: { type: "boolean" } },
  density: { control: { type: "boolean" } },
  showValues: { control: { type: "boolean" } },
  zoomable: { control: { type: "boolean" } },
  controls: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <div style={wrap}>
    <Histogram data={returns} xLabel="Daily return (%)" yLabel="Days" valueFormat={pct} />
  </div>
);

export const Bins: Story = () => (
  <div style={{ ...wrap, display: "grid", gap: "var(--sf-unit)" }}>
    <Histogram
      data={returns}
      height={180}
      xLabel="automatic (Freedman-Diaconis)"
      valueFormat={pct}
    />
    <Histogram data={returns} bins={10} height={180} xLabel="bins={10}" valueFormat={pct} />
    <Histogram
      data={returns}
      bins={[-8, -4, -2, -1, -0.5, 0, 0.5, 1, 2, 4, 8]}
      height={180}
      xLabel="explicit thresholds, irregular widths"
      valueFormat={pct}
    />
  </div>
);

export const Density: Story = () => (
  <div style={wrap}>
    <Histogram
      data={returns}
      density
      xLabel="Daily return (%)"
      yLabel="Days"
      valueFormat={pct}
      scaffolding="full"
    />
  </div>
);

export const Cumulative: Story = () => (
  <div style={wrap}>
    <Histogram
      data={returns}
      cumulative
      normalize="percent"
      bins={40}
      xLabel="Daily return (%)"
      yLabel="Share of days at or below"
      valueFormat={pct}
      scaffolding="full"
    />
  </div>
);

export const Normalized: Story = () => (
  <div style={wrap}>
    <Histogram
      data={returns}
      normalize="percent"
      showValues
      bins={12}
      xLabel="Daily return (%)"
      yLabel="Share of days"
      valueFormat={pct}
    />
  </div>
);

export const OverlaidSeries: Story = () => (
  <div style={wrap}>
    <Histogram
      series={[
        { name: "Balanced", data: normal(600, 0.04, 0.7, 7), color: "var(--sf-color-primary)" },
        { name: "Growth", data: normal(600, 0.07, 1.4, 8), color: "var(--sf-color-success)" },
      ]}
      bins={30}
      density
      xLabel="Daily return (%)"
      yLabel="Days"
      valueFormat={pct}
    />
  </div>
);

export const Zoomable: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { id: "zero", type: "vline", x: 0, label: "flat" },
    { id: "tail", type: "rect", x1: -8, x2: -2, label: "left tail" },
  ]);
  return (
    <div style={wrap}>
      <Histogram
        data={returns}
        bins={60}
        zoomable
        controls
        frame
        fullscreen
        selectable
        scaffolding="full"
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        xLabel="Daily return (%)"
        yLabel="Days"
        valueFormat={pct}
      />
    </div>
  );
};

const dense = normal(100_000, 0, 1, 99);

export const Dense: Story = () => (
  <div style={wrap}>
    <Histogram
      data={dense}
      density
      zoomable
      xLabel="z (100'000 samples, automatic bins)"
      yLabel="Count"
      scaffolding="full"
    />
  </div>
);
