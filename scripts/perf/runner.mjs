// Shared machinery for the interaction-latency probes — the generalization of
// scripts/probe-graph.mjs. Scenarios (scripts/perf/scenarios/*.mjs) call into
// this to open a Ladle story headlessly and measure readiness, frame times
// during scripted interaction, input→paint latency, and JS heap.
//
// Conventions:
//   - Ladle must already be running (default http://localhost:61000).
//   - Perf stories mark their settled root with [data-perf-ready]; a missing
//     hook falls back to a settle delay.
//   - Chromium is launched with --enable-precise-memory-info so
//     performance.memory is precise rather than quantized.

import { chromium } from "playwright";

export const VIEWPORT = { width: 1280, height: 900 };
const READY_TIMEOUT_MS = 60_000;
const SETTLE_MS = 600;

export function p95(xs) {
  if (!xs || xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
}

export function median(xs) {
  if (!xs || xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

// Hardware GL by default. Playwright's default headless build (the headless
// shell) only has SwiftShader, and software raster then dominates every canvas
// and WebGL frame: one frame of the 10k-node Graph story costs 186ms there
// and 2.5ms on an integrated GPU, so the probes measured the rasterizer
// instead of the component. The full Chromium build in headless mode reaches
// the GPU through ANGLE's EGL backend. PERF_GL=software keeps the old setup;
// a machine without the full build falls back to it.
const MEMORY_ARGS = ["--enable-precise-memory-info"];
const GPU_ARGS = [
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--disable-gpu-sandbox",
  "--use-angle=gl-egl",
];

export async function launchBrowser() {
  if (process.env.PERF_GL !== "software") {
    try {
      return await chromium.launch({ channel: "chromium", args: [...MEMORY_ARGS, ...GPU_ARGS] });
    } catch (error) {
      process.stderr.write(
        `hardware GL launch failed, using software GL: ${error.message.split("\n")[0]}\n`,
      );
    }
  }
  return chromium.launch({ args: MEMORY_ARGS });
}

/** The WebGL renderer string the browser reports (SwiftShader or a GPU). */
export async function glRenderer(browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return null;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
  } finally {
    await page.close();
  }
}

/** Navigate to a story and wait until it's ready. Returns the Ladle frame the
 *  story renders in plus `readyMs` (navigation → ready hook / settle). */
export async function openStory(
  browser,
  { storyId, baseUrl, readySelector = "[data-perf-ready]" },
) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const navStart = Date.now();
  await page.goto(`${baseUrl}/?story=${encodeURIComponent(storyId)}`, {
    waitUntil: "networkidle",
  });
  const frame =
    page.frame({ name: "ladle-frame" }) ??
    page.frames().find((f) => f.url().includes("/iframe")) ??
    page.mainFrame();
  await frame.waitForLoadState("networkidle").catch(() => {});
  let readyMs;
  try {
    await frame.waitForSelector(readySelector, { timeout: READY_TIMEOUT_MS });
    readyMs = Date.now() - navStart;
  } catch {
    await page.waitForTimeout(SETTLE_MS);
    readyMs = Date.now() - navStart;
  }
  // PERF_THROTTLE=4 slows the CPU fourfold for the interactions (a slow
  // laptop); load and readyMs run at full speed.
  const throttle = Number(process.env.PERF_THROTTLE ?? 1);
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  return { context, page, frame, readyMs };
}

/** Begin sampling rAF frame deltas inside the story frame. */
export function startFrameSampler(frame) {
  return frame.evaluate(() => {
    window.__frameDeltas = [];
    let last = performance.now();
    const tick = (now) => {
      window.__frameDeltas.push(now - last);
      last = now;
      window.__frameRaf = requestAnimationFrame(tick);
    };
    window.__frameRaf = requestAnimationFrame(tick);
  });
}

/** Stop sampling and return the deltas (first warm-up sample dropped). */
export async function stopFrameSampler(frame) {
  const deltas = await frame.evaluate(() => {
    cancelAnimationFrame(window.__frameRaf);
    const ds = window.__frameDeltas ?? [];
    window.__frameDeltas = undefined;
    window.__frameRaf = undefined;
    return ds;
  });
  return deltas.length > 1 ? deltas.slice(1) : deltas;
}

/** Measure input→paint for one discrete interaction: arm a double-rAF paint
 *  timer, run `dispatch()` (Playwright input), read the delta back. Returns
 *  milliseconds, or null if nothing painted within 2s. */
export async function measureInteraction(frame, dispatch) {
  // Load-bearing settle: while headless Chromium's frame clock is "hot" (a
  // recent measurement or animation keeps vsync-aligned BeginFrames coming),
  // both armed rAFs wait for 60Hz ticks and the metric absorbs a full extra
  // vsync (~+16.7ms) regardless of app cost — a chained measurement reads
  // ~30ms for ~3ms of real work. After ~250ms of frame idleness the scheduler
  // issues immediate on-demand BeginFrames and the double-rAF closes right
  // after the interaction's actual paint (~13ms floor). Verified with a no-op
  // dispatch in the hoverMove slot: hot 30.1ms vs cold ~13.5ms (2026-07-04,
  // issues #8/#9 residual investigation).
  await new Promise((resolve) => setTimeout(resolve, 300));
  await frame.evaluate(() => {
    window.__interactionStart = performance.now();
    window.__interactionPaintMs = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__interactionPaintMs = performance.now() - window.__interactionStart;
      });
    });
  });
  await dispatch();
  await frame
    .waitForFunction(() => window.__interactionPaintMs != null, undefined, { timeout: 2000 })
    .catch(() => {});
  const ms = await frame.evaluate(() => window.__interactionPaintMs);
  return ms == null ? null : Math.round(ms * 100) / 100;
}

/** Like `measureInteraction`, but for interactions whose visible result lands
 *  after the input's own paint (popup opens: Base UI mounts the portal content
 *  in a later flush, so the double-rAF closes on the click's trivial paint and
 *  under-reports — issue #16). Polls rAF until the in-page `predicate`
 *  (self-contained source, serialized into the page) holds, then stamps the
 *  next paint. Same load-bearing 300ms cold-clock settle as
 *  `measureInteraction` (see the comment there) and the same 2s
 *  timeout-with-null semantics, so numbers stay comparable. */
export async function measureInteractionUntil(frame, dispatch, predicate) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  await frame.evaluate(`void (window.__interactionPredicate = (${predicate}))`);
  await frame.evaluate(() => {
    window.__interactionStart = performance.now();
    window.__interactionPaintMs = null;
    const poll = () => {
      // In-page deadline mirrors the waitForFunction timeout below, so a
      // never-true predicate can't leave a stale loop stamping a later run.
      if (performance.now() - window.__interactionStart > 2000) return;
      if (window.__interactionPredicate()) {
        requestAnimationFrame(() => {
          window.__interactionPaintMs = performance.now() - window.__interactionStart;
        });
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
  await dispatch();
  await frame
    .waitForFunction(() => window.__interactionPaintMs != null, undefined, { timeout: 2000 })
    .catch(() => {});
  const ms = await frame.evaluate(() => window.__interactionPaintMs);
  return ms == null ? null : Math.round(ms * 100) / 100;
}

export function readHeapMB(frame) {
  return frame.evaluate(() => {
    const mem = performance.memory;
    return mem ? Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 100) / 100 : null;
  });
}

/** Bounding box of the first match, or null. */
export async function boundsOf(frame, selector) {
  const el = await frame.$(selector);
  if (!el) return null;
  return el.boundingBox();
}
