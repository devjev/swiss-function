// Explorer: scroll an ~11k-node tree; toggle a folder; select a row.
import {
  boundsOf,
  measureInteraction,
  p95,
  startFrameSampler,
  stopFrameSampler,
} from "../runner.mjs";

export const scenarios = [
  {
    name: "explorer-tree-11k",
    story: "perf--explorer--perf-tree",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const box = await boundsOf(frame, "[role='treegrid']");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await startFrameSampler(frame);
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        await page.mouse.wheel(0, 480);
        await page.waitForTimeout(40);
      }
      const deltas = await stopFrameSampler(frame);
      const metrics = { p95FrameMs: p95(deltas) };

      // Scroll back to the top so rows are where we expect them.
      await frame.evaluate(() => {
        const viewport = document.querySelector("[role='treegrid']");
        if (viewport) viewport.scrollTop = 0;
      });
      await page.waitForTimeout(120);

      // Folder toggle → subtree collapse repaint (click the first chevron).
      const chevron = await frame.$("[role='treegrid'] svg");
      if (chevron) {
        const cb = await chevron.boundingBox();
        if (cb) {
          metrics.toggleMs = await measureInteraction(frame, () =>
            page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2),
          );
        }
      }
      // Row select → selection repaint.
      metrics.selectMs = await measureInteraction(frame, () => page.mouse.click(cx, box.y + 90));
      return metrics;
    },
  },
];
