import type { Story } from "@ladle/react";
import type { GridData } from "../../lib/chart3d/types";
import { Heatmap } from "./Heatmap";

export default { title: "Chart3d/Heatmap" };

/** z = sin(r)/r — the same field the Surface story shows, here flat. */
function peakGrid(n = 48): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(-8 + (16 * i) / (n - 1));
  for (let j = 0; j < n; j++) y.push(-8 + (16 * j) / (n - 1));
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(x[i] ?? 0, y[j] ?? 0) || 1e-6;
      row.push(Math.sin(r) / r);
    }
    z.push(row);
  }
  return { x, y, z };
}

export const Basic: Story = () => (
  <div style={{ maxWidth: 560 }}>
    <Heatmap data={peakGrid()} xLabel="x" yLabel="y" />
  </div>
);

export const WithContours: Story = () => (
  <div style={{ maxWidth: 560 }}>
    <Heatmap data={peakGrid()} contours={6} xLabel="x" yLabel="y" />
    <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
      Filled heatmap with 6 marching-squares iso-lines. The Swiss-friendly 2D read of the same field
      the Surface story renders in 3D.
    </p>
  </div>
);
