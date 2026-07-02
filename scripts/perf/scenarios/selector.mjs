// Selector: open a 1000-item list → painted; filter keystroke; arrow nav.
import { measureInteraction } from "../runner.mjs";

export const scenarios = [
  {
    name: "selector-1000",
    story: "perf--selector--perf-thousand",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      const input = frame.getByRole("combobox").first();

      // Open → full list painted.
      metrics.openMs = await measureInteraction(frame, () => input.click());
      await page.waitForTimeout(150);

      // Filter keystroke → pruned list painted.
      metrics.filterKeyMs = await measureInteraction(frame, () => page.keyboard.type("1"));
      // Let the filtered list fully settle — otherwise the arrow measurement
      // races the tail of the filter repaint and jitters wildly.
      await page.waitForTimeout(400);

      // Arrow navigation → highlight moved.
      metrics.arrowMs = await measureInteraction(frame, () => page.keyboard.press("ArrowDown"));
      return metrics;
    },
  },
];
