import { defineConfig, devices } from "@playwright/test";

// Visual regression gate (issue #47). Self-hosted pixel-diff over the Ladle
// stories: every story in `vrt/stories.json` is rendered in both themes with
// reduced motion, screenshotted, and diffed against a committed baseline.
//
// This is a LOCAL gate, like `perf`/`size`: pixel output is machine- and
// font-specific, so baselines are seeded on the baseline machine with
// `npm run vrt:update` (see vrt/README.md). A disjoint test glob (`*.vrt.ts`)
// keeps it clear of Vitest (`*.test.tsx`) and Playwright CT (`*.spec.tsx`).
//
// Ladle is started (or reused) via `webServer`. Requires it on :61000.

const BASE_URL = process.env.LADLE_URL ?? "http://localhost:61000";

export default defineConfig({
  testDir: "vrt",
  testMatch: "**/*.vrt.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  // Baselines live beside the manifest, one file per story × theme.
  snapshotPathTemplate: "vrt/__screenshots__/{arg}-{projectName}{ext}",
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      // Fast-forward CSS animations/transitions to their end state.
      animations: "disabled",
      caret: "hide",
      // Per-pixel colour sensitivity (0 = exact, 1 = ignore). Playwright's
      // default; enough slack for sub-pixel anti-aliasing on the baseline
      // machine.
      threshold: 0.15,
      // Tight budget so a small-but-real regression (a font-weight bump on a
      // short label, a 1px shift) still trips the gate — while a few stray
      // anti-aliased pixels don't. Canvas-heavy stories that can't hit this on
      // a given machine should be dropped via VRT_EXCLUDE (see list-stories.mjs).
      maxDiffPixels: 60,
      stylePath: "vrt/freeze.css",
    },
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 900, height: 700 },
    trace: "off",
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  // One project per theme; the project name is the `data-theme` value the
  // story is rendered under (see stories.vrt.ts).
  projects: [
    {
      name: "light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],
});
