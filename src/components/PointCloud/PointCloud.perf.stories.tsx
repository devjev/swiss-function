import type { Story } from "@ladle/react";
import type { Point3, PointSeries } from "../../lib/chart3d/types";
import { PointCloud } from "./PointCloud";

export default { title: "Perf/PointCloud" };

// Deterministic 20k-point cloud for the perf probes (scripts/perf/scenarios/
// pointcloud.mjs): orbit-drag input→paint, sustained-drag frame p95, and heap
// after a drag (pins per-frame allocation churn). The shipped stories max out
// at 320 points — far too small to catch a regression in the redraw path.
// Never use Math.random here — numbers must be reproducible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedCloud(count: number): PointSeries[] {
  const rand = mulberry32(23);
  const bell = () => rand() + rand() + rand() - 1.5; // mean 0, ~[-1.5, 1.5]
  const data: Point3[] = Array.from({ length: count }, () => ({
    x: bell() * 4,
    y: bell() * 4,
    z: bell() * 4,
  }));
  return [{ name: "Samples", data }];
}

const SERIES = seedCloud(20_000);

/** 1 series × 20k points — the perf-probe target. */
export const PerfCloud20k: Story = () => (
  <div style={{ maxWidth: 720 }} data-perf-ready="">
    <PointCloud series={SERIES} xLabel="x" yLabel="y" height={480} />
  </div>
);
