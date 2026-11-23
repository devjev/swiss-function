// DataTable tree mode heap (issue #18): 50k-node collapsed tree. TanStack
// used to materialize a Row (~2.6KB) per hidden node — 157MB at 50k; pruning
// collapsed subtrees keeps hidden nodes off the row model. Heap is read after
// forced GC so the number pins Row materialization, not allocation noise.
// The filter probe (issue #108) unchecks one of five teams: the walk covers
// all 50k nodes, and the ~500 roots of that team stay as open paths to their
// matching children, so ~8k rows enter the row model.
import { ANCHOR, measureInteraction, readHeapMB } from "../runner.mjs";

export const scenarios = [
  {
    name: "datatable-tree-50k",
    story: "perf--datatable--perf-tree",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      const cdp = await page.context().newCDPSession(page);
      for (let i = 0; i < 5; i++) await cdp.send("HeapProfiler.collectGarbage");
      metrics.treeHeapMB = await readHeapMB(frame);
      // Expand + collapse the first root (visible-tree rebuild latency).
      const expand = frame.getByRole("button", { name: "Expand row" }).first();
      metrics.expandMs = await measureInteraction(frame, () => expand.click(), {
        anchor: ANCHOR.click,
      });
      const collapse = frame.getByRole("button", { name: "Collapse row" }).first();
      metrics.collapseMs = await measureInteraction(frame, () => collapse.click(), {
        anchor: ANCHOR.click,
      });
      await frame.getByRole("button", { name: "Filter Team" }).click();
      const alpha = frame.getByRole("checkbox", { name: "Alpha" });
      metrics.filterMs = await measureInteraction(frame, () => alpha.click(), {
        anchor: ANCHOR.click,
      });
      await page.keyboard.press("Escape");
      for (let i = 0; i < 5; i++) await cdp.send("HeapProfiler.collectGarbage");
      metrics.filteredHeapMB = await readHeapMB(frame);
      return metrics;
    },
  },
];
