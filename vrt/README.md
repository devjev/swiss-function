# Visual regression testing (issue #47)

A self-hosted pixel-diff gate over the Ladle stories. Every story in
[`stories.json`](./stories.json) is rendered in **both themes** with **reduced
motion**, screenshotted, and diffed against a committed baseline. Built on
Playwright's `toHaveScreenshot` (its pixel comparator, no hosted service),
which fits the solo / self-hosted setup.

This is a **local gate**, exactly like `perf` and `size`: pixel output is
machine- and font-specific, so baselines are seeded on *your* machine and are
**not committed** (`.gitignore`d). The harness and the story manifest *are*
versioned, so the gate is reproducible; only the reference images are local.

## Layout

| File | Role |
| --- | --- |
| `stories.json` | Committed manifest of every story id the gate covers. Refresh with `npm run vrt:list`. |
| `stories.vrt.ts` | One `toHaveScreenshot` assertion per story, run once per theme project. |
| `freeze.css` | Injected per-shot to halt residual motion (carets, scrollbars) beyond Playwright's animation freeze. |
| `../playwright-vrt.config.ts` | Config: `light` / `dark` projects, reduced motion, diff budget, `webServer` (Ladle). |
| `__screenshots__/` | Baselines (`<story>-<theme>.png`). Git-ignored, seeded locally. |

## Workflow

```bash
just dev            # Ladle on :61000 (the config will also start one if absent)

npm run vrt:update  # seed / refresh baselines (do this on a clean tree)
npm run vrt         # gate: diff current render against the baselines
npm run vrt:list    # refresh stories.json after adding/removing stories
```

`vrt` exits non-zero on any diff beyond the budget (`maxDiffPixels`), writing
`<name>-diff.png` next to the actual under `test-results/` for inspection.

The page's clock is pinned to one date (`page.clock.setFixedTime` in
`stories.vrt.ts`), so a story that reads it (the Timeline "now" line) renders
the same on any day. Timers and animations keep running; only `Date` is fixed.

## Phone projects

`VRT_PHONE=1 npm run vrt` (and `VRT_PHONE=1 npm run vrt:update` to seed them)
adds two projects, `phone-light` and `phone-dark`: every story at 390 x 844
with touch emulation. The page then reports a coarse pointer, so the touch
tokens and the automatic comfortable density apply, as on a real phone. They
are opt-in because they double the run. Their baselines are named
`<story>-phone-<theme>.png`.

Pixels show that a layout changed; they do not say whether it is usable. The
measured half is `npm run mobile` (`scripts/mobile/audit.mjs`): page overflow,
clipped controls, colliding text, hit areas under 24px and text fields under
16px, counted per story against `perf/mobile-baseline.json`.

## Tuning & non-determinism

Some `<canvas>` / WebGL stories don't render the same frame twice: `Graph`
force layouts, the 3D `Surface`, the animated dither effects. A story whose
data keeps arriving for longer than the screenshot timeout never settles
either. Drop them from the gate by story-id prefix when refreshing the
manifest. The committed manifest uses this list, measured on 2026-11-15 by
running the canvas-heavy groups three times in each theme and dropping every
story that failed at least once:

```bash
VRT_EXCLUDE="chart3d--surface--,graph--controlled-selection,graph--dense-content,graph--editable,graph--force,graph--hover-highlight,graph--lab--,graph--large-stress,graph--playground,graph--selected-node,non-ideal-state--effects4,perf--pointcloud--perf-cloud20k,perf--scatterplot--perf-points,progress--animated-effects,streaming-terminal-text--configured" \
  npm run vrt:list
```

Keep the list when you refresh the manifest, or the dropped stories come back.
To measure again, repeat the suspect groups and count the failures:

```bash
npx playwright test -c playwright-vrt.config.ts --repeat-each=3 \
  --grep " (graph|chart3d|non-ideal-state|progress|map|skeleton|spinner|perf)--"
```

The per-pixel `threshold` and total `maxDiffPixels` budget live in
`playwright-vrt.config.ts`. Tighten them to catch smaller regressions; loosen if
a specific machine shows anti-aliasing noise.

## CI

Because baselines are machine-specific, CI would need to either build them as a
cached artifact on a pinned runner image or run against a committed set produced
on that same image. The gate is intentionally left **out of the tag-publish
workflow** (like `perf`/`size`) and run locally before a release.
