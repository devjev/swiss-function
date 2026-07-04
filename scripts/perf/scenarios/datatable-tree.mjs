// DataTable tree mode heap (issue #18): 50k-node collapsed tree. TanStack
// used to materialize a Row (~2.6KB) per hidden node — 157MB at 50k; pruning
// collapsed subtrees keeps hidden nodes off the row model. Heap is read after
// forced GC so the number pins Row materialization, not allocation noise.
import { measureInteraction, readHeapMB } from "../runner.mjs";

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
      metrics.expandMs = await measureInteraction(frame, () => expand.click());
      const collapse = frame.getByRole("button", { name: "Collapse row" }).first();
      metrics.collapseMs = await measureInteraction(frame, () => collapse.click());
      return metrics;
    },
  },
];
