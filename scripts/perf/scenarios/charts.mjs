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

// Viewport interaction (issue #27): input→paint for one wheel-zoom step, then
// frame p95 during a zoom burst + drag-pan sweep. Every event recomputes the
// x-domain, re-slices + re-decimates the 50k series, and re-renders the plot —
// the decimation budget (~plot-width elements) is what keeps this in frame.
function zoomRun() {
  return async ({ page, frame }) => {
    const box = await boundsOf(frame, "svg");
    const cx = box.x + box.width * 0.6;
    const cy = box.y + box.height * 0.5;
    const metrics = {};

    // Plain wheel is gated behind a click (page-scroll protection) — arm first.
    await page.mouse.click(cx, cy);
    metrics.zoomStepMs = await measureInteraction(frame, () => page.mouse.wheel(0, -240));

    await startFrameSampler(frame);
    const deadline = Date.now() + 2000;
    let i = 0;
    while (Date.now() < deadline) {
      await page.mouse.wheel(0, i % 24 < 12 ? -180 : 180);
      i += 1;
      await page.waitForTimeout(30);
    }
    // Zoom in, then sweep-pan across the window.
    for (let k = 0; k < 8; k++) await page.mouse.wheel(0, -240);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let s = 0; s < 30; s++) {
      await page.mouse.move(cx + Math.sin(s / 3) * box.width * 0.3, cy, { steps: 2 });
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const deltas = await stopFrameSampler(frame);
    metrics.p95ZoomFrameMs = p95(deltas);
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
  {
    name: "scatterplot-zoom-50k",
    story: "perf--scatterplot--perf-zoom",
    ready: "[data-perf-ready]",
    run: zoomRun(),
  },
];
