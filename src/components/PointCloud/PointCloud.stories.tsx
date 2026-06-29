import type { Story } from "@ladle/react";
import type { PointSeries } from "../../lib/chart3d/types";
import { PointCloud } from "./PointCloud";

export default { title: "Chart3d/PointCloud" };

// Deterministic pseudo-random (LCG) so stories/screenshots are stable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function cluster(name: string, cx: number, cy: number, cz: number, n: number, seed: number) {
  const r = rng(seed);
  const data = Array.from({ length: n }, () => ({
    x: cx + (r() - 0.5) * 3,
    y: cy + (r() - 0.5) * 3,
    z: cz + (r() - 0.5) * 3,
  }));
  return { name, data };
}

const clusters: PointSeries[] = [
  { ...cluster("Alpha", 3, 3, 3, 80, 1), color: "var(--sf-color-primary)" },
  { ...cluster("Beta", -3, 2, -2, 80, 2), color: "var(--sf-color-success)" },
  { ...cluster("Gamma", 1, -3, 2, 80, 3), color: "var(--sf-color-danger)" },
];

export const Clusters: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <PointCloud series={clusters} xLabel="x" yLabel="y" />
    <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
      Drag to rotate. Three labelled clusters in x/y/z.
    </p>
  </div>
);

const single: PointSeries[] = [{ ...cluster("Samples", 0, 0, 0, 200, 7) }];

export const SingleSeries: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <PointCloud series={single} />
  </div>
);
