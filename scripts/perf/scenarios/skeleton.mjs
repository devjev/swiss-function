// Skeleton: 24 concurrent dithered fills — the WebGL-context-budget probe.
// The story instruments HTMLCanvasElement.getContext (window.__sfGl), so the
// scenario can assert the pooled engine creates exactly 1 WebGL context with
// 0 evictions (per-fill contexts created 24 and blanked the oldest 8), while
// p95 frame keeps the 24 concurrent draw+blit loops honest.
import { p95, startFrameSampler, stopFrameSampler } from "../runner.mjs";

export const scenarios = [
  {
    name: "skeleton-fills-24",
    story: "perf--skeleton--perf-fills24",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      // Let the lazily-loaded engine arrive and every fill take its first frame.
      await page.waitForTimeout(800);
      await startFrameSampler(frame);
      await page.waitForTimeout(1500);
      const deltas = await stopFrameSampler(frame);
      const gl = await frame.evaluate(() => window.__sfGl ?? { created: -1, lost: -1 });
      return { p95FrameMs: p95(deltas), glCreated: gl.created, glLost: gl.lost };
    },
  },
];
