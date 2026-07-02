// Heatmap: readiness IS the metric for a 10k-cell SVG grid; plus
// hover→tooltip/crosshair paint.
import { boundsOf, measureInteraction } from "../runner.mjs";

export const scenarios = [
  {
    name: "heatmap-dense-100",
    story: "perf--heatmap--perf-dense",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const box = await boundsOf(frame, "svg");
      const metrics = {};
      metrics.hoverMs = await measureInteraction(frame, () =>
        page.mouse.move(box.x + box.width / 2, box.y + box.height / 2),
      );
      metrics.hoverMoveMs = await measureInteraction(frame, () =>
        page.mouse.move(box.x + box.width / 3, box.y + box.height / 3),
      );
      return metrics;
    },
  },
];
