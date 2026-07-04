// PointCloud: orbit-drag cost at 20k points (issue #23). Gate on heapMB (per-
// drag allocation churn) + the two dragMove input→paint readings — both
// regress unthrottled. p95FrameMs holds vsync unthrottled at 20k (the stalls
// only show under CPU throttle, which the runner doesn't apply), so it's a
// relative-regression signal, not a budget. dragMove readings sit at/near the
// runner's ~13ms double-rAF floor — treat small deltas as noise.
import {
  boundsOf,
  measureInteraction,
  p95,
  readHeapMB,
  startFrameSampler,
  stopFrameSampler,
} from "../runner.mjs";

export const scenarios = [
  {
    name: "pointcloud-orbit-20k",
    story: "perf--pointcloud--perf-cloud20k",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      const box = await boundsOf(frame, "canvas");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      // Discrete: single orbit pointermove → repaint (project + sort + draw).
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      metrics.dragMoveMs = await measureInteraction(frame, () => page.mouse.move(cx + 40, cy + 20));
      metrics.dragMove2Ms = await measureInteraction(frame, () =>
        page.mouse.move(cx - 30, cy - 15),
      );

      // Continuous: ~30 interpolated moves along an ellipse while dragging.
      await startFrameSampler(frame);
      for (let k = 0; k < 30; k++) {
        const a = (k / 30) * Math.PI * 2;
        await page.mouse.move(cx + Math.cos(a) * 140, cy + Math.sin(a) * 90);
        await page.waitForTimeout(16);
      }
      const deltas = await stopFrameSampler(frame);
      metrics.p95FrameMs = p95(deltas);

      await page.mouse.up();
      // Read heap right after the drag, before GC: pins per-move allocation
      // churn (the pre-fix redraw allocated 20k fresh objects per move).
      metrics.heapMB = await readHeapMB(frame);
      return metrics;
    },
  },
];
