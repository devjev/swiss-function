import type { Story } from "@ladle/react";
import type { GridData } from "../../lib/chart3d/types";
import { Heatmap } from "./Heatmap";

export default { title: "Perf/Heatmap" };

// 100×100 grid (10k SVG cells) + contours for the perf probes
// (scripts/perf/scenarios/heatmap.mjs): the metric is readiness (render cost)
// plus hover→tooltip latency. Doubles as a manual stress story.

function field(n: number): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(-8 + (16 * i) / (n - 1));
  for (let j = 0; j < n; j++) y.push(-8 + (16 * j) / (n - 1));
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) {
      const xv = x[i] as number;
      const yv = y[j] as number;
      row.push(Math.sin(xv / 2) * Math.cos(yv / 3) + Math.sin((xv + yv) / 4));
    }
    z.push(row);
  }
  return { x, y, z };
}

const DATA = field(100);

/** 10k cells + 6 iso-lines — the perf-probe target. */
export const PerfDense: Story = () => (
  <div style={{ maxWidth: 720 }} data-perf-ready="">
    <Heatmap data={DATA} contours={6} xLabel="x" yLabel="y" />
  </div>
);
