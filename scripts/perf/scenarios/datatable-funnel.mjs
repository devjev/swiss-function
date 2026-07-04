// DataTable filter funnel on a high-cardinality column (issue #17): the
// PerfGrid story's Name column has 10k distinct values. Funnel open is
// measured wall-clock-to-populated (option checkboxes present) — a pre-armed
// double-rAF closes on the click's trivial paint and under-reported a 4,965ms
// mount task as 12ms.
import { measureInteraction, measureInteractionUntil } from "../runner.mjs";

export const scenarios = [
  {
    name: "datatable-funnel-10k",
    story: "perf--datatable--perf-grid",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      // Open the 10k-distinct Name funnel → populated checklist painted.
      const trigger = frame.getByRole("button", { name: "Filter Name" });
      metrics.funnelOpenMs = await measureInteractionUntil(
        frame,
        () => trigger.click(),
        "() => document.querySelectorAll('[role=\"checkbox\"]').length > 1",
      );
      // First search keystroke over the full 10k-value set.
      await frame.getByRole("textbox", { name: "Search values" }).click();
      metrics.searchKeyMs = await measureInteraction(frame, () => page.keyboard.type("z"));
      // Toggle one option on the full list (commit + 10k-row refilter).
      await frame.getByRole("textbox", { name: "Search values" }).fill("");
      const box = frame.getByRole("checkbox").nth(1);
      metrics.toggleMs = await measureInteraction(frame, () => box.click());
      return metrics;
    },
  },
];
