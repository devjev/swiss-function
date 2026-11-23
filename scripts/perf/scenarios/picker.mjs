// Picker: open a 1000-item list → painted; filter keystroke; backspace back to
// the full list; arrow nav.
import { ANCHOR, measureInteraction, measureInteractionUntil } from "../runner.mjs";

export const scenarios = [
  {
    name: "picker-1000",
    story: "perf--picker--perf-thousand",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      const input = frame.getByRole("combobox").first();

      // Open → option list painted. Base UI mounts the portal popup after the
      // click's own paint, so plain measureInteraction closes on the click's
      // trivial paint and reads floor-level numbers (issue #16); poll until
      // options exist instead. Under virtualization only the window mounts,
      // so the predicate is "any option painted", not a full count. Base UI
      // opens a combobox on mousedown, in the pointerdown's task.
      metrics.openMs = await measureInteractionUntil(
        frame,
        () => input.click(),
        () => document.querySelectorAll('[role="option"]').length > 0,
        { anchor: ANCHOR.press },
      );
      await page.waitForTimeout(150);

      // Filter keystroke → pruned list painted (same-frame input flush, so
      // measureInteraction is valid while the popup stays open).
      metrics.filterKeyMs = await measureInteraction(frame, () => page.keyboard.type("1"), {
        anchor: ANCHOR.key("1"),
      });
      await page.waitForTimeout(400);

      // Backspace → full 1000-item list restored. The list-growing keystroke
      // is the worst case for a non-virtualized list (issue #15).
      metrics.backspaceMs = await measureInteraction(
        frame,
        () => page.keyboard.press("Backspace"),
        {
          anchor: ANCHOR.key("Backspace"),
        },
      );
      // Let the restored list fully settle — otherwise the arrow measurement
      // races the tail of the repaint and jitters wildly.
      await page.waitForTimeout(400);

      // Arrow navigation → highlight moved.
      metrics.arrowMs = await measureInteraction(frame, () => page.keyboard.press("ArrowDown"), {
        anchor: ANCHOR.key("ArrowDown"),
      });
      return metrics;
    },
  },
];
