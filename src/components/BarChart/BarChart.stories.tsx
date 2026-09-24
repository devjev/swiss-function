import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { BarChart, type BarChartProps } from "./BarChart";

export default { title: "Chart/BarChart" };

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export const Playground: Story<BarChartProps> = (args) => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <BarChart {...args} />
  </div>
);
Playground.args = {
  categories: QUARTERS,
  series: [{ name: "Revenue", values: [42, 58, 51, 73] }],
  xLabel: "Quarter",
  yLabel: "Revenue (k)",
  showLegend: false,
  stacked: false,
  fill: "ramp",
};
Playground.argTypes = {
  stacked: { options: [false, true, "percent"], control: { type: "select" }, defaultValue: false },
  fill: { options: ["ramp", "dither"], control: { type: "radio" }, defaultValue: "ramp" },
};

export const SingleSeries: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <BarChart
      categories={["Mon", "Tue", "Wed", "Thu", "Fri"]}
      series={[{ name: "PRs merged", values: [4, 7, 11, 6, 9] }]}
      xLabel="Day"
      yLabel="Count"
    />
  </div>
);

export const Grouped: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={QUARTERS}
      series={[
        {
          name: "Plan",
          values: [50, 55, 60, 65],
          color: "var(--sf-color-fg-subtle)",
        },
        {
          name: "Actual",
          values: [42, 58, 51, 73],
          color: "var(--sf-color-primary)",
        },
      ]}
      xLabel="Quarter"
      yLabel="Revenue (k)"
    />
  </div>
);

/** Several series piled into one bar per category. Uncoloured series step
 *  through the neutral ink ramp, biggest first, and the total is printed above
 *  the stack (the one figure the axis cannot be read for). */
export const Stacked: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={QUARTERS}
      series={[
        { name: "Subscriptions", values: [120, 138, 151, 166] },
        { name: "Services", values: [64, 61, 72, 80] },
        { name: "Licences", values: [28, 33, 30, 41] },
      ]}
      xLabel="Quarter"
      yLabel="Revenue (k)"
      stacked
    />
  </div>
);

/** `stacked="percent"` makes every bar the same height, so the reading is the
 *  mix rather than the total. The value axis re-ticks in percent. */
export const StackedPercent: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={QUARTERS}
      series={[
        { name: "Subscriptions", values: [120, 138, 151, 166] },
        { name: "Services", values: [64, 61, 72, 80] },
        { name: "Licences", values: [28, 33, 30, 41] },
      ]}
      xLabel="Quarter"
      yLabel="Share of revenue"
      stacked="percent"
    />
  </div>
);

/** The halftone is the second step of the same ladder, for print and for
 *  monochrome screens. */
export const StackedDither: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={QUARTERS}
      series={[
        { name: "Subscriptions", values: [120, 138, 151, 166] },
        { name: "Services", values: [64, 61, 72, 80] },
        { name: "Licences", values: [28, 33, 30, 41] },
      ]}
      xLabel="Quarter"
      yLabel="Revenue (k)"
      stacked
      fill="dither"
    />
  </div>
);

/** A stack with both signs: positives pile up from the baseline, negatives
 *  hang below it, so no bar is shorter than one of its own parts. */
export const StackedWithNegatives: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={QUARTERS}
      series={[
        { name: "Subscriptions", values: [140, 160, 175, 190] },
        { name: "Redemptions", values: [-60, -45, -80, -52] },
        { name: "Performance", values: [22, -14, 31, 18] },
      ]}
      xLabel="Quarter"
      yLabel="Flow (k)"
      stacked
      scaffolding="full"
    />
  </div>
);

/** One `valueFormat` carries units into the labels, the tooltips and the axis;
 *  `tickFormat` keeps the axis short while it does. `categoryFormat` names a
 *  position (the quarters), `seriesFormat` names a dataset (the legend). */
export const Formatting: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={QUARTERS}
      series={[
        { name: "Plan", values: [50000, 55000, 60000, 65000], color: "var(--sf-color-fg-subtle)" },
        { name: "Actual", values: [42000, 58000, 51000, 73000], color: "var(--sf-color-primary)" },
      ]}
      xLabel="Quarter"
      yLabel="Revenue"
      valueFormat={(v) => `CHF ${(v / 1000).toFixed(1)}k`}
      tickFormat={(v) => `${v / 1000}k`}
      categoryFormat={(c) => `${c} 2026`}
      seriesFormat={(n) => `${n} (CHF)`}
    />
  </div>
);

export const WithCustomColors: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <BarChart
      categories={["Critical", "High", "Medium", "Low"]}
      series={[
        {
          name: "Open",
          values: [3, 12, 28, 41],
          color: "var(--sf-color-danger)",
        },
        {
          name: "Resolved",
          values: [11, 34, 52, 80],
          color: "var(--sf-color-success)",
        },
      ]}
      xLabel="Severity"
      yLabel="Issues"
    />
  </div>
);

