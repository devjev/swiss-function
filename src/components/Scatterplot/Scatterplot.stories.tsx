import type { Story } from "@ladle/react";
import { useState } from "react";
import {
  type ChartAnnotation,
  Scatterplot,
  type ScatterplotProps,
  type ScatterSeries,
} from "./Scatterplot";

export default { title: "Chart/Scatterplot" };

/** Deterministic PRNG — story data must be stable across reloads. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const samplePoints = [
  { x: 1, y: 12 },
  { x: 2, y: 18 },
  { x: 3, y: 14 },
  { x: 4, y: 22 },
  { x: 5, y: 19 },
  { x: 6, y: 28 },
  { x: 7, y: 24 },
  { x: 8, y: 31 },
];

export const Playground: Story<ScatterplotProps> = (args) => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Scatterplot {...args} />
  </div>
);
Playground.args = {
  series: [{ name: "Series A", data: samplePoints, showPoints: true, showLine: false }],
  xLabel: "Trial",
  yLabel: "Value",
  showLegend: false,
};

export const Points: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Scatterplot series={[{ name: "Trials", data: samplePoints }]} xLabel="Trial" yLabel="Score" />
  </div>
);

export const Line: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Scatterplot
      series={[
        {
          name: "Revenue",
          data: samplePoints,
          showLine: true,
          showPoints: false,
        },
      ]}
      xLabel="Quarter"
      yLabel="Revenue (k)"
    />
  </div>
);

export const PointsAndLine: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Scatterplot
      series={[
        {
          name: "Observations",
          data: samplePoints,
          showLine: true,
          showPoints: true,
        },
      ]}
      xLabel="Sample"
      yLabel="Value"
    />
  </div>
);

export const MultiSeries: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <Scatterplot
      series={[
        {
          name: "Treatment",
          data: [
            { x: 1, y: 4 },
            { x: 2, y: 9 },
            { x: 3, y: 14 },
            { x: 4, y: 21 },
            { x: 5, y: 27 },
            { x: 6, y: 32 },
          ],
          color: "var(--sf-color-primary)",
          showLine: true,
        },
        {
          name: "Control",
          data: [
            { x: 1, y: 5 },
            { x: 2, y: 7 },
            { x: 3, y: 10 },
            { x: 4, y: 12 },
            { x: 5, y: 15 },
            { x: 6, y: 17 },
          ],
          color: "var(--sf-color-warning)",
          showLine: true,
        },
      ]}
      xLabel="Week"
      yLabel="Conversion (%)"
    />
  </div>
);

export const TimeSeries: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <Scatterplot
      series={[
        {
          name: "Deployments",
          data: [
            { x: new Date("2026-01-15"), y: 4 },
            { x: new Date("2026-02-12"), y: 7 },
            { x: new Date("2026-03-08"), y: 6 },
            { x: new Date("2026-04-22"), y: 11 },
            { x: new Date("2026-06-04"), y: 9 },
            { x: new Date("2026-08-19"), y: 14 },
            { x: new Date("2026-11-03"), y: 12 },
          ],
          showLine: true,
        },
      ]}
      xLabel="Date"
      yLabel="Deploys / week"
    />
  </div>
);

/**
 * `scaffolding="full"` brings back the v0.1 chrome: nice-tick axes with
 * even steps + horizontal gridlines, instead of per-datum dot-dash ticks.
 * Use this when you have many overlapping x values that would collide as
 * dot-dash labels.
 */
export const FullScaffolding: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Scatterplot
      series={[{ name: "Trials", data: samplePoints, showLine: true }]}
      scaffolding="full"
      xLabel="Trial"
      yLabel="Score"
    />
  </div>
);

/**
 * `zoomable`: wheel zooms at the cursor (click the chart once, or hold
 * ctrl/⌘), drag pans, double-click resets. Keyboard when focused: ←/→ pan,
 * +/- zoom, 0 resets. Two years of daily data — zoom in and watch the time
 * axis morph from months to days, and the decimated line progressively reveal
 * raw points. The y-axis follows the visible window.
 */
export const Zoomable: Story = () => {
  const rand = seededRandom(42);
  const data: { x: Date; y: number }[] = [];
  let level = 120;
  const start = new Date(2024, 0, 1).getTime();
  for (let i = 0; i < 730; i++) {
    level += (rand() - 0.48) * 4;
    data.push({ x: new Date(start + i * 86_400_000), y: Number(level.toFixed(2)) });
  }
  return (
    <div style={{ width: "min(48rem, 100%)" }}>
      <Scatterplot
        series={[{ name: "Sensor", data, showLine: true, showPoints: false }]}
        scaffolding="full"
        zoomable
        xLabel="Date"
        yLabel="Reading"
      />
    </div>
  );
};

/**
 * Annotations are plain JSON anchored in data space, so they stay glued to
 * their values through zoom and pan (this chart is also `zoomable`).
 */
