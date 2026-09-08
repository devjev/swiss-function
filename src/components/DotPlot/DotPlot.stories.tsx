import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { DotPlot, type DotPlotDatum, type DotPlotProps } from "./DotPlot";

export default { title: "Chart/DotPlot" };

const REGIONS = [
  "Switzerland",
  "Germany",
  "France",
  "Italy",
  "Austria",
  "Netherlands",
  "Belgium",
  "Spain",
];
const REVENUE = [412, 388, 271, 196, 154, 133, 97, 88];
const REVENUE_PRIOR = [380, 402, 244, 205, 120, 141, 101, 72];

const wrap: React.CSSProperties = { width: "min(40rem, 100%)" };

export const Playground: Story<DotPlotProps> = (args) => (
  <div style={wrap}>
    <DotPlot {...args} />
  </div>
);
Playground.args = {
  categories: REGIONS,
  series: [{ name: "Revenue", values: REVENUE }],
  yLabel: "Revenue (k CHF)",
  sort: "desc",
  scaffolding: "hover",
  showLegend: false,
  lollipop: false,
};
Playground.argTypes = {
  sort: { options: ["none", "asc", "desc"], control: { type: "radio" } },
  orientation: { options: ["horizontal", "vertical"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  lollipop: { control: { type: "boolean" } },
  showValues: { control: { type: "boolean" } },
  zoomable: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={REGIONS}
      series={[{ name: "Revenue", values: REVENUE }]}
      sort="desc"
      yLabel="Revenue (k CHF)"
    />
  </div>
);

export const TwoSeries: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={REGIONS}
      series={[
        { name: "Prior year", values: REVENUE_PRIOR },
        { name: "This year", values: REVENUE },
      ]}
      sort="This year"
      yLabel="Revenue (k CHF)"
    />
  </div>
);

export const Dumbbell: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={REGIONS}
      series={[
        { name: "Before", values: REVENUE_PRIOR },
        { name: "After", values: REVENUE },
      ]}
      range
      rangeTone="direction"
      sort="After"
      yLabel="Revenue (k CHF)"
    />
  </div>
);

const TICKERS = ["NESN", "NOVN", "ROG", "UBSG", "ZURN", "ABBN", "CFR", "SIKA"];
const LOW = [72.1, 78.4, 212.6, 18.9, 401.2, 30.4, 98.7, 201.1];
const HIGH = [108.3, 101.2, 291.4, 31.2, 511.8, 51.6, 148.2, 279.5];
const NOW = [91.4, 96.3, 240.1, 29.7, 498.6, 44.2, 121.9, 232.4];

export const FiftyTwoWeek: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={TICKERS}
      series={[
        { name: "52w low", values: LOW, color: "var(--sf-color-muted)" },
        { name: "52w high", values: HIGH, color: "var(--sf-color-muted)" },
      ]}
      range
      marker={NOW}
      markerLabel="Last"
      yLabel="Price (CHF)"
      valueFormat={(v) => v.toFixed(1)}
      height={300}
    />
  </div>
);

export const Lollipop: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={["Mon", "Tue", "Wed", "Thu", "Fri"]}
      series={[{ name: "PRs merged", values: [4, 7, 11, 6, 9] }]}
      lollipop
      yLabel="Count"
      height={220}
    />
  </div>
);

export const Sorted: Story = () => {
  const [sort, setSort] = useState<"none" | "asc" | "desc">("desc");
  return (
    <div style={{ ...wrap, display: "grid", gap: "var(--sf-unit)" }}>
      <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)" }}>
        {(["none", "asc", "desc"] as const).map((s) => (
          <label key={s} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="sort" checked={sort === s} onChange={() => setSort(s)} />
            {s}
          </label>
        ))}
      </div>
      <DotPlot
        categories={REGIONS}
        series={[{ name: "Revenue", values: REVENUE_PRIOR }]}
        sort={sort}
        yLabel="Revenue (k CHF)"
      />
    </div>
  );
};

const MANY = Array.from({ length: 40 }, (_, i) => `Cost centre ${String(i + 1).padStart(2, "0")}`);
const MANY_VALUES = MANY.map((_, i) => 100 + ((i * 37) % 61) * 12 + (i % 5) * 7);

export const ManyCategories: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={MANY}
      series={[{ name: "Spend", values: MANY_VALUES }]}
      sort="desc"
      yLabel="Spend (k CHF)"
      height={240}
    />
  </div>
);

export const Compact: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={MANY.slice(0, 16)}
      series={[{ name: "Spend", values: MANY_VALUES.slice(0, 16) }]}
      sort="desc"
      rowHeight={18}
      yLabel="Spend (k CHF)"
    />
  </div>
);

export const Vertical: Story = () => (
  <div style={wrap}>
    <DotPlot
      categories={REGIONS}
      series={[
        { name: "Prior year", values: REVENUE_PRIOR },
        { name: "This year", values: REVENUE },
      ]}
      range
      rangeTone="direction"
      orientation="vertical"
      xLabel="Region"
      yLabel="Revenue (k CHF)"
      height={300}
    />
  </div>
);

export const Zoomable: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { type: "vline", x: 200, label: "target" },
  ]);
  const [last, setLast] = useState<DotPlotDatum | null>(null);
  return (
    <div style={{ ...wrap, display: "grid", gap: "var(--sf-unit)" }}>
      <DotPlot
        categories={REGIONS}
        series={[{ name: "Revenue", values: REVENUE }]}
        sort="desc"
        yLabel="Revenue (k CHF)"
        scaffolding="full"
        frame
        controls
        zoomable
        fullscreen
        selectable
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        onPointActivate={setLast}
        height={320}
      />
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        last activated: {last ? `${last.category} ${last.value}` : "none"}
      </div>
    </div>
  );
};
