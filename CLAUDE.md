# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read these first

This repo already ships two authoritative guides — defer to them, don't restate them:

- **AGENTS.md** — what to build with the library: component catalogue, "when the user asks for X reach for Y", token/CSS/Field/`cx()` conventions, and anti-patterns. This is the usage contract.
- **AESTHETICS.md** — *why* the library looks the way it does (Swiss/Bauhaus posture, sharp corners, no gray body text, reduced-motion, no "personality").
- **docs/API.md** — per-component prop/element reference for every exported component. Keep it in sync: when a documented prop/default/element/`--sf-*` variable changes (or a component is added), update API.md in the same change.

CLAUDE.md covers only the build/test/architecture wiring that isn't obvious from those.

## Environment

Node/npm are not on `PATH` by default (NixOS). The dev shell is provided via `flake.nix` + direnv (`.envrc`). If `npm` isn't found, the environment hasn't been activated.

## Commands

`just` lists all recipes; each just recipe just wraps the matching npm script.

- `npm run dev` — Ladle story server at http://localhost:61000 (primary way to view components)
- `npm run check` — Biome lint + format check (the lint gate; `npm run format` writes fixes)
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — Vitest, runs **only `*.test.{ts,tsx}`**
- `npm run test:ct` — Playwright Component Testing, runs **only `*.spec.tsx`** (needs `npx playwright install --with-deps chromium` once)
- `npm run build` — full library build (see below)

Run a single test: `npx vitest run path/to/File.test.tsx` (or `-t "name"` to filter). Single CT spec: `npx playwright test -c playwright-ct.config.ts path/to/File.spec.tsx`.

Pre-publish gate (`npm run prepublishOnly`): check → typecheck → build.

### The test-file split is load-bearing

`*.test.tsx` → Vitest. `*.spec.tsx` → Playwright CT. The two runners are configured to match disjoint globs (`vitest.config.ts` vs `playwright-ct.config.ts`); naming a file the wrong way means its runner silently ignores it. `*.bench.ts` is a third disjoint glob — micro-benchmarks, run only by `npm run bench`.

### Performance tests (three layers, all local-only)

- `npm run bench` — vitest micro-benchmarks of pure logic (`*.bench.ts`, colocated; shared options + seeded PRNG in `perf/benchOptions.ts` — bench data must never use `Math.random`).
- `npm run perf` — interaction-latency probes: `scripts/perf/run.mjs` drives `Perf/*` Ladle stories (`*.perf.stories.tsx`, deterministic data, root marks `[data-perf-ready]`) headlessly via `scripts/perf/runner.mjs` and reports medians (readyMs, p95 frame during scripted interaction, input→paint, heap). **Ladle must already be running on :61000.** Compares against `perf/baseline.json` (±20% + 5ms floor) when present; `npm run perf:update` rewrites it. Timings are machine-specific — update baselines only deliberately, on the baseline machine.
- `npm run size` — per-entry bundle cost: walks each `package.json` exports entry through the dist ESM import graph (gzip bytes; wrongly-bundled deps count against the entry). Compares against `perf/size-baseline.json`, fails on > max(5%, 2KB) growth; `npm run size:update` rewrites. Needs a fresh `npm run build`.

## Architecture

A headless React component library: Base UI primitives wrapped with CSS Modules + `--sf-*` CSS custom-property tokens. No Tailwind, no CSS-in-JS, no `clsx` (use `src/lib/cx.ts`). Cascade layer `@layer sf.tokens` lets consumers override predictably.

### Tokens are the styling contract

Every CSS rule references a `--sf-*` custom property defined in `src/tokens/tokens.css`. If a consumer doesn't import `tokens.css` at app root, components render unstyled. Dark mode is `[data-theme="dark"]` on any ancestor swapping token values — never branch on theme in JS. `src/tokens/tokens.css` is the canonical list of available variables.

### The build chain (the genuinely non-obvious part)

`npm run build` is three steps and the CSS handling is fragile by design:

1. `tsc -p tsconfig.build.json --emitDeclarationOnly` + `vite-plugin-dts` → `.d.ts` files.
2. `vite build` in library mode with `preserveModules: true` — one JS chunk per source module, not a single bundle. Per-component entries are listed explicitly in `vite.config.ts` (`componentNames`). `libInjectCss` injects side-effect CSS imports so consumer bundlers don't tree-shake the styles away (they would otherwise — this was a real bug at v0.2.0).
3. `scripts/postbuild.mjs` rewrites `dist/`: renames `*.module.css` → `*.css` and moves the side-effect CSS import from the `.module.css.js` shim into the component's own `.js`. This prevents consumer bundlers from re-processing already-scoped CSS as fresh CSS Modules. Read the header comment in `postbuild.mjs` before touching build output.

Peer/runtime deps (react, `@base-ui/react`, `@dnd-kit/*`, `@tanstack/*`, react-markdown, remark-*) are externalized — never bundled.

### Adding a component requires registration in three places

A new `src/components/<Name>/` (with `<Name>.tsx`, `.module.css`, `index.ts`, stories, optional spec) is invisible until you also:

1. add `export * from "./components/<Name>"` to `src/index.ts`,
2. add `"<Name>"` to the `componentNames` array in `vite.config.ts`,
3. add the per-component entry to the `exports` field in `package.json`.

Miss any one and either the barrel, the build, or the deep import (`@tarassov-ch/swiss-function/<name>`) breaks. The `exports` field is the public contract — consumers must never import from internal `dist/...` paths.

### Component shape

`forwardRef`, accept HTML attributes, spread `...rest` to the root, merge classes with `cx(styles.root, ..., className)`. Compound components (Dialog, Popover, Menu, Tabs, Field, Pane, Graph) expose Base UI's compound API as object namespaces (`Dialog.Root`, `Field.Label`, etc.). Shared internals live in `src/lib/chart/` (scale/tick/axis/tooltip math for the chart components), `src/lib/graph/` (Graph layout/rendering), and `src/lib/effects/` (the animated WebGL "dither" fills shared by NonIdealState/Skeleton/DataTable — the home for reusable visual effects).
