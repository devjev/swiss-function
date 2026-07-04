import type { Story } from "@ladle/react";
import { type Candle, CandlestickChart } from "./CandlestickChart";

export default { title: "Perf/CandlestickChart" };

// Deterministic 1000-candle OHLC walk (~4k SVG elements) for the perf probes
// (scripts/perf/scenarios/charts.mjs): the metrics are hover-move input→paint
// and frame p95 during a pointer sweep — each candle crossing must bail out at
// the memo'd candle layer instead of re-reconciling every candle group.
// Doubles as a manual stress story. Never use Math.random here — data must be
// reproducible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCandles(n: number): Candle[] {
  const rand = mulberry32(11);
  let price = 100;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = Math.max(5, open + (rand() - 0.47) * 7);
    const high = Math.max(open, close) + rand() * 3.5;
    const low = Math.min(open, close) - rand() * 3.5;
    price = close;
    out.push({ x: i, open, high, low, close });
  }
  return out;
}

const CANDLES = makeCandles(1000);

/** 1000 candles — the perf-probe target. */
export const PerfCandles: Story = () => (
  <div style={{ width: 960 }} data-perf-ready="">
    <CandlestickChart candles={CANDLES} yLabel="Price" xLabel="Session" height={480} />
  </div>
);
