// WindowArray: p95 frame during a scripted drag-rearrange loop, plus
// keyboard-move and gutter-resize input→paint on a 12-column / ~54-window strip.
import { measureInteraction, p95, startFrameSampler, stopFrameSampler } from "../runner.mjs";

export const scenarios = [
  {
    name: "windowarray-strip-54",
    story: "perf--windowarray--perf-strip",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};

      // Continuous: drag a title bar around the strip for ~3s (drop-slot
      // resolution + indicator churn is the hot path).
      const handle = frame.getByRole("button", { name: "Window 1.1" });
      const hb = await handle.boundingBox();
      await startFrameSampler(frame);
      const deadline = Date.now() + 3000;
      let angle = 0;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      while (Date.now() < deadline) {
        const dx = 200 + Math.cos(angle) * 180;
        const dy = 120 + Math.sin(angle) * 100;
        await page.mouse.move(hb.x + dx, hb.y + dy, { steps: 4 });
        angle += 0.5;
        await page.waitForTimeout(30);
      }
      await page.keyboard.press("Escape"); // cancel the drag — no state change
      await page.mouse.up();
      const deltas = await stopFrameSampler(frame);
      metrics.p95DragFrameMs = p95(deltas);

      // Discrete: Shift+Arrow keyboard move → strip repaint.
      await handle.click();
      metrics.keyboardMoveMs = await measureInteraction(frame, () =>
        page.keyboard.press("Shift+ArrowRight"),
      );

      // Discrete: gutter resize keyboard step → track repaint.
      const gutter = frame.getByRole("separator").first();
      await gutter.focus();
      metrics.resizeStepMs = await measureInteraction(frame, () =>
        page.keyboard.press("ArrowRight"),
      );
      return metrics;
    },
  },
];
