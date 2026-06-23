import type { Story } from "@ladle/react";
import { type Candle, CandlestickChart, type CandlestickChartProps } from "./CandlestickChart";

export default { title: "Chart/CandlestickChart" };

const MS_DAY = 86_400_000;

// Deterministic OHLC walk so the stories render the same every time.
function makeCandles(n: number, withDates = true): Candle[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const base = new Date("2026-01-01").getTime();
  let price = 100;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = Math.max(5, open + (rand() - 0.47) * 7);
    const high = Math.max(open, close) + rand() * 3.5;
    const low = Math.min(open, close) - rand() * 3.5;
    price = close;
    out.push({ x: withDates ? new Date(base + i * MS_DAY) : i, open, high, low, close });
  }
  return out;
}

export const Playground: Story<CandlestickChartProps> = (args) => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <CandlestickChart {...args} />
  </div>
);
Playground.args = {
  candles: makeCandles(30),
  yLabel: "Price",
  scaffolding: "hover",
};
Playground.argTypes = {
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
};

/**
 * Daily OHLC over a date axis. Up candles (close ≥ open) are success-coloured,
 * down candles danger-coloured. Hover a column for the O/H/L/C tooltip + crosshair.
 */
export const Daily: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <CandlestickChart candles={makeCandles(40)} yLabel="USD" />
  </div>
);

/**
 * `scaffolding="full"` keeps the nice-tick price axis and gridlines visible at
 * all times — useful for dense series.
 */
export const FullScaffolding: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <CandlestickChart candles={makeCandles(40)} yLabel="USD" scaffolding="full" />
  </div>
);

/**
 * `scaffolding="minimal"` — Tufte idle: no axis or gridlines until you hover,
 * where a crosshair traces the close price and date.
 */
export const Minimal: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <CandlestickChart candles={makeCandles(40)} yLabel="USD" scaffolding="minimal" />
  </div>
);

/**
 * A plain numeric x-axis (index/session number) instead of dates.
 */
export const NumericAxis: Story = () => (
  <div style={{ width: "min(48rem, 100%)" }}>
    <CandlestickChart candles={makeCandles(24, false)} yLabel="Price" xLabel="Session" />
  </div>
);
