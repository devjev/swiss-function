import type { Story } from "@ladle/react";
import { Scatterplot, type ScatterplotProps } from "./Scatterplot";

export default { title: "Chart/Scatterplot" };

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
