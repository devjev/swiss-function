import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { Stat } from "../Stat";
import { BulletChart, type BulletChartProps, type BulletItem } from "./BulletChart";

export default { title: "Chart/BulletChart" };

const panel = (width = "min(36rem, 100%)"): React.CSSProperties => ({ width });

const KPIS: BulletItem[] = [
  {
    label: "Revenue",
    sublabel: "CHF k",
    value: 1284,
    target: 1400,
    ranges: [900, 1200, 1600],
    comparative: [1190],
  },
  {
    label: "Gross margin",
    sublabel: "%",
    value: 42.5,
    target: 45,
    ranges: [30, 40, 55],
    domain: [0, 60],
    comparative: [41.2],
  },
  {
    label: "Churn",
    sublabel: "%",
    value: 2.3,
    target: 2,
    ranges: [1.5, 3, 5],
    domain: [0, 6],
    goodDirection: "down",
  },
  { label: "NPS", value: 38, target: 50, ranges: [25, 50, 75], domain: [0, 100] },
  {
    label: "Uptime",
    sublabel: "%",
    value: 99.92,
    target: 99.95,
    ranges: [99.5, 99.9, 99.99],
    domain: [99, 100],
  },
];

const QUOTA: BulletItem[] = [
  { label: "North", value: 92, target: 100, ranges: [50, 100, 120] },
  { label: "South", value: 118, target: 100, ranges: [50, 100, 120] },
  { label: "West", value: 64, target: 100, ranges: [50, 100, 120] },
  { label: "East", value: 101, target: 100, ranges: [50, 100, 120] },
  { label: "Central", value: 137, target: 100, ranges: [50, 100, 120] },
  { label: "Export", value: 48, target: 100, ranges: [50, 100, 120] },
];

export const Playground: Story<BulletChartProps> = (args) => (
  <div style={panel()}>
    <BulletChart {...args} />
  </div>
);
Playground.args = {
  items: KPIS,
  tone: "primary",
  rangeFill: "dither",
  orientation: "horizontal",
  size: "md",
  showValues: true,
  scaffolding: "hover",
  frame: false,
  fullscreen: false,
};
Playground.argTypes = {
  tone: {
    options: ["neutral", "primary", "success", "warning", "danger"],
    control: { type: "radio" },
  },
  rangeFill: { options: ["dither", "shade"], control: { type: "radio" } },
  orientation: { options: ["horizontal", "vertical"], control: { type: "radio" } },
  size: { options: ["sm", "md", "lg"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  showValues: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
  fullscreen: { control: { type: "boolean" } },
};

/** Five KPIs on their own scales: hover a row to read its scale. */
export const Default: Story = () => (
  <div style={panel()}>
    <BulletChart items={KPIS} />
  </div>
);

/** One scale for the panel: an axis below, zoomable, with a quota line. */
export const SharedDomain: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { type: "vline", x: 100, label: "quota" },
  ]);
  return (
    <div style={panel("min(40rem, 100%)")}>
      <BulletChart
        items={QUOTA}
        domain={[0, 150]}
        xLabel="Percent of quota"
        zoomable
        controls
        frame
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        valueFormat={(v) => `${v}%`}
      />
    </div>
  );
};

/** Colour only where it means status: a beaten target in success, a missed
 *  one in danger, the rest in the neutral accent. */
export const Tones: Story = () => (
  <div style={panel()}>
    <BulletChart
      tone="neutral"
      items={[
        {
          label: "Bookings",
          sublabel: "CHF k",
          value: 412,
          target: 380,
          ranges: [250, 350, 450],
          tone: "success",
        },
        {
          label: "Pipeline",
          sublabel: "CHF k",
          value: 1130,
          target: 1200,
          ranges: [800, 1100, 1400],
        },
        {
          label: "Win rate",
          sublabel: "%",
          value: 18,
          target: 25,
          ranges: [15, 22, 30],
          domain: [0, 40],
          tone: "danger",
        },
        {
          label: "Cycle time",
          sublabel: "days",
          value: 31,
          target: 28,
          ranges: [21, 30, 45],
          domain: [0, 50],
          goodDirection: "down",
          tone: "warning",
        },
      ]}
    />
  </div>
);

/** The tiers as dither densities (the house halftone) or grey shades. */
export const RangeFills: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)", ...panel() }}>
    <BulletChart
      items={QUOTA.slice(0, 3)}
      domain={[0, 150]}
      rangeFill="dither"
      scaffolding="full"
    />
    <BulletChart items={QUOTA.slice(0, 3)} domain={[0, 150]} rangeFill="shade" scaffolding="full" />
  </div>
);

export const Vertical: Story = () => (
  <div style={panel("min(32rem, 100%)")}>
    <BulletChart
      items={QUOTA}
      domain={[0, 150]}
      orientation="vertical"
      yLabel="Percent of quota"
      height={260}
      scaffolding="full"
    />
  </div>
);

export const Sizes: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)", ...panel() }}>
    {(["sm", "md", "lg"] as const).map((size) => (
      <BulletChart key={size} items={QUOTA.slice(0, 3)} domain={[0, 150]} size={size} />
    ))}
  </div>
);

/** The KPI cards and their bullets from one data set. */
export const WithStat: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)", ...panel("min(44rem, 100%)") }}>
    <Stat.Group columns={4}>
      <Stat
        size="sm"
        label="Revenue"
        value={1284}
        valueUnit="k"
        delta={7.9}
        caption="CHF, target 1'400"
      />
      <Stat size="sm" label="Gross margin" value={42.5} decimals={1} valueUnit="%" delta={1.3} />
      <Stat
        size="sm"
        label="Churn"
        value={2.3}
        decimals={1}
        valueUnit="%"
        delta={0.3}
        goodDirection="down"
      />
      <Stat size="sm" label="NPS" value={38} delta={-4} />
    </Stat.Group>
    <BulletChart items={KPIS.slice(0, 4)} size="sm" />
  </div>
);

/** Twenty rows at `sm`: a whole scorecard in one panel. */
export const Dense: Story = () => {
  const items: BulletItem[] = Array.from({ length: 20 }, (_, i) => {
    const value = 40 + ((i * 37) % 90);
    return {
      label: `Metric ${String(i + 1).padStart(2, "0")}`,
      value,
      target: 100,
      ranges: [50, 100, 120],
      comparative: [value - 8 + ((i * 13) % 17)],
    };
  });
  return (
    <div style={panel()}>
      <BulletChart items={items} domain={[0, 150]} size="sm" scaffolding="full" frame />
    </div>
  );
};
