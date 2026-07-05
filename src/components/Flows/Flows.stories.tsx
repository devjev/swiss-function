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

/**
 * Issue #36 + #35: the full shared chart scaffolding — a frame, fullscreen, the
 * controls toolbar, value-axis (AUM) zoom, and an editable reference-level
 * annotation. Zoom windows the AUM axis; the x axis is per-period.
 */
export const InteractiveScaffolding: Story = () => {
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
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
      />
    </div>
  );
};
