# Visual regression testing (issue #47)

A self-hosted pixel-diff gate over the Ladle stories. Every story in
[`stories.json`](./stories.json) is rendered in **both themes** with **reduced
motion**, screenshotted, and diffed against a committed baseline. Built on
Playwright's `toHaveScreenshot` (its pixel comparator, no hosted service) —
fitting the solo / self-hosted setup.

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

## Tuning & non-determinism

`<canvas>` / WebGL surfaces (charts, `Graph`, `Map`, the dithered
`NonIdealState` / `Skeleton` / `FieldLayout.Filler` fills, `Spinner`) don't
render identical frames across machines, so they can exceed the pixel budget.
Drop those groups from the gate by story-id prefix when refreshing the manifest:

```bash
VRT_EXCLUDE="graph--,map--,scatterplot--,heatmap--,surface--,pointcloud--,spinner--,skeleton--,nonidealstate--" \
  npm run vrt:list
```

The per-pixel `threshold` and total `maxDiffPixels` budget live in
`playwright-vrt.config.ts`. Tighten them to catch smaller regressions; loosen if
a specific machine shows anti-aliasing noise.

## CI

Because baselines are machine-specific, CI would need to either build them as a
cached artifact on a pinned runner image or run against a committed set produced
on that same image. The gate is intentionally left **out of the tag-publish
workflow** (like `perf`/`size`) and run locally before a release.
