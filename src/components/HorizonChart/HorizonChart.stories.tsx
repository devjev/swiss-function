import type { Story } from "@ladle/react";
import { useState } from "react";
import {
  type ChartAnnotation,
  HorizonChart,
  type HorizonChartProps,
  type HorizonSeries,
} from "./HorizonChart";

export default { title: "Chart/HorizonChart" };

/** Deterministic PRNG: story data must be stable across reloads. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A near-normal deviate from a seeded uniform source. */
function gaussian(rand: () => number): number {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += rand();
  return (sum - 3) * 1.41;
}

const START = new Date(2025, 8, 1);

function tradingDay(i: number): Date {
  return new Date(START.getFullYear(), START.getMonth(), START.getDate() + i);
}

const TICKERS = [
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
];

/** Daily percentage changes with a per-ticker volatility and drift. */
function dailyChanges(seed: number, days: number, vol: number, drift = 0): HorizonSeries["data"] {
  const rand = seededRandom(seed);
  return Array.from({ length: days }, (_, i) => ({
    x: tradingDay(i),
    y: Number((drift + vol * gaussian(rand)).toFixed(2)),
  }));
}

/** The running sum of daily changes: the cumulative return since the first
 *  day, in percent, which has shape over weeks where raw changes are noise. */
function cumulative(data: HorizonSeries["data"]): HorizonSeries["data"] {
  let sum = 0;
  return data.map((d) => {
    sum += d.y;
    return { x: d.x, y: Number(sum.toFixed(2)) };
  });
}

/** A price level random walk. */
function priceWalk(seed: number, days: number, start: number, vol: number): HorizonSeries["data"] {
  const rand = seededRandom(seed);
  let level = start;
  return Array.from({ length: days }, (_, i) => {
    level = Math.max(1, level * (1 + (vol * gaussian(rand)) / 100));
    return { x: tradingDay(i), y: Number(level.toFixed(2)) };
  });
}

const changes: HorizonSeries[] = TICKERS.map((name, i) => ({
  name,
  data: cumulative(dailyChanges(100 + i, 260, 0.8 + (i % 4) * 0.4, (i % 3) * 0.03 - 0.03)),
}));

const fourRows = changes.slice(0, 4);

export const Playground: Story<HorizonChartProps> = (args) => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <HorizonChart {...args} />
  </div>
);
Playground.args = {
  series: changes.slice(0, 6),
  bands: 3,
  mode: "mirror",
  sharedScale: true,
  labels: "left",
  showValues: true,
  scaffolding: "hover",
  zoomable: false,
  controls: false,
  frame: false,
};
Playground.argTypes = {
  bands: { control: { type: "range", min: 1, max: 5, step: 1 } },
  mode: { options: ["mirror", "offset"], control: { type: "radio" } },
  labels: { options: ["left", "overlay", "none"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  sharedScale: { control: { type: "boolean" } },
  showValues: { control: { type: "boolean" } },
  zoomable: { control: { type: "boolean" } },
  controls: { control: { type: "boolean" } },
  frame: { control: { type: "boolean" } },
};

/** Twelve tickers, one year of cumulative return since the first day, folded
 *  into three bands. */
export const Default: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <HorizonChart series={changes} showValues valueFormat={(v) => `${v > 0 ? "+" : ""}${v}%`} />
  </div>
);

const bandRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
  gap: "calc(var(--sf-unit) * 1.5)",
};

const caption: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  marginBlockEnd: "calc(var(--sf-unit) / 2)",
};

/** The same four rows at one, two, three and four bands. */
export const Bands: Story = () => (
  <div style={bandRow}>
    {[1, 2, 3, 4].map((bands) => (
      <div key={bands}>
        <div style={caption}>bands = {bands}</div>
        <HorizonChart series={fourRows} bands={bands} />
      </div>
    ))}
  </div>
);

/** Negative values mirrored upward (default) against Saito's offset form. */
export const MirrorVsOffset: Story = () => (
  <div style={bandRow}>
    <div>
      <div style={caption}>mode = mirror</div>
      <HorizonChart series={fourRows} mode="mirror" />
    </div>
    <div>
      <div style={caption}>mode = offset</div>
      <HorizonChart series={fourRows} mode="offset" />
    </div>
  </div>
);

const prices: HorizonSeries[] = TICKERS.slice(0, 6).map((name, i) => ({
  name,
  data: priceWalk(300 + i, 260, 40 + i * 25, 1.2 + (i % 3) * 0.5),
}));

/** Price levels folded around each row's mean: above the mean in the accent,
 *  below in danger. */
export const BaselineMean: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <HorizonChart series={prices} baseline="mean" showValues />
  </div>
);

/** One shared band range (a tall fill means a large move in any row) against
 *  a range per row (every row peaks at full height). */
export const IndependentScales: Story = () => (
  <div style={bandRow}>
    <div>
      <div style={caption}>sharedScale (default)</div>
      <HorizonChart series={changes.slice(0, 5)} />
    </div>
    <div>
      <div style={caption}>sharedScale = false</div>
      <HorizonChart series={changes.slice(0, 5)} sharedScale={false} />
    </div>
  </div>
);

const manyRows: HorizonSeries[] = Array.from({ length: 60 }, (_, i) => ({
  name: `${TICKERS[i % TICKERS.length]}.${String(Math.floor(i / TICKERS.length) + 1)}`,
  data: cumulative(dailyChanges(500 + i, 260, 0.6 + (i % 5) * 0.3)),
}));

/** Sixty rows in a 480px chart: the rows scroll, the axis stays. */
export const ManyRows: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <HorizonChart series={manyRows} height={480} rowHeight={24} showValues />
  </div>
);

/** A chart window: zoom the time axis (wheel after a click, drag to pan,
 *  double-click to reset), the toolbar, annotations and fullscreen. */
export const Zoomable: Story = () => {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([
    { id: "q4", type: "rect", x1: tradingDay(90), y1: 0, x2: tradingDay(120), y2: 12 },
    { id: "cpi", type: "vline", x: tradingDay(45) },
  ]);
  return (
    <div style={{ width: "min(56rem, 100%)" }}>
      <HorizonChart
        series={changes}
        scaffolding="full"
        zoomable
        controls
        fullscreen
        frame
        showValues
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        xLabel="Trading day"
      />
    </div>
  );
};

/** Names printed over the rows and a chart with no names at all. */
export const Labels: Story = () => (
  <div style={bandRow}>
    <div>
      <div style={caption}>labels = overlay</div>
      <HorizonChart series={fourRows} labels="overlay" />
    </div>
    <div>
      <div style={caption}>labels = none</div>
      <HorizonChart series={fourRows} labels="none" />
    </div>
  </div>
);

/** Thirty rows of 5000 points each, decimated to the pixel columns. */
export const Dense: Story = () => {
  const rows: HorizonSeries[] = Array.from({ length: 30 }, (_, i) => {
    const rand = seededRandom(900 + i);
    let level = 0;
    return {
      name: `Sensor ${String(i + 1).padStart(2, "0")}`,
      data: Array.from({ length: 5000 }, (_, t) => {
        level = level * 0.98 + gaussian(rand) * 0.4;
        return { x: t, y: Number(level.toFixed(3)) };
      }),
    };
  });
  return (
    <div style={{ width: "min(56rem, 100%)" }}>
      <HorizonChart series={rows} rowHeight={20} zoomable scaffolding="full" xLabel="Sample" />
    </div>
  );
};
