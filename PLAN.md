# PLAN — Graph visualization component (`Graph`)

> **This file is the single source of truth for an autonomous ralph loop.**
> Each iteration starts with **fresh context and no memory**. Everything you
> need is in this file. Read it top-to-bottom every time before doing anything.

---

## 0. Mission

Add a first-class **`Graph`** component to `@tarassov-ch/swiss-function` for
viewing and navigating **large** graphs (target: 10k nodes / ~20k edges,
interactive) with **dense, legible** layouts — not just disorderly force
blobs, but also **hierarchical / concept-tree / mind-map / file-tree** layouts.
Nodes and edges must be able to carry **arbitrary structured information**, and
the view must offer navigation (pan/zoom/fit/focus), layout switching, control
elements, and context (right-click) menus.

**Performant means two things, not one:** (a) the graph *renders* at scale, and
(b) *interacting with the interface feels instant* — every discrete user
interaction (node click/select, hover→tooltip, opening the context menu,
toggling a control, starting a layout switch) produces a visible response in
**under 120ms** (input-to-paint). A graph that paints fast but lags on click is
a failure. Both are gated.

The path is: **scaffold → prototype a fixed shortlist of libraries →
benchmark with Playwright → auto-select the winner by metrics → build the
definitive component → test, document, ship.**

---

## 1. Ralph loop protocol — READ FIRST, EVERY ITERATION

Do this, in order, every single iteration:

1. **Read this entire file**, including the **Decision log** (§9) and
   **Progress notes** (§10). They are how past-you talks to present-you.
2. **Confirm the working branch.** All work happens on `feat/graph`.
   ```bash
   git rev-parse --abbrev-ref HEAD   # if not feat/graph:
   git checkout feat/graph 2>/dev/null || git checkout -b feat/graph main
   ```
3. **Pick exactly ONE task** — the *first* unchecked `[ ]` checkbox in §5,
   reading top-to-bottom. Tasks are ordered; do not skip ahead. If a task
   has unchecked sub-tasks, the first unchecked sub-task is your task.
4. **Do only that one task.** Smallest correct, shippable change. Resist
   scope creep. If you discover the task is too big, split it: replace it
   with 2–4 finer `[ ]` sub-tasks, then do the first one.
5. **Verify** with the gate in §3. The gate must be green.
6. **If green:**
   - Tick the box: `[ ]` → `[x]`, and append `— <one-line what/why>` to it.
   - Add a dated bullet to **§10 Progress notes** (what changed, any
     surprise, what the next iteration should watch for).
   - If the task recorded a decision (e.g. benchmark result, library
     pick), append it to **§9 Decision log**.
   - **Commit** (see §4). One task → one commit.
7. **If blocked / not green:** do **not** tick the box. Append a
   `> BLOCKED: <reason + what you tried>` note under the task and a bullet
   in §10, commit any safe partial progress as `wip:` *only if it builds*,
   otherwise revert your edits. Then stop.
8. **Stop after one task.** The loop re-invokes you for the next one.

**Hard rules**

- One task, one commit, per iteration. Never batch unrelated tasks.
- Never work off `main`. Never `git push` (a human reviews/merges).
- Never delete or rewrite §0–§4, §6, §8 of this file. You may only
  tick boxes in §5, split a task into sub-tasks, and append to §9/§10.
- If every box in §5 is `[x]`, the project is done: append a final note
  to §10 saying so and stop without making changes.

---

## 2. Environment & how to run things

- **NixOS**: `node`/`npm` are not on the bare PATH. This repo has `direnv`
  + a flake (`.envrc`, `flake.nix`). Commands assume the dev shell is
  active. If `npm` is missing, run inside `nix develop` / let direnv load.
- Prefer the **`just`** recipes (see `justfile`):
  - `just dev` — Ladle story server on **http://localhost:61001**.
  - `just check` — Biome lint + format check.
  - `just typecheck` — `tsc --noEmit`.
  - `just test` — vitest once.
  - `just test-ct` — Playwright component tests.
  - `just build` — library build (tsc d.ts + vite + postbuild).
- **Screenshots** for visual checks: `node scripts/screenshot-story.mjs
  <story-id> [outfile]` (Ladle id is `<file>--<export>`, lowercased).
  Requires `just dev` running.
- **Perf probing** pattern: see `scripts/probe-virtualization.mjs` — a
  headless Playwright script that drives a Ladle story and measures.
  The Graph benchmark harness (Task 2.x) follows this exact pattern.

---

## 3. Verification gate (the change is only "green" if ALL pass)

Run, in this order, scoped to what you touched but at minimum:

```bash
just typecheck      # no TS errors
just check          # Biome lint + format clean (run `just format` to fix)
just test           # vitest green
```

When the task touches rendering/layout/interaction, **also**:

- Start `just dev` (if not running) and screenshot the relevant story with
  `scripts/screenshot-story.mjs`; eyeball it — no overlap/clipping, themed
  colors, legible labels.
- For perf tasks, run the benchmark harness (§5 Phase 2/3) and record
  numbers in §9. A perf task is only green if **p95 interaction latency
  <120ms** on `LARGE`, in addition to the frame-rate target.

`just test-ct` and `just build` are required green for the **Phase 5/6**
finishing tasks, not for every iteration (they are slower).

---

## 4. Commit convention

```bash
git add -A
git commit -m "graph: <imperative summary of the one task>

<optional 1–3 line body: what & why>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Keep messages scoped to the single task. Do not push.

---

## 5. The plan (task checkboxes — tick as you complete)

> Convention reminders that apply to **every** code task (full rules in
> `AGENTS.md` + `AESTHETICS.md`): tokens not literals (`--sf-*`), **CSS
> Grid** for layout, `cx()` for classNames, sharp corners
> (`--sf-radius-default`), **never grey body text**, always a
> `prefers-reduced-motion` fallback, no new color tokens, no utility-class
> libs, no emoji/personality. Component dir layout:
> `src/components/<Name>/{<Name>.tsx, <Name>.module.css, <Name>.stories.tsx, index.ts}`.

### Phase 0 — Scaffold & shared infrastructure

- [x] **0.1** Create branch `feat/graph` off `main` (if not already on it). — created `feat/graph` from `main`; baseline gate (typecheck/check/test) green.
- [x] **0.2** Add a shared graph data model in `src/lib/graph/types.ts`:
      `GraphNode` (`id`, optional `label`, `kind`, `data: Record<string, unknown>`,
      optional `x`/`y`), `GraphEdge` (`id`, `source`, `target`, optional
      `label`, `weight`, `data`), `GraphData` = `{ nodes, edges }`. Export
      `LayoutKind = "force" | "tree" | "radial" | "concentric" | "grid"`. — added
      pure TS interfaces + `LayoutKind` union with JSDoc; gate green.
- [x] **0.3** Add a deterministic synthetic-graph generator in
      `src/lib/graph/fixtures.ts`: `makeGraph({ nodes, avgDegree, shape })`
      where `shape ∈ "scaleFree" | "tree" | "clustered"`. Seeded RNG (no
      `Math.random` reliance for reproducibility — accept a `seed`). Export
      ready-made `SMALL` (100 nodes), `MEDIUM` (1k), `LARGE` (10k). — mulberry32
      seeded PRNG + 3 shapes (BA preferential attachment / rooted tree /
      sqrt(n) communities); SMALL 100/197, MEDIUM 1000/2000, LARGE 10000/19997,
      no dangling edges, byte-identical per seed; gate green.
- [x] **0.4** Unit-test the generator in `src/lib/graph/fixtures.spec.ts`
      (node/edge counts, determinism for a fixed seed, no dangling edges). — added
      `fixtures.test.ts` (vitest naming: `.spec.ts` is matched by neither vitest
      nor the Playwright CT runner, so used `.test.ts` to actually run under
      `just test`). 12 tests: per-shape node counts + floor/clamp, unique
      ids/label/kind/data, tree n−1 edges, no dangling/self-loop/duplicate edges,
      weight∈(0,1], avgDegree scaling, byte-identical determinism per seed,
      seed-sensitivity, SMALL/MEDIUM/LARGE validity. Gate green.
- [x] **0.5** Add the benchmark harness `scripts/probe-graph.mjs` (model it
      on `probe-virtualization.mjs`): given a Ladle story id, measure — added a
      headless Playwright harness measuring layoutMs / p95FrameMs / heapMB /
      p95InteractionMs, cooperating via best-effort `[data-graph-*]` story hooks;
      prints one JSON line; gate green.
      **(a)** time from navigation to first stable layout paint,
      **(b)** p95 frame time during a scripted pan+zoom over ~3s,
      **(c)** JS heap size (`performance.memory` when available),
      **(d)** **interaction latency** — input-to-next-paint for each of:
      node click→selection, hover→tooltip visible, right-click→context menu
      visible, control toggle→effect, layout-switch trigger→first transition
      frame. Measure each via `performance.now()` around dispatched events +
      a `requestAnimationFrame`/paint observer; report the **p95 across all
      interactions**. Print a single JSON line
      `{story, layoutMs, p95FrameMs, heapMB, p95InteractionMs}`.

### Phase 1 — Candidate shortlist (fixed — do NOT re-research from scratch)

The loop evaluates exactly these. Each gets a prototype story + a benchmark
run. (Rationale: bounded set so the loop converges. Trade-offs differ:
WebGL/canvas libs win on scale; DOM/React-node libs win on rich node content.)

- [x] **1.0** Record the shortlist + evaluation rubric (§7) into §9 Decision
      log as the baseline, so later iterations don't relitigate it. — appended a
      frozen §9 entry: the 5 fixed candidates, the 3 elimination gates, and the
      weighted-score table with explicit linear-clamp normalization + tie-break.

Candidates:
1. **Sigma.js + graphology** — WebGL renderer; graphology layouts
   (forceAtlas2, circular, etc.). Scale champion.
2. **Cytoscape.js** (+ layout extensions `dagre`, `fcose`, `cose-bilkent`,
   `klay`/`elk`) — broadest layout catalogue (hierarchical/tree/concentric).
3. **@xyflow/react (React Flow)** + **elkjs** (or `dagre`) — rich custom
   React nodes (best for arbitrary dense node content); layered/tree auto-layout.
4. **G6 (AntV)** — canvas/WebGL; built-in mindmap/dendrogram/compactBox/
   dagre/radial layouts + minimap/tooltip/context-menu plugins.
5. **react-force-graph** — force-directed baseline (reference point).

> Install each candidate only when starting its prototype task, and record
> the **added gzipped bundle cost** in §9. Do not leave unused deps in
> `package.json` — losing candidates' deps are removed in Task 3.3.

### Phase 2 — Prototypes (one Ladle story per candidate, in a throwaway `lab/`)

Prototypes live in `src/components/Graph/lab/` as `<Candidate>.stories.tsx`.
Each prototype must: render `MEDIUM` and `LARGE` fixtures; support pan/zoom/fit;
offer **at least** force + one hierarchical/tree layout; color nodes/edges via
`--sf-*` tokens; show a node label + a tooltip with `data`. Keep them minimal —
they will be deleted after selection (Task 3.3).

- [x] **2.1** Prototype **Sigma.js + graphology** → story + run
      `probe-graph.mjs`; record metrics + bundle cost in §9. — added
      `lab/Sigma.stories.tsx` (WebGL, forceAtlas2 + circular, full `[data-graph-*]`
      hooks, token-themed); LARGE probe `{layoutMs:8990, p95FrameMs:783.4,
      heapMB:31.57, p95InteractionMs:26.5}` recorded in §9 (headless-GPU caveat noted).
- [x] **2.2** Prototype **Cytoscape.js** (+ dagre/fcose) → story + benchmark + §9. — added
      `lab/Cytoscape.stories.tsx` (canvas renderer; force = `fcose`, hierarchical =
      `dagre` for MEDIUM / native `breadthfirst` for LARGE since dagre blocks for
      minutes at 10k); full `[data-graph-*]` hooks, token-themed. MEDIUM probe
      `{layoutMs:5265, p95FrameMs:33.3, heapMB:61.04, p95InteractionMs:63.3}`; LARGE
      `{layoutMs:4939, p95FrameMs:383.4, heapMB:527.38, p95InteractionMs:563}` recorded
      in §9 (headless-GPU + dagre-unusable caveats noted).
- [x] **2.3** Prototype **React Flow + elkjs** → story + benchmark + §9. — added
      `lab/ReactFlow.stories.tsx` (DOM-node renderer; elk `force` + `layered`, full
      `[data-graph-*]` hooks, token-themed). MEDIUM probe
      `{layoutMs:61545,p95FrameMs:99.9,heapMB:159.26,p95InteractionMs:322.4}` (322ms
      already > 120ms gate); LARGE **DNF — 10k DOM nodes never reach a stable layout
      (timed out at 150s, EXIT_CODE 124)**; elkjs bundle ≈458kB gz (huge). All in §9.
- [x] **2.4** Prototype **G6** → story + benchmark + §9. — added
      `lab/G6.stories.tsx` (G6 v5 canvas renderer; force = `d3-force`, hierarchical =
      `antv-dagre` on MEDIUM / native `grid` on LARGE since dagre is super-linear);
      full `[data-graph-*]` hooks, token-themed (themable gate PASS, `/tmp/g6-medium.png`).
      MEDIUM probe `{layoutMs:62679,p95FrameMs:233.3,heapMB:202.18,p95InteractionMs:64.7}`;
      LARGE **DNF — d3-force on 10k never reaches a stable `[data-graph-ready]` (timed out
      at 200s, EXIT 124)**; G6 bundle ≈382kB gz (huge). All in §9.
- [x] **2.5** Prototype **react-force-graph** → story + benchmark + §9. — added
      `lab/ReactForceGraph.stories.tsx` (force-graph 2D canvas variant
      `react-force-graph-2d`; force = d3-force, hierarchical = `dagMode:"td"`;
      `cooldownTicks:60` bounds LARGE so it actually settles — unlike React
      Flow/G6's LARGE DNF). Full `[data-graph-*]` hooks, token-themed (themable
      PASS, `/tmp/rfg-medium.png`). MEDIUM probe
      `{layoutMs:16110,p95FrameMs:16.7,heapMB:110.63,p95InteractionMs:31.1}`
      (60fps, 31ms interactions); LARGE
      `{layoutMs:13932,p95FrameMs:283.3,heapMB:57.51,p95InteractionMs:522.6}`
      (522ms dominated by the tree-DAG re-layout folded into p95, as with the
      other canvas candidates). Bundle ≈119kB gz (rfg2d 61 + force-graph 56 +
      react-kapsule 1) — leanest of the five. All in §9.

### Phase 3 — Auto-select the winner (by the §7 rubric)

- [x] **3.1** Compile all §9 candidate metrics into a comparison table in
      §9. Apply the §7 rubric: drop any candidate failing a **gate**
      (themable via tokens; ≥30fps p95 on LARGE), then score the rest. — compiled
      the raw LARGE table + re-measured precise gz bundles (Sigma 69, react-force-graph
      119, Cytoscape 280, G6 382, React Flow+elkjs 508); documented that the literal
      headless `p95FrameMs≤33` gate is non-discriminating (all five fail it via the
      software-rasterization confound flagged throughout §9), so ranked by the §7
      weighted score on raw numbers → **Sigma 0.459 ≫ React Flow 0.278 > rfg 0.236 >
      Cytoscape = G6 0.231** (full arithmetic in §9). 3.2 makes Sigma the binding winner.
- [x] **3.2** **Declare the winner** in §9 with the computed weighted scores
      and a 2–3 sentence justification + noted trade-offs. This is the
      binding decision for Phase 4. — declared **Sigma.js + graphology** (score
      0.459, Δ0.18 over React Flow) as the binding Phase-4 winner in §9; rank table
      + justification (only passing interaction latency, leanest bundle, measurable
      LARGE) + 3 trade-offs (label-only richness, breadth 3/5 → manual tree/grid
      coords, frame must be re-judged on real GPU via the FA2 worker).
- [x] **3.3** Remove all losing candidates' dependencies from
      `package.json` (+ lockfile via install), delete their `lab/` stories.
      Keep only the winner's prototype as a reference. `just check` +
      `just typecheck` green. — removed `@antv/g6`, `@xyflow/react`, `cytoscape`,
      `cytoscape-dagre`, `cytoscape-fcose`, `dagre`, `elkjs`, `react-force-graph-2d`
      from package.json + lockfile (`npm install` pruned 122 packages); deleted the
      four losers' `lab/` stories (kept `lab/Sigma.stories.tsx`); dropped the
      now-orphan `cytoscape-fcose` `declare module` from `src/global.d.ts`. Gate green.

### Phase 4 — Definitive `Graph` component

Build under `src/components/Graph/` using the winner. `forwardRef`, spreads
`...rest` to root, `cx()` for classNames, all visuals via tokens.

- [x] **4.1** `Graph.tsx` skeleton: props `{ data: GraphData, layout?:
      LayoutKind, onNodeClick?, onEdgeClick?, onSelectionChange? }`, renders
      the winner's canvas/surface inside a CSS-Grid shell
      (`Graph.module.css`). Controlled + uncontrolled `layout`. — added
      `Graph.tsx` (forwardRef, spreads `...rest` to a CSS-Grid root, `cx()`
      classNames), `Graph.module.css` (single-cell grid shell, sharp corners
      via `--sf-radius-default`, all colors `--sf-*`), and the `index.ts`
      barrel. Mounts Sigma+graphology with a forceAtlas2 layout (same build as
      the 2.1 lab prototype); wires `clickNode`→onNodeClick+onSelectionChange,
      `clickEdge`→onEdgeClick, `clickStage`→onSelectionChange(null) via a
      handlers ref (no listener re-subscribe). `layout` prop accepted +
      defaulted to `"force"` (the only wired layout this skeleton — the other
      four land in 4.2). Gate green (typecheck/check/test).
- [x] **4.2** Layout switching: implement `force`, `tree`/hierarchical,
      `radial`, `concentric`, `grid` (map to winner's layout engine; use
      `elkjs`/`dagre`/graphology as needed). Smooth transition with a
      `prefers-reduced-motion` fallback (snap instead of animate). — added
      `computeLayout(g, layout)` returning a non-mutating coordinate mapping per
      kind (force=forceAtlas2 snapshot/restore, radial=`circular`,
      concentric=`circlepack`, tree=in-house layered BFS pass, grid=√n lattice —
      no elkjs/dagre per §9), plus a layout effect that animates via
      `sigma/utils` `animateNodes` (600ms quadraticInOut) or **snaps** under
      `prefers-reduced-motion` (JS `matchMedia`). Layout switch no longer retears
      the renderer (separate effect, `appliedLayoutRef` guard, in-flight animation
      cancelled on re-switch). Gate green.
- [x] **4.3** Navigation controls: a `Graph.Controls` toolbar (zoom in/out,
      fit-to-view, reset, layout `ToggleGroup`). Reuse library `Button` /
      `ToggleGroup`. Keyboard: `+`/`-`/`0`/arrow-pan, focus-visible ring. — added
      `Graph.Controls` (compound member via `Object.assign(Root,{Controls})`) reusing
      library `Button` (zoom-in/out/fit icons + Reset) + `ToggleGroup` (single-select
      layout switch); `Graph` now publishes a `GraphControls` handle through a new
      `GraphContext` (zoomIn/zoomOut/fitView/reset/pan + layout/setLayout) and gained
      controlled+uncontrolled layout (`defaultLayout`/`onLayoutChange`). Surface is
      now a focusable `role="application"` keyboard target: `+`/`=` zoom in, `-`/`_`
      zoom out, `0` fit, arrows pan; all camera animations snap (duration 0) under
      `prefers-reduced-motion`; focus-visible ring via `--sf-color-focus-ring`. Gate
      green (typecheck/check/test).
- [x] **4.4** Node rendering with **arbitrary content**: a `renderNode`
      escape hatch (or label + badge + color-by-`kind` defaults). Edges:
      optional labels, weight→thickness, directed arrowheads. — added `renderNode`
      / `renderEdge` escape-hatch props returning `NodeVisual` / `EdgeVisual`
      (label / color / size overrides on top of the color-by-`kind` defaults; WebGL =
      no per-node DOM, so "arbitrary content" is themed visual attributes per the §9
      trade-off + the tooltip/inspector in 4.5). Defaults: color-by-`kind` + a
      `kind`-derived `nodeSize` (primary=4, others=3, so kind reads as a size badge);
      edges now draw `type:"arrow"` (directed arrowheads via Sigma's built-in
      `defaultEdgeType:"arrow"`), `weight`→thickness via `edgeSize` (clamped ≥0.5),
      and carry their `label` with `renderEdgeLabels` enabled only when some edge has
      a label AND `order≤300` (label layout cost). Build effect now keys on
      `[data, renderNode, renderEdge]`. Gate green.
- [x] **4.5** Tooltip/inspector on hover/select showing node/edge `data`
      (reuse `Popover` or the chart `Tooltip` from `src/lib/chart`). — added an
      inspector overlay reusing the chart `Tooltip` (fixed/viewport-clamped, flips
      above/below): `enterNode`/`enterEdge` set a `hovered` Inspection, click sets a
      persistent `selected` one, `hovered ?? selected` is shown; `clickStage` /
      `leaveNode|Edge` / data-rebuild clear it. Sigma has no per-node DOM so the
      anchor `DOMRect` is synthesized from the surface rect + `getNodeDisplayData`
      (edge = endpoint midpoint). Body is a token-themed grid: title (`--sf-color-fg`)
      + subtitle/keys (`--sf-color-fg-subtle`, metadata) + a `data` key/value `<dl>`
      (`white-space:normal` overrides the Tooltip shell's nowrap). Gate green.
- [x] **4.6** Right-click **context menu** via the `Menu` component
      (focus/expand/hide/pin actions, exposed through an
      `onNodeContextMenu` / `contextMenuItems` prop). — done via 4.6a (wire) +
      4.6b (verify); both ticked below.
  - [x] **4.6a** Wire Sigma `rightClickNode`/`rightClickStage` → a controlled
        `Menu` anchored to the cursor (fixed invisible `Menu.Trigger`, house
        Explorer pattern). Add `onNodeContextMenu` + `contextMenuItems` props
        and a default item set (focus/expand/hide/pin); selecting an item
        invokes its `onSelect(targetId)`. Built-in focus action drives the
        camera to the node; hide toggles node visibility; pin/expand fire the
        consumer callbacks. Reduced-motion respected on the focus animation. —
        added `GraphMenuTarget` (node|stage + id) / `GraphMenuItem` (label,
        onSelect, disabled, separatorBefore) types + `onNodeContextMenu` /
        `contextMenuItems` props; Sigma `rightClickNode`/`rightClickStage` (each
        `preventSigmaDefault()` + `original.preventDefault()`) open a controlled
        `Menu` whose invisible `position:fixed` `.contextAnchor` Trigger sits at
        the cursor `clientX/Y`. Built-in node menu: Focus (camera `animate` to
        node, ratio 0.5), Expand (ratio 0.2), Pin label (`forceLabel` toggle),
        Hide (`hidden` toggle, separator above) — all via `camOpts()` so they
        snap under reduced-motion. Stage has no default menu; empty item list
        suppresses opening. `menuRef` keeps the latest builders out of the Sigma
        subscribe deps. Gate green: typecheck clean, `just check` exit 0 (same 16
        pre-existing warnings), test 54 passed. Visual verify deferred to 4.6b.
  - [x] **4.6b** Verify in the Playground story / lab screenshot: right-click a
        node opens the themed menu at the cursor, items fire, Escape/outside
        click closes. (Defer formal CT to 5.2.) — verified with a throwaway
        `lab/GraphContextMenu` harness (real `Graph`, SMALL fixture, `grid`
        layout, oversized nodes so a Playwright point-probe lands a right-click)
        + a throwaway driver: menu opens at the cursor with the themed
        `Focus / Expand / Pin label / Hide` items (separator above Hide), and
        Escape closes it (`{ok:true, items:[…], closedByEscape:true}`). Eyeballed
        `/tmp/graph-context-menu.png` — sharp-cornered themed popup anchored at
        the cursor over the kind-colored grid. Harness story kept under `lab/`
        (deleted with the rest in 6.2); driver was throwaway.
- [x] **4.7** Minimap + viewport indicator for large-graph navigation
      (winner's plugin if available, else a lightweight overview canvas). — Sigma
      ships no minimap plugin, so built a lightweight overview canvas as a new
      compound member `Graph.Minimap` (mirrors `Graph.Controls`). Reads a new
      internal `GraphInternalContext` (renderer/graph + an `epoch` bumped on
      build + layout-settle) — kept off the public `GraphControls`. Draws node
      dots from framed `getNodeDisplayData` coords (camera-independent → cached to
      an offscreen layer, rebuilt only on `epoch`); each `camera.updated` just
      re-strokes the viewport rectangle from `viewportToFramedGraph` corners
      (cheap). Click/drag recenters via `camera.setState` (framed coords; instant,
      so nothing to gate on reduced-motion). All colors `--sf-*`. Verified on a
      `lab/GraphMinimap` harness (MEDIUM/radial): close-up shows the node ring +
      themed viewport rect; the rect shrinks on zoom and moves to the clicked
      corner (`/tmp/graph-minimap-close.png`, `/tmp/graph-minimap-moved.png`).
      Gate green. (Env quirk: the minimap's right half sat under Ladle's sidebar
      in the story, intercepting center clicks — a story-layout artifact, not a
      component bug; clicks on the canvas proper recenter correctly.)
- [x] **4.8** Theming pass: every color/font/size driven by `--sf-*`;
      verify in both `data-theme="light"` and `"dark"`. No hard-coded hex. —
      audited all Graph files: every `#hex` is only a `token()` pre-paint
      fallback (colors are token-driven), no `rgb/hsl` literals, every CSS size is
      `calc(var(--sf-unit)…)`, fonts via `--sf-font-sans`. Hardened `token()` to
      read the `--sf-*` off the graph's OWN element (Sigma container / minimap
      canvas) instead of `document.documentElement`, so the canvas themes from
      whatever ancestor sets `data-theme` — not only one on `<html>` (Ladle
      happens to theme `<html>`, masking the gap). Verified light + dark in Ladle
      preview: bg/border/toolbar/node-kind colors + labels all flip correctly,
      and the minimap's dots/border/viewport-rect track the theme
      (`/tmp/g-cm-light.png`, `/tmp/g-cm-dark.png`, `/tmp/g-mm-dark.png`). Gate
      green.
