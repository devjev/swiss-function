import type { Story } from "@ladle/react";
import { type ScatterDatum, Scatterplot } from "./Scatterplot";

export default { title: "Perf/Scatterplot" };

// Deterministic 5k-point series for the perf probes (scripts/perf/scenarios/
// charts.mjs): the metrics are hover-move input→paint and frame p95 during a
// pointer sweep — each point crossing must bail out at the memo'd point layer
// instead of re-reconciling all 5k circles. Doubles as a manual stress story.
// Never use Math.random here — data must be reproducible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePoints(n: number): ScatterDatum[] {
  const rand = mulberry32(7);
  const out: ScatterDatum[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: i, y: Math.round(rand() * 1000) / 10 });
  }
  return out;
}

const DATA = makePoints(5000);

/** 5k points — the perf-probe target. */
export const PerfPoints: Story = () => (
  <div style={{ width: 960 }} data-perf-ready="">
    <Scatterplot
      series={[{ name: "Probe", data: DATA }]}
      xLabel="Index"
      yLabel="Value"
      height={480}
      showLegend={false}
    />
  </div>
);
