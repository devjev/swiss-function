import type { Story } from "@ladle/react";
import type { Point3, PointSeries } from "../../lib/chart3d/types";
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

// --- Sensitivity point cluster (Monte-Carlo) ---

/** Same 5-yr DCF as the Heatmap/Surface sensitivity stories, as a scalar: NPV
 *  % change vs baseline for given growth (g) and discount-rate (d) deltas. */
function npvDelta(g: number, d: number): number {
  const npv = (gg: number, dd: number) => {
    const growth = 0.06 + gg / 100;
    const rate = 0.1 + dd / 100;
    let v = 0;
    for (let t = 1; t <= 5; t++) v += (100 * (1 + growth) ** t) / (1 + rate) ** t;
    return v;
  };
  const base = npv(0, 0);
  return ((npv(g, d) - base) / base) * 100;
}

/** Monte-Carlo scenarios: sample the two drivers from bell-ish distributions
 *  (sum-of-uniforms), evaluate the model, and split the cloud into upside /
 *  downside vs the baseline. x = growth Δ, y = discount Δ, z = NPV Δ%. */
function scenarios(seed: number, n = 320): PointSeries[] {
  const r = rng(seed);
  const bell = () => r() + r() + r() + r() - 2; // mean 0, ~[-2, 2]
  const upside: Point3[] = [];
  const downside: Point3[] = [];
  for (let k = 0; k < n; k++) {
    const g = bell() * 3; // growth Δ, sd ≈ a few pp
    const d = bell() * 1.5; // discount Δ
    const z = npvDelta(g, d);
    (z >= 0 ? upside : downside).push({ x: g, y: d, z });
  }
  return [
    { name: "Upside", data: upside, color: "var(--sf-color-success)" },
    { name: "Downside", data: downside, color: "var(--sf-color-danger)" },
  ];
}

/** The point-cluster counterpart to the sensitivity matrix: instead of a smooth
 *  grid, a cloud of sampled scenarios coloured by outcome. The vertical (z)
 *  spread is the risk; the green/red split is the chance of value creation. */
export const SensitivityCluster: Story = () => (
  <div style={{ maxWidth: 640 }}>
    <PointCloud series={scenarios(11)} xLabel="Growth Δ (pp)" yLabel="Discount Δ (pp)" />
    <p style={{ color: "var(--sf-color-muted)", fontSize: "var(--sf-font-size-sm)" }}>
      Drag to rotate. 320 Monte-Carlo scenarios over the same NPV model; height (z) is NPV % vs
      baseline. Green = upside, red = downside — the cloud's tilt and spread are the sensitivity.
    </p>
  </div>
);