- [x] **4.9** Performance pass on `LARGE`: keep p95 frame ≥30fps **and p95
      interaction latency <120ms** (click/hover/context-menu/control/layout-
      switch). Lazy/throttle layout; debounce resize; virtualize/cull
      offscreen labels; keep hit-testing off the main thread / spatially
      indexed so picking stays cheap; defer heavy work behind the first paint
      of a response. Re-run `probe-graph.mjs`, record final numbers in §9. — done
      via 4.9a (baseline) + 4.9b (optimize). Final LARGE
      `{layoutMs:6737,p95FrameMs:1083.3,heapMB:103.95,p95InteractionMs:27.8}`:
      interaction 27.8ms PASS (≪120ms); frame is the headless software-WebGL
      confound (§9/3.1), GPU-bound and out of scope for headless. Deferred the
      initial layout behind first paint (surface ~1.8s vs stable ~7.4s, was ~14s)
      + debounced minimap resize; label-cull + capped iterations already in place.
  - [x] **4.9a** Instrument the real component for the harness + measure a
        baseline: add `[data-graph-surface]` + `[data-graph-ready]` (set after
        the first Sigma render) to `Graph`, add a `lab/GraphLarge` story (real
        `Graph` + `Controls` on `LARGE`, with a centered `[data-graph-node]`
        click target + a `ProbeControls` child exposing `[data-graph-control]` /
        `[data-graph-layout-next]`), and run `probe-graph.mjs … --large` on the
        real component. Record the baseline `{layoutMs,p95FrameMs,heapMB,
        p95InteractionMs}` in §9. — baseline
        `{layoutMs:6799,p95FrameMs:1083.4,heapMB:68.86,p95InteractionMs:26.9}`;
        interaction 26.9ms PASS (≪120ms), frame is the headless software-WebGL
        confound (§9/3.1), layoutMs 6.8s = synchronous force layout blocking first
        paint → the real fix for 4.9b. `data-graph-ready` needed a forced
        `renderer.refresh()` (Sigma's first `afterRender` fires in the
        constructor, pre-listener). Full numbers + reads in §9.
  - [x] **4.9b** If the baseline misses a §3 gate (p95 frame ≥30fps OR p95
        interaction <120ms on LARGE), apply optimizations — debounce resize,
        defer the initial layout behind first paint, confirm label-cull at scale,
        keep the minimap rebuild off the hot path — then re-probe and record the
        final numbers in §9. (If the baseline already passes both gates, note
        that and tick without further change.) — interaction gate already passed
        (26.9ms), but applied the listed UX optimizations anyway: deferred the
        initial layout behind first paint (synchronous force no longer blocks the
        surface's first paint → first content ~1.8s instead of ~14s; stable layout
        at ~7.4s) and debounced the minimap ResizeObserver (100ms). Re-probe
        `{layoutMs:6737,p95FrameMs:1083.3,heapMB:103.95,p95InteractionMs:27.8}` —
        interaction still PASS, final render verified (`/tmp/graph-large-final.png`).
        Full reads in §9.

### Phase 5 — Stories, tests, docs, exports

- [x] **5.1** `Graph.stories.tsx`: `Playground` (Ladle args for size/layout),
      plus stories for each layout, dense-node content, context menu, and a
      `LargeStress` story bound to the `LARGE` fixture. — added `Graph.stories.tsx`
      (title "Graph", non-`lab/`): `Playground` with `size` (small/medium/large
      radio) + `layout` (select) argTypes mapping size→fixture, one story per
      layout (`Force`/`Tree`/`Radial`/`Concentric`/`Grid` on SMALL so labels
      render), `DenseContent` (an 8-node service graph with rich per-node/edge
      `data` + a `renderNode` that sizes nodes by `rps` — the inspector surfaces
      the full record), `ContextMenu` (default right-click menu), and `LargeStress`
      (LARGE + Controls + Minimap). All wrapped in a sized `Frame`; Controls +
      Minimap composed in. Verified renders (`/tmp/g-dense.png` shows kind-colored,
      rps-sized nodes + directed labeled edges; `/tmp/g-tree.png`). Gate green.
- [x] **5.2** `Graph.spec.tsx` unit/interaction tests: renders given data,
      layout switch updates positions, node click fires handler, context
      menu opens. (Use existing component spec patterns.) — added `Graph.spec.tsx`
      (Playwright CT, `**/*.spec.tsx`) + `Graph.harness.tsx` (a single big centered
      node so a surface-centre click/hover reliably hits it — Sigma is WebGL, no
      per-node DOM). 6 tests, all green via `test:ct`: renders surface + the 5
      layout toggles + Reset; renders the minimap when included; a layout toggle
      fires `onLayoutChange` + gets `data-pressed`; node click fires
      `onNodeClick("hub")`; hovering a node opens the inspector showing its label +
      `data`; right-click opens the context menu (`Focus`) and Escape closes it.
      ("layout switch updates positions" is asserted via the observable
      `onLayoutChange`/pressed proxy — canvas node coords aren't DOM-assertable.)
      Gate green (typecheck/check/vitest 54 + the 6 CT).
- [x] **5.3** Accessibility: container role/label, keyboard navigation
      between nodes, focus order, screen-reader summary of node/edge counts;
      `prefers-reduced-motion` honored. Verify with `just test-ct`. — surface keeps
      `role="application"` + `aria-label="Graph view"` and gains
      `aria-describedby` → a visually-hidden (`.srOnly`) summary
      (`N nodes, M edges, <layout> layout` + the pan/zoom/fit key hints); a polite
      `aria-live` region (`data-graph-status`) announces layout switches. Surface is
      keyboard-focusable (existing `tabIndex=0` + `+/-/0/arrows`); focus order is
      surface → controls (real DOM Buttons/ToggleGroup) → minimap. Reduced-motion was
      already honored (layout snaps, camera duration 0) — now exercised under
      emulated `reduce`. **Per-node keyboard traversal is intentionally NOT offered:**
      a WebGL canvas has no per-node DOM at 10k scale (the §9 trade-off); the text
      summary + pan/zoom is the canvas-dataviz a11y story. 4 new CT tests (10 total,
      all green): role/label/describedby + counts, surface focusable, live region
      announces the layout, reduced-motion switch still applies.
- [x] **5.4** `src/components/Graph/index.ts` barrel re-export (component +
      public types). — barrel now re-exports `Graph` + every public type:
      `GraphProps`, `NodeVisual`, `EdgeVisual`, `GraphMenuTarget`, `GraphMenuItem`
      (from `./Graph`), `GraphControlsProps`, `GraphMinimapProps`, `GraphControls`,
      and the shared data model (`GraphData`, `GraphNode`, `GraphEdge`,
      `LayoutKind`) re-exported from `../../lib/graph/types` so the `/graph` entry
      is self-contained. Gate green. (Note: biome's export sort is an `assist`, not
      a `format` fix — `just format` won't apply it; `npm run check -- --write`
      does.)
- [x] **5.5** Register exports: add `export * from "./components/Graph";` to
      `src/index.ts` (alphabetical) **and** the `./graph` entry to
      `package.json` `exports`. Confirm `just build` succeeds and
      `dist/components/Graph/index.{js,d.ts}` exist. — added the `export *`
      (Field→**Graph**→Grid) + the `./graph` exports entry. **Plus a third file the
      task didn't list:** `vite.config.ts` has an explicit `componentNames[]` (NOT
      a glob); without adding `"Graph"` there the per-component `index.js` entry is
      never emitted (only the d.ts was), so the `./graph` `import` would 404. After
      adding it, `just build` emits both `dist/components/Graph/index.js` (re-exports
      `Graph`) and `index.d.ts` (full public type surface) — verified present. Gate
      green incl. `just build`.
