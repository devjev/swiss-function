import type { Story } from "@ladle/react";
import { useState } from "react";
import { BarChart } from "../BarChart";
import { Histogram } from "../Histogram";
import { Scatterplot } from "../Scatterplot";
import { Multiples, type MultiplesDomain, type MultiplesProps } from "./Multiples";

export default { title: "Chart/Multiples" };

/** Deterministic PRNG (mulberry32): story data must be stable across reloads. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYMBOLS = [
  "NESN",
  "ROG",
  "NOVN",
  "UBSG",
  "ZURN",
  "ABBN",
  "CFR",
  "SIKA",
  "LONN",
  "GIVN",
  "GEBN",
  "SREN",
  "SLHN",
  "HOLN",
  "SCMN",
  "PGHN",
  "ALC",
  "SOON",
  "LOGN",
  "BAER",
];

interface Ticker {
  symbol: string;
  data: { x: Date; y: number }[];
}

/** One year of daily closes per ticker, indexed to 100 at the start. */
function dailyTickers(n: number, seed = 11): Ticker[] {
  const rand = seededRandom(seed);
  const start = new Date(2025, 8, 1);
  return Array.from({ length: n }, (_, i) => {
    let y = 100;
    const drift = (rand() - 0.5) * 0.15;
    const vol = 0.6 + rand() * 1.2;
    const data: { x: Date; y: number }[] = [];
    for (let d = 0; d < 250; d++) {
      const x = new Date(start);
      x.setDate(start.getDate() + Math.floor(d * 1.4));
      y *= 1 + (drift + (rand() - 0.5) * vol) / 100;
      data.push({ x, y: Math.round(y * 100) / 100 });
    }
    return { symbol: SYMBOLS[i % SYMBOLS.length] ?? `T${i}`, data };
  });
}

const twelve = dailyTickers(12);

function TickerPanels({
  items,
  zoomable = true,
  ...rest
}: Partial<MultiplesProps<Ticker>> & { items: Ticker[]; zoomable?: boolean }) {
  return (
    <Multiples
      items={items}
      titleKey="symbol"
      render={(t, shared) => (
        <Scatterplot
          series={[{ name: t.symbol, data: t.data, showLine: true, showPoints: false }]}
          height={shared.height}
          scaffolding={shared.scaffolding}
          zoomable={zoomable}
          xDomain={shared.xDomain}
          onXDomainChange={shared.onXDomainChange}
          yDomain={shared.yDomain}
        />
      )}
      {...rest}
    />
  );
}

export const Playground: Story<
  Pick<
    MultiplesProps<Ticker>,
    | "columns"
    | "link"
    | "axes"
    | "dividers"
    | "scaffolding"
    | "frame"
    | "fullscreen"
    | "panelHeight"
    | "gap"
  > & { count: number }
