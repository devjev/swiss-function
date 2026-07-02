// DataTable: virtualized scroll over 100k rows (existing story) + discrete
// interactions on a 10k-row sortable/filterable grid (perf story).
import {
  boundsOf,
  measureInteraction,
  p95,
  startFrameSampler,
  stopFrameSampler,
} from "../runner.mjs";

export const scenarios = [
  {
    name: "datatable-scroll-100k",
    story: "data-table--virtualized100k",
    ready: "[role='grid']",
    async run({ page, frame }) {
      const box = await boundsOf(frame, "[role='grid']");
      const cx = box.x + box.width / 2;
      const cy = box.y + Math.min(box.height / 2, 200);
      await page.mouse.move(cx, cy);
      await startFrameSampler(frame);
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(40);
      }
      const deltas = await stopFrameSampler(frame);
      return { p95FrameMs: p95(deltas) };
    },
  },
  {
    name: "datatable-interactions-10k",
    story: "perf--datatable--perf-grid",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      // Sortable header click → sorted repaint (10k rows re-ordered).
      const header = frame.locator("[role='columnheader'][data-sortable]").first();
      metrics.sortMs = await measureInteraction(frame, () => header.click());
      // Column resize: one keyboard step on the first resize separator.
      const grip = frame.getByRole("separator").first();
      if ((await grip.count()) > 0) {
        await grip.focus();
        metrics.resizeStepMs = await measureInteraction(frame, () =>
          page.keyboard.press("ArrowRight"),
        );
      }
      return metrics;
    },
  },
];
