import type { Story } from "@ladle/react";
import { useState } from "react";
import { formatNumber } from "../../lib/format";
import { PieChart, type PieChartProps, type PieDatum, type PieSlice } from "./PieChart";

export default { title: "Chart/PieChart" };

const readout: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg)",
  marginBlockStart: "calc(var(--sf-unit) / 2)",
};

// A portfolio's asset mix, in millions. Four parts of one whole: the case a
// pie is actually good at.
const allocation: PieSlice[] = [
  { name: "Equity", value: 482.4 },
  { name: "Fixed income", value: 261.9 },
  { name: "Alternatives", value: 128.3 },
  { name: "Cash", value: 47.1 },
];

// Where a quarter's revenue came from, with a long tail to group.
const revenue: PieSlice[] = [
  { name: "Switzerland", value: 3240 },
  { name: "Germany", value: 2110 },
  { name: "France", value: 1480 },
  { name: "United Kingdom", value: 960 },
  { name: "Italy", value: 540 },
  { name: "Netherlands", value: 390 },
  { name: "Belgium", value: 220 },
  { name: "Austria", value: 180 },
  { name: "Portugal", value: 95 },
  { name: "Denmark", value: 70 },
  { name: "Finland", value: 45 },
];

// Semantic colours, where the colour carries the meaning.
const status: PieSlice[] = [
  { name: "Settled", value: 812, color: "var(--sf-color-success)" },
  { name: "Pending", value: 143, color: "var(--sf-color-warning)" },
  { name: "Failed", value: 28, color: "var(--sf-color-danger)" },
];

const million = (v: number) => `${formatNumber(v, { maximumFractionDigits: 1 })}M`;

export const Default: Story = () => <PieChart data={allocation} height={320} />;

export const Donut: Story = () => <PieChart data={allocation} innerRadius={0.6} height={320} />;

/** The hole reads out the total, then whatever the pointer is on. */
export const DonutWithCentre: Story = () => (
  <PieChart
    data={allocation}
    innerRadius={0.62}
    height={320}
    valueFormat={million}
    center={(focused) => (
      <>
        <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-lg)" }}>
          {million(focused ? focused.value : allocation.reduce((t, d) => t + d.value, 0))}
        </div>
        <div style={{ color: "var(--sf-color-fg-subtle)" }}>{focused ? focused.name : "Total"}</div>
      </>
    )}
  />
);

/** Neutral ink by default; the halftone is the second step of the same ladder. */
export const Fills: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
    <PieChart data={allocation} height={280} />
    <PieChart data={allocation} height={280} fill="dither" />
  </div>
);

/** Colour only where it means something: settled, pending, failed. */
export const SemanticColours: Story = () => (
  <PieChart data={status} height={300} showValues="both" />
);

/** Eleven countries is not a pie. `maxSlices` makes it one, and names what it
 *  grouped. */
export const LongTail: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
    <PieChart data={revenue} height={300} />
    <PieChart data={revenue} height={300} maxSlices={6} otherLabel="Rest of Europe" />
  </div>
);

/** minimal: the pure area read. hover (default): the percent ring fades in.
 *  full: the ring stays. */
export const Postures: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
    <PieChart data={allocation} height={260} scaffolding="minimal" />
    <PieChart data={allocation} height={260} scaffolding="hover" />
    <PieChart data={allocation} height={260} scaffolding="full" />
  </div>
);

/** Units and precision come from `valueFormat`; a category can be retitled
 *  with `categoryFormat`. */
export const Formatting: Story = () => (
  <PieChart
    data={allocation}
    height={320}
    showValues="both"
    valueFormat={(v) => `CHF ${formatNumber(v, { decimals: 1 })}M`}
    categoryFormat={(name, i) => `${i + 1}. ${name}`}
  />
);

/** The compact read: no radial labels, one swatch list underneath. */
export const WithLegend: Story = () => (
  <PieChart data={allocation} height={300} labels="none" legend innerRadius={0.5} />
);

/** The order the data carries, starting where you ask. */
export const StartAngleAndOrder: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
    <PieChart data={allocation} height={260} sort="none" />
    <PieChart data={allocation} height={260} startAngle={-90} />
  </div>
);

export const Selection: Story = () => {
  const [selection, setSelection] = useState<PieDatum | null>(null);
  return (
    <div>
      <PieChart
        data={allocation}
        height={320}
        innerRadius={0.55}
        selectable
        selection={selection}
        onSelectionChange={setSelection}
      />
      <div style={readout}>
        {selection ? `${selection.name}: ${selection.value}` : "nothing pinned"}
      </div>
    </div>
  );
};

/** Drill-down is an event: click a slice and swap the data. */
export const DrillDown: Story = () => {
  const [region, setRegion] = useState<string | null>(null);
  const byRegion: Record<string, PieSlice[]> = {
    Equity: [
      { name: "Europe", value: 210 },
      { name: "North America", value: 180 },
      { name: "Asia", value: 92.4 },
    ],
    "Fixed income": [
      { name: "Government", value: 170 },
      { name: "Corporate", value: 91.9 },
    ],
  };
  const drilled = region ? byRegion[region] : undefined;
  return (
    <div>
      <PieChart
        data={drilled ?? allocation}
        height={320}
        valueFormat={million}
        onPointActivate={(d) => setRegion(drilled ? null : byRegion[d.name] ? d.name : null)}
      />
      <div style={readout}>{region ? `${region} — click a slice to go back` : "click a slice"}</div>
    </div>
  );
};

export const Framed: Story = () => (
  <PieChart data={allocation} height={320} frame fullscreen scaffolding="full" />
);

/** One part is the whole: the full turn is drawn as a circle, not a
 *  degenerate arc. */
export const SinglePart: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
    <PieChart data={[{ name: "Cash", value: 100 }]} height={240} />
    <PieChart data={[{ name: "Cash", value: 100 }]} height={240} innerRadius={0.6} />
  </div>
);

export const Playground: Story<PieChartProps & { innerRadius: number }> = (args) => (
  <PieChart {...args} />
);
Playground.args = {
  data: allocation,
  innerRadius: 0,
  height: 320,
  sort: "value",
  startAngle: 0,
  fill: "ramp",
  labels: "auto",
  showValues: true,
  legend: false,
  scaffolding: "hover",
  frame: false,
  fullscreen: false,
  selectable: false,
};
Playground.argTypes = {
  sort: { options: ["value", "none"], control: { type: "radio" }, defaultValue: "value" },
  fill: { options: ["ramp", "dither"], control: { type: "radio" }, defaultValue: "ramp" },
  labels: { options: ["auto", "none"], control: { type: "radio" }, defaultValue: "auto" },
  showValues: {
    options: [true, false, "percent", "value", "both"],
    control: { type: "select" },
    defaultValue: true,
  },
  scaffolding: {
    options: ["minimal", "hover", "full"],
    control: { type: "radio" },
    defaultValue: "hover",
  },
};