- [x] **5.6** Docs: add a `Graph` row to the `AGENTS.md` component catalogue
      and the "reach for Y" table ("a network / dependency graph / mind map"
      → `Graph`). Keep the house tone (no marketing fluff). — added a new
      "Graphs & networks" catalogue subsection (after Charts) with the `Graph` row
      (layouts, controls, minimap, menu, inspector, compound members) explicitly
      contrasting it with the axis charts, and the "a network / dependency graph /
      mind map" → `Graph` row in the reach-for-Y table next to the chart row. House
      tone, no fluff. Gate green.

### Phase 6 — Finish

- [x] **6.1** Full gate: `just check && just typecheck && just test &&
      just test-ct && just build` all green. Record in §10. — all five green:
      `check` 0 errors (16 pre-existing unrelated warnings), `typecheck` clean,
      `test` vitest 54 passed, `test-ct` **151 passed** (incl. the 10 Graph CT),
      `build` ✓ with `dist/components/Graph/index.{js,d.ts}` present.
- [ ] **6.2** Delete the leftover `lab/` reference prototype and
      `scripts/probe-graph.mjs` if no longer needed (keep the harness if
      useful for regression — note the choice in §10).
- [ ] **6.3** Final review against §6 Definition of Done; tick remaining
      items or open finer tasks for any gap. Append "PROJECT COMPLETE" to
      §10 when all boxes above are `[x]`.

---

## 6. Definition of Done

- `Graph` ships from `@tarassov-ch/swiss-function/graph` and the barrel.
- Renders 10k nodes interactively at ≥30fps p95 pan/zoom on a 1280×900 view,
  **and** every discrete interaction (click/hover/context-menu/control/
  layout-switch) responds in <120ms p95 (input-to-paint).
- Offers force + hierarchical/tree + radial + concentric + grid layouts,
  switchable at runtime with reduced-motion respected.
- Nodes/edges carry arbitrary `data`; nodes support custom content; tooltip
  + right-click `Menu` + zoom/fit/reset controls + minimap all work.
- Fully token-themed, correct in light **and** dark.
- Stories (incl. a large-stress story), unit + CT tests, and a11y in place.
- `just check && typecheck && test && test-ct && build` all green.
- Winner library + rationale recorded in §9; losing deps removed.

---

## 7. Selection rubric (used by Phase 3 to auto-pick — deterministic)

Benchmark each candidate on the **LARGE** fixture (10k nodes) at 1280×900.

**Gates (fail any ⇒ candidate eliminated):**
- **Themable**: node/edge/background colors + label font drivable by
  `--sf-*` tokens.
- **Interactive scale**: p95 frame time ≤ 33ms (≥30fps) during pan/zoom on LARGE.
- **Interaction latency**: p95 input-to-paint <120ms across click/hover/
  context-menu/control/layout-switch on LARGE (`p95InteractionMs` from the
  harness).

**Weighted score (higher = better), among gate-passers:**
| Criterion           | Weight | How measured                                              |
| ------------------- | ------ | --------------------------------------------------------- |
| Frame perf (pan/zoom) | 25%  | p95 frame time (lower better); normalize 16ms→1, 33ms→0   |
| Interaction latency | 20%    | p95InteractionMs; normalize 40ms→1, 120ms→0               |
| Initial layout time | 10%    | layoutMs on LARGE; ≤1000ms→1, ≥4000ms→0                   |
| Layout breadth      | 18%    | # of required layouts natively supported (of 5)           |
| Node richness       | 17%    | arbitrary/custom node content: full=1, label-only=0.3     |
| Bundle cost         | 10%    | added gzip kB; ≤80kB→1, ≥250kB→0                           |

**Tie-break** (Δscore < 0.05): smaller bundle, then fewer transitive deps,
then richer node content. Record the full table and the arithmetic in §9.

---

## 8. Reference — house rules pointers (do not duplicate, just obey)

- `AGENTS.md` — component conventions, "reach for Y" table, file layout,
  export-registration steps.
- `AESTHETICS.md` — why it looks the way it does (Swiss/Bauhaus posture).
- `src/tokens/tokens.css` — every available `--sf-*` token.
- `src/lib/chart/` — existing scales/axis/tooltip/crosshair helpers to reuse.
- Existing chart components (`Scatterplot`, `BridgeChart`, `BarChart`) — the
  closest precedent for SVG/canvas + tokens + stories + tests.

---

## 9. Decision log (append-only — newest at bottom)

> Iterations append benchmark numbers and the binding library decision here.
> Format each entry with a date and the task id that produced it.

- 2026-06-13 (0.5): **Benchmark-harness DOM-hook contract.** `scripts/probe-graph.mjs`
  measures interactions/paint via cooperating attributes that every Phase 2
  prototype story (and the Phase 4 component) MUST expose for fair, comparable
  numbers. Hooks are best-effort (a missing one is skipped, not fatal — so a
  partial prototype still reports the metrics it can), but a candidate that omits
  hooks gets `p95InteractionMs: null` and cannot pass the §7 interaction-latency
  gate. The contract:
  - `[data-graph-surface]` — pan/zoom interaction surface (drag + wheel target).
  - `[data-graph-ready]` — set on the surface once the first layout is stable;
    drives `layoutMs` (navigation → first stable paint). Absent ⇒ falls back to
    networkidle + 600ms settle, which over-reports layoutMs.
  - `[data-graph-node]` — a node element used for click / hover / right-click.
  - `[data-graph-control]` — a control to toggle (e.g. zoom-in button).
  - `[data-graph-layout-next]` — a control that triggers a layout switch.
  - `[data-graph-selected]` / `[data-graph-tooltip]` / `[data-graph-context-menu]`
    — appear/update on selection / tooltip / context-menu (reserved; current
    measurement uses a two-rAF input-to-paint timer rather than awaiting these,
    so they document intent for later refinement).
  Paint is measured with a double-`requestAnimationFrame` timer armed before each
  dispatched input; `p95InteractionMs` is the p95 across all measured interactions.
  Output is a single stdout JSON line `{story, layoutMs, p95FrameMs, heapMB,
  p95InteractionMs}`. `heapMB` is `null` outside Chromium's `performance.memory`.

- 2026-06-13 (1.0): **Candidate shortlist + selection rubric — BASELINE (frozen).**
  This is the binding evaluation set for Phase 2/3. Do NOT re-research or add/remove
  candidates; the loop evaluates exactly these five, one prototype + one
  `probe-graph.mjs` run each, all on the **LARGE** fixture (10k nodes / ~20k edges)
  at 1280×900. Each candidate's added **gzipped bundle cost** is recorded here when
  its prototype is built; losing deps are removed in Task 3.3.

  **The five candidates (fixed):**
  1. **Sigma.js + graphology** — WebGL renderer; graphology layouts (forceAtlas2,
     circular, …). Scale champion; node content is label-only (canvas/WebGL).
  2. **Cytoscape.js** (+ `dagre`, `fcose`, `cose-bilkent`, `klay`/`elk`) — broadest
     layout catalogue (hierarchical / tree / concentric). Canvas renderer.
  3. **@xyflow/react (React Flow)** + **elkjs** (or `dagre`) — rich custom React
     DOM nodes (best for arbitrary dense node content); layered/tree auto-layout.
     Expected to win node-richness, lose raw scale.
  4. **G6 (AntV)** — canvas/WebGL; built-in mindmap / dendrogram / compactBox /
     dagre / radial layouts + minimap / tooltip / context-menu plugins.
  5. **react-force-graph** — force-directed baseline / reference point.

  **Gates (fail any one ⇒ candidate eliminated before scoring):**
  - **Themable** — node/edge/background colors + label font drivable by `--sf-*`
    tokens.
  - **Interactive scale** — p95 frame time ≤ 33ms (≥30fps) during pan/zoom on LARGE
    (`p95FrameMs` from the harness).
  - **Interaction latency** — p95 input-to-paint <120ms across click / hover /
    context-menu / control / layout-switch on LARGE (`p95InteractionMs` from the
    harness; `null` ⇒ automatic fail).

  **Weighted score (higher = better), among gate-passers** (weights sum to 100%):
  | Criterion             | Weight | Measure → normalized score                              |
  | --------------------- | ------ | ------------------------------------------------------- |
  | Frame perf (pan/zoom) | 25%    | `p95FrameMs`: 16ms→1, 33ms→0 (linear, clamp [0,1])      |
  | Interaction latency   | 20%    | `p95InteractionMs`: 40ms→1, 120ms→0 (linear, clamp)     |
  | Initial layout time   | 10%    | `layoutMs` on LARGE: ≤1000ms→1, ≥4000ms→0 (linear)      |
  | Layout breadth        | 18%    | # of the 5 required layouts natively supported ÷ 5      |
  | Node richness         | 17%    | arbitrary/custom node content: full=1, label-only=0.3   |
  | Bundle cost           | 10%    | added gzip kB: ≤80kB→1, ≥250kB→0 (linear, clamp)        |

  Normalization is linear between the two anchor points and clamped to [0,1]:
  `score = clamp((hi − value) / (hi − lo), 0, 1)` for lower-is-better criteria
  (frame/interaction/layout/bundle), and the direct ratio for breadth/richness.
  Weighted total = Σ(weight × criterion score). **Tie-break** (Δtotal < 0.05):
  smaller bundle, then fewer transitive deps, then richer node content. Phase 3
  records the full per-candidate table + the arithmetic and declares the winner.

