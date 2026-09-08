import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { Marimekko, type MarimekkoDatum, type MarimekkoProps } from "./Marimekko";

export default { title: "Chart/Marimekko" };

const REGIONS = [
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East and Africa",
];

/** Revenue by customer segment and region, in millions. Column totals size
 *  the columns; the segments stack to each region's 100%. */
const SEGMENTS = [
  { name: "Enterprise", values: [420, 310, 260, 60, 45] },
  { name: "Mid-market", values: [260, 240, 210, 70, 40] },
  { name: "SMB", values: [180, 170, 240, 90, 55] },
  { name: "Consumer", values: [140, 120, 290, 110, 60] },
];

const SEGMENT_COLORS = [
  "var(--sf-color-primary)",
  "var(--sf-color-success)",
  "var(--sf-color-warning)",
  "var(--sf-color-fg-subtle)",
];

/** Deterministic pseudo-random numbers (mulberry32), so a story renders the
 *  same on every load. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wide: React.CSSProperties = { width: "min(48rem, 100%)" };

export const Playground: Story<MarimekkoProps> = (args) => (
  <div style={wide}>
    <Marimekko {...args} />
  </div>
);
Playground.args = {
  categories: REGIONS,
  series: SEGMENTS,
  normalize: true,
  orientation: "vertical",
  fill: "ramp",
  showValues: true,
  columnLabels: "name",
  scaffolding: "hover",
  gap: 1,
  xLabel: "Region, sized by revenue",
  yLabel: "Share of revenue",
  showLegend: true,
};
Playground.argTypes = {
  orientation: { options: ["vertical", "horizontal"], control: { type: "radio" } },
  fill: { options: ["ramp", "dither"], control: { type: "radio" } },
  showValues: { options: [true, false, "percent", "value", "both"], control: { type: "select" } },
  columnLabels: { options: ["name", "name+share", "none"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  normalize: { control: { type: "boolean" } },
  gap: { control: { type: "range", min: 0, max: 8, step: 1 } },
  showLegend: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <div style={wide}>
    <Marimekko
      categories={REGIONS}
      series={SEGMENTS}
      xLabel="Region, sized by revenue"
      yLabel="Share of revenue"
    />
  </div>
);

/** `normalize={false}`: the stacks keep their units, so the tallest column
 *  is the biggest region, and the value axis can zoom. */
export const Absolute: Story = () => (
  <div style={wide}>
    <Marimekko
      categories={REGIONS}
      series={SEGMENTS}
      normalize={false}
      zoomable
      controls
      scaffolding="full"
      xLabel="Region"
      yLabel="Revenue (M)"
      height={320}
    />
  </div>
);

/** Column widths from a measure other than the totals: the addressable
 *  market per region, with each column's share printed under its name. */
export const ExplicitWidths: Story = () => (
  <div style={wide}>
    <Marimekko
      categories={REGIONS}
      series={SEGMENTS}
      widthBy={[340, 450, 1200, 280, 380]}
      columnLabels="name+share"
      xLabel="Region, sized by addressable market"
      yLabel="Share of revenue"
    />
  </div>
);

export const Horizontal: Story = () => (
  <div style={wide}>
    <Marimekko
      categories={REGIONS}
      series={SEGMENTS}
      orientation="horizontal"
      height={320}
      xLabel="Share of revenue"
      yLabel="Region, sized by revenue"
    />
  </div>
);

export const ValueLabels: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)", ...wide }}>
    {(["percent", "value", "both"] as const).map((mode) => (
      <Marimekko
        key={mode}
        categories={REGIONS}
        series={SEGMENTS}
        showValues={mode}
        xLabel={`showValues="${mode}"`}
        height={220}
        showLegend={false}
      />
    ))}
  </div>
);

/** Sixteen product columns: the category labels ellipsize to their column
 *  with the full text in a title, and the ones that cannot show three
 *  characters drop out while the first and last always survive. */
export const ManyColumns: Story = () => {
  const rand = mulberry32(7);
  const categories = [
    "Alpha",
    "Bravo",
    "Charlie",
    "Delta",
    "Echo",
    "Foxtrot",
    "Golf",
    "Hotel",
    "India",
    "Juliet",
    "Kilo",
    "Lima",
    "Mike",
    "November",
    "Oscar",
    "Papa",
  ];
  const series = ["Subscription", "Services", "Hardware"].map((name) => ({
    name,
    values: categories.map(() => Math.round(20 + rand() * 180)),
  }));
  return (
    <div style={wide}>
      <Marimekko categories={categories} series={series} xLabel="Product, sized by revenue" />
    </div>
  );
};

export const CustomColors: Story = () => (
  <div style={wide}>
    <Marimekko
      categories={REGIONS}
      series={SEGMENTS.map((s, i) => ({ ...s, color: SEGMENT_COLORS[i] }))}
      xLabel="Region, sized by revenue"
    />
  </div>
);

/** `fill="dither"`: the series step through the house halftone at falling
 *  dot densities instead of the ink ramp. */
export const DitherFill: Story = () => (
  <div style={wide}>
    <Marimekko
      categories={REGIONS}
      series={SEGMENTS}
      fill="dither"
      xLabel="Region, sized by revenue"
    />
  </div>
);

/** The framed chart window: a border, the fullscreen toggle, the toolbar and
 *  editable annotations. An `hline` at 0.5 marks the half of every column. */
export const Framed: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { id: "half", type: "hline", y: 0.5, label: "50%" },
  ]);
  return (
    <div style={wide}>
      <Marimekko
        categories={REGIONS}
        series={SEGMENTS}
        frame
        fullscreen
        controls
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        xLabel="Region, sized by revenue"
        yLabel="Share of revenue"
        height={320}
      />
    </div>
  );
};

/** Click a segment to pin it: the popover holds while the pointer moves on,
 *  and the selection is reported for the consumer to act on. */
export const Selection: Story = () => {
  const [selection, setSelection] = useState<MarimekkoDatum | null>(null);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", ...wide }}>
      <Marimekko
        categories={REGIONS}
        series={SEGMENTS}
        selectable
        selection={selection}
        onSelectionChange={setSelection}
        xLabel="Region, sized by revenue"
      />
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        {selection
          ? `${selection.category}, ${selection.series}: ${selection.value} (${Math.round(selection.share * 100)}% of column)`
          : "nothing pinned"}
      </div>
    </div>
  );
};
