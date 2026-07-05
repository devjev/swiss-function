import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { BridgeChart, type BridgeChartProps } from "./BridgeChart";

export default { title: "Chart/BridgeChart" };

export const Playground: Story<BridgeChartProps> = (args) => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BridgeChart {...args} />
  </div>
);
Playground.args = {
  items: [
    { label: "Q1", value: 100, kind: "total" },
    { label: "Sales", value: 25, kind: "delta" },
    { label: "Costs", value: -12, kind: "delta" },
    { label: "Q2", value: 113, kind: "total" },
  ],
  yLabel: "Revenue (k)",
  showConnectors: true,
};

/**
 * Classic financier waterfall — a starting total, a few signed deltas, and
 * an ending total. The dashed connectors trace cumulative flow between bars.
 */
export const Quarterly: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BridgeChart
      items={[
        { label: "Q1", value: 100, kind: "total" },
        { label: "New", value: 28, kind: "delta" },
        { label: "Upsell", value: 14, kind: "delta" },
        { label: "Churn", value: -9, kind: "delta" },
        { label: "Discount", value: -6, kind: "delta" },
        { label: "Q2", value: 127, kind: "total" },
      ]}
      yLabel="ARR (k)"
    />
  </div>
);

/**
 * Multiple `kind: "total"` items mid-bridge act as anchored subtotals — each
 * resets the cumulative to its own value, so the next delta floats above it.
 */
export const WithSubtotals: Story = () => (
  <div style={{ width: "min(56rem, 100%)" }}>
    <BridgeChart
      items={[
        { label: "Start", value: 200, kind: "total" },
        { label: "Q1 Δ", value: 35, kind: "delta" },
        { label: "Mid", value: 235, kind: "total" },
        { label: "Q2 Δ", value: -18, kind: "delta" },
        { label: "Q3 Δ", value: 42, kind: "delta" },
        { label: "End", value: 259, kind: "total" },
      ]}
      yLabel="Headcount"
    />
  </div>
);

/**
 * When the running total dips below the starting baseline, deltas show in
 * danger red and the auto-fit domain may extend below 0.
 */
export const Negative: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BridgeChart
      items={[
        { label: "Open", value: 80, kind: "total" },
        { label: "Refunds", value: -30, kind: "delta" },
        { label: "Chargebacks", value: -25, kind: "delta" },
        { label: "New", value: 10, kind: "delta" },
        { label: "Close", value: 35, kind: "total" },
      ]}
      yLabel="Net cash"
    />
  </div>
);

/**
 * Connectors omitted — for dense bridges where the dashes start to crowd.
 */
export const WithoutConnectors: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BridgeChart
      items={[
        { label: "Q1", value: 100, kind: "total" },
        { label: "Sales", value: 25, kind: "delta" },
        { label: "Costs", value: -12, kind: "delta" },
        { label: "Q2", value: 113, kind: "total" },
      ]}
      yLabel="Revenue (k)"
      showConnectors={false}
    />
  </div>
);

/**
 * `scaffolding="full"` switches off the per-bar value labels and adds a
 * traditional nice-tick y-axis with horizontal gridlines.
 */
export const FullScaffolding: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BridgeChart
      items={[
        { label: "Q1", value: 100, kind: "total" },
        { label: "Sales", value: 25, kind: "delta" },
        { label: "Costs", value: -12, kind: "delta" },
        { label: "Q2", value: 113, kind: "total" },
      ]}
      yLabel="Revenue (k)"
      scaffolding="full"
    />
  </div>
);

// The full interactive chart window — frame, fullscreen, controls, value-axis
// (y) zoom (the waterfall's x is categorical, so the value axis windows) and an
// editable hline reference level. `zoomOutLimit` allows arbitrary zoom-out.
export const ChartWindow: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { type: "hline", y: 100, label: "opening" },
  ]);
  return (
    <div style={{ width: "min(48rem, 100%)" }}>
      <BridgeChart
        items={[
          { label: "Q1", value: 100, kind: "total" },
          { label: "Subs", value: 45, kind: "delta" },
          { label: "Redem.", value: -28, kind: "delta" },
          { label: "Perf.", value: 12, kind: "delta" },
          { label: "Q2", value: 129, kind: "total" },
        ]}
        yLabel="AUM (m)"
        xLabel="Flow"
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
