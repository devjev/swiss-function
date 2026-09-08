import type { Story } from "@ladle/react";
import { useState } from "react";
import { type SlopeDatum, Slopegraph, type SlopegraphProps, type SlopeSeries } from "./Slopegraph";

export default { title: "Chart/Slopegraph" };

/** Government receipts as a share of GDP, two years, after Tufte's VDQI
 *  slopegraph (rounded, deterministic). */
const RECEIPTS: SlopeSeries[] = [
  { name: "Sweden", values: [46.9, 57.4] },
  { name: "Netherlands", values: [44.0, 55.8] },
  { name: "Norway", values: [43.5, 52.2] },
  { name: "Britain", values: [40.7, 39.0] },
  { name: "France", values: [39.0, 43.4] },
  { name: "Germany", values: [37.5, 42.9] },
  { name: "Belgium", values: [35.2, 43.2] },
  { name: "Canada", values: [35.2, 35.8] },
  { name: "Finland", values: [34.9, 38.5] },
  { name: "Italy", values: [30.4, 35.7] },
  { name: "United States", values: [30.3, 32.5] },
  { name: "Greece", values: [26.8, 30.6] },
  { name: "Switzerland", values: [26.5, 33.2] },
  { name: "Spain", values: [22.5, 27.1] },
  { name: "Japan", values: [20.7, 26.6] },
];

/** A seeded generator so every render draws the same data. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const TEAMS = [
  "Basel",
  "Bern",
  "Geneva",
  "Lausanne",
  "Lugano",
  "Lucerne",
  "St. Gallen",
  "Winterthur",
  "Zug",
  "Zurich",
];
const PERIODS = ["R1", "R2", "R3", "R4", "R5", "R6"];
const STANDINGS: SlopeSeries[] = (() => {
  const rnd = lcg(7);
  return TEAMS.map((name, i) => {
    let points = 10 + i * 3;
    const values: number[] = [];
    for (let p = 0; p < PERIODS.length; p++) {
      points += Math.round(rnd() * 9);
      values.push(points);
    }
    return { name, values };
  });
})();

const MANY: SlopeSeries[] = (() => {
  const rnd = lcg(11);
  return Array.from({ length: 60 }, (_, i) => {
    const a = Math.round(20 + rnd() * 80);
    const b = Math.round(a + (rnd() - 0.45) * 30);
    return { name: `Fund ${String(i + 1).padStart(2, "0")}`, values: [a, b] };
  });
})();

const wide: React.CSSProperties = { width: "min(40rem, 100%)" };

export const Playground: Story<SlopegraphProps> = (args) => (
  <div style={wide}>
    <Slopegraph {...args} />
  </div>
);
Playground.args = {
  columns: ["1970", "1979"],
  series: RECEIPTS,
  y: "value",
  labels: "both",
  showValues: true,
  tone: "none",
  scaffolding: "hover",
  height: 420,
  frame: false,
  fullscreen: false,
  selectable: false,
};
Playground.argTypes = {
  y: { options: ["value", "rank"], control: { type: "radio" } },
  labels: { options: ["both", "start", "end", "none"], control: { type: "radio" } },
  tone: { options: ["none", "direction"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  showValues: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
  fullscreen: { control: { type: "boolean" } },
  selectable: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <div style={wide}>
    <Slopegraph
      columns={["1970", "1979"]}
      series={RECEIPTS}
      height={520}
      xLabel="Current receipts of government as a percentage of GDP"
      valueFormat={(v) => v.toFixed(1)}
    />
  </div>
);

export const DirectionTones: Story = () => (
  <div style={wide}>
    <Slopegraph
      columns={["1970", "1979"]}
      series={RECEIPTS}
      tone="direction"
      height={420}
      valueFormat={(v) => v.toFixed(1)}
    />
  </div>
);

export const Highlight: Story = () => (
  <div style={wide}>
    <Slopegraph
      columns={["1970", "1979"]}
      series={RECEIPTS}
      highlight={["Switzerland", "Sweden"]}
      height={420}
      valueFormat={(v) => v.toFixed(1)}
    />
  </div>
);

export const Rank: Story = () => (
  <div style={wide}>
    <Slopegraph
      columns={PERIODS}
      series={STANDINGS}
      y="rank"
      highlight={["Zurich", "Basel"]}
      height={360}
      xLabel="League table by round, rank 1 at the top"
    />
  </div>
);

export const ManyEntities: Story = () => (
  <div style={wide}>
    <Slopegraph
      columns={["2024", "2025"]}
      series={MANY}
      highlight={["Fund 07", "Fund 42"]}
      height={420}
      xLabel="Sixty funds in the room of fifteen: names thin, lines stay"
    />
  </div>
);

export const EndLabels: Story = () => (
  <div style={wide}>
    <Slopegraph
      columns={["Plan", "Actual"]}
      series={RECEIPTS.slice(0, 8)}
      labels="end"
      tone="direction"
      height={320}
      valueFormat={(v) => v.toFixed(1)}
    />
  </div>
);

export const Narrow: Story = () => (
  <div style={{ width: "16rem" }}>
    <Slopegraph
      columns={["Q3", "Q4"]}
      series={RECEIPTS.slice(0, 6)}
      height={220}
      frame
      valueFormat={(v) => v.toFixed(0)}
    />
  </div>
);

export const Selectable: Story = () => {
  const [selection, setSelection] = useState<SlopeDatum | null>(null);
  return (
    <div style={wide}>
      <Slopegraph
        columns={PERIODS}
        series={STANDINGS}
        height={360}
        scaffolding="full"
        frame
        fullscreen
        selectable
        selection={selection}
        onSelectionChange={setSelection}
        renderSelection={(d) => (
          <div style={{ fontFamily: "var(--sf-font-mono)" }}>
            {d.name} at {d.column}: {d.value}
          </div>
        )}
      />
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        pinned: {selection ? `${selection.name} / ${selection.column}` : "none"}
      </div>
    </div>
  );
};
