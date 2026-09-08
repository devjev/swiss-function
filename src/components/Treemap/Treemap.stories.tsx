import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Treemap, type TreemapDatum, type TreemapProps } from "./Treemap";
import { type TreemapLayout, type TreemapNode, treemapPath } from "./Treemap.math";

export default { title: "Chart/Treemap" };

/** Deterministic PRNG (mulberry32), so every render of a story is identical. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SECTORS: [string, string[]][] = [
  ["Information Technology", ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE"]],
  ["Health Care", ["LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "PFE"]],
  ["Financials", ["BRK.B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS"]],
  ["Consumer Discretionary", ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "BKNG"]],
  ["Communication Services", ["GOOGL", "META", "NFLX", "DIS", "CMCSA", "TMUS", "VZ", "T"]],
  ["Industrials", ["GE", "CAT", "RTX", "UNP", "HON", "BA", "DE", "LMT"]],
  ["Consumer Staples", ["PG", "COST", "WMT", "KO", "PEP", "PM", "MDLZ", "CL"]],
  ["Energy", ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "OXY"]],
  ["Utilities", ["NEE", "SO", "DUK", "CEG", "SRE", "AEP", "D", "PCG"]],
  ["Real Estate", ["PLD", "AMT", "EQIX", "WELL", "SPG", "PSA", "O", "DLR"]],
  ["Materials", ["LIN", "SHW", "APD", "FCX", "ECL", "NEM", "DOW", "NUE"]],
];

/** A market map: sectors of names, sized by market value with a daily change. */
function marketMap(seed = 7, namesPerSector = 8): TreemapNode {
  const rnd = prng(seed);
  return {
    name: "S&P sample",
    children: SECTORS.map(([sector, names], s) => ({
      name: sector,
      children: names.slice(0, namesPerSector).map((ticker, i) => ({
        name: ticker,
        value: Math.round((60 - s * 4) * (1.6 - i * 0.16) * (0.6 + rnd() * 0.8) * 10) / 10,
        change: Math.round((rnd() * 2 - 1) * 4 * 100) / 100,
      })),
    })),
  };
}

const PORTFOLIO: TreemapNode = {
  name: "Portfolio",
  children: [
    {
      name: "Equities",
      children: [
        { name: "AAPL", value: 184_200, change: 1.4 },
        { name: "MSFT", value: 162_900, change: -0.6 },
        { name: "NVDA", value: 121_400, change: 3.1 },
        { name: "ASML", value: 64_100, change: -1.2 },
        { name: "NESN", value: 48_300, change: 0.2 },
      ],
    },
    {
      name: "Fixed income",
      children: [
        { name: "UST 10y", value: 142_000, change: 0.3 },
        { name: "Bund 5y", value: 71_500, change: 0.1 },
        { name: "IG credit", value: 58_200, change: -0.2 },
      ],
    },
    {
      name: "Alternatives",
      children: [
        { name: "Gold", value: 44_900, change: 0.8 },
        { name: "Private credit", value: 38_000, change: 0 },
      ],
    },
    { name: "Cash", value: 52_700, change: 0 },
  ],
};

const SMALL: TreemapNode = {
  name: "Costs",
  children: [
    { name: "Salaries", value: 6 },
    { name: "Cloud", value: 6 },
    { name: "Office", value: 4 },
    { name: "Travel", value: 3 },
    { name: "Tools", value: 2 },
    { name: "Legal", value: 2 },
    { name: "Other", value: 1 },
  ],
};

function flat(n: number, seed = 3): TreemapNode {
  const rnd = prng(seed);
  return {
    name: "Files",
    children: Array.from({ length: n }, (_, i) => ({
      name: `file-${String(i + 1).padStart(2, "0")}.bin`,
      value: Math.round(1 + rnd() ** 2 * 120),
    })),
  };
}

function dense(groups: number, perGroup: number, seed = 11): TreemapNode {
  const rnd = prng(seed);
  return {
    name: "Dense",
    children: Array.from({ length: groups }, (_, g) => ({
      name: `Group ${g + 1}`,
      children: Array.from({ length: perGroup }, (_, i) => ({
        name: `${g + 1}.${i + 1}`,
        value: Math.round(1 + rnd() ** 3 * 200),
        change: Math.round((rnd() * 2 - 1) * 300) / 100,
      })),
    })),
  };
}

const caption: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg)",
  marginBlockEnd: "calc(var(--sf-unit) / 4)",
};

