// Graph: readiness + p95 frame during scripted pan/zoom on the LargeStress
// story (a port of scripts/probe-graph.mjs's continuous phase; the Graph
// component emits [data-graph-surface] / [data-graph-ready] itself).
//
// READINESS SEMANTICS (issue #21): at LargeStress scale the force layout now
// settles in the FA2 worker, so [data-graph-ready] means "seed positions
// painted, graph interactive" — no longer "stable layout painted". readyMs
// therefore dropped by the old ~1.4s synchronous forceAtlas2 block; baselines
// must be re-recorded deliberately. The background settle marks
// [data-graph-settled] when its iteration budget completes (measured by the
// graph-settle scenario) and may still be streaming position frames during
// this scenario's pan/zoom window.
//
// GL: the runner launches the full Chromium build with hardware GL (see
// launchBrowser in ../runner.mjs). Playwright's default headless shell only
// has SwiftShader, where a full-scene 10k-node/20k-edge redraw costs ~190ms
// whatever the component does; on an integrated GPU it is ~2.5ms, so absolute
// frame budgets apply. PERF_GL=software reproduces the old numbers. The
// baseline records the GL renderer, and a mismatch warns.
import { boundsOf, p95, startFrameSampler, stopFrameSampler } from "../runner.mjs";

export const scenarios = [
  {
    name: "graph-panzoom-large",
    story: "graph--large-stress",
    ready: "[data-graph-ready]",
    async run({ page, frame }) {
      const box = (await boundsOf(frame, "[data-graph-surface]")) ?? {
        x: 0,
        y: 0,
        width: 1280,
        height: 900,
      };
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await startFrameSampler(frame);
      const deadline = Date.now() + 3000;
      let angle = 0;
      while (Date.now() < deadline) {
        const dx = Math.cos(angle) * 120;
        const dy = Math.sin(angle) * 80;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
        await page.mouse.up();
        await page.mouse.wheel(0, angle % 2 === 0 ? -240 : 240);
        angle += 0.8;
        await page.waitForTimeout(60);
      }
      const deltas = await stopFrameSampler(frame);
      return { p95FrameMs: p95(deltas) };
    },
  },
];
