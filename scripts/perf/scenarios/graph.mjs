// Graph: readiness + p95 frame during scripted pan/zoom on the LargeStress
// story (a port of scripts/probe-graph.mjs's continuous phase; the Graph
// component emits [data-graph-surface] / [data-graph-ready] itself).
//
// NOTE: headless Chromium runs WebGL on SwiftShader (software rasterization) —
// verified unescapable on this setup: vulkan / gl-egl / ignore-blocklist flag
// variants all fall back to SwiftShader despite live /dev/dri render nodes. A
// full-scene 10k-node/20k-edge redraw costs ~380-600ms in software GL
// regardless of component code, so absolute frame budgets (16.7ms) do not
// apply here; this scenario tracks RELATIVE regressions only. On a real GPU
// the same renders are single-digit ms.
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