export const Playground: Story<TreemapProps> = (args) => <Treemap {...args} />;
Playground.args = {
  data: PORTFOLIO,
  colorBy: "change",
  layout: "squarify",
  padding: 1,
  groupPadding: 1,
  showValues: true,
  labels: "auto",
  scaffolding: "hover",
  frame: false,
  fullscreen: false,
  selectable: false,
  height: "calc(var(--sf-unit) * 16)",
};
Playground.argTypes = {
  colorBy: { options: ["none", "group", "change"], control: { type: "radio" } },
  layout: { options: ["squarify", "slice", "dice", "sliceDice"], control: { type: "radio" } },
  labels: { options: ["auto", "none"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  padding: { control: { type: "range", min: 0, max: 6, step: 1 } },
  groupPadding: { control: { type: "range", min: 0, max: 6, step: 1 } },
  showValues: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
  fullscreen: { control: { type: "boolean" } },
  selectable: { control: { type: "boolean" } },
};

export const Default: Story = () => (
  <Treemap data={PORTFOLIO} showValues aria-label="Portfolio by market value" />
);

export const MarketMap: Story = () => (
  <Treemap
    data={marketMap()}
    colorBy="change"
    height="calc(var(--sf-unit) * 22)"
    aria-label="Market map"
  />
);

export const Groups: Story = () => (
  <Treemap data={marketMap(5, 6)} colorBy="group" height="calc(var(--sf-unit) * 18)" />
);

export const Layouts: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "calc(var(--sf-unit) * 1.5)",
    }}
  >
    {(["squarify", "slice", "dice", "sliceDice"] as TreemapLayout[]).map((layout) => (
      <div key={layout}>
        <div style={caption}>{layout}</div>
        <Treemap data={SMALL} layout={layout} showValues height="calc(var(--sf-unit) * 8)" />
      </div>
    ))}
  </div>
);

export const Depth: Story = () => (
  <div
    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "calc(var(--sf-unit) * 1.5)" }}
  >
    <div>
      <div style={caption}>depth 1: groups as cells</div>
      <Treemap data={PORTFOLIO} depth={1} showValues height="calc(var(--sf-unit) * 10)" />
    </div>
    <div>
      <div style={caption}>all levels</div>
      <Treemap data={PORTFOLIO} showValues height="calc(var(--sf-unit) * 10)" />
    </div>
  </div>
);

/** Drill-down is consumer state: a click on a group makes it the root, and the
 *  breadcrumb (from `treemapPath`) climbs back out. */
export const DrillDown: Story = () => {
  const data = marketMap();
  const [root, setRoot] = useState<string>(data.name);
  const crumbs = treemapPath(data, root);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--sf-unit) / 4)",
          marginBlockEnd: "calc(var(--sf-unit) / 2)",
        }}
      >
        {crumbs.map((node, i) => {
          const id = crumbs
            .slice(0, i + 1)
            .map((n) => n.name)
            .join("/");
          const last = i === crumbs.length - 1;
          return (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {i > 0 ? <span style={caption}>/</span> : null}
              {last ? (
                <span style={{ ...caption, marginBlockEnd: 0 }}>{node.name}</span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setRoot(id)}>
                  {node.name}
                </Button>
              )}
            </span>
          );
        })}
      </div>
      <Treemap
        data={data}
        root={root}
        colorBy="change"
        showValues
        height="calc(var(--sf-unit) * 18)"
        onPointActivate={(d: TreemapDatum) => {
          if (d.kind === "group") setRoot(d.id);
        }}
      />
    </div>
  );
};

export const Selectable: Story = () => (
  <Treemap
    data={PORTFOLIO}
    colorBy="change"
    showValues
    selectable
    renderSelection={(d) => (
      <span style={caption}>
        {d.path.join(" / ")}: {d.value.toLocaleString("de-CH")}
      </span>
    )}
  />
);

export const Flat: Story = () => <Treemap data={flat(30)} showValues />;

export const Dense: Story = () => (
  <Treemap
    data={dense(10, 50)}
    colorBy="change"
    labels="auto"
    height="calc(var(--sf-unit) * 20)"
    aria-label="500 leaves"
  />
);

export const Framed: Story = () => (
  <Treemap
    data={PORTFOLIO}
    colorBy="group"
    showValues
    frame
    fullscreen
    scaffolding="full"
    height="calc(var(--sf-unit) * 14)"
  />
);

export const Minimal: Story = () => (
  <Treemap data={marketMap(9, 8)} colorBy="change" scaffolding="minimal" labels="none" />
);
