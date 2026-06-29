import type { Story } from "@ladle/react";
import type { GridData } from "../../lib/chart3d/types";
import { Surface } from "./Surface";

export default { title: "Chart3d/Surface" };

/** z = sin(r)/r — the classic "ripple" peak, great for reading a 3D surface. */
function peakGrid(n = 44): GridData {
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

/** A smooth pseudo-terrain from summed sinusoids (deterministic, no RNG). */
function terrainGrid(n = 40): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(i);
  for (let j = 0; j < n; j++) y.push(j);
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) {
      const v =
        Math.sin(i / 5) * Math.cos(j / 6) +
        0.5 * Math.sin(i / 2.3 + j / 3.1) +
        0.3 * Math.cos((i + j) / 4);
      row.push(v);
    }
    z.push(row);
  }
  return { x, y, z };
}

export const Peak: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <Surface data={peakGrid()} xLabel="x" yLabel="y" zLabel="z" />
    <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
      Drag to rotate. z = sin(r)/r.
    </p>
  </div>
);

export const Terrain: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <Surface data={terrainGrid()} height={420} />
  </div>
);

export const NoWireframe: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <Surface data={peakGrid()} wireframe={false} />
  </div>
);
