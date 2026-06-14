// NonIdealState fill benchmark — drives a story headlessly, sizes the block,
// and measures the animation's rendering cost. Models on probe-graph.mjs.
//
// Usage:
//   node scripts/probe-nonideal.mjs <story-id> [width] [height] [base-url]
//
// Example (M block):
//   node scripts/probe-nonideal.mjs non-ideal-state--loading 520 300
//
// Assumes `just dev` is running on http://localhost:61000 (override via 4th arg
// or LADLE_PORT). Story id is kebab-case <file>--<export>.
//
// Sizes the [data-nis-root] block to width×height, lets it settle, then samples
// requestAnimationFrame deltas + longtask entries for ~4s while the fill
// animates. Prints a single JSON line:
//   {"story","w","h","fps","p95FrameMs","longTasks","frames"}

import { chromium } from "playwright";

const storyId = process.argv[2];
const w = Number(process.argv[3] ?? 520);
const h = Number(process.argv[4] ?? 300);
const port = process.env.LADLE_PORT ?? "61000";
const baseUrl = process.argv[5] ?? `http://localhost:${port}`;
if (!storyId) {
  process.stderr.write("usage: node scripts/probe-nonideal.mjs <story-id> [w] [h] [base-url]\n");
  process.exit(1);
}

const VIEWPORT = { width: Math.max(900, w + 120), height: Math.max(700, h + 120) };
const SETTLE_MS = 400;
const SAMPLE_MS = 4000;

const p95 = (xs) => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();
await page.goto(`${baseUrl}/?story=${encodeURIComponent(storyId)}&mode=preview`, {
  waitUntil: "networkidle",
});

const frame =
  page.frame({ name: "ladle-frame" }) ??
  page.frames().find((f) => f.url().includes("/iframe")) ??
  page.mainFrame();
await frame.waitForLoadState("networkidle").catch(() => {});
await frame.waitForSelector("[data-nis-root]", { timeout: 10_000 });

// Size the block; the component's ResizeObserver regenerates the fill to match.
await frame.evaluate(
  ({ w, h }) => {
    const el = document.querySelector("[data-nis-root]");
    if (el) {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }
  },
  { w, h },
);
await page.waitForTimeout(SETTLE_MS);

await frame.evaluate(() => {
  window.__f = [];
  window.__long = 0;
  try {
    const po = new PerformanceObserver((list) => {
      window.__long += list.getEntries().length;
    });
    po.observe({ entryTypes: ["longtask"] });
    window.__po = po;
  } catch {
    /* longtask not supported — leave count at 0 */
  }
  let last = performance.now();
  const tick = (now) => {
    window.__f.push(now - last);
    last = now;
    window.__raf = requestAnimationFrame(tick);
  };
  window.__raf = requestAnimationFrame(tick);
});

await page.waitForTimeout(SAMPLE_MS);

const res = await frame.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  window.__po?.disconnect();
  const ds = (window.__f ?? []).slice(1); // drop warm-up frame
  const long = window.__long ?? 0;
  delete window.__f;
  delete window.__raf;
  delete window.__po;
  delete window.__long;
  return { ds, long };
});

const elapsed = res.ds.reduce((a, b) => a + b, 0);
const fps = elapsed > 0 ? Math.round((res.ds.length / elapsed) * 1000 * 10) / 10 : null;

await browser.close();

process.stdout.write(
  `${JSON.stringify({
    story: storyId,
    w,
    h,
    fps,
    p95FrameMs: p95(res.ds),
    longTasks: res.long,
    frames: res.ds.length,
  })}\n`,
);
