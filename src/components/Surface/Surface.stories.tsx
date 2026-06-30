import type { Story } from "@ladle/react";
import type { Domain, GridData } from "../../lib/chart3d/types";
import { Surface } from "./Surface";

export default { title: "Chart3d/Surface" };

/** Two-way sensitivity of a 5-year DCF: output is NPV expressed as % change vs
 *  the baseline, over revenue-growth Δ (x, pp) and discount-rate Δ (y, pp).
 *  Same model the Heatmap "SensitivityMatrix" story renders flat. Deterministic. */
function npvSensitivity(n = 41): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(-10 + (20 * i) / (n - 1));
  for (let j = 0; j < n; j++) y.push(-4 + (8 * j) / (n - 1));
  const npv = (g: number, d: number) => {
    const growth = 0.06 + g / 100;
    const rate = 0.1 + d / 100;
    let v = 0;
    for (let t = 1; t <= 5; t++) v += (100 * (1 + growth) ** t) / (1 + rate) ** t;
    return v;
  };
  const base = npv(0, 0);
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) row.push(((npv(x[i] ?? 0, y[j] ?? 0) - base) / base) * 100);
    z.push(row);
  }
  return { x, y, z };
}

/** Symmetric ±max domain so 0 (the baseline) sits at the ramp's midpoint. */
function symmetric(data: GridData): Domain {
  let m = 0;
  for (const row of data.z) for (const v of row) m = Math.max(m, Math.abs(v));
  return [-m, m];
}

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

/** The sensitivity matrix as a 3D response surface — the height-field read of the
 *  same NPV model the Heatmap "SensitivityMatrix" story shows flat. The diverging
 *  ramp and symmetric domain keep the baseline plane neutral. Drag to rotate. */
export const SensitivitySurface: Story = () => {
  const data = npvSensitivity();
  return (
    <div style={{ maxWidth: 640 }}>
      <Surface
        data={data}
        zDomain={symmetric(data)}
        colorScale={["var(--sf-color-danger)", "var(--sf-color-success)"]}
        height={420}
        xLabel="Growth Δ (pp)"
        yLabel="Discount Δ (pp)"
        zLabel="NPV Δ (%)"
      />
      <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
        5-yr NPV (% vs baseline) as a response surface. The steep tilt along the growth axis vs the
        gentle slope along the discount axis is the sensitivity, read as gradient.
      </p>
    </div>
  );
};