export const Annotations: Story = () => {
  const rand = seededRandom(7);
  const data: { x: Date; y: number }[] = [];
  let level = 80;
  const start = new Date(2025, 0, 6).getTime();
  for (let i = 0; i < 240; i++) {
    level += (rand() - 0.46) * 2;
    data.push({ x: new Date(start + i * 86_400_000), y: Number(level.toFixed(2)) });
  }
  return (
    <div style={{ width: "min(48rem, 100%)" }}>
      <Scatterplot
        series={[{ name: "Price", data, showLine: true, showPoints: false }]}
        scaffolding="full"
        zoomable
        xLabel="Date"
        yLabel="Price"
        annotations={[
          { type: "hline", y: 80, label: "Entry", color: "var(--sf-color-success)" },
          { type: "vline", x: new Date(2025, 3, 1), label: "Q2" },
          {
            type: "rect",
            x1: new Date(2025, 5, 1),
            x2: new Date(2025, 6, 1),
            label: "Freeze",
            color: "var(--sf-color-warning)",
          },
          {
            type: "measure",
            x1: new Date(2025, 1, 3),
            y1: 80,
            x2: new Date(2025, 4, 15),
            y2: 88,
          },
        ]}
      />
    </div>
  );
};

/**
 * Drill-down is an event, not behavior: `onPointActivate` fires on
 * click/Enter, the consumer swaps `series` for finer-grained data and renders
 * its own breadcrumb. `onXDomainChange` is the matching hook for loading
 * finer data when the user zooms in (semantic zoom).
 */
export const DrillDown: Story = () => {
  const years = [
    { x: 2021, y: 84 },
    { x: 2022, y: 132 },
    { x: 2023, y: 118 },
    { x: 2024, y: 176 },
    { x: 2025, y: 205 },
  ];
  const monthsFor = (year: number): ScatterSeries => {
    const rand = seededRandom(year);
    return {
      name: `${year} by month`,
      data: Array.from({ length: 12 }, (_, m) => ({
        x: m + 1,
        y: Math.round(5 + rand() * 20),
        label: new Date(year, m, 1).toLocaleString(undefined, { month: "short" }),
      })),
      showLine: true,
    };
  };
  const [year, setYear] = useState<number | null>(null);
  return (
    <div style={{ width: "min(48rem, 100%)" }}>
      {year != null ? (
        <button type="button" onClick={() => setYear(null)} style={{ marginBlockEnd: "0.5rem" }}>
          ← All years
        </button>
      ) : null}
      <Scatterplot
        series={
          year != null ? [monthsFor(year)] : [{ name: "Revenue", data: years, showLine: true }]
        }
        scaffolding="full"
        xLabel={year != null ? `Months of ${year}` : "Year"}
        yLabel="Revenue (k)"
        onPointActivate={year == null ? (d) => setYear(Number(d.x)) : undefined}
      />
    </div>
  );
};

/**
 * The full chart window (issue #27 M3): `controls` renders the toolbar —
 * zoom in/out/reset plus, because `onAnnotationsChange` is wired, the
 * annotation tools. Arm a tool and drag to draw a trend line, region or
 * measure; click to place h/v lines; the text tool opens an inline note
 * input. Click a drawing to select it (drag its handles or body; Delete
 * removes it). `frame` gives the chart its panel border and `fullscreen`
 * the maximize toggle. The annotations array round-trips through state —
 * persist it as-is.
 */
// Narrow-container stress: dates on x and 7-digit y values in 320px. The
// per-datum dot-dash labels go through measured collision thinning (the range
// endpoints always survive) and the y column is sized to the widest measured
// label. Deterministic data — this is a VRT surface.
export const Narrow: Story = () => (
  <div style={{ width: 320 }}>
    <Scatterplot
      series={[
        {
          name: "AUM",
          data: [
            { x: new Date(2026, 0, 5), y: 1_234_567 },
            { x: new Date(2026, 0, 19), y: 1_298_402 },
            { x: new Date(2026, 1, 2), y: 1_190_338 },
            { x: new Date(2026, 1, 16), y: 1_275_910 },
            { x: new Date(2026, 2, 2), y: 1_402_664 },
            { x: new Date(2026, 2, 16), y: 1_366_072 },
            { x: new Date(2026, 2, 30), y: 1_450_218 },
            { x: new Date(2026, 3, 13), y: 1_521_884 },
          ],
          showLine: true,
        },
      ]}
      xLabel="Date"
      yLabel="AUM"
      showLegend={false}
    />
  </div>
);

export const ChartWindow: Story = () => {
  const rand = seededRandom(11);
  const data: { x: Date; y: number }[] = [];
  let level = 100;
  const start = new Date(2025, 6, 1).getTime();
  for (let i = 0; i < 365; i++) {
    level += (rand() - 0.47) * 3;
    data.push({ x: new Date(start + i * 86_400_000), y: Number(level.toFixed(2)) });
  }
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { type: "hline", y: 100, label: "Baseline", id: "baseline" },
  ]);
  return (
    <div style={{ width: "min(52rem, 100%)" }}>
      <Scatterplot
        series={[{ name: "Index", data, showLine: true, showPoints: false }]}
        scaffolding="full"
        zoomable
        controls
        fullscreen
        frame
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        yLabel="Level"
      />
    </div>
  );
};
