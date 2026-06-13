// Graph benchmark harness — drives a Ladle Graph story headlessly and measures
// both rendering and interaction performance. Models on probe-virtualization.mjs.
//
// Usage:
//   node scripts/probe-graph.mjs <story-id> [base-url]
//
// Example:
//   node scripts/probe-graph.mjs sigma--large
//
// Ladle URL convention: ?story=<file-name>--<export-name>, both lowercased
// (e.g. Sigma.stories.tsx + export Large → "sigma--large").
// Assumes `just dev` is running on http://localhost:61001.
//
// Prints a single JSON line to stdout:
//   {"story","layoutMs","p95FrameMs","heapMB","p95InteractionMs"}
//
// Measures:
//   (a) layoutMs        — navigation → first stable layout paint.
//   (b) p95FrameMs      — p95 frame time during a scripted pan+zoom (~3s).
//   (c) heapMB          — JS heap (performance.memory, when available; else null).
//   (d) p95InteractionMs — p95 input-to-next-paint across the discrete
//                          interactions: node click→selection, hover→tooltip,
//                          right-click→context menu, control toggle→effect,
//                          layout-switch→first transition frame.
//
// The story cooperates via optional DOM hooks (all best-effort — a missing hook
// is skipped, not fatal):
//   [data-graph-surface]      the pan/zoom interaction surface (canvas/svg/root).
//   [data-graph-ready]        set on the surface once the first layout is stable.
//   [data-graph-node]         a node target for click / hover.
//   [data-graph-control]      a control (e.g. zoom-in button) to toggle.
//   [data-graph-layout-next]  a control that triggers a layout switch.
//   [data-graph-selected]     appears/updates when a node is selected.
//   [data-graph-tooltip]      appears when a tooltip is visible.
//   [data-graph-context-menu] appears when the right-click menu is visible.

import { chromium } from "playwright";

const storyId = process.argv[2];
const baseUrl = process.argv[3] ?? "http://localhost:61001";
if (!storyId) {
  process.stderr.write("usage: node scripts/probe-graph.mjs <story-id> [base-url]\n");
  process.exit(1);
}

const VIEWPORT = { width: 1280, height: 900 };
const PANZOOM_MS = 3000;
const LAYOUT_TIMEOUT_MS = 60_000;
const SETTLE_MS = 600;

const p95 = (xs) => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

const navStart = Date.now();
await page.goto(`${baseUrl}/?story=${encodeURIComponent(storyId)}`, { waitUntil: "networkidle" });

// Ladle renders the story inside an iframe — operate on that frame.
const frame =
  page.frame({ name: "ladle-frame" }) ??
  page.frames().find((f) => f.url().includes("/iframe")) ??
  page.mainFrame();
await frame.waitForLoadState("networkidle").catch(() => {});

// (a) Wait for first stable layout paint, signaled by [data-graph-ready];
// fall back to a settle delay if the story doesn't expose the hook.
let layoutMs = null;
try {
  await frame.waitForSelector("[data-graph-ready]", { timeout: LAYOUT_TIMEOUT_MS });
  layoutMs = Date.now() - navStart;
} catch {
  await page.waitForTimeout(SETTLE_MS);
  layoutMs = Date.now() - navStart;
}

const surface = (await frame.$("[data-graph-surface]")) ?? (await frame.$("body"));
const box = (await surface?.boundingBox()) ?? {
  x: 0,
  y: 0,
  width: VIEWPORT.width,
  height: VIEWPORT.height,
};
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

// (b) p95 frame time during a scripted pan+zoom. Sample frame deltas via rAF
// inside the frame while we drive pointer drags and wheel zoom from Playwright.
await frame.evaluate(() => {
  window.__frameDeltas = [];
  let last = performance.now();
  const tick = (now) => {
    window.__frameDeltas.push(now - last);
    last = now;
    window.__frameRaf = requestAnimationFrame(tick);
  };
  window.__frameRaf = requestAnimationFrame(tick);
});

const panZoomDeadline = Date.now() + PANZOOM_MS;
await page.mouse.move(cx, cy);
let toggle = 0;
while (Date.now() < panZoomDeadline) {
  const dx = Math.cos(toggle) * 120;
  const dy = Math.sin(toggle) * 80;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, toggle % 2 === 0 ? -240 : 240);
  toggle += 0.8;
  await page.waitForTimeout(60);
}

const frameDeltas = await frame.evaluate(() => {
  cancelAnimationFrame(window.__frameRaf);
  const ds = window.__frameDeltas ?? [];
  delete window.__frameDeltas;
  delete window.__frameRaf;
  return ds;
});
// Drop the first sample (warm-up artifact) when we have enough data.
const p95FrameMs = p95(frameDeltas.length > 1 ? frameDeltas.slice(1) : frameDeltas);

// (c) JS heap size, when the engine exposes performance.memory.
const heapMB = await frame.evaluate(() => {
  const mem = performance.memory;
  return mem ? Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 100) / 100 : null;
});

// (d) Interaction latency — input-to-next-paint for each discrete interaction.
// We arm a one-shot paint timer in the page, dispatch the input from Playwright,
// then read back the measured delta. Each measurement is independent and any
// interaction whose hook is absent is skipped.
const armPaintTimer = () =>
  frame.evaluate(() => {
    window.__interactionStart = performance.now();
    window.__interactionPaintMs = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__interactionPaintMs = performance.now() - window.__interactionStart;
      });
    });
  });

const readPaintMs = async () => {
  await frame
    .waitForFunction(() => window.__interactionPaintMs != null, undefined, { timeout: 2000 })
    .catch(() => {});
  return frame.evaluate(() => window.__interactionPaintMs);
};

const interactions = [];

// node click → selection
const node = await frame.$("[data-graph-node]");
if (node) {
  const nb = await node.boundingBox();
  if (nb) {
    await armPaintTimer();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    const ms = await readPaintMs();
    if (ms != null) interactions.push(ms);
  }
}

// hover → tooltip visible
if (node) {
  const nb = await node.boundingBox();
  if (nb) {
    await armPaintTimer();
    await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
    const ms = await readPaintMs();
    if (ms != null) interactions.push(ms);
    await page.mouse.move(cx, cy);
  }
}

// right-click → context menu visible
if (node) {
  const nb = await node.boundingBox();
  if (nb) {
    await armPaintTimer();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2, { button: "right" });
    const ms = await readPaintMs();
    if (ms != null) interactions.push(ms);
    await page.keyboard.press("Escape").catch(() => {});
  }
}

// control toggle → effect
const control = await frame.$("[data-graph-control]");
if (control) {
  await armPaintTimer();
  await control.click().catch(() => {});
  const ms = await readPaintMs();
  if (ms != null) interactions.push(ms);
}

// layout-switch trigger → first transition frame
const layoutNext = await frame.$("[data-graph-layout-next]");
if (layoutNext) {
  await armPaintTimer();
  await layoutNext.click().catch(() => {});
  const ms = await readPaintMs();
  if (ms != null) interactions.push(ms);
}

const p95InteractionMs = p95(interactions);

await browser.close();

// Single JSON line on stdout (process.stdout.write avoids the noConsole lint).
process.stdout.write(
  `${JSON.stringify({ story: storyId, layoutMs, p95FrameMs, heapMB, p95InteractionMs })}\n`,
);
