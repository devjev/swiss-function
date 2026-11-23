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

/** The event that starts an interaction's clock (issue #103). The clock used
 *  to start before `dispatch()`, so Playwright's own work ahead of the input
 *  fell inside it: a locator click waits two frames for its target to hold
 *  still and then moves the pointer onto it, and the double rAF could close
 *  during that wait. The metric then read the hover, not the interaction: a
 *  29ms DataTable sort read 11ms, a 320ms filter toggle 11ms. Now a
 *  capture-phase listener on the story
 *  window starts the clock when the anchor event arrives, before any handler
 *  of the page runs, and the frames are requested from there.
 *
 *  Anchor on the event the component's handler listens on. A sort runs on
 *  `click`; a combobox opens on `mousedown`, which arrives in the same task as
 *  its `pointerdown`; chart hover runs on `pointerover` (a move within one
 *  element fires only `pointermove`, so `move` takes whichever comes first).
 *  An anchor later than the work reads the floor; one earlier in the gesture
 *  (a `pointerdown` for a `click` handler) can let the frames close before
 *  the work starts. `key` narrows a keydown to one key, so the Shift of
 *  Shift+ArrowRight does not start the clock. */
export const ANCHOR = {
  click: { types: ["click"] },
  press: { types: ["pointerdown"] },
  move: { types: ["pointerover", "pointermove"] },
  wheel: { types: ["wheel"] },
  key: (key) => ({ types: ["keydown"], key }),
};

/** Measure input→paint for one discrete interaction: from the `anchor` event
 *  (see ANCHOR) to the second animation frame after it, while `dispatch()`
 *  (Playwright input) runs. Returns milliseconds, or null if nothing painted
 *  within 2s. */
export function measureInteraction(frame, dispatch, { anchor } = {}) {
  return measureFrom(frame, dispatch, anchor, false);
}

/** Like `measureInteraction`, but for interactions whose visible result lands
 *  after the input's own paint (popup opens: Base UI mounts the portal content
 *  in a later flush, so the double-rAF closes on the input's trivial paint and
 *  under-reports, issue #16). From the anchor event, polls rAF until the
 *  in-page `predicate` (self-contained source, serialized into the page)
 *  holds, then stamps the next paint. Same 2s timeout-with-null semantics, so
 *  numbers stay comparable. */
export async function measureInteractionUntil(frame, dispatch, predicate, { anchor } = {}) {
  await frame.evaluate(`void (window.__interactionPredicate = (${predicate}))`);
  return measureFrom(frame, dispatch, anchor, true);
}

function describeAnchor(anchor) {
  return `${anchor.types.join("/")}${anchor.key == null ? "" : ` ${anchor.key}`}`;
}

async function measureFrom(frame, dispatch, anchor, until) {
  if (!anchor?.types?.length) {
    throw new Error("measureInteraction needs an `anchor`, the event that starts the clock");
  }
  // The settle is required: while headless Chromium's frame clock is "hot" (a
  // recent measurement or animation keeps vsync-aligned BeginFrames coming),
  // both rAFs wait for 60Hz ticks and the metric absorbs a full extra vsync
  // (~+16.7ms) regardless of app cost: a chained measurement reads ~30ms for
  // ~3ms of real work. After ~250ms of frame idleness the scheduler issues
  // immediate on-demand BeginFrames and the double-rAF closes right after the
  // interaction's actual paint (~13ms floor). Verified with a no-op dispatch
  // in the hoverMove slot: hot 30.1ms vs cold ~13.5ms (2026-07-04, issues
  // #8/#9 residual investigation).
  await new Promise((resolve) => setTimeout(resolve, 300));
  await frame.evaluate(
    ({ types, key, until }) => {
      // A token per measurement, so frames still pending from a measurement
      // that timed out cannot stamp this one.
      const id = (window.__interactionId ?? 0) + 1;
      window.__interactionId = id;
      window.__interactionStart = null;
      window.__interactionPaintMs = null;
      const stamp = () => {
        if (window.__interactionId !== id) return;
        window.__interactionPaintMs = performance.now() - window.__interactionStart;
      };
      const start = (event) => {
        if (key != null && event.key !== key) return;
        window.__interactionDisarm();
        window.__interactionStart = performance.now();
        if (!until) {
          requestAnimationFrame(() => requestAnimationFrame(stamp));
          return;
        }
        const poll = () => {
          // In-page deadline mirrors the waitForFunction timeout, so a
          // never-true predicate can't leave a loop running into a later run.
          if (window.__interactionId !== id) return;
          if (performance.now() - window.__interactionStart > 2000) return;
          if (window.__interactionPredicate()) {
            requestAnimationFrame(stamp);
            return;
          }
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      };
      window.__interactionDisarm = () => {
        for (const type of types) window.removeEventListener(type, start, true);
      };
      for (const type of types) {
        window.addEventListener(type, start, { capture: true, passive: true });
      }
    },
    { types: anchor.types, key: anchor.key ?? null, until },
  );
  await dispatch();
  await frame
    .waitForFunction(() => window.__interactionPaintMs != null, undefined, { timeout: 2000 })
    .catch(() => {});
  const { ms, started } = await frame.evaluate(() => {
    window.__interactionDisarm();
    return { ms: window.__interactionPaintMs, started: window.__interactionStart != null };
  });
  if (!started) {
    process.stderr.write(
      `  anchor "${describeAnchor(anchor)}" never arrived; the metric is null\n`,
    );
  }
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
