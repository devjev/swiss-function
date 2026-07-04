// Chart hover: input→paint for a discrete hover move plus frame p95 during a
// diagonal pointer sweep — pins the memo'd point/candle layers (a hover
// re-render must bail out at one fiber instead of re-reconciling 5k circles /
// 1k candle groups; see issue #14).
import {
  boundsOf,
  measureInteraction,
  p95,
  startFrameSampler,
  stopFrameSampler,
} from "../runner.mjs";

// `hoverTarget` is the element the discrete hover move lands on: a specific
// circle for the scatter (points don't tile the plot), the plot centre for the
// candles (full-height hit rects always catch the pointer).
function hoverRun(hoverTarget) {
  return async ({ page, frame }) => {
    const box = await boundsOf(frame, "svg");
    const metrics = {};

    // Discrete: park off the targets, then move onto one → tooltip + crosshair.
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.85);
    const target = hoverTarget ? await boundsOf(frame, hoverTarget) : null;
    const tx = target ? target.x + target.width / 2 : box.x + box.width / 2;
    const ty = target ? target.y + target.height / 2 : box.y + box.height / 2;
    metrics.hoverMoveMs = await measureInteraction(frame, () => page.mouse.move(tx, ty));

    // Continuous: sweep across the plot for ~3s — every point/candle crossing
    // fires a delegated enter/leave pair.
    await startFrameSampler(frame);
    const deadline = Date.now() + 3000;
    let t = 0;
    while (Date.now() < deadline) {
      const fx = 0.1 + 0.8 * Math.abs(Math.sin(t));
      const fy = 0.1 + 0.8 * Math.abs(Math.cos(t * 0.7));
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 4 });
      t += 0.4;
      await page.waitForTimeout(30);
    }
    const deltas = await stopFrameSampler(frame);
    metrics.p95SweepFrameMs = p95(deltas);
    return metrics;
  };
}

export const scenarios = [
  {
    name: "scatterplot-hover-5k",
    story: "perf--scatterplot--perf-points",
    ready: "[data-perf-ready]",
    run: hoverRun("circle[data-idx='2500']"),
  },
  {
    name: "candlestick-hover-1000",
    story: "perf--candlestickchart--perf-candles",
    ready: "[data-perf-ready]",
    run: hoverRun(null),
  },
];
