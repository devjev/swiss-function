import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { type FlowPeriod, Flows, type FlowsProps } from "./Flows";

export default { title: "Chart/Flows" };

// A fund's monthly AUM decomposition. Each period's close carries into the next
// period's open (a continuous ledger) — deterministic, no RNG.
function monthlyFlows(): FlowPeriod[] {
  const rows: [string, number, number, number, number][] = [
    // [month, subscriptions, redemptions, performance, fxEffect]
    ["Jan", 120, 60, 34, -8],
    ["Feb", 90, 110, -22, 5],
    ["Mar", 150, 70, 41, -12],
    ["Apr", 80, 95, 18, 3],
    ["May", 200, 60, -30, -6],
    ["Jun", 110, 130, 52, 9],
  ];
  const periods: FlowPeriod[] = [];
  let open = 1000;
  for (const [x, subscriptions, redemptions, performance, fxEffect] of rows) {
    periods.push({ x, open, subscriptions, redemptions, performance, fxEffect });
    open = open + subscriptions - redemptions + performance + fxEffect;
  }
  return periods;
}

// A full year of monthly periods with YYYY-MM labels — a continuous ledger
// like `monthlyFlows`, deterministic, no RNG.
function yearlyFlows(): FlowPeriod[] {
  const rows: [number, number, number, number][] = [
    // [subscriptions, redemptions, performance, fxEffect]
    [120, 60, 34, -8],
    [90, 110, -22, 5],
    [150, 70, 41, -12],
    [80, 95, 18, 3],
    [200, 60, -30, -6],
    [110, 130, 52, 9],
    [95, 85, 27, -4],
    [140, 100, -18, 7],
    [70, 120, 45, -10],
    [160, 75, 12, 6],
    [105, 90, -25, -3],
    [130, 65, 38, 11],
  ];
  const periods: FlowPeriod[] = [];
  let open = 1000;
  rows.forEach(([subscriptions, redemptions, performance, fxEffect], i) => {
    periods.push({
      x: `2025-${String(i + 1).padStart(2, "0")}`,
      open,
      subscriptions,
      redemptions,
      performance,
      fxEffect,
    });
    open = open + subscriptions - redemptions + performance + fxEffect;
  });
  return periods;
}

export const Playground: Story<FlowsProps> = (args) => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <Flows {...args} />
  </div>
);
Playground.args = {
  periods: monthlyFlows(),
  yLabel: "AUM (m)",
  xLabel: "Month",
};

export const Compact: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Flows periods={monthlyFlows()} yLabel="AUM (m)" height={220} />
  </div>
);

/**
 * `scaffolding="full"` keeps the AUM axis and gridlines visible at all times —
 * useful when the exact level at each step matters.
 */
export const FullScaffolding: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <Flows periods={monthlyFlows()} yLabel="AUM (m)" xLabel="Month" scaffolding="full" />
  </div>
);

// Narrow-container stress: 12 monthly YYYY-MM periods in 320px. The measured
// fitting ladder can't usefully ellipsize YYYY-MM, so it thins the period
// axis to a stride keeping first + last; the y column is sized to the widest
// measured AUM label. Deterministic data — this is a VRT surface.
export const Narrow: Story = () => (
  <div style={{ width: 320 }}>
    <Flows periods={yearlyFlows()} yLabel="AUM (m)" scaffolding="full" showLegend={false} />
  </div>
);

/**
 * The full interactive chart window — a frame, fullscreen, the controls toolbar,
 * value-axis (AUM) zoom (the x axis is per-period), and an editable
 * reference-level annotation. `zoomOutLimit` allows arbitrary zoom-out.
 */
export const ChartWindow: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { type: "hline", y: 1000, label: "opening AUM" },
  ]);
  return (
    <div style={{ width: "min(48rem, 100%)" }}>
      <Flows
        periods={monthlyFlows()}
        yLabel="AUM (m)"
        xLabel="Month"
        scaffolding="full"
        frame
        fullscreen
        controls
        zoomable
        zoomOutLimit={Number.POSITIVE_INFINITY}
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
      />
    </div>
  );
};
