// Graph: background force-settle cost on the LargeStress story (issue #21).
// [data-graph-ready] = seed positions painted (readyMs, from openStory);
// [data-graph-settled] = the FA2 worker settle finished its iteration budget.
// settledMs pins the whole nav → settled window and maxLongtaskMs pins the
// property the worker settle buys: no multi-second main-thread block between
// ready and settled (the old synchronous forceAtlas2 ran ~1.3-1.4s). Longtasks
// here are dominated by SwiftShader full-scene renders (~200ms with the
// read-only "thinline" edge program, issue #22) — like graph.mjs, this
// scenario tracks RELATIVE regressions only; real GPUs render in single-digit
// milliseconds.
//
// NOTE: not self-registering — scripts/perf/run.mjs lists scenario modules
// centrally; add "graph-settle" there to enable this scenario.

export const scenarios = [
  {
    name: "graph-settle-large",
    story: "graph--large-stress",
    ready: "[data-graph-ready]",
    async run({ frame }) {
      const t0 = Date.now();
      // Buffered observer: catches longtasks from before its creation (the
      // longtask buffer holds up to ~200 entries), so the window effectively
      // spans story attach → settled.
      await frame.evaluate(() => {
        window.__settleLongtasks = [];
        window.__settleObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__settleLongtasks.push(entry.duration);
          }
        });
        window.__settleObserver.observe({ type: "longtask", buffered: true });
      });
      await frame.waitForSelector("[data-graph-settled]", { timeout: 60_000 });
      const settledAfterReadyMs = Date.now() - t0;
      // Drain: give the final settle paint's longtask a beat to be observed.
      await new Promise((resolve) => setTimeout(resolve, 250));
      const longtasks = await frame.evaluate(() => {
        window.__settleObserver.disconnect();
        const ds = window.__settleLongtasks ?? [];
        window.__settleObserver = undefined;
        window.__settleLongtasks = undefined;
        return ds;
      });
      return {
        settledAfterReadyMs,
        maxLongtaskMs: longtasks.length > 0 ? Math.round(Math.max(...longtasks)) : 0,
      };
    },
  },
];
