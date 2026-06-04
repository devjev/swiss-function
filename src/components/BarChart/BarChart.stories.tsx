import type { Story } from "@ladle/react";
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