export const ManyCategories: Story = () => (
  <div style={{ width: "min(56rem, 100%)" }}>
    <BarChart
      categories={[
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ]}
      series={[
        {
          name: "Signups",
          values: [120, 138, 156, 174, 192, 210, 198, 222, 240, 258, 276, 312],
        },
      ]}
      xLabel="Month"
      yLabel="Signups"
    />
  </div>
);

/**
 * `scaffolding="full"` opts back to the v0.1 chrome: nice-tick y-axis,
 * horizontal gridlines, no inline value labels. Use this when bars are too
 * dense (or too numerous) for direct-label readability.
 */
export const FullScaffolding: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <BarChart
      categories={["Mon", "Tue", "Wed", "Thu", "Fri"]}
      series={[{ name: "PRs merged", values: [4, 7, 11, 6, 9] }]}
      scaffolding="full"
      xLabel="Day"
      yLabel="Count"
    />
  </div>
);

/**
 * Drill-down is an event, not behavior: `onPointActivate` fires on
 * click/Enter, the consumer swaps the data for finer granularity and renders
 * its own breadcrumb (a plain back button here).
 */
export const DrillDown: Story = () => {
  const years: Record<string, number[]> = {
    "2023": [22, 31, 28, 35],
    "2024": [30, 26, 38, 41],
    "2025": [36, 44, 39, 47],
  };
  const [year, setYear] = useState<string | null>(null);
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      {year != null ? (
        <button type="button" onClick={() => setYear(null)} style={{ marginBlockEnd: "0.5rem" }}>
          ← All years
        </button>
      ) : null}
      {year == null ? (
        <BarChart
          categories={Object.keys(years)}
          series={[
            {
              name: "Revenue",
              values: Object.values(years).map((q) => q.reduce((a, b) => a + b, 0)),
            },
          ]}
          yLabel="Revenue (k)"
          onPointActivate={(d) => setYear(d.category)}
        />
      ) : (
        <BarChart
          categories={["Q1", "Q2", "Q3", "Q4"]}
          series={[{ name: year, values: years[year] ?? [] }]}
          yLabel={`Revenue ${year} (k)`}
        />
      )}
    </div>
  );
};

// The full interactive chart window — frame, fullscreen, the controls toolbar,
// value-axis (y) zoom (x is categorical, so wheel/drag/±/0 window the value
// axis) and editable annotations. `zoomOutLimit` allows arbitrary zoom-out.
export const ChartWindow: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { type: "hline", y: 60, label: "target" },
  ]);
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <BarChart
        categories={QUARTERS}
        series={[{ name: "Revenue", values: [42, 58, 51, 73] }]}
        yLabel="Revenue (k)"
        showLegend={false}
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

/**
 * `selectable`: clicking a bar FREEZES it — a pinned popover opens anchored to
 * the bar and stays open (unlike the hover tooltip), and the bar keeps an
 * accent ring. The popover tracks the bar through zoom/pan (this chart is also
 * `zoomable` on the value axis). Dismiss by clicking the bar again, clicking
 * away, Escape, or the ✕. `renderSelection` supplies richer, interactive
 * content than the hover tooltip; omit it and the tooltip body is reused.
 */
export const Selectable: Story = () => {
  const [selected, setSelected] = useState<string>("none");
  return (
    <div style={{ width: "min(44rem, 100%)" }}>
      <p style={{ fontSize: "var(--sf-font-size-sm)", fontFamily: "var(--sf-font-mono)" }}>
        Pinned: {selected}
      </p>
      <BarChart
        categories={QUARTERS}
        series={[{ name: "Revenue", values: [42, 58, 51, 73] }]}
        xLabel="Quarter"
        yLabel="Revenue (k)"
        showLegend={false}
        zoomable
        selectable
        onSelectionChange={(s) => setSelected(s ? `${s.category}: ${s.value}` : "none")}
        renderSelection={(d) => (
          <div style={{ display: "grid", gap: "calc(var(--sf-unit) / 4)" }}>
            <strong>{d.category}</strong>
            <span style={{ fontFamily: "var(--sf-font-mono)" }}>
              {d.series}: {d.value}
            </span>
            <a href="#top" style={{ fontSize: "var(--sf-font-size-sm)" }}>
              Open {d.category} →
            </a>
          </div>
        )}
      />
    </div>
  );
};

// Narrow-container stress: long category names in 320px. The measured fitting
// ladder ellipsizes (full text in the title attr) and, when bands get too
// narrow, thins to a stride keeping first + last; the y column is sized to
// the widest measured label. Deterministic data — this is a VRT surface.
export const Narrow: Story = () => (
  <div style={{ width: 320 }}>
    <BarChart
      categories={[
        "Northern Territories",
        "Eastern Seaboard",
        "Central Plains",
        "Mountain West",
        "Pacific Rim",
        "Gulf Coast",
      ]}
      series={[
        { name: "Volume", values: [1_234_567, 890_123, 456_789, 234_567, 1_876_543, 654_321] },
      ]}
      yLabel="Volume"
      showLegend={false}
      scaffolding="full"
    />
  </div>
);
