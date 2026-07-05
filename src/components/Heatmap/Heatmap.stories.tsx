import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import type { Domain, GridData } from "../../lib/chart3d/types";
import { Heatmap } from "./Heatmap";

export default { title: "Chart3d/Heatmap" };

/** Two-way sensitivity of a 5-year DCF: output is NPV expressed as % change vs
 *  the baseline (centre cell), over revenue-growth Δ (x, percentage points) and
 *  discount-rate Δ (y, percentage points). Deterministic — no RNG. */
function npvSensitivity(n = 41): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(-10 + (20 * i) / (n - 1));
  for (let j = 0; j < n; j++) y.push(-4 + (8 * j) / (n - 1));
  const npv = (g: number, d: number) => {
    const growth = 0.06 + g / 100; // base 6% revenue growth
    const rate = 0.1 + d / 100; // base 10% discount rate
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

/** Symmetric ±max domain, so 0 (the baseline) lands at the ramp's midpoint. */
function symmetric(data: GridData): Domain {
  let m = 0;
  for (const row of data.z) for (const v of row) m = Math.max(m, Math.abs(v));
  return [-m, m];
}

/** Diverging red→green ramp, kept semi-transparent so the blend doesn't read as
 *  a heavy "swamp" at the neutral midpoint — the page shows through a little. */
const RAMP: [string, string] = [
  "color-mix(in srgb, var(--sf-color-danger) 55%, transparent)",
  "color-mix(in srgb, var(--sf-color-success) 55%, transparent)",
];

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

/** A two-way sensitivity matrix: the classic colored data table of an output
 *  metric against two drivers, each cell carrying its value. Diverging red→green
 *  ramp with a symmetric domain, so the baseline (centre, 0) reads neutral. Coarse
 *  by design — value labels only make sense on a table-sized grid. */
export const SensitivityMatrix: Story = () => {
  const data = npvSensitivity(9);
  return (
    <div style={{ maxWidth: 520 }}>
      <Heatmap
        data={data}
        zDomain={symmetric(data)}
        colorScale={RAMP}
        showValues
        valueFormat={(z) => `${z > 0 ? "+" : ""}${Math.round(z)}`}
        height={360}
        xLabel="Revenue growth Δ (pp)"
        yLabel="Discount rate Δ (pp)"
      />
      <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
        5-yr NPV, % change vs baseline. Red = value-destroying, green = value-creating; the centre
        cell is the baseline (0). Reading across a row vs down a column shows NPV is far more
        sensitive to revenue growth than to the discount rate.
      </p>
    </div>
  );
};

/** The same model at full resolution as a smooth field with iso-lines — the
 *  continuous read when you don't need per-cell numbers. */
export const SensitivityField: Story = () => {
  const data = npvSensitivity(41);
  return (
    <div style={{ maxWidth: 520 }}>
      <Heatmap
        data={data}
        zDomain={symmetric(data)}
        colorScale={RAMP}
        contours={8}
        xLabel="Revenue growth Δ (pp)"
        yLabel="Discount rate Δ (pp)"
      />
      <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
        The near-vertical iso-lines (incl. the break-even contour through 0) confirm the same story
        the matrix tells, continuously.
      </p>
    </div>
  );
};

// Issue #35: shared scaffolding on the grid — frame, fullscreen, controls, a
// data-anchored region annotation, and value-axis (row) zoom (wheel/drag/±/0
// window a vertical sub-range of rows).
export const InteractiveScaffolding: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([]);
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <Heatmap
        data={npvSensitivity(21)}
        xLabel="Revenue growth Δ (pp)"
        yLabel="Discount rate Δ (pp)"
        height={360}
        frame
        fullscreen
        controls
        zoomable
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
      />
    </div>
  );
};
