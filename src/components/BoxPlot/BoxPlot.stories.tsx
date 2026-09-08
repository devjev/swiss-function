import type { Story } from "@ladle/react";
import { useState } from "react";
import { BoxPlot, type BoxPlotProps, type BoxStats } from "./BoxPlot";

export default { title: "Chart/BoxPlot" };

/** Deterministic samples: a seeded PRNG (mulberry32) with a Box-Muller normal,
 *  so every story renders the same picture on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(next: () => number) {
  const u = Math.max(next(), 1e-9);
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A log-normal latency sample (ms) around a median with a spread and n. The
 *  normal tail is clamped to 1.9 sigma so the bulk stays inside the Tukey
 *  fences; `extras` (multiples of the median) append the deliberate outliers
 *  that the fences are there to flag. */
function latency(
  seed: number,
  median: number,
  spread: number,
  n = 200,
  extras: number[] = [],
): number[] {
  const next = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.max(-1.9, Math.min(1.9, normal(next)));
    out.push(Math.round(median * Math.exp(spread * z)));
  }
  for (const k of extras) out.push(Math.round(median * k));
  return out;
}

const SERVICES = ["gateway", "auth", "search", "billing", "reports"];
const LATENCY = [
  latency(1, 42, 0.3, 200, [2.5]),
  latency(2, 65, 0.35, 200, [2.4, 2.6]),
  latency(3, 120, 0.4, 200, []),
  latency(4, 88, 0.25, 200, [2.1]),
  latency(5, 210, 0.35, 200, [2.4]),
];
const LATENCY_LAST_WEEK = [
  latency(11, 48, 0.3, 200, [2.5]),
  latency(12, 60, 0.35, 200, [2.9]),
  latency(13, 140, 0.4, 200, [2.6, 2.7]),
  latency(14, 90, 0.25, 200, []),
  latency(15, 180, 0.35, 200, [3]),
];
/** The same services with one runaway value in reports: the case for
 *  `clipOutliers`. */
const LATENCY_RUNAWAY = LATENCY.map((s, i) => (i === 4 ? [...s, 4_800] : s));

const wide: React.CSSProperties = { width: "min(44rem, 100%)" };

export const Playground: Story<BoxPlotProps> = (args) => (
  <div style={wide}>
    <BoxPlot {...args} />
  </div>
);
Playground.args = {
  categories: SERVICES,
  series: [{ name: "Latency", values: LATENCY }],
  xLabel: "Service",
  yLabel: "Request latency (ms)",
  whiskers: "tukey",
  orientation: "vertical",
  scaffolding: "hover",
  showValues: false,
  showLegend: false,
};
Playground.argTypes = {
  whiskers: { options: ["tukey", "minmax"], control: { type: "radio" } },
  shape: { options: [undefined, "quartile", "box", "violin"], control: { type: "radio" } },
  orientation: { options: ["vertical", "horizontal"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  showValues: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <div style={wide}>
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY }]}
      xLabel="Service"
      yLabel="Request latency (ms)"
    />
  </div>
);

export const QuartileVsBox: Story = () => (
  <div style={{ ...wide, display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY }]}
      yLabel="hover: quartile plot"
      showValues
    />
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY }]}
      yLabel="full: box"
      scaffolding="full"
    />
  </div>
);

export const Violin: Story = () => (
  <div style={wide}>
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY }]}
      shape="violin"
      xLabel="Service"
      yLabel="Request latency (ms)"
    />
  </div>
);

export const Grouped: Story = () => (
  <div style={wide}>
    <BoxPlot
      categories={SERVICES}
      series={[
        { name: "Last week", values: LATENCY_LAST_WEEK },
        { name: "This week", values: LATENCY },
      ]}
      scaffolding="full"
      xLabel="Service"
      yLabel="Request latency (ms)"
    />
  </div>
);

export const Whiskers: Story = () => (
  <div style={{ ...wide, display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY }]}
      whiskers="tukey"
      yLabel="tukey (1.5 IQR)"
      scaffolding="full"
    />
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY }]}
      whiskers="minmax"
      yLabel="minmax"
      scaffolding="full"
    />
  </div>
);

export const Horizontal: Story = () => (
  <div style={wide}>
    <BoxPlot
      categories={[
        "Northern Territories",
        "Eastern Seaboard",
        "Central Plains",
        "Mountain West",
        "Pacific Rim",
        "Gulf Coast",
      ]}
      series={[
        {
          name: "Order value",
          values: [
            latency(21, 120, 0.4),
            latency(22, 95, 0.5),
            latency(23, 140, 0.35),
            latency(24, 80, 0.6),
            latency(25, 210, 0.3),
            latency(26, 130, 0.45),
          ],
        },
      ]}
      orientation="horizontal"
      xLabel="Order value"
      height={300}
    />
  </div>
);

const PRECOMPUTED: BoxStats[] = [
  { min: 12, q1: 31, median: 44, q3: 58, max: 90, outliers: [140, 155], n: 1_240 },
  { min: 20, q1: 45, median: 66, q3: 84, max: 130, outliers: [], n: 980 },
  { min: 40, q1: 88, median: 121, q3: 170, max: 290, outliers: [410], n: 2_310 },
  { min: 30, q1: 70, median: 89, q3: 104, max: 150, n: 640 },
  { min: 120, q1: 240, median: 312, q3: 390, max: 610, outliers: [880, 905, 1_020], n: 3_050 },
];

export const Precomputed: Story = () => (
  <div style={wide}>
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", stats: PRECOMPUTED }]}
      scaffolding="full"
      xLabel="Service"
      yLabel="Request latency (ms), summaries from the warehouse"
    />
  </div>
);

const MANY = Array.from({ length: 30 }, (_, i) => `Endpoint ${String(i + 1).padStart(2, "0")}`);
const MANY_VALUES = MANY.map((_, i) =>
  latency(100 + i, 40 + ((i * 37) % 200), 0.3 + (i % 4) * 0.1, 80),
);

export const ManyCategories: Story = () => (
  <div style={{ width: "min(56rem, 100%)" }}>
    <BoxPlot
      categories={MANY}
      series={[{ name: "Latency", values: MANY_VALUES }]}
      xLabel="Endpoint"
      yLabel="Latency (ms)"
      height={320}
    />
  </div>
);

export const ClippedOutliers: Story = () => (
  <div style={{ ...wide, display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY_RUNAWAY }]}
      yLabel="auto domain (one 4.8 s value)"
      scaffolding="full"
    />
    <BoxPlot
      categories={SERVICES}
      series={[{ name: "Latency", values: LATENCY_RUNAWAY }]}
      yLabel="clipOutliers"
      scaffolding="full"
      clipOutliers
    />
  </div>
);

export const Zoomable: Story = () => {
  const [selection, setSelection] =
    useState<Parameters<NonNullable<BoxPlotProps["onSelectionChange"]>>[0]>(null);
  return (
    <div style={{ ...wide, display: "grid", gap: "calc(var(--sf-unit) / 2)" }}>
      <BoxPlot
        categories={SERVICES}
        series={[{ name: "Latency", values: LATENCY }]}
        scaffolding="full"
        frame
        fullscreen
        controls
        zoomable
        zoomOutLimit={Number.POSITIVE_INFINITY}
        selectable
        selection={selection}
        onSelectionChange={setSelection}
        annotations={[{ type: "hline", y: 200, label: "SLO 200 ms" }]}
        xLabel="Service"
        yLabel="Request latency (ms)"
        height={320}
      />
      <span style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        selection: {selection ? `${selection.category}, median ${selection.stats.median}` : "none"}
      </span>
    </div>
  );
};