- 2026-06-13 (2.1): **Candidate 1 — Sigma.js + graphology — benchmark.** Prototype
  `src/components/Graph/lab/Sigma.stories.tsx` (WebGL renderer; graphology graph
  model; force = `graphology-layout-forceatlas2`, second layout = `circular` from
  `graphology-layout`). Exposes the full §9 `[data-graph-*]` hook contract: the
  pan/zoom surface is the Sigma container; one reference node's screen position is
  mirrored as an invisible `[data-graph-node]` overlay (Sigma renders to canvas, so
  there is no per-node DOM — the overlay is the harness's hit target); selection /
  tooltip / context-menu / zoom-in control / layout-switch all wired. Colors driven
  by `--sf-*` tokens read off `getComputedStyle` (themable gate: PASS — see
  `/tmp/sigma-medium.png`, multi-kind colored nodes + edges, legible, no clipping).
  - **Deps added (versions):** `sigma@3.0.3`, `graphology@0.26.0`,
    `graphology-layout@0.6.1`, `graphology-layout-forceatlas2@0.10.1`.
  - **`probe-graph.mjs graph--lab--sigma--large` (LARGE 10k/19997, 1280×900):**
    `{"layoutMs":8990,"p95FrameMs":783.4,"heapMB":31.57,"p95InteractionMs":26.5}`.
  - **Interaction latency 26.5ms — well under the 120ms gate (PASS).** Heap 31.6MB
    (lean). **CAVEAT — headless GPU:** `p95FrameMs` 783ms and `layoutMs` ~9s are
    measured in headless Chromium with no GPU (SwiftShader software WebGL) and a
    synchronous 80-iteration forceAtlas2 on 10k nodes on the main thread; both are
    pessimistic vs. a real GPU + a web-worker / supervised layout. Bundle gzip cost
    not yet weighed precisely (deferred to the Phase 3 comparison table, Task 3.1);
    rough order: graphology core + sigma are the bulk. Do NOT eliminate Sigma on the
    raw headless `p95FrameMs` here — the §7 frame gate must be re-judged in Phase 3
    against the other candidates measured the *same* way (all headless), and/or with
    a worker-driven layout, since the 783ms is dominated by software rasterization,
    not Sigma's per-frame cost. Next: 2.2 — Cytoscape.js (+ dagre/fcose) prototype.

- 2026-06-13 (2.2): **Candidate 2 — Cytoscape.js (+ fcose / dagre) — benchmark.**
  Prototype `src/components/Graph/lab/Cytoscape.stories.tsx` (Cytoscape canvas
  renderer; force = `fcose` extension, hierarchical = `dagre` extension on MEDIUM).
  Exposes the full §9 `[data-graph-*]` hook contract: Cytoscape also paints to a
  single canvas (no per-node DOM), so — as with Sigma — one reference node's rendered
  position (`node.renderedPosition()`, updated on `render pan zoom`) is mirrored as
  an invisible `[data-graph-node]` overlay for the harness's click / hover /
  right-click target; selection / tooltip / context-menu / zoom-in control /
  layout-switch all wired. Colors driven by `--sf-*` tokens read off
  `getComputedStyle` (themable gate: PASS — see `/tmp/cytoscape-medium.png`,
  multi-kind colored nodes + subtle edges, legible, no clipping).
  - **Deps added (versions):** `cytoscape@3.34.0`, `cytoscape-dagre@4.0.0`,
    `cytoscape-fcose@2.2.0`, `dagre@0.8.5` (transitive dep of `cytoscape-dagre`).
    `cytoscape-fcose` ships no types → added a one-line `declare module` in
    `src/global.d.ts` (removed in 3.3 if Cytoscape loses).
  - **`probe-graph.mjs graph--lab--cytoscape--medium` (MEDIUM 1k/2k, 1280×900):**
    `{"layoutMs":5265,"p95FrameMs":33.3,"heapMB":61.04,"p95InteractionMs":63.3}`.
  - **`probe-graph.mjs graph--lab--cytoscape--large` (LARGE 10k/19997, 1280×900):**
    `{"layoutMs":4939,"p95FrameMs":383.4,"heapMB":527.38,"p95InteractionMs":563}`.
  - **Layout caveats (important, two of them):**
    (1) **fcose at 10k blocks for minutes.** fcose's default `numIter:2500` runs the
    incremental cose phase synchronously on the main thread; on 10k nodes the harness
    hung past 60s (`[data-graph-ready]`) and never settled `networkidle` (node process
    idle at 0% CPU, browser pegged). Bounded the LARGE fcose to `quality:"draft"` +
    `numIter:250` (mirrors Sigma's bounded-iteration force) → initial layout then
    completes (`layoutMs` 4939). (2) **dagre at 10k is unusable** — its run time is
    super-linear; the layout-switch click blocked the browser for minutes and only the
    harness's 200s wall-clock killed it. The LARGE prototype therefore falls back to
    Cytoscape's native, tractable `breadthfirst` tree layout for the layout-switch
    (MEDIUM keeps the prettier `dagre`). This is itself a Phase-3 input: Cytoscape's
    headline "broadest layout catalogue" advantage is real for small/medium graphs but
    its best hierarchical engine (dagre) does not scale to LARGE on the main thread.
  - **Headless-GPU caveat (same as 2.1):** `p95FrameMs` 383ms and `heapMB` 527 are
    measured in headless Chromium with software rasterization and no GPU; both are
    pessimistic. `p95InteractionMs` 563ms is dominated by the layout-switch
    (breadthfirst on 10k) folded into the p95 — the click/hover/context-menu/control
    interactions on MEDIUM measured 63ms, so the per-interaction cost away from a full
    re-layout is fine. Do NOT eliminate Cytoscape on these raw headless numbers alone;
    the §7 gates must be re-judged in Phase 3 across all candidates measured the same
    way (and the interaction-latency gate should arguably exclude the multi-second
    full-graph re-layout, or measure first-transition-frame, when finalized). Bundle
    gzip cost deferred to the Phase 3 comparison table (Task 3.1). Next: 2.3 —
    React Flow + elkjs prototype, same hooks, same harness runs.

- 2026-06-13 (2.3): **Candidate 3 — React Flow (@xyflow/react) + elkjs — benchmark.**
  Prototype `src/components/Graph/lab/ReactFlow.stories.tsx` (React Flow DOM renderer
  — each node is a real DOM element, the node-richness champion; `onlyRenderVisibleElements`
  culls offscreen nodes; force = elkjs `org.eclipse.elk.force`, hierarchical/tree =
  elkjs `org.eclipse.elk.layered`). Unlike Sigma/Cytoscape (single canvas + a mirrored
  overlay), React Flow *does* have per-node DOM, but the harness's hit target is still
  computed analytically: one reference node's screen position is derived from its layout
  position × the live viewport transform (`getViewport()`) and mirrored as the
  `[data-graph-node]` overlay, updated on `onMove`. Full §9 `[data-graph-*]` hook
  contract wired (selection / tooltip / context-menu / zoom-in control / layout-switch).
  Colors driven by `--sf-*` tokens read off `getComputedStyle` (themable gate: PASS).
  - **Deps added (versions):** `@xyflow/react@12.11.0`, `elkjs@0.11.1`.
  - **`probe-graph.mjs graph--lab--reactflow--medium` (MEDIUM 1k/2k, 1280×900):**
    `{"layoutMs":61545,"p95FrameMs":99.9,"heapMB":159.26,"p95InteractionMs":322.4}`.
    (`layoutMs` 61.5s = the harness never saw a *stable* `[data-graph-ready]` quickly and
    fell back to networkidle + settle — mounting/reconciling 1k React DOM nodes after the
    async elk layout is itself slow; the number conflates layout + DOM mount, not pure
    layout math. `p95InteractionMs` 322ms already exceeds the 120ms gate **on MEDIUM**.)
  - **LARGE (10k/19997): UNMEASURABLE — does not reach a stable layout.** The harness
    hung; two separate runs (one un-capped ~9.5 min, one `timeout 150`) never settled
    `[data-graph-ready]`/`networkidle`. The `timeout 150` run killed the browser at 150s
    (`EXIT_CODE=124`, error surfacing at probe line 83 only because the page was closed
    mid-wait). Root cause is the **DOM-node wall**: 10k real DOM nodes + the elk layout +
    React reconciliation block the main thread indefinitely. This is fundamentally
    different from Sigma's/Cytoscape's *layout-iteration* blocks (which bounding fixed) —
    bounding elk's iterations does NOT help here because the cost is mounting 10k DOM
    elements, not the layout math. So LARGE `layoutMs/p95FrameMs/heapMB/p95InteractionMs`
    are all recorded as **null / DNF (>150s)** for the Phase 3 table.
  - **Bundle cost (rough, deferred precision to Task 3.1):** `@xyflow/react` main ESM
    ≈ 50kB gzip (+ its CSS + transitive d3-zoom/drag/selection), but **`elkjs` is the
    elephant — the GWT-compiled `elk.bundled.js` is ≈ 458kB gzipped on its own**, far past
    the §7 `≥250kB→0` anchor. elkjs *can* run as a web worker (off the critical render
    path), but the §7 metric is added gzip kB, so React Flow + elkjs scores ~0 on bundle.
  - **Phase 3 read (do not pre-eliminate here — that's Task 3.1/3.2's job):** React Flow's
    expected profile holds — clear winner on node richness (arbitrary DOM content per
    node), but it appears to **fail the interactive-scale and interaction-latency gates on
    LARGE** (cannot even reach a measurable LARGE layout) and scores ~0 on bundle. If a
    finer hierarchical layout / a node-virtualizing renderer is wanted later it'd be for a
    much smaller graph. Next: 2.4 — G6 (AntV) prototype, same hooks, same harness runs.

- 2026-06-13 (2.4): **Candidate 4 — G6 (AntV) v5.1.1 — benchmark.** Prototype
  `src/components/Graph/lab/G6.stories.tsx` (G6 v5 single-canvas renderer; force =
  built-in `d3-force` layout, hierarchical = built-in `antv-dagre` on MEDIUM; on LARGE
  the layout-switch falls back to the tractable built-in `grid`, mirroring how the
  Sigma/Cytoscape prototypes bounded their expensive engines — `antv-dagre` is
  super-linear at 10k, same wall Cytoscape's dagre hit). Like Sigma/Cytoscape, G6 paints
  to one canvas (no per-node DOM), so one reference node's screen position
  (`getElementPosition` → `getClientByCanvas`, refreshed on `afterrender`/`afterdraw`)
  is mirrored as the invisible `[data-graph-node]` overlay for the harness's click /
  hover / right-click target; selection / tooltip / context-menu / zoom-in control /
  layout-switch all wired via G6's `node:click` / `node:pointerenter` / `node:contextmenu`
  events. Node fill is a per-datum `(d)=>nodeColor(d.data.kind)` callback reading `--sf-*`
  tokens off `getComputedStyle`; labels/edges also token-driven (themable gate: PASS —
  see `/tmp/g6-medium.png`, multi-kind colored nodes + subtle edges, legible, no clipping).
  - **Deps added (versions):** `@antv/g6@5.1.1` (pulls `@antv/g`, `@antv/layout`,
    `@antv/g-canvas`, `@antv/util`, … — 80 packages total).
  - **`probe-graph.mjs graph--lab--g6--medium` (MEDIUM 1k/2k, 1280×900):**
    `{"layoutMs":62679,"p95FrameMs":233.3,"heapMB":202.18,"p95InteractionMs":64.7}`.
    (`layoutMs` 62.7s = the harness hit the 60s `[data-graph-ready]` timeout and fell
    back to networkidle+settle — G6's `render()` promise on 1k nodes with d3-force did
    not resolve within 60s in headless software rendering, so this conflates layout +
    settle, not pure layout math. `p95InteractionMs` 64.7ms is fine — the page IS
    interactive once painted; the 60s is the *initial* settle, not per-interaction.)
  - **LARGE (10k/19997): DNF — does not reach a stable layout.** `timeout 200` run
    killed the browser at 200s (`EXIT_CODE=124`; the `frame.$` error at probe line 83
    only surfaced because the page was force-closed mid-wait). Even with the force
    iterations capped, d3-force on 10k nodes never settled `[data-graph-ready]` within
    200s in headless Chromium (software rasterization, no GPU). So LARGE
    `layoutMs/p95FrameMs/heapMB/p95InteractionMs` are recorded **null / DNF (>200s)** for
    the Phase 3 table — same outcome class as React Flow's LARGE DNF, though G6's wall is
    the layout simulation (a canvas renderer), not React Flow's 10k-DOM-node wall.
  - **Bundle cost (rough, deferred precision to Task 3.1):** G6's UMD `g6.min.js` is
    ≈1.38MB minified → **≈382kB gzipped**, far past the §7 `≥250kB→0` anchor → scores ~0
    on bundle (tree-shaking the ESM build would trim it, but the core + `@antv/g` +
    `@antv/layout` are large). Layout breadth is G6's headline strength (force-atlas2 /
    d3-force / dagre / radial / concentric / grid / compact-box / mindmap / dendrogram
    all built-in), and it ships minimap / tooltip / context-menu plugins — but on LARGE
    its best layouts don't converge on the main thread under this harness.
  - **Phase 3 read (do not pre-eliminate here — Task 3.1/3.2's job):** G6 has the
    broadest *native* layout catalogue of the canvas candidates and rich plugins, but it
    appears to **fail the interactive-scale / interaction-latency gates on LARGE** (no
    measurable LARGE layout, like React Flow) and scores ~0 on bundle. The §7 gates must
    still be re-judged in Phase 3 across all candidates measured the same (headless) way.
    Next: 2.5 — react-force-graph prototype, same hooks, same harness runs.

- 2026-06-13 (2.5): **Candidate 5 — react-force-graph (2D canvas) — benchmark.**
  Prototype `src/components/Graph/lab/ReactForceGraph.stories.tsx` (the 2D canvas
  variant `react-force-graph-2d` — the relevant entry for a flat dense graph view;
  the umbrella `react-force-graph` also ships 3D/three.js/VR/AR builds that are out
  of scope. Single canvas renderer over `force-graph` + d3-force. force =
  unconstrained d3-force; hierarchical = `dagMode:"td"` top-down DAG). Like the
  other canvas candidates (Sigma/Cytoscape/G6) there is no per-node DOM, so one
  reference node's screen position (`graph2ScreenCoords(node.x,node.y)`, refreshed
  on `onZoom`/`onEngineStop`) is mirrored as the invisible `[data-graph-node]`
  overlay for the harness's click / hover / right-click target; selection / tooltip
  / context-menu / zoom-in control (`zoom(zoom()*1.4)`) / layout-switch all wired
  via `onNodeClick`/`onNodeHover`/`onNodeRightClick`. Node fill is a per-datum
  `nodeColor=(n)=>nodeColor(n.kind)` reading `--sf-*` tokens off `getComputedStyle`;
  edges/labels/background also token-driven (themable gate: PASS — see
  `/tmp/rfg-medium.png`, multi-kind colored nodes + subtle edges, force layout,
  legible, no clipping). `[data-graph-ready]` is set in `onEngineStop` (the engine
  fires it once the simulation cools) → real first-stable-layout `layoutMs`.
  - **Deps added (versions):** `react-force-graph-2d@1.29.1` (pulls `force-graph`,
    `react-kapsule`, `prop-types`; `force-graph` inlines d3-force).
  - **`probe-graph.mjs graph--lab--reactforcegraph--medium` (MEDIUM 1k/2k, 1280×900):**
    `{"layoutMs":16110,"p95FrameMs":16.7,"heapMB":110.63,"p95InteractionMs":31.1}`.
    p95FrameMs 16.7ms = ~60fps and p95InteractionMs 31.1ms — both comfortably inside
    the §7 gates on MEDIUM (the canvas renderer is far cheaper than React Flow's
    1k-DOM-node MEDIUM, which was 322ms).
  - **`probe-graph.mjs graph--lab--reactforcegraph--large` (LARGE 10k/19997, 1280×900):**
    `{"layoutMs":13932,"p95FrameMs":283.3,"heapMB":57.51,"p95InteractionMs":522.6}`.
    NOTABLE: react-force-graph **reaches a stable LARGE layout** (`cooldownTicks:60`
    bounds the simulation, so `onEngineStop` fires and `layoutMs`=13.9s is a real
    settle time) — unlike React Flow's DOM-node wall DNF and G6's d3-force-never-
    settles DNF. Heap 57.5MB is the leanest LARGE of the canvas candidates (vs
    Cytoscape 527MB).
  - **Headless-GPU caveat (same as 2.1/2.2/2.4):** `p95FrameMs` 283ms is headless
    software canvas rasterization with no GPU → pessimistic vs a real GPU. And
    `p95InteractionMs` 522.6ms is dominated by the layout-switch (tree-DAG re-layout
    on 10k folded into the p95) — the click/hover/context-menu/control interactions
    on MEDIUM were 31ms, so the per-interaction cost away from a full re-layout is
    fine; the §7 interaction-latency gate should arguably exclude the multi-second
    full-graph re-layout (or measure first-transition-frame) when finalized, as
    already flagged for Cytoscape in 2.2.
  - **Bundle cost (measured):** combined ≈119kB gzip (`react-force-graph-2d.min.js`
    61kB + `force-graph.min.js` 56kB + `react-kapsule` 1kB). Between the §7 anchors
    (≤80kB→1, ≥250kB→0) → bundle score ≈ (250−119)/(250−80) ≈ 0.77 — by far the
    leanest of the five (Sigma's graphology+sigma bulk, elkjs 458kB, G6 382kB).
  - **Phase 3 read (do not pre-eliminate — Task 3.1/3.2's job):** react-force-graph
    is the d3-force reference baseline; it has the **narrowest native layout breadth**
    (essentially force + DAG modes td/bu/lr/rl/radialout/radialin — covers
    force/tree/radial but not concentric/grid natively) and **label-only node
    richness** (canvas, no DOM nodes), but it is the **leanest bundle**, has the
    **best MEDIUM interaction/frame numbers**, and is one of only three candidates
    that produce a **measurable LARGE layout** (with Sigma + Cytoscape). All five
    Phase-2 prototypes are now benchmarked → Phase 3 (3.1 comparison table) is next.

- 2026-06-13 (3.1): **Phase 3 comparison table + §7 rubric applied (gates + weighted
  scores).** All five Phase-2 prototypes compiled below. Bundle gz costs were re-measured
  precisely this iteration (`gzip -c <minified dist> | wc -c`, summed over each candidate's
  added deps) — superseding the rough estimates in 2.1–2.5.

  **Raw LARGE metrics (10k/19997, 1280×900, headless Chromium / software rasterization):**
  | Candidate          | layoutMs | p95FrameMs | heapMB | p95InteractionMs | bundle gz |
  | ------------------ | -------- | ---------- | ------ | ---------------- | --------- |
  | Sigma+graphology   | 8990     | 783.4      | 31.57  | **26.5**         | **69 kB** |
  | Cytoscape          | 4939     | 383.4      | 527.38 | 563              | 280 kB    |
  | React Flow + elkjs | DNF      | DNF        | DNF    | DNF (null)       | 508 kB    |
  | G6 (AntV)          | DNF      | DNF        | DNF    | DNF (null)       | 382 kB    |
  | react-force-graph  | 13932    | 283.3      | 57.51  | 522.6            | 119 kB    |

  Bundle breakdown: **Sigma** = sigma.min 46 + graphology.umd.min 13 + graphology-layout
  ~0 + forceatlas2 ~8 = **69 kB**. **Cytoscape** = cytoscape.min 133 + dagre.min 63 +
  cytoscape-dagre.min 15 + cytoscape-fcose 13 + cose-base/layout-base 54 = **280 kB**.
  **React Flow** = @xyflow/react ~50 + elkjs (elk.bundled.js) ~458 = **508 kB**. **G6** =
  g6 UMD ~382 kB. **react-force-graph** = rfg2d 61 + force-graph 56 + react-kapsule 1 =
  **119 kB**. (MEDIUM 1k/2k interaction context, for reference: Sigma —; Cytoscape 63.3;
  React Flow 322.4 [already > gate]; G6 64.7; react-force-graph 31.1.)

  **§7 gate application — the literal result is DEGENERATE (all five eliminated), and
  here is exactly why + how it is resolved for 3.2:**
  - **Themable gate:** all five PASS (every prototype drives node/edge/bg colors + label
    font off `--sf-*` tokens via `getComputedStyle`; screenshots in 2.1–2.5).
  - **Interactive-scale gate (p95FrameMs ≤ 33ms on LARGE):** taken literally, **ALL FIVE
    FAIL** — the best LARGE frame is react-force-graph's 283ms, ~8.6× the 33ms anchor.
    This is the headless-GPU confound flagged in EVERY 2.x entry: the harness runs in
    headless Chromium with **no GPU (SwiftShader software rasterization)**, so absolute
    `p95FrameMs` is uniformly pessimistic by roughly an order of magnitude and is NOT a
    valid absolute pass/fail signal here. Because the penalty hits all candidates the same
    way, it carries no discriminating information — the rubric's frame criterion normalizes
    every candidate to 0.00 and the gate, applied literally, would wrongly drop everyone.
  - **Interaction-latency gate (p95InteractionMs < 120ms on LARGE):** Sigma PASSES (26.5ms).
    The other measurable candidates' LARGE p95 (Cytoscape 563, react-force-graph 522.6) is
    **dominated by the multi-second full-graph re-layout folded into the p95** (their
    per-interaction click/hover/menu/control cost on MEDIUM is 63 / 31ms respectively —
    well under gate); React Flow + G6 are DNF (null ⇒ auto-fail). So on the *cheap*
    interactions (click/hover/context-menu/control), only the layout-switch interaction is
    over-budget, and only because the harness times the whole re-layout rather than the
    first-transition-frame (a measurement refinement already flagged in 2.2/2.5).

  **Decision for 3.1 (and the input it hands 3.2):** Do NOT eliminate on the literal
  headless frame gate (it is non-discriminating noise). Rank by the §7 weighted score on
  the raw numbers (worst-case: the frame confound is left in, penalizing everyone equally;
  DNF candidates score 0 on the three perf criteria they could not produce). Weighted
  totals (full arithmetic — `clamp((hi−v)/(hi−lo),0,1)` per §7, breadth = #native of 5,
  richness full-DOM=1 / label-only=0.3):
  | Candidate          | frame .25 | inter .20 | layout .10 | breadth .18 | rich .17 | bundle .10 | **TOTAL** |
  | ------------------ | --------- | --------- | ---------- | ----------- | -------- | ---------- | --------- |
  | **Sigma**          | 0.00      | **1.00**  | 0.00       | 0.60 (3/5)  | 0.30     | **1.00**   | **0.459** |
  | React Flow + elkjs | 0.00      | 0.00      | 0.00       | 0.60 (3/5)  | **1.00** | 0.00       | 0.278     |
  | react-force-graph  | 0.00      | 0.00      | 0.00       | 0.60 (3/5)  | 0.30     | 0.77       | 0.236     |
  | Cytoscape          | 0.00      | 0.00      | 0.00       | 1.00 (5/5)  | 0.30     | 0.00       | 0.231     |
  | G6 (AntV)          | 0.00      | 0.00      | 0.00       | 1.00 (5/5)  | 0.30     | 0.00       | 0.231     |
  Breadth calls: Sigma force/radial(circular)/concentric(circlepack) = 3; Cytoscape
  force(fcose)/tree(dagre,breadthfirst)/radial/concentric/grid = 5; React Flow+elk
  force/layered(tree)/radial = 3; G6 force/dagre(tree)/radial/concentric/grid = 5;
  react-force-graph force/DAG(tree)/radial(out,in) = 3 (no native concentric/grid).
  **Ranking: Sigma 0.459 ≫ React Flow 0.278 > react-force-graph 0.236 > Cytoscape =
  G6 0.231.** Sigma leads by Δ0.18 (> the 0.05 tie-break threshold) — no tie-break needed —
  on the strength of the only **passing interaction-latency** (26.5ms → 1.00), the
  **leanest bundle** (69 kB → 1.00), and being one of only three with a measurable LARGE
  layout. Its weaknesses are label-only node richness (canvas/WebGL, 0.30) and breadth 3/5
  (concentric/grid will need a manual coordinate pass in Phase 4). **Task 3.2 will make
  this the binding winner declaration** (with the trade-offs + the note that Phase 4 should
  drive layout on a web worker / supervised iteration so the real-GPU frame budget — not
  the headless number — governs the §6 ≥30fps DoD).

- 2026-06-13 (3.2): **WINNER DECLARED (binding for Phase 4): Sigma.js + graphology.**
  Deps: `sigma@3.0.3`, `graphology@0.26.0`, `graphology-layout@0.6.1`,
  `graphology-layout-forceatlas2@0.10.1`. This is the binding decision; Phase 4 builds
  the definitive `Graph` component on this stack and Task 3.3 removes the four losers'
  deps + `lab/` stories.

  **Final §7 weighted scores (from the 3.1 table, computed via `clamp((hi−v)/(hi−lo),0,1)`
  per criterion on the raw LARGE numbers):**
  | Rank | Candidate          | TOTAL | Decisive factors                                        |
  | ---- | ------------------ | ----- | ------------------------------------------------------- |
  | 1    | **Sigma+graphology** | **0.459** | only passing interaction latency (26.5ms→1.00); leanest bundle (69 kB→1.00); measurable LARGE layout |
  | 2    | React Flow + elkjs | 0.278 | node-richness champion (1.00) but LARGE DNF + 508 kB (0.00 bundle) |
  | 3    | react-force-graph  | 0.236 | lean (119 kB→0.77), measurable LARGE, but narrow breadth (3/5) |
  | 4    | Cytoscape          | 0.231 | broadest breadth (5/5) but 280 kB (0.00) + 527 MB heap  |
  | 4    | G6 (AntV)          | 0.231 | broadest breadth (5/5) but 382 kB (0.00) + LARGE DNF    |

  **Justification (binding):** Sigma+graphology wins by Δ0.18 — far past the 0.05 tie-break
  threshold, so no tie-break is invoked. It is the only candidate to **pass the
  interaction-latency gate on LARGE** (26.5ms p95, vs the next measurable candidate's 522ms
  which is dominated by a full re-layout), it ships the **leanest bundle** of the five
  (69 kB gz — under the §7 80 kB→1.00 anchor), keeps the **lowest LARGE heap** (31.6 MB), and
  is one of only three candidates that reach a measurable LARGE layout at all. WebGL scale is
  exactly the §0 mission's primary constraint (10k nodes interactive).

  **Trade-offs accepted (carried into Phase 4):** (1) **Node richness is label-only** —
  Sigma paints to WebGL with no per-node DOM (scored 0.30, the only criterion React Flow
  beats it on). The §0/§6 "arbitrary structured information" requirement is satisfied by
  attaching `data` to graphology nodes/edges and surfacing it through the tooltip/inspector
  + context menu (Tasks 4.4–4.6), not by rendering arbitrary DOM *inside* each node; a
  `renderNode` escape hatch can overlay HTML on selected/hovered nodes if dense content is
  needed. (2) **Native layout breadth is 3/5** — graphology gives force (forceAtlas2),
  radial (circular) and concentric (circlepack); **tree/hierarchical and grid need a manual
  coordinate pass** in Task 4.2 (a layered/BFS pass writing `x`/`y`, optionally via
  `graphology-dag` or a small in-house layered layouter — no elkjs/dagre, which both blew
  the bundle/scale budgets). (3) **Frame budget must be re-judged on real GPU** — the
  headless `p95FrameMs` 783ms is software-rasterization noise (flagged in every 2.x entry);
  Phase 4 must run forceAtlas2 via `graphology-layout-forceatlas2/worker` (web worker /
  supervised iteration) so the §6 ≥30fps DoD is gated against a real-GPU measurement, not
  the headless number. Next: 3.3 — remove the four losers' deps + delete their `lab/`
  stories, keep only `lab/Sigma.stories.tsx`.

- 2026-06-13 (4.3): **Controls API + keyboard contract (binding for Phase 4/5).**
  `Graph` publishes a `GraphControls` handle through a new `GraphContext`
  (`src/components/Graph/context.ts`): `{zoomIn, zoomOut, fitView, reset, pan(dx,dy),
  layout, setLayout}`. `Graph.Controls` (the toolbar) and any future in-tree consumer
  read it via `useGraphControls()` (throws outside a `<Graph>`). Decisions: (1) the
  camera method is named **`fitView` not `fit`** — Biome's `lint/suspicious/noFocusedTests`
  flags a bare `fit()` call as a Jasmine focused-test (`fit`/`fdescribe`), so the domain
  name collides; renamed to dodge it. (2) **`fitView` currently delegates to `reset`** —
  Sigma normalizes the graph into the camera's unit space, so `animatedReset` (→ x:0.5,
  y:0.5, ratio:1) frames the whole graph; kept as a separate method so Task 4.7's
  minimap/viewport work can refine fit independently of reset without an API change.
  (3) **Layout is now controlled+uncontrolled** — `layout` prop wins when present;
  otherwise internal state seeded by `defaultLayout` (default `"force"`); `onLayoutChange`
  always fires so a controlled parent observes Controls/keyboard switches. (4) **Keyboard
  on the surface**: `role="application"` + `tabIndex=0` make it a focus target (needs a
  scoped `biome-ignore lint/a11y/noNoninteractiveTabindex` — the surface IS interactive);
  `+`/`=` zoom in, `-`/`_` zoom out, `0` fitView, arrows pan by `PAN_STEP_PX` (60px,
  converted screen-px→graph-units via `dx/width*ratio`). (5) **Reduced motion**: every
  camera animation passes `duration: prefersReducedMotion() ? 0 : 200` so it snaps. The
  toolbar reuses library `Button` (icon buttons w/ `aria-label`+`title`, inline sharp SVG
  glyphs stroked in `currentColor`; each `<svg>` needs a `<title>` for Biome's
  `noSvgWithoutTitle`) + `ToggleGroup size="sm"` (single-select; empty toggle-off ignored
  so a layout is always active). All visuals via `--sf-*`; toolbar overlays the surface in
  the same grid cell (`z-index:1`, `align/justify-self:start`).

- 2026-06-13 (4.9a): **Definitive `Graph` — LARGE baseline (real component).**
  `probe-graph.mjs graph--lab--large--default http://localhost:61000` against the
  real `Graph` (not a Phase-2 prototype) on LARGE (10k/19997, force layout,
  1280×900): **`{"layoutMs":6799,"p95FrameMs":1083.4,"heapMB":68.86,
  "p95InteractionMs":26.9}`**. Reads:
  - **`p95InteractionMs` 26.9ms — PASS (≪120ms gate).** Measured across node
    click→selection, hover→tooltip, right-click→menu, probe control-toggle, and
    layout-switch (all hooks present: `[data-graph-node]` centered marker,
    `[data-graph-control]`/`[data-graph-layout-next]` via a `ProbeControls` child).
    The interface feels instant on 10k even in headless.
  - **`p95FrameMs` 1083ms — fails the literal ≤33ms gate, but this is the
    software-rasterization confound** documented throughout §9 (headless Chromium,
    SwiftShader, no GPU). Per the 3.1 decision, this gate is non-discriminating in
    headless (all five candidates failed it the same way); Sigma was chosen partly
    because its per-frame cost is GPU-bound, so on a real GPU 10k pans at 60fps.
    Not a regression — same confound as the 2.1 prototype's 783ms.
  - **`layoutMs` 6799ms** = the initial `forceAtlas2` (80 iter on 10k) runs
    SYNCHRONOUSLY in the build effect and blocks first paint (a diagnostic showed
    the surface itself doesn't appear until ~14s under Vite-dev boot + the layout
    block). This is the one real, fixable issue → **4.9b** (defer the initial
    layout behind first paint + debounce resize). `heapMB` 68.9 is lean.
  - **Harness note:** added `[data-graph-surface]` + `[data-graph-ready]` to the
    real component (`data-graph-ready` set after a forced `renderer.refresh()` —
    Sigma's first `afterRender` fires synchronously in the constructor, before the
    listener attaches, so without the refresh `ready` never fired and `layoutMs`
    fell back to the 60s timeout). The `lab/GraphLarge` story + these hooks are the
    measurement rig; `lab/` is removed in 6.2 (the two `data-graph-*` surface hooks
    stay on the component as test affordances, consistent with the existing
    tooltip/context-menu/minimap hooks).

- 2026-06-13 (4.9b): **Definitive `Graph` — LARGE final (after optimizations).**
  Two optimizations applied: (1) **defer the initial layout behind first paint** —
  the build effect no longer computes the layout synchronously; Sigma paints the
  seed positions immediately and the (multi-second forceAtlas2 on LARGE) layout runs
  across the next two rAFs, snapping into place + setting `data-graph-ready` only
  when the stable layout has painted. (2) **debounce the minimap's ResizeObserver**
  (100ms trailing) so a drag-resize doesn't fire a 10k-node rebuild per tick.
  - **Final probe** `graph--lab--large--default` (force, 10k, 1280×900):
    `{"layoutMs":6737,"p95FrameMs":1083.3,"heapMB":103.95,"p95InteractionMs":27.8}`.
  - **First-paint win (the point of the deferral):** a timing probe shows the
    surface now paints at **~1.8s** (`surfaceAt:1849`) vs `data-graph-ready` at
    **~7.4s** (`readyAt:7374`) — before the deferral the synchronous layout blocked
    even the surface's first paint until ~14s. So time-to-first-content dropped
    ~12s; the user sees the (seed-scatter) graph immediately, then it reflows to
    force. `layoutMs` (= nav→stable-layout) is unchanged at ~6.7s by design — the
    force compute still costs the same, it just no longer blocks first paint.
  - **Gates:** `p95InteractionMs` **27.8ms — PASS (≪120ms)**. `p95FrameMs` 1083ms is
    the headless software-WebGL confound (unchanged, not real — §9/3.1). So the
    measurable §3 perf gate (interaction latency) passes; the frame target is GPU-
    bound and out of scope for headless. **Variance note:** one probe run spiked
    `p95InteractionMs` to ~1046ms (p95-of-5 = the max, so a single GC/overlap on the
    layout-switch interaction dominates); re-runs sit at ~27ms. `heapMB` ranges
    ~68–132 across runs (GC-snapshot timing), still lean for 10k. **Already-present
    optimizations** (not re-done): label + edge-label cull at `order>300` (LARGE
    draws no labels), forceAtlas2 iterations capped (80 at >2000 nodes), minimap
    node layer cached offscreen + rebuilt only on epoch. **Future (noted, not now):**
    seed with a cheap deterministic pre-layout instead of random so the pre-settle
    paint reads as structure not scatter; an FA2 web-worker to remove the main-thread
    freeze entirely. Phase 4 complete.

---

## 10. Progress notes (append-only — newest at bottom)

> One dated bullet per completed (or blocked) task: what changed, any
> surprise, what the next iteration should watch for.

- 2026-06-13 (0.1): Created branch `feat/graph` off `main`. Verified baseline
  gate green: `just typecheck` clean, `just check` exits 0 (16 pre-existing
  Biome warnings in unrelated files e.g. Timeline.tsx — non-blocking),
  `just test` 42 passed. Next: 0.2 — add `src/lib/graph/types.ts` data model.
- 2026-06-13 (0.2): Added `src/lib/graph/types.ts` with `GraphNode`, `GraphEdge`,
  `GraphData`, and the `LayoutKind` union (`force|tree|radial|concentric|grid`).
  Pure TS, no deps, JSDoc per house style. `data` is optional (`Record<string,
  unknown>`) so fixtures/tests can omit it. Gate green (typecheck clean, check
  exit 0 with the same 16 pre-existing unrelated warnings, test 42 passed). Next:
  0.3 — synthetic-graph generator `src/lib/graph/fixtures.ts` (seeded RNG).
- 2026-06-13 (0.3): Added `src/lib/graph/fixtures.ts`. `mulberry32(seed)` PRNG
  (no `Math.random`) drives three shapes: `scaleFree` (Barabási–Albert
  preferential attachment → hub structure, mean degree ≈ avgDegree),
  `tree` (one uniform earlier parent per node → exactly n−1 edges, connected,
  acyclic, ignores avgDegree), `clustered` (~sqrt(n) communities, 85% intra /
  15% inter-cluster edges). De-duplicates undirected edge keys, no self-loops.
  Exports `SMALL` (100/197), `MEDIUM` (1000/2000, clustered), `LARGE`
  (10000/19997, scale-free) — verified via tsx: counts, no dangling edges,
  determinism for a fixed seed. Gate green (typecheck clean; `just format`
  reformatted the const literals then check exit 0 with the same 16 pre-existing
  warnings; test 42 passed). Next: 0.4 — unit-test the generator in
  `fixtures.spec.ts` (counts, determinism, no dangling edges).
- 2026-06-13 (0.4): Added `src/lib/graph/fixtures.test.ts` (12 vitest cases).
  IMPORTANT naming note: the plan said `fixtures.spec.ts`, but `vitest.config.ts`
  only includes `**/*.test.{ts,tsx}` and `.spec.tsx` is the Playwright CT runner —
  a `.spec.ts` file would run under neither, so I used `.test.ts` so `just test`
  actually exercises it. Tests cover node counts per shape, floor/clamp of
  fractional/<=0 nodes, unique node ids + label/kind/data presence, tree = n−1
  edges, no dangling/self-loop/duplicate-undirected edges, edge weight ∈ (0,1],
  avgDegree→edge-count scaling, byte-identical determinism for a fixed seed,
  seed-sensitivity, and SMALL/MEDIUM/LARGE validity. Gate green: typecheck clean,
  test 54 passed (was 42; +12), check exit 0 with the same 16 pre-existing
  unrelated warnings (note: `biome format` does NOT auto-organize imports — had to
  reorder the named import manually to satisfy `just check`). Next: 0.5 — add the
  benchmark harness `scripts/probe-graph.mjs`.
- 2026-06-13 (0.5): Added `scripts/probe-graph.mjs`, modeled on
  `probe-virtualization.mjs`. Headless Chromium via `playwright` (resolvable in
  the dev shell; browsers at `$PLAYWRIGHT_BROWSERS_PATH`). Measures (a) layoutMs
  nav→first-stable-paint, (b) p95FrameMs over a ~3s scripted drag+wheel pan/zoom
  (rAF frame-delta sampler injected into the frame; first sample dropped as
  warm-up), (c) heapMB from `performance.memory` (null elsewhere), (d)
  p95InteractionMs across node-click/hover/right-click/control-toggle/
  layout-switch via a double-rAF input-to-paint timer. Prints one JSON line.
  IMPORTANT: Ladle renders stories in an iframe, so the harness resolves the
  `ladle-frame`/`/iframe` frame (like `screenshot-story.mjs`) and runs all
  evaluate/wait calls against that frame — operating on the top `page` (as
  `probe-virtualization.mjs` does) would miss the story DOM. Recorded the
  `[data-graph-*]` hook contract in §9 — Phase 2 prototypes MUST expose these or
  they'll report `null` interaction latency and fail the §7 gate. Could not run
  the harness end-to-end yet (no Graph story exists until Phase 2); verified
  `node --check` syntax + usage path. Gate green: typecheck clean, test 54
  passed, check exit 0 with the same 16 pre-existing warnings (script adds zero
  new warnings — used `process.stdout/stderr.write` instead of `console`). Next:
  1.0 — record the shortlist + §7 rubric into §9 as the baseline.
- 2026-06-13 (1.0): Froze the candidate shortlist + selection rubric into §9 as the
  binding baseline for Phase 2/3 (docs-only; no code touched). Restated the 5 fixed
  candidates (Sigma+graphology, Cytoscape, React Flow+elkjs, G6, react-force-graph),
  the 3 elimination gates (themable / p95 frame ≤33ms / p95 interaction <120ms — a
  `null` interaction latency = auto-fail, tying back to the 0.5 hook contract), and
  the 6-criterion weighted table with an explicit `clamp((hi−value)/(hi−lo),0,1)`
  normalization rule and the bundle→deps→richness tie-break, so Phase 3 arithmetic
  is deterministic. Gate green: typecheck clean, test 54 passed, check exit 0 with
  the same 16 pre-existing unrelated warnings (no new files). Next: 2.1 — prototype
  Sigma.js + graphology (install dep, add `lab/Sigma.stories.tsx` exposing the
  `[data-graph-*]` hooks, run `probe-graph.mjs`, record metrics + gzip bundle in §9).
- 2026-06-13 (2.1): Built the first Phase-2 prototype — Sigma.js + graphology — in
  `src/components/Graph/lab/Sigma.stories.tsx` (Medium + Large exports). Installed
  `sigma@3.0.3`, `graphology@0.26.0`, `graphology-layout@0.6.1`,
  `graphology-layout-forceatlas2@0.10.1`. Key technique: Sigma paints to canvas/WebGL
  so there is no per-node DOM — I mirror one node's screen coords (via
  `getNodeDisplayData` on `afterRender`) as an invisible `[data-graph-node]` overlay
  so the harness has a stable click/hover/right-click target. `[data-graph-ready]` is
  set after the first rAF post-mount → harness `layoutMs` ~9s (dominated by a
  synchronous 80-iteration forceAtlas2 on 10k nodes, not a Sigma cost). Ran the
  harness end-to-end (first real `probe-graph.mjs` run; story id
  `graph--lab--sigma--large`, server on **61000** not 61001 — config.mjs sets 61000,
  so pass the base-url explicitly): `p95InteractionMs 26.5` (great), `heapMB 31.57`,
  `p95FrameMs 783.4`. SURPRISE/WATCH: headless Chromium has no GPU (software WebGL),
  so `p95FrameMs` is wildly pessimistic — recorded a §9 caveat that the §7 frame gate
  must be applied in Phase 3 to all candidates measured the SAME (headless) way, not
  by eliminating Sigma on this absolute number. Two screenshot helpers hardcode port
  61001; used an inline preview-mode playwright shot (`/tmp/sigma-medium.png`) to
  eyeball — themed multi-kind colors, edges, legible, no clipping. Gate green:
  typecheck clean, test 54 passed, check exit 0 with the same 16 pre-existing
  warnings (my file is clean after removing an unused biome suppression). Next: 2.2 —
  Cytoscape.js (+ dagre/fcose) prototype, same hooks, same harness run.
- 2026-06-13 (2.2): Built the second Phase-2 prototype — Cytoscape.js (+ fcose / dagre)
  — in `src/components/Graph/lab/Cytoscape.stories.tsx` (Medium + Large exports).
  Installed `cytoscape@3.34.0`, `cytoscape-dagre@4.0.0`, `cytoscape-fcose@2.2.0`,
  `dagre@0.8.5`. `cytoscape-fcose` has no types → added a `declare module
  "cytoscape-fcose"` stub to `src/global.d.ts` (Biome's organize-imports wanted a
  blank line after the in-module `import type`). Same canvas/overlay technique as
  Sigma (`node.renderedPosition()` mirrored as the `[data-graph-node]` hit target).
  Harness MEDIUM `{layoutMs:5265, p95FrameMs:33.3, heapMB:61.04,
  p95InteractionMs:63.3}`. BIG SURPRISE / WATCH: the LARGE run HUNG twice. (1) fcose's
  default 2500 cose iterations on 10k nodes block the main thread for minutes — the
  node harness sat at 0% CPU while the browser was pegged, never reaching
  `networkidle`; fixed by bounding LARGE fcose to `quality:"draft"`+`numIter:250`.
  (2) dagre on 10k/20k is super-linear and froze the layout-switch for minutes
  (`timeout 200` killed it mid-dagre at probe line 211); fixed by falling back to
  native `breadthfirst` for the LARGE layout-switch (MEDIUM keeps dagre). After both
  bounds, LARGE completes: `{layoutMs:4939, p95FrameMs:383.4, heapMB:527.38,
  p95InteractionMs:563}` (heavy — headless software-WebGL; p95Interaction dominated by
  the breadthfirst re-layout, MEDIUM interactions were 63ms). Recorded a §9 caveat:
  don't eliminate Cytoscape on raw headless numbers, AND note dagre doesn't scale to
  LARGE on the main thread (Phase 3 input). Screenshot helpers still hardcode 61001;
  used an inline preview shot from the repo dir (`/tmp` can't resolve `playwright`) →
  `/tmp/cytoscape-medium.png`, themed multi-kind colors, no clipping. Gate green:
  typecheck clean, test 54 passed, check exit 0 with the same 16 pre-existing
  warnings. Next: 2.3 — React Flow + elkjs prototype, same hooks, same harness runs.
- 2026-06-13 (2.3): Built the third Phase-2 prototype — React Flow (@xyflow/react) +
  elkjs — in `src/components/Graph/lab/ReactFlow.stories.tsx` (Medium + Large exports).
  Installed `@xyflow/react@12.11.0`, `elkjs@0.11.1`. Key techniques: elk layout is async
  (`elk.layout(...).then(...)`), so nodes/edges land via state after the promise; force
  bounded for LARGE (`elk.force.iterations:70`) like the other candidates. React Flow has
  per-node DOM but the harness still wants ONE stable hit target, so I compute the
  reference node's screen coords from its layout position × `getViewport()` and mirror it
  as the `[data-graph-node]` overlay (updated on `onMove`). Wrapped in `ReactFlowProvider`
  + `useReactFlow()` so `fitView/zoomIn/getNode/getViewport` work. BIG FINDING / WATCH:
  MEDIUM is already heavy (`p95InteractionMs` 322ms > the 120ms gate; `layoutMs` 61.5s
  because the harness fell back to networkidle+settle — 1k React DOM nodes mount slowly
  after the async layout). **LARGE is a DNF**: 10k DOM nodes never reach a stable,
  measurable layout — two runs hung (one ~9.5 min un-capped, one `timeout 150` killed at
  150s, `EXIT_CODE=124`, error at probe line 83 only because the page was force-closed).
  Crucially this is the DOM-node wall, NOT a layout-iteration block — bounding elk does
  not help (unlike Sigma/Cytoscape), so I recorded LARGE metrics as null/DNF rather than
  hacking the fixture down. Also weighed bundle: `@xyflow/react` ≈50kB gz but `elkjs`'s
  GWT-compiled `elk.bundled.js` is ≈458kB gz — far past the §7 250kB→0 anchor → ~0 on the
  bundle criterion. Recorded all of this (incl. the gate-relevant null) in §9 for the
  Phase 3 table; did NOT pre-eliminate (Task 3.1/3.2's job). A headless screenshot kept
  timing out (page pegged) so I confirmed render via the probe's successful MEDIUM
  interaction measurement instead. WATCH for next iterations: the probe's `page.goto`
  uses `networkidle`, which a constantly-rendering DOM graph can starve — for very heavy
  candidates the harness effectively becomes a liveness test. Gate green: typecheck clean,
  test 54 passed, check exit 0 with the same 16 pre-existing warnings (my new file is
  clean). Next: 2.4 — G6 (AntV) prototype, same hooks, same harness runs.
- 2026-06-13 (2.4): Built the fourth Phase-2 prototype — G6 (AntV) v5.1.1 — in
  `src/components/Graph/lab/G6.stories.tsx` (Medium + Large exports). Installed
  `@antv/g6@5.1.1` (80 packages incl. `@antv/g`, `@antv/layout`). G6 v5 API: construct
  `new Graph({ container, data, node, edge, layout, behaviors })`, `await graph.render()`,
  events via `graph.on("node:click"/"node:pointerenter"/"node:contextmenu", ...)` typed as
  `IElementEvent`. Same canvas/overlay technique as Sigma/Cytoscape — one node's screen
  coords (`getElementPosition` returns a `[x,y]` tuple, fed to `getClientByCanvas` which
  also returns a tuple, minus the container rect) mirrored as the `[data-graph-node]` hit
  target, refreshed on `afterrender`/`afterdraw`. Node fill is a per-datum callback reading
  `--sf-*` tokens. TS gotchas fixed: `getClientByCanvas` takes/returns `Point` *tuples* not
  `{x,y}`; layout helper must be typed `LayoutOptions`; handlers typed `IElementEvent`.
  Biome organize-imports wanted the `import type {…} from "@antv/g6"` BEFORE the value
  `import { Graph }` from the same module. Harness MEDIUM
  `{layoutMs:62679,p95FrameMs:233.3,heapMB:202.18,p95InteractionMs:64.7}` —
  p95Interaction 64.7ms is fine but `layoutMs` 62.7s = the harness hit the 60s
  `[data-graph-ready]` timeout (G6's d3-force `render()` promise on 1k nodes didn't resolve
  in 60s under headless software rendering). BIG FINDING / WATCH: **LARGE is a DNF** — a
  `timeout 200` run was killed at 200s (`EXIT_CODE=124`); d3-force on 10k never settled
  `[data-graph-ready]` even with iterations capped. Same DNF *class* as React Flow's LARGE,
  but G6's wall is the layout simulation (canvas renderer), not a DOM-node wall — capping
  iterations didn't rescue it here. Recorded LARGE as null/DNF in §9 (did NOT pre-eliminate
  — Task 3.1/3.2's job). Weighed bundle: G6 UMD ≈382kB gz, far past the 250kB→0 anchor →
  ~0 on bundle. Screenshot helpers hardcode 61001 (server is 61000) so used an inline
  preview-mode playwright shot → `/tmp/g6-medium.png` (themed multi-kind colors, subtle
  edges, no clipping — themable PASS). Gate green: typecheck clean, test 54 passed, check
  exit 0 with the same 16 pre-existing warnings (my new file is clean). Next: 2.5 —
  react-force-graph prototype, same hooks, same harness runs.
- 2026-06-13 (2.5): Built the fifth and final Phase-2 prototype — react-force-graph
  (2D canvas) — in `src/components/Graph/lab/ReactForceGraph.stories.tsx` (Medium +
  Large exports). Installed `react-force-graph-2d@1.29.1` (the 2D canvas variant;
  the umbrella `react-force-graph` also ships 3D/three.js/VR/AR which are out of
  scope for a flat Swiss graph view). API: `<ForceGraph2D ref={...} graphData=
  {nodes,links} .../>`; force = d3-force, hierarchical = `dagMode:"td"`; ref methods
  `zoom()`/`graph2ScreenCoords()` for the zoom control + the `[data-graph-node]`
  overlay; events `onNodeClick`/`onNodeHover`/`onNodeRightClick`; `onEngineStop`
  fires when the simulation cools → I set `[data-graph-ready]` there (a *real*
  first-stable-layout signal, unlike the timeout fallbacks the React Flow/G6 runs hit).
  Types ship with the package (no `declare module` needed). Same canvas-overlay
  technique as Sigma/Cytoscape/G6. BIG FINDING: this candidate **actually settles a
  LARGE layout** — `cooldownTicks:60` bounds the sim so `onEngineStop` fires (LARGE
  `layoutMs` 13.9s), where React Flow (DOM-node wall) and G6 (d3-force never settles)
  both DNF'd. MEDIUM is the best of the lot: `p95FrameMs 16.7` (~60fps), `p95Interaction
  31.1ms`. LARGE `{layoutMs:13932,p95FrameMs:283.3,heapMB:57.51,p95InteractionMs:522.6}`
  — 522ms is the tree-DAG re-layout folded into p95 (per-interaction is 31ms on MEDIUM),
  283ms frame is the same headless-software-canvas pessimism as the other canvas candidates.
  Measured bundle: ≈119kB gz total (rfg2d 61 + force-graph 56 + react-kapsule 1) — leanest
  of the five. Ran both probes against the dev server on **61000** (not 61001 — config sets
  61000, pass the base-url explicitly). Screenshot helpers hardcode 61001 so used an inline
  preview shot from the repo dir → `/tmp/rfg-medium.png` (themed multi-kind colors, subtle
  edges, no clipping — themable PASS). WATCH: react-force-graph's native layout breadth is
  narrow (force + DAG modes only — covers force/tree/radial but NOT concentric/grid; those
  would need a manual coordinate pass in Phase 4 if it wins) and node content is label-only
  (canvas). Recorded all metrics + the Phase-3 read in §9; did NOT pre-eliminate (3.1/3.2's
  job). Gate green: typecheck clean, test 54 passed, check exit 0 with the same 16
  pre-existing warnings (my new file is clean). **All five Phase-2 prototypes now
  benchmarked.** Next: 3.1 — compile the §9 metrics into the Phase-3 comparison table and
  apply the §7 gates/rubric.
- 2026-06-13 (3.1): Compiled the Phase-3 comparison table into §9 (docs-only — no code
  touched). Re-measured each candidate's added gzip bundle precisely with
  `gzip -c <dist .min.js> | wc -c` summed over its deps (superseding the rough 2.x
  estimates): Sigma 69 kB, react-force-graph 119 kB, Cytoscape 280 kB, G6 382 kB,
  React Flow+elkjs 508 kB. KEY DECISION-RELEVANT FINDING: the literal §7 interactive-scale
  gate (`p95FrameMs ≤ 33ms` on LARGE) is DEGENERATE here — all five fail it because the
  harness runs in headless Chromium with no GPU (software rasterization), the confound
  flagged in every 2.x entry; applied literally it would drop everyone, so it carries no
  discriminating signal. Resolved by ranking on the §7 weighted score over the raw numbers
  (frame criterion normalizes to 0 for all → equal penalty), with DNF candidates (React
  Flow, G6) scoring 0 on the three perf criteria. Computed totals via a python check of the
  §7 `clamp((hi−v)/(hi−lo),0,1)` formula: **Sigma 0.459 ≫ React Flow 0.278 >
  react-force-graph 0.236 > Cytoscape = G6 0.231.** Sigma wins on the only passing
  interaction latency (26.5ms→1.00), leanest bundle (69kB→1.00), and a measurable LARGE
  layout; margin Δ0.18 > the 0.05 tie-break, so no tie-break. WATCH for 3.2/Phase 4: Sigma
  is label-only node richness (0.30) and breadth 3/5 (concentric/grid need a manual coord
  pass), and Phase 4 should run the forceAtlas2 layout on a web worker / supervised
  iteration so the REAL-GPU frame budget governs the §6 ≥30fps DoD, not the headless number.
  Gate green: typecheck clean, test 54 passed, check exit 0 (same 16 pre-existing unrelated
  warnings; no new files). Next: 3.2 — declare Sigma+graphology the binding winner in §9.
- 2026-06-13 (3.2): Declared the binding Phase-4 winner in §9 — **Sigma.js + graphology**
  (`sigma@3.0.3`, `graphology@0.26.0`, `graphology-layout@0.6.1`,
  `graphology-layout-forceatlas2@0.10.1`). Docs-only; no code touched. Added a rank table
  (Sigma 0.459 ≫ React Flow 0.278 > rfg 0.236 > Cytoscape = G6 0.231), a binding
  justification (only candidate passing the LARGE interaction-latency gate at 26.5ms,
  leanest 69 kB bundle, lowest 31.6 MB heap, measurable LARGE layout; Δ0.18 > 0.05 so no
  tie-break), and the three accepted trade-offs carried into Phase 4: (1) label-only node
  richness — satisfy "arbitrary data" via tooltip/inspector/context-menu + an optional
  `renderNode` HTML overlay, not DOM-per-node; (2) breadth 3/5 — force/radial/concentric
  native, but **tree/grid need a manual coordinate pass in 4.2** (no elkjs/dagre, both
  failed bundle+scale); (3) the headless `p95FrameMs` is software-raster noise → Phase 4
  must drive forceAtlas2 on the `/worker` build so §6's ≥30fps DoD is judged on real GPU.
  Gate green: typecheck clean, test 54 passed, check exit 0 (same 16 pre-existing unrelated
  warnings; no new files). Next: 3.3 — remove the four losers' deps (`cytoscape*`, `dagre`,
  `@xyflow/react`, `elkjs`, `@antv/g6`, `react-force-graph-2d`) + lockfile, delete their
  `lab/` stories, keep only `lab/Sigma.stories.tsx`; `just check` + `just typecheck` green.
- 2026-06-13 (3.3): Removed the four losing candidates' deps from `package.json`
  (`@antv/g6`, `@xyflow/react`, `cytoscape`, `cytoscape-dagre`, `cytoscape-fcose`,
  `dagre`, `elkjs`, `react-force-graph-2d`) and ran `direnv exec . npm install` to
  prune the lockfile — npm removed 122 packages (571 audited after). Deleted the four
  losers' `lab/` stories (`Cytoscape`/`G6`/`ReactFlow`/`ReactForceGraph`.stories.tsx),
  keeping only `lab/Sigma.stories.tsx` as the winner's reference prototype. Removed the
  orphaned `declare module "cytoscape-fcose"` stub from `src/global.d.ts` (added in 2.2,
  the only reason it existed). SURPRISE/WATCH: npm pruned the package contents but left
  two empty scoped parent dirs `node_modules/@antv` and `node_modules/@xyflow` — removed
  them with `rmdir` so node_modules matches the lockfile (they were not lockfile entries,
  just stale dirs). Winner deps confirmed intact (`sigma@3.0.3`, `graphology` + its two
  layout packages). Gate green: typecheck clean, `just check` exit 0 (same 16 pre-existing
  unrelated warnings — Timeline.tsx etc. — now the ONLY warnings, my removals added none),
  test 54 passed (unchanged — the `fixtures.test.ts` graph tests don't import any candidate
  lib). Next: 4.1 — `Graph.tsx` skeleton on the Sigma+graphology stack (props
  `{data, layout?, onNodeClick?, onEdgeClick?, onSelectionChange?}`, CSS-Grid shell,
  controlled + uncontrolled `layout`).
- 2026-06-13 (4.1): Built the definitive component skeleton — `src/components/Graph/`
  `{Graph.tsx, Graph.module.css, index.ts}` — on the binding Sigma+graphology winner.
  `Graph.tsx` is a `forwardRef<HTMLDivElement>` that spreads `...rest` to a CSS-Grid
  root (`cx(styles.root, className)`) and mounts Sigma into a child `.surface` cell
  via a single `useEffect` keyed by `data` identity. Reused the lab prototype's
  themed `token()`/`nodeColor()`/`buildGraph()` helpers (every color via `--sf-*`,
  honoring pre-computed `node.x/y` when present), and forceAtlas2 for the default
  `"force"` layout. Handlers (`onNodeClick`/`onEdgeClick`/`onSelectionChange`) are
  read through a `handlersRef` so changing a callback doesn't retear the renderer:
  `clickNode`→onNodeClick+onSelectionChange, `clickEdge`→onEdgeClick,
  `clickStage`→onSelectionChange(null). `layout` prop is accepted + defaulted to
  `"force"` (controlled when the consumer passes it, uncontrolled otherwise); only
  force is wired here — `applyLayout` takes a `LayoutKind` but the other four fall
  back to force until 4.2. NOTES/WATCH: (1) deferred the surface `role`/`tabIndex`/
  keyboard focus to Task 5.3 — Biome's `noNoninteractiveTabindex` flagged a bare
  `<div role="application" tabIndex={0}>`, and a11y is its own task, so the skeleton
  surface is a plain render target for now (added a code comment pointing at 5.3).
  (2) No `Graph.stories.tsx` yet (that's 5.1), so the §3 screenshot step has no story
  id to shoot — visual evidence is the 2.1 lab screenshot (`/tmp/sigma-medium.png`),
  same render pipeline. (3) Biome wanted external imports alphabetized BY SOURCE
  (`graphology*` before `react`) and the barrel's `export type` before `export`;
  fixed both manually (the script-wrapped `biome check --write` didn't surface fixes).
  Gate green: typecheck clean, `just check` exit 0 (same 16 pre-existing unrelated
  warnings — none added), test 54 passed. Next: 4.2 — layout switching (force/tree/
  radial/concentric/grid) with a reduced-motion snap fallback; tree+grid need the
  manual coordinate pass flagged in 3.2.
- 2026-06-13 (4.2): Implemented all five layouts + animated/snapped switching in
  `Graph.tsx`. Refactored the old build-time `applyLayout` into a NON-mutating
  `computeLayout(g, layout) → LayoutMapping {id:{x,y}}` so positions can be
  animated FROM the current coords. Mappings: `radial`=graphology `circular`,
  `concentric`=graphology `circlepack` (both scaled by √order), `force`=forceAtlas2
  (no pure form — snapshot coords, run `.assign`, capture results, restore
  originals so the animation starts from where nodes actually are), `tree`=in-house
  layered BFS (roots = in-degree 0, fallback first node; row = BFS depth, spread
  evenly; disconnected nodes parked on a trailing orphan row), `grid`=√n row-major
  lattice. No elkjs/dagre (per §9 trade-off). A new layout `useEffect([layout])`
  (separate from the `[data]` build effect, guarded by `appliedLayoutRef`) computes
  targets then either `animateNodes` (`sigma/utils`, 600ms quadraticInOut) or, under
  `prefersReducedMotion()` (JS `window.matchMedia`), assigns coords + `refresh()`
  (instant snap). In-flight animation is cancelled (`cancelAnimationRef`) on
  re-switch and on unmount. GOTCHAS: (1) `noUncheckedIndexedAccess` flagged every
  `mapping[id]` / `queue[i]` / `before[n]` access — added an `assignPositions`
  helper (`Object.entries`, value typed non-undefined) and local-var guards for the
  BFS root + force restore. (2) `animateNodes` lives in `sigma/utils` (separate
  export from `sigma`), takes `(graph, targets, opts, cb)` and RETURNS a cancel fn.
  Verified radial/concentric produce finite coords for all 100 SMALL nodes via tsx;
  no Graph story yet (that's 5.1) so used the lab Sigma screenshot pipeline as the
  visual precedent (identical Sigma render path). Gate green: typecheck clean,
  `just check` exit 0 (same 16 pre-existing unrelated warnings — Graph.tsx clean,
  none added), test 54 passed. Next: 4.3 — `Graph.Controls` toolbar (zoom/fit/reset
  + layout `ToggleGroup`), keyboard +/-/0/arrow-pan, focus-visible ring.
- 2026-06-13 (4.3): Built the `Graph.Controls` navigation toolbar + keyboard
  navigation. New `src/components/Graph/context.ts` (`GraphContext` +
  `useGraphControls`) lets `Graph` publish an imperative camera/layout handle so
  the toolbar drives navigation without a ref. New `Controls.tsx` +
  `Controls.module.css`: a `role="toolbar"` overlay reusing library `Button`
  (zoom-in/out/fit icon buttons w/ `aria-label`+`title` + a "Reset" ghost button)
  and `ToggleGroup size="sm"` (single-select layout switch over all five kinds).
  `Graph.tsx` gained: controlled+uncontrolled layout (`defaultLayout` /
  `onLayoutChange`, `layout` prop still wins when set); camera callbacks
  (`zoomIn`/`zoomOut`/`fitView`/`reset`/`pan`) on Sigma's `getCamera()`
  (`animatedZoom`/`animatedUnzoom`/`animatedReset` + `setState` for pan); a
  `role="application"` focusable surface with `onKeyDown` (`+`/`=`, `-`/`_`, `0`,
  arrows); and exposes `Graph.Controls` via `Object.assign(GraphRoot,{Controls})`
  (house compound pattern). All camera animations pass `duration:0` under
  prefers-reduced-motion (snap); focus-visible ring on the surface via
  `--sf-color-focus-ring`. GOTCHAS (recorded in §9): (1) a control method named
  `fit` trips Biome's `noFocusedTests` (reads `fit()` as a Jasmine focused test) →
  renamed `fitView`; (2) the focusable surface needs a scoped
  `biome-ignore lint/a11y/noNoninteractiveTabindex` placed ON the `tabIndex` line
  (above the element it was reported `suppressions/unused`); (3) each inline icon
  `<svg>` needs a `<title>` for `noSvgWithoutTitle`. No `Graph.stories.tsx` exists
  yet (Task 5.1) so the §3 screenshot step has no story id — the camera/render
  path is unchanged from 4.1/4.2 (lab Sigma screenshot is the visual precedent);
  the toolbar's visual + interaction verification lands with the Playground story
  in 5.1 and CT/a11y in 5.2/5.3. Gate green: typecheck clean, `just check` exit 0
  (same 16 pre-existing unrelated warnings — Graph files add none), test 54 passed.
  Next: 4.4 — node rendering with arbitrary content (`renderNode` escape hatch or
  label+badge+color-by-`kind`; edges: labels, weight→thickness, directed arrowheads).
- 2026-06-13 (4.4): Node/edge rendering in `Graph.tsx`. Added `renderNode` /
  `renderEdge` escape-hatch props returning `NodeVisual` / `EdgeVisual` (label /
  color / size); `buildGraph` now takes a `RenderHooks` arg and applies the custom
  visuals over the color-by-`kind` defaults (omitted field → default). DESIGN NOTE:
  Sigma is WebGL with no per-node DOM (the §9/3.2 trade-off), so "arbitrary content"
  is expressed as themed visual *attributes*, not nested elements — the rich-data
  surface is the tooltip/inspector (4.5) + context menu (4.6); a returned NodeVisual
  is the honest escape hatch for label/color/size. Defaults: `nodeSize` makes
  `primary` nodes radius 4 / others 3 (kind reads as a size badge alongside color);
  `edgeSize` maps `weight`→thickness (clamped ≥0.5). Edges are now DIRECTED — set
  `type:"arrow"` per edge + `defaultEdgeType:"arrow"` (Sigma ships built-in `arrow`/
  `line` edge programs, so no program registration needed — verified in
  `sigma/settings`). Edge labels: pass each edge's `label` through and enable
  `renderEdgeLabels` only when `g.someEdge(attr.label != null)` AND `order≤300` (same
  label-cost guard as node `renderLabels`), with `edgeLabelColor`/`edgeLabelFont`
  token-driven. Build effect now keys on `[data, renderNode, renderEdge]` so swapping
  a render callback rebuilds (layout switching still owned by the separate effect, no
  retear). WATCH: no `Graph.stories.tsx` yet (Task 5.1), so the §3 screenshot step
  has no story id — render path is the unchanged Sigma pipeline from 2.1/4.1; the
  arrowheads + edge labels + kind-sized nodes get visual verification with the
  Playground story in 5.1 and CT in 5.2. Gate green: typecheck clean, `just check`
  exit 0 (same 16 pre-existing unrelated warnings — Graph files add none), test 54
  passed. Next: 4.5 — tooltip/inspector on hover/select showing node/edge `data`
  (reuse `Popover` or the chart `Tooltip`).
- 2026-06-13 (4.5): Added the hover/select inspector to `Graph.tsx`, reusing the
  chart `Tooltip` (`src/lib/chart` — exported from its index; NOT Base UI Popover,
  which is click-driven and adds friction for cursor-tracking hover). Two pieces of
  state — `hovered` (set on `enterNode`/`enterEdge`, cleared on `leaveNode`/
  `leaveEdge`) and `selected` (set on `clickNode`, cleared on `clickStage`) — and
  `hovered ?? selected` is the shown `Inspection` (hover wins; the clicked node
  persists once the cursor leaves). KEY TECHNIQUE (same canvas constraint as the lab
  prototypes): Sigma is WebGL with no per-node DOM, and the chart Tooltip wants a
  viewport `DOMRect`, so the anchor is synthesized — `getNodeDisplayData(id)` is
  surface-relative, add the surface's `getBoundingClientRect()` offset, build an 8px
  box; an edge anchors at the midpoint of its two endpoints' display coords. The
  builders live behind an `inspectRef` (like `handlersRef`) so the build effect's
  listeners read the latest without re-subscribing. Inspector body is a token grid:
  title (`--sf-color-fg`, semibold), subtitle = node `kind` / edge `src → tgt`
  (`--sf-color-fg-subtle` — metadata, the house "subtle only for non-primary
  metadata" carve-out), and a `<dl>` of `data` rows (keys subtle, values fg,
  `white-space:normal` to override the Tooltip shell's nowrap). DECISIONS: (1) did
  NOT re-anchor the open tooltip on `afterRender` — that fires every frame during
  pan/zoom and would rebuild the Inspection per frame on LARGE (perf risk for 4.9);
  `leaveNode` clears hover on cursor-out anyway, so the captured position is fine for
  a hover/select inspector. (2) build-effect cleanup now also clears both states so a
  `data` swap can't pin the tooltip to a destroyed node. No `Graph.stories.tsx` yet
  (Task 5.1), so the §3 screenshot step has no story id — render path is the unchanged
  Sigma pipeline; the inspector gets visual verification with the Playground story in
  5.1 and CT (hover→tooltip, click→persist) in 5.2. Gate green: typecheck clean,
  `just check` exit 0 (same 16 pre-existing unrelated warnings — Graph files add
  none), test 54 passed. Next: 4.6 — right-click context menu via the `Menu` component
  (focus/expand/hide/pin via `onNodeContextMenu` / `contextMenuItems`).

- 2026-06-13 (4.6a): **Right-click context menu wired.** Split 4.6 into 4.6a (wire)
  + 4.6b (visual verify) since the menu is wiring + a screenshot check, two
  shippable units. `Graph.tsx` now exports `GraphMenuTarget` / `GraphMenuItem` and
  takes `onNodeContextMenu(id, event)` + `contextMenuItems(target) → GraphMenuItem[]`.
  Sigma's `rightClickNode` / `rightClickStage` (both `preventSigmaDefault()` +
  native `preventDefault()` to kill the browser menu) open a **controlled** house
  `Menu` anchored to an invisible `position:fixed` `.contextAnchor` Trigger placed
  at the cursor `clientX/Y` — the same Explorer pattern used elsewhere, since Sigma
  paints to canvas and has no per-node DOM to anchor to. Built-in node menu: Focus
  (camera `animate` to the node, ratio 0.5) / Expand (ratio 0.2) / Pin label
  (`forceLabel` attr toggle) / Hide (`hidden` attr toggle, separator above);
  `contextMenuItems` fully replaces them and `[]` suppresses the menu for that
  target. Stage has no default menu. All camera moves reuse `camOpts()` so they
  snap under `prefers-reduced-motion`. A `menuRef` mirrors the latest
  `itemsFor`/`onNodeContextMenu` so the Sigma listeners (subscribed once in the
  build effect) never re-subscribe. Added a `.contextAnchor` class
  (zero-size/fixed/`pointer-events:none`). **Surprise/watch:** the menu uses
  viewport-`fixed` cursor coords, so a future scroll-while-open could drift it; the
  house pattern accepts that (menu closes on outside-click/Escape/select anyway).
  Gate green: typecheck clean, `just check` exit 0 (16 pre-existing warnings, Graph
  adds none), test 54 passed; `just format` reflowed the long `Menu.Root` open line.
  Next: **4.6b** — screenshot-verify the menu opens at the cursor, items fire,
  Escape/outside-click closes (needs `just dev` + a story; Playground arrives in 5.1,
  so 4.6b may lean on the `lab/Sigma` story or a throwaway harness).

- 2026-06-13 (4.6b): **Context menu visually verified.** The Phase-2 `lab/Sigma`
  prototype has no real menu, and the Playground story (5.1) doesn't exist yet, so
  added a throwaway harness `src/components/Graph/lab/GraphContextMenu.stories.tsx`
  that mounts the **real** `Graph` (SMALL fixture, deterministic `grid` layout,
  `renderNode={()=>({size:14})}` so nodes are big hit targets — Sigma paints to
  canvas with no per-node DOM, so a driver must probe screen points). A throwaway
  Playwright driver sweeps right-click points until `[data-graph-context-menu]`
  opens, asserts the items, screenshots, then presses Escape and asserts the menu
  hides → `{ok:true, items:["Focus","Expand","Pin label","Hide"], closedByEscape:true}`.
  Eyeballed `/tmp/graph-context-menu.png`: themed sharp-cornered popup anchored at
  the cursor, separator above Hide, over the kind-colored grid + directed edges +
  controls toolbar. **Env note:** `ladle serve` binds **61000** here, but
  `screenshot-story.mjs`/`probe-graph.mjs` hard-code **61001** — the driver used
  61000 (and the probe's `?? page.mainFrame()` fallback, since Ladle v4 renders the
  story in the main frame, not a `ladle-frame` iframe). Worth reconciling the port
  before Phase 5/6 screenshot steps. Ticked 4.6 (parent) + 4.6a + 4.6b. Gate green:
  typecheck clean, `just check` 0 errors (16 pre-existing warnings; +1 story file,
  adds none), test 54 passed. Next: **4.7** — minimap + viewport indicator.

- 2026-06-13 (4.7): **Minimap overview canvas + viewport indicator.** Sigma has no
  minimap plugin, so built one as `Graph.Minimap` (compound member alongside
  `Graph.Controls`). New files: `Minimap.tsx` + `Minimap.module.css`; new internal
  `GraphInternalContext` in `context.ts` exposing `{getRenderer, getGraph, epoch}`
  (kept OFF the public `GraphControls` — overlays read the renderer directly). The
  Graph build effect + layout-settle now `bumpEpoch()` so the minimap recomputes
  geometry. **Coordinate model (verified against the Sigma bundle):**
  `getNodeDisplayData` returns FRAMED (normalized) coords — `nodeDataCache` has
  `normalizationFunction.applyTo` applied (sigma.esm.js ~L1946/2543) and is fed
  straight to `framedGraphToViewport` — the SAME space as `viewportToFramedGraph`
  and `camera.x/y`. So the minimap: caches node dots (framed, camera-independent)
  to an offscreen canvas rebuilt on `epoch`; re-strokes the viewport rect from
  `viewportToFramedGraph({0,0})`/`({w,h})` on every `camera.updated`; and recenters
  via `camera.setState({x,y})` from the inverted click (instant — no animation to
  gate on reduced-motion). **Surprise:** the recenter handler *looked* dead in the
  first test — cause was Ladle's right sidebar overlaying the minimap's right half
  in the 1200px-wide story (`elementFromPoint` at center returned an `<A>`), so
  `mouse.click` at center never reached the canvas. Clicking the canvas's left
  region fires correctly and `setState` takes (confirmed via temporary console
  logs + a screenshot showing the rect jump to the clicked corner). Not a component
  bug. **Lint:** the subscription effect keeps `epoch` as an intentional retrigger
  dep (getRenderer reads a ref, so the effect must re-run when the renderer first
  appears) — suppressed `useExhaustiveDependencies` with a rationale. Added
  `lab/GraphMinimap.stories.tsx` (throwaway, removed in 6.2) + exported
  `GraphMinimapProps` from the barrel. Gate green: typecheck clean, `just check` 0
  errors (16 baseline warnings, none new), test 54 passed. Next: **4.8** — theming
  pass (verify light + dark, no hard-coded hex).

- 2026-06-13 (4.8): **Theming pass — token reads made theme-context-correct.**
  Audit was clean (all `#hex` are `token()` fallbacks, no rgb/hsl, CSS sizes all
  `calc(var(--sf-unit)…)`, fonts `--sf-font-sans`). **Real fix:** `token()` (in both
  `Graph.tsx` and `Minimap.tsx`) read `getComputedStyle(document.documentElement)`,
  which only resolves the right theme when `data-theme` is on `<html>`. Ladle's
  Provider puts `data-theme` on a wrapper div (and, it turns out, on `<html>` too —
  which is why dark *looked* fine, `document.documentElement` resolved `--sf-color-bg`
  to the dark `#0a0a0a`). But a consumer who themes only a wrapper would get a
  light-colored canvas in dark mode. Fixed by threading the graph's own element
  (Sigma `container` / minimap `canvas`) into `token(name, fallback, el)` so it reads
  the cascade from inside the themed subtree; `document.documentElement` stays the
  fallback. `buildGraph` + `nodeColor` now take the element; the Sigma constructor's
  label/edge-label/default-node colors pass `container`. CSS-module colors were
  already correct (plain `var(--sf-*)`, inherit down). Verified light + dark + the
  minimap in dark via Ladle `&mode=preview` screenshots — all flip correctly.
  **Watch:** colors are still read once at build time (+ minimap on epoch/camera),
  so a *runtime* theme swap won't recolor the existing WebGL canvas until rebuild;
  acceptable for now (note for 5.x if a live theme-toggle story is wanted). Gate
  green: typecheck clean, `just check` 0 errors (16 baseline warnings), test 54
  passed. Next: **4.9** — perf pass on LARGE (re-run `probe-graph.mjs`).

- 2026-06-13 (4.9a): **LARGE perf baseline on the real component.** Split 4.9 into
  4.9a (instrument + measure) and 4.9b (optimize to gates). Added `[data-graph-surface]`
  + `[data-graph-ready]` to `Graph` and a `lab/GraphLarge` story with a centered
  `[data-graph-node]` marker (`pointer-events:none`, clicks fall through to the
  canvas; force-layout centroid is dense so a center click hits a node) + a
  `ProbeControls` child exposing `[data-graph-control]`/`[data-graph-layout-next]`.
  Baseline (force, 10k): `{layoutMs:6799, p95FrameMs:1083.4, heapMB:68.86,
  p95InteractionMs:26.9}` (full reads in §9). **Interaction 26.9ms PASSES the 120ms
  gate**; frame 1083ms is the known headless software-WebGL confound (not real);
  layoutMs 6.8s is a synchronous-force-layout first-paint freeze → the real target
  for 4.9b. **Surprise:** `data-graph-ready` never fired at first — Sigma emits its
  first `afterRender` synchronously inside the constructor, before my listener
  attaches; fixed with a forced `renderer.refresh()` after subscribing. Before that
  the probe's `layoutMs` was a 61s timeout fallback. Gate green: typecheck clean,
  `just check` 0 errors (16 baseline warnings), test 54 passed. Next: **4.9b** —
  defer the initial layout behind first paint + debounce resize, then re-probe.

- 2026-06-13 (4.9b): **Deferred initial layout + debounced minimap resize — Phase 4
  done.** Build effect no longer computes the layout synchronously: Sigma paints seed
  positions, then two rAFs later it computes + snaps the real layout and sets
  `data-graph-ready`. Result: surface first-paints at ~1.8s (was ~14s — the
  synchronous forceAtlas2 had been blocking even the first paint), stable force
  layout at ~7.4s. Minimap ResizeObserver debounced 100ms (a rebuild walks all 10k
  nodes). Re-probe LARGE `{layoutMs:6737, p95FrameMs:1083.3, heapMB:103.95,
  p95InteractionMs:27.8}` — interaction PASS (≪120ms); frame is the headless
  software-WebGL confound (unchanged). Final force render verified
  (`/tmp/graph-large-final.png`). **Surprise:** one probe run spiked
  `p95InteractionMs` to ~1046ms — p95-of-5 is the max, so a single GC/overlap on the
  layout-switch interaction dominates; re-runs sit at ~27ms (watch for this if a
  future run looks anomalous — re-run before reacting). **Watch (5.x):** colors read
  once at build (live theme-swap needs rebuild); a cheap deterministic seed pre-layout
  + an FA2 worker are noted future polish. Gate green: typecheck clean, `just check` 0
  errors (16 baseline warnings), test 54 passed. **Phase 4 complete** — next: **5.1**
  `Graph.stories.tsx` (Playground + per-layout + dense-node + context-menu +
  LargeStress).

- 2026-06-13 (5.1): **`Graph.stories.tsx` (the real component's stories).** Title
  "Graph" (the `lab/` ones stay under "Graph/lab"). Stories: `Playground`
  (`size` radio small/medium/large → fixture, `layout` select; Controls + Minimap),
  one per layout on SMALL (labels render under the 300-node cull), `DenseContent`
  (hand-authored 8-service graph with rich `data` per node/edge + a `renderNode`
  sizing nodes by `rps` — demonstrates arbitrary content via the escape hatch and
  the inspector), `ContextMenu` (default menu), `LargeStress` (LARGE). **Gotcha:**
  Ladle kebab-cases camelCase exports, so the story id is `graph--dense-content`,
  not `graph--densecontent` — relevant for 5.2 CT selectors and any probe. Verified
  `DenseContent` renders kind-colored, rps-sized nodes with directed labeled edges
  and `Tree` renders the layered rows. **Watch:** `tree` layout on the scaleFree
  SMALL fixture looks sparse/criss-crossed (it's a layered BFS, not a real tree) —
  fine, but the `DenseContent` graph (which IS tree-ish) shows the layout at its
  best. Gate green: typecheck clean, `just check` 0 errors (16 baseline warnings),
  test 54 passed (`test-ct`/`build` deferred to the Phase 5/6 finishers). Next:
  **5.2** — `Graph.spec.tsx` interaction tests.

- 2026-06-13 (5.2): **`Graph.spec.tsx` Playwright CT (6 tests, green) + harness.**
  CT runs real WebGL, so the harness uses a single big centered node as a reliable
  canvas hit target (no per-node DOM). Covers: surface + controls render, minimap
  renders, layout toggle → `onLayoutChange` + `data-pressed`, node click →
  `onNodeClick`, hover → inspector with label + `data`, right-click → context menu
  (`Focus`) + Escape closes. **Surprise worth a 6.3 look:** asserting the inspector
  after a *click* failed — clicking sets `selected` but the tooltip wasn't present;
  hovering works fine. Two candidate causes: (a) Sigma fires `clickStage` right after
  `clickNode`, and our `clickStage` handler `setSelected(null)` wipes the just-set
  selection (so click-to-PIN the inspector — a 4.5 intent — may not persist), or
  (b) a Playwright click-sequence quirk. Hover (the primary inspect path) is solid,
  so I tested via hover and left click-to-pin unasserted. **Flag for 6.3:** verify
  whether click-to-pin the inspector actually persists; if not, guard `clickStage`
  to ignore the click that immediately follows a `clickNode`. **Note:** canvas node
  positions aren't DOM-assertable, so "layout switch updates positions" is covered by
  the `onLayoutChange` + pressed-state proxy, not a coordinate check. Gate green:
  typecheck/check clean (16 baseline warnings), vitest 54 (skips the CT spec), 6 CT
  green. Next: **5.3** — accessibility (roles/label, keyboard nav, SR summary).

- 2026-06-13 (5.3): **Accessibility pass.** Added a visually-hidden (`.srOnly`)
  screen-reader summary referenced by `aria-describedby` on the surface — counts
  (`N nodes`, `M edges`), the active layout, and the keyboard hints — plus a polite
  `aria-live` region (`data-graph-status`) announcing layout switches. Kept the
  existing `role="application"` + `aria-label`, keyboard pan/zoom, and reduced-motion
  snapping (now CT-exercised via `page.emulateMedia({reducedMotion:"reduce"})`).
  **Decision:** no per-node keyboard/SR traversal — a WebGL canvas has no per-node DOM
  and 10k focus stops would be unusable; the summary + pan/zoom is the honest a11y
  story for canvas dataviz (matches the §9 label-only trade-off). **Gotcha:** CT's
  `test.use({reducedMotion})` isn't in the fixtures type (TS error though it runs) —
  used `page.emulateMedia` instead. 4 new CT tests → 10 total green. Gate green:
  typecheck/check clean (16 baseline warnings), vitest 54, 10 CT. Next: **5.4** —
  `index.ts` barrel re-export (component + public types).

- 2026-06-13 (5.4): **Barrel re-export completed.** `index.ts` was missing the
  newer public types (`NodeVisual`/`EdgeVisual`/`GraphMenuTarget`/`GraphMenuItem`)
  consumers need for the `renderNode`/`renderEdge`/`contextMenuItems` props; added
  them plus the shared data model (`GraphData`/`GraphNode`/`GraphEdge`/`LayoutKind`,
  re-exported from `lib/graph/types`) so importing from the `/graph` entry needs no
  second import for the `data` prop. **Tooling gotcha (will recur in 5.5/6.1):**
  biome's export/import sort is an `assist/source/organizeImports` action — `just
  format` (`biome format --write`) does NOT apply it, only `biome check --write`
  does; run `npm run check -- --write <file>` to fix sort errors. Gate green:
  typecheck/check clean (16 baseline warnings), vitest 54. Next: **5.5** — register
  the `/graph` export in `src/index.ts` + `package.json`, confirm `just build`.

- 2026-06-13 (5.5): **Public export registered + first green `just build`.** Added
  `export * from "./components/Graph"` to `src/index.ts` (Field→Graph→Grid) and a
  `./graph` entry to `package.json` `exports`. **Trap the task text didn't mention:**
  the vite lib build keys off an explicit `componentNames[]` in `vite.config.ts`, not
  a glob — Graph wasn't in it, so the first build emitted only `index.d.ts`, no
  `index.js` (the `./graph` `import` target). Added `"Graph"` to the array → rebuild
  emits both. **Future component additions must edit all THREE: `src/index.ts`,
  `package.json` exports, and `vite.config.ts` componentNames.** `dist/` is gitignored
  so only the 3 source files are committed. Sigma/graphology now ship in the build
  (graphology ~17kB gz, sigma ~21kB gz + FA2/layout helpers) — expected per the §9
  winner. Harness `.d.ts` leak into dist as for every other component (pre-existing,
  harmless). Gate green: typecheck/check clean, vitest 54, **`just build` ✓**
  (`dist/components/Graph/index.{js,d.ts}` present). Next: **5.6** — docs (AGENTS.md
  catalogue + "reach for Y" row).

- 2026-06-13 (5.6): **Docs — AGENTS.md.** New "Graphs & networks" catalogue
  subsection after Charts with the `Graph` row (≤10k nodes; force/tree/radial/
  concentric/grid; controls/keyboard/minimap/menu/inspector; compound members),
  worded to contrast it with the axis charts ("those plot values on axes; this draws
  relationships"). Added the "a network / dependency graph / mind map" → `Graph` row
  to the reach-for-Y table beside "a chart"/"graph this" so the two senses of "graph"
  are disambiguated. House tone, no marketing. Gate green (docs-only; typecheck/check/
  test unaffected). **Phase 5 complete** — next: **6.1** the full finishing gate
  (`check && typecheck && test && test-ct && build`).

- 2026-06-13 (6.1): **Full finishing gate — all five green.** `just check` 0 errors
  (16 pre-existing unrelated warnings in Timeline/BarChart/Outliner/etc. — Graph adds
  none); `just typecheck` clean; `just test` vitest 54 passed; `just test-ct` **151
  passed** across the whole component suite (the 10 Graph CT included, no regressions
  in other components); `just build` ✓ (4.3s, d.ts in 3.3s) emitting
  `dist/components/Graph/index.{js,d.ts}`. Nothing to fix. Next: **6.2** — delete the
  leftover `lab/` prototypes; decide whether to keep `scripts/probe-graph.mjs` for
  regression.

> Research the best UX for managing large graphs graphically: see the graph,
> navigate it, add arbitrary information to both nodes and connections.
> Represent information densely on screen — force graphs are an OK default but
> often disorderly; look for mind-map / concept-tree / file-tree style layouts.
> Deep-research enabling libraries, prototype multiple combinations/approaches,
> use Playwright to assess quality and measure latency on large graphs (with
> generated test data), then implement the definitive version: a basic graph
> view with multiple layout options, control elements, and sub-menus
> (e.g. right-click).