> = ({ count, ...args }) => <TickerPanels items={dailyTickers(count)} {...args} />;
Playground.args = {
  count: 8,
  columns: "auto",
  link: "x",
  axes: "each",
  dividers: false,
  scaffolding: "hover",
  frame: false,
  fullscreen: false,
  panelHeight: 144,
  gap: 1,
};
Playground.argTypes = {
  columns: { options: ["auto", 1, 2, 3, 4, 6], control: { type: "select" } },
  link: { options: ["x", "y", "both", "none"], control: { type: "radio" } },
  axes: { options: ["each", "outer"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  dividers: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
  fullscreen: { control: { type: "boolean" } },
  panelHeight: { control: { type: "range", min: 96, max: 320, step: 8 } },
  gap: { control: { type: "range", min: 0, max: 3, step: 0.5 } },
  count: { control: { type: "range", min: 1, max: 20, step: 1 } },
};

/** Twelve tickers on one shared time axis: wheel or drag in any panel and
 *  every panel follows; double-click resets them all. */
export const Default: Story = () => {
  const [domain, setDomain] = useState<MultiplesDomain | null>(null);
  return (
    <div style={{ display: "grid", gap: "calc(var(--sf-unit) / 2)" }}>
      <TickerPanels items={twelve} onXDomainChange={setDomain} />
      <div
        style={{
          fontFamily: "var(--sf-font-mono)",
          fontSize: "var(--sf-font-size-sm)",
          color: "var(--sf-color-fg)",
        }}
      >
        shared window:{" "}
        {domain
          ? `${(domain[0] as Date).toISOString().slice(0, 10)} to ${(domain[1] as Date).toISOString().slice(0, 10)}`
          : "full"}
      </div>
    </div>
  );
};

/** The axes drawn once: a time axis under each column, an indexed-price axis
 *  left of each row, the panels bare. Both domains are given, which is what an
 *  outer axis needs. */
export const OuterAxes: Story = () => (
  <TickerPanels
    items={twelve.slice(0, 8)}
    axes="outer"
    link="both"
    columns={4}
    xDomain={[new Date(2025, 8, 1), new Date(2026, 7, 20)]}
    yDomain={[70, 140]}
    xLabel="2025 to 2026"
    yLabel="indexed to 100"
    scaffolding="full"
  />
);

const REGIONS = ["Europe", "Americas", "Asia", "Middle East", "Africa", "Oceania"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const regionRevenue = (() => {
  const rand = seededRandom(3);
  return REGIONS.map((region) => ({
    region,
    values: QUARTERS.map(() => Math.round(20 + rand() * 60)),
  }));
})();

/** A BarChart per region on a shared value axis (`link="y"`): the same
 *  0 to 100 scale in every panel, so bar heights compare across panels. */
export const BarPanels: Story = () => (
  <Multiples
    items={regionRevenue}
    titleKey="region"
    link="y"
    yDomain={[0, 100]}
    columns={3}
    render={(r, shared) => (
      <BarChart
        categories={QUARTERS}
        series={[{ name: r.region, values: r.values }]}
        height={shared.height}
        scaffolding={shared.scaffolding}
        yDomain={shared.yDomain}
        onValueDomainChange={shared.onValueDomainChange}
      />
    )}
  />
);

/** Daily returns in percent: a mix of two normals (Box-Muller). */
function returns(n: number, seed: number, sd: number): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rand() || 1e-12;
    const v = rand();
    const stressed = rand() < 0.15;
    out.push((stressed ? sd * 3 : sd) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
}
const portfolios = [
  { name: "Conservative", data: returns(600, 1, 0.4) },
  { name: "Balanced", data: returns(600, 2, 0.8) },
  { name: "Growth", data: returns(600, 3, 1.3) },
  { name: "Aggressive", data: returns(600, 4, 2.0) },
];

/** A Histogram per portfolio on one shared x window: the same bins and the
 *  same range in every panel, zoom linked. */
export const HistogramPanels: Story = () => (
  <Multiples
    items={portfolios}
    titleKey="name"
    columns={4}
    xDomain={[-8, 8]}
    render={(p, shared) => (
      <Histogram
        data={p.data}
        bins={32}
        domain={[-8, 8]}
        height={shared.height}
        scaffolding={shared.scaffolding}
        zoomable
        onXDomainChange={shared.onXDomainChange}
        valueFormat={(v) => `${v.toFixed(1)}%`}
      />
    )}
  />
);

/** Drag the container's corner: the column count follows the width, one
 *  panel of at least twelve units per column, no breakpoints. */
export const AutoColumns: Story = () => (
  <div
    style={{
      resize: "horizontal",
      overflow: "auto",
      inlineSize: "42rem",
      maxInlineSize: "100%",
      padding: "calc(var(--sf-unit) / 2)",
      border: "1px dashed var(--sf-color-border)",
    }}
  >
    <TickerPanels items={twelve.slice(0, 6)} columns="auto" minPanelWidth={12 * 24} />
  </div>
);

/** Framed with a fullscreen toggle: the whole grid maximizes, the panels keep
 *  their height and the grid scrolls. Hairline dividers in the gaps. */
export const Framed: Story = () => (
  <TickerPanels items={twelve.slice(0, 6)} columns={3} frame fullscreen dividers />
);

/** Forty panels at a glance: outer axes (one time axis per column), bare
 *  panels just tall enough for the chart's own minimum plot, half-unit gaps. */
export const Many: Story = () => (
  <TickerPanels
    items={dailyTickers(40, 5)}
    columns="auto"
    minPanelWidth="calc(var(--sf-unit) * 8)"
    panelHeight={112}
    gap={0.5}
    axes="outer"
    xDomain={[new Date(2025, 8, 1), new Date(2026, 7, 20)]}
    zoomable={false}
  />
);
