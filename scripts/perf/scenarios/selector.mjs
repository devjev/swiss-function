// Selector: open a 1000-item list → painted; filter keystroke; arrow nav.
import { ANCHOR, measureInteraction } from "../runner.mjs";

export const scenarios = [
  {
    name: "selector-1000",
    story: "perf--selector--perf-thousand",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      const input = frame.getByRole("combobox").first();

      // Open → full list painted. Valid only while the list stays virtualized:
      // a non-virtualized popup mounts in a later flush than the click's own
      // paint, so the double-rAF would close early and silently read
      // floor-level (issue #16; picker.mjs uses measureInteractionUntil).
      // Base UI opens a combobox on mousedown, in the pointerdown's task.
      metrics.openMs = await measureInteraction(frame, () => input.click(), {
        anchor: ANCHOR.press,
      });
      await page.waitForTimeout(150);

      // Filter keystroke → pruned list painted.
      metrics.filterKeyMs = await measureInteraction(frame, () => page.keyboard.type("1"), {
        anchor: ANCHOR.key("1"),
      });
      // Let the filtered list fully settle — otherwise the arrow measurement
      // races the tail of the filter repaint and jitters wildly.
      await page.waitForTimeout(400);

      // Arrow navigation → highlight moved.
      metrics.arrowMs = await measureInteraction(frame, () => page.keyboard.press("ArrowDown"), {
        anchor: ANCHOR.key("ArrowDown"),
      });
      return metrics;
    },
  },
];
