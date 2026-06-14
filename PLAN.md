# PLAN — NonIdealState: performant dithered fills (renderer + effects)

> **This file is the single source of truth for an autonomous ralph loop.**
> Each iteration starts with **fresh context and no memory**. Everything you
> need is in this file. Read it top-to-bottom every time before doing anything.

---

## 0. Mission

`NonIdealState` already renders a sizable block continuously filled with
console-style dithered shade blocks (empty / no-results / error / loading),
with a message in the cleared center and a ripple on loading. It works, but:

1. The animated fill rebuilds a whole `<pre>` string every frame — **wasteful**.
   We want the **least computation / best performance** renderer, after
   honestly researching the options (incl. **canvas** and any libraries).
2. We want to **prototype multiple renderers and benchmark** them, then keep
   the one where the ripple is fastest.
3. The ripple (and other effects) must be **parameterizable**.
4. Add **more effects** — random noise, etc. — behind one effect API.
5. The blocks should be **more subtle** — gray / transparent is fine — and
   derived from **pre-defined base colors** (tokens), not loud saturated fills.
6. Fix the **coverage bug**: the fill doesn't reach the right/bottom edge of
   the block (see the white strip in the brief's screenshot). It must
   **auto-fill the entire block** at any size.

Root cause of #6 is known (see §9 D2): the cell grid is computed from a
hardcoded `CELL_W=7 / CELL_H=11` that mismatches the real monospace cell
(~6px at the 10px font), so too few columns are generated. A measured cell
fixes the DOM path; a canvas sized to the block fixes it by construction.

The path is: **harness + fix coverage → research → prototype a fixed set of
renderers → benchmark → auto-select the fastest → rebuild with parameterized
effects + subtle token-based color → test, document.**

---

## 1. Ralph loop protocol — READ FIRST, EVERY ITERATION

Do this, in order, every single iteration:

1. **Read this entire file**, including the **Decision log** (§9) and
   **Progress notes** (§10). They are how past-you talks to present-you.
2. **Confirm the working branch.** All work happens on `feat/non-ideal-state`.
   ```bash
   git rev-parse --abbrev-ref HEAD   # if not feat/non-ideal-state:
   git checkout feat/non-ideal-state 2>/dev/null || git checkout -b feat/non-ideal-state main
   ```
3. **Pick exactly ONE task** — the *first* unchecked `[ ]` checkbox in §5,
   reading top-to-bottom. Tasks are ordered; do not skip ahead. If a task
   has unchecked sub-tasks, the first unchecked sub-task is your task.
4. **Do only that one task.** Smallest correct, shippable change. Resist
   scope creep. If a task is too big, split it into 2–4 finer `[ ]`
   sub-tasks, then do the first.
5. **Verify** with the gate in §3. The gate must be green.
6. **If green:**
   - Tick the box `[ ]`→`[x]` and append `— <one-line what/why>`.
   - Add a dated bullet to **§10 Progress notes**.
   - Record any decision / benchmark number in **§9 Decision log**.
   - **Commit** (see §4). One task → one commit.
7. **If blocked / not green:** do **not** tick the box. Append
   `> BLOCKED: <reason + what you tried>` under the task and a §10 bullet;
   commit safe partial progress as `wip:` *only if it builds*, else revert.
   Then stop.
8. **Stop after one task.** The loop re-invokes you for the next.

**Hard rules**

- One task, one commit. Never batch unrelated tasks.
- Never work off `main`. Never `git push` (a human reviews/merges).
- Never delete or rewrite §0–§4, §6, §7, §8. You may tick boxes in §5,
  split tasks into sub-tasks, and append to §9/§10.
- **Prefer no new runtime dependency.** Raw Canvas 2D / WebGL over a library
  unless §2 research finds a *small, clearly-better* one — and even then,
  record the bundle cost in §9 and get the rubric (§7) to justify it.
- Keep the fill **decorative** (`aria-hidden`) and the message accessible.
  The component's public behavior must stay backward-compatible (props may be
  added; existing ones keep working).
- If every box in §5 is `[x]`, the project is done: append a final §10 note
  and stop.

---

## 2. Environment & how to run things

- **NixOS**: `node`/`npm` aren't on the bare PATH; this repo uses `direnv` +
  a flake. If `npm` is missing, the dev shell isn't active.
- **`just`** recipes: `just dev` (Ladle), `just check`, `just typecheck`,
  `just test` (vitest, `*.test.{ts,tsx}` only), `just test-ct` (Playwright CT,
  `*.spec.tsx`), `just build`.
- **Ladle serves on http://localhost:61000** (see `.ladle/config.mjs`). NOTE:
  the bundled `scripts/screenshot-story.mjs` still points at **:61001** — it is
  stale and must be fixed (Task 0.2) before screenshots work. Story id is the
  kebab-case `<file>--<export>` (e.g. `non-ideal-state--loading`); the story
  renders inside an iframe, and `?mode=preview` shows it bare.
- **Perf harness pattern**: model the new probe on `scripts/probe-graph.mjs`
  (headless Playwright that drives a story and measures via `performance` +
  `requestAnimationFrame`). It must report **sustained FPS**, **p95 JS
  frame time**, and **long-task / dropped-frame count** over a few seconds.
- **Reduced motion**: read `matchMedia("(prefers-reduced-motion: reduce)")`;
  animated effects must render a single static frame instead.
- **Canvas**: size the backing store to `cssWidth * devicePixelRatio` (and
  scale the context) or the fill will be blurry / mis-covered on HiDPI.

---

## 3. Verification gate (the change is only "green" if ALL pass)

Run, at minimum:

```bash
just typecheck      # no TS errors
just check          # Biome lint + format clean (run `just format` to fix)
just test           # vitest green
```

When the task changes **rendering / effects / animation**, **also**:

- Run the perf harness (Task 0.3) on the relevant story/size and record the
  JSON numbers in §9. A perf-sensitive task is only green if it meets the
  §7 target (sustained ≥ 55 fps at the M block, no long task > 50ms).
- `just dev` + screenshot the relevant story (fixed script from 0.2); eyeball:
  **the fill covers the entire block, every edge, at the tested size**; color
  is subtle/token-based; no overlap/clipping of the message; reduced-motion
  renders a clean static frame.

`just test-ct` and `just build` are required green for the **Phase 5/6**
finishing tasks, not every iteration.

---

## 4. Commit convention

```bash
git add -A
git commit -m "nis: <imperative summary of the one task>

<optional 1–3 line body: what & why>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Keep messages scoped to the single task. Do not push.

---

## 5. The plan (task checkboxes — tick as you complete)

> House rules (full: `AGENTS.md` + `AESTHETICS.md`): tokens not literals,
> CSS Grid for layout, `cx()`, sharp corners, **never grey body text** (the
> message; the *fill* may be grey/transparent — it's decorative), always a
> `prefers-reduced-motion` fallback, no new global color tokens, no
> utility-class libs, no emoji, prefer no new deps.

### Phase 0 — Setup, screenshot fix, perf harness, baseline

- [x] **0.1** Confirm branch `feat/non-ideal-state` (create off `main` if
      missing — the component already lives there). Baseline gate green. — on branch; baseline typecheck/check/test (63) green.
- [x] **0.2** Fix `scripts/screenshot-story.mjs` to target **:61000** (Ladle's
      configured port) instead of the stale :61001, so visual checks work.
      Verify by screenshotting `non-ideal-state--empty`.
- [x] **0.3** Add `scripts/probe-nonideal.mjs` (model on `probe-graph.mjs`): a
      headless Playwright harness that opens a NonIdealState story at a given
      block size, runs the animation ~4s, and prints one JSON line
      `{renderer, w, h, fps, p95FrameMs, longTasks}`. Drive it via story hooks
      (a `data-nis-*` attribute or a query param the lab stories read) so it
      can target a specific renderer + size.
- [x] **0.4** Record the **current** DOM-`<pre>` renderer's numbers at three
      block sizes — S `≈240×140`, M `≈520×300`, L `≈960×540` — into §9 as the
      baseline to beat.

### Phase 1 — Fix the coverage bug (correctness, renderer-agnostic)

- [x] **1.1** Replace the hardcoded `CELL_W/CELL_H` with a **measured** cell:
      render a probe row, read its rect, compute `cols/rows` so the field
      always **overfills by one cell and clips** — no gap on any edge. Verify
      by screenshotting at deliberately awkward sizes (e.g. width 333px,
      height 199px) in light **and** dark; the dither must reach all four
      edges. (Canvas later makes this exact by construction; this fixes the
      shipped DOM path now and gives a fair benchmark baseline.)

### Phase 2 — Research + renderer prototypes (fixed shortlist)

- [ ] **2.0** Research note → §9: search for libraries that render an animated
      dithered/ASCII *field* cheaply (e.g. three.js `AsciiEffect`, canvas
      image-dither libs, shader toys). Record what exists, bundle cost, and
      whether any fits (expectation per D3: image-dither libs are the wrong
      shape and `AsciiEffect`/three is too heavy — roll our own — but
      **confirm or refute**, don't assume).

The loop benchmarks exactly these renderers (bounded set → converges). Each
implements one shared field interface `intensity(x,y,t,params) → [0,1]` and a
shared ramp, in a throwaway `src/components/NonIdealState/lab/`:

1. **DOM `<pre>` string** (current, coverage-fixed) — baseline.
2. **Canvas 2D — filled rects.** One alpha-stepped rect per cell, **batched by
   ramp level** (group same-level cells, one fill per level) to cut draw calls.
   Block-sized canvas ⇒ exact coverage.
3. **Canvas 2D — `fillText`.** Draw the literal `░▒▓█` glyphs per cell (keeps
   the true console character look); measure the text-draw cost.
4. **WebGL fragment shader.** Compute intensity + Bayer threshold per cell on
   the GPU (raw WebGL, no lib if feasible). The performance ceiling.

- [ ] **2.1** Extract the field math into a shared, renderer-agnostic module
      (`fields.ts`): `ripple`, `noise`, `vignette` as pure
      `(x,y,t,params)→intensity`, plus the Bayer ramp mapping. Unit-test it.
- [ ] **2.2** Prototype renderer #1 (DOM `<pre>`, coverage-fixed) behind the
      shared interface as a lab story param. (May reuse current code.)
- [ ] **2.3** Prototype renderer #2 (Canvas 2D rects, batched) as a lab story.
- [ ] **2.4** Prototype renderer #3 (Canvas 2D `fillText`) as a lab story.
- [ ] **2.5** Prototype renderer #4 (WebGL shader) as a lab story. If WebGL
      proves disproportionately complex for the win, split into a spike and
      record the call in §9 rather than forcing it.

### Phase 3 — Benchmark + auto-select the renderer

- [ ] **3.1** Run `probe-nonideal` on every prototype at S/M/L; record all
      JSON rows in §9 (one table).
- [ ] **3.2** Apply the §7 rubric to pick the **winner**; record the winner +
      scores + rationale in §9. Must clear the hard gates (≥55fps@M, full
      coverage, supports subtle color + ≥2 effects).
- [ ] **3.3** Delete the losing prototypes' code (and any unused dep). Keep a
      minimal perf-regression lab story for the winner only.

### Phase 4 — Definitive renderer + parameterized effects + subtle color

- [ ] **4.1** Implement the winning renderer as the real `NonIdealState` fill,
      replacing the per-frame `<pre>` rewrite. Keep it `aria-hidden`, keep the
      message panel + variants, keep the vignette center-clear behavior.
- [ ] **4.2** Effects API: `effect?: "ripple" | "noise" | "vignette" | ...`
      (variant picks a sensible default — loading→ripple, others→vignette).
      Wire all effects through the shared `fields.ts`.
- [ ] **4.3** Parameterize the ripple: `{ speed, wavelength, amplitude,
      origin }` (typed). Sensible defaults; expose via a prop
      (e.g. `effectOptions`). Story shows live param control.
- [ ] **4.4** Add the **noise** effect: random per-cell density at a `rate`
      (flicker fps), seedable for determinism. Reduced-motion → static seed.
- [ ] **4.5** **Subtle, token-based color**: a `color` prop accepting a base
      (default a subtle token; `error`→`--sf-color-danger`) and render the
      ramp as **alpha steps** of that base (grey/transparent), so the fill
      reads as a faint texture, not a loud block. Theme-aware (light + dark).
      Re-screenshot — should be markedly subtler than the brief's screenshot.
- [ ] **4.6** Guarantee **full coverage** in the winning renderer (canvas
      sized to block × dpr, or measured-grid overfill) and pause work when
      offscreen (IntersectionObserver) or the tab is hidden
      (`visibilitychange`) to save CPU. Reduced-motion → one static frame.
- [ ] **4.7** Re-run the perf harness on the final component at S/M/L; confirm
      the §7 target and record final numbers in §9.

### Phase 5 — Stories, tests, docs, exports

- [ ] **5.1** Stories: an effects gallery (ripple / noise / vignette), a
      params Playground (ripple speed/wavelength/amplitude), subtle-color
      examples, and odd-size blocks proving full coverage.
- [ ] **5.2** CT specs (`*.spec.tsx`): message/action render; fill is
      `aria-hidden`; role per variant; **fill covers the block** (canvas/grid
      spans to each edge); reduced-motion renders static; an effect param
      visibly changes output.
- [ ] **5.3** Keep `probe-nonideal` + a perf-regression lab story; record the
      shipped numbers in §9.
- [ ] **5.4** Update `AGENTS.md`: document `effect`, `effectOptions`, `color`,
      and the perf characteristics. Keep it terse.
- [ ] **5.5** Public surface: props-only, so no new `package.json` export /
      `src/index.ts` change. Export any new effect/param **types** from the
      component's `index.ts`. Keep the renderer + `fields.ts` internal.

### Phase 6 — Finish

- [ ] **6.1** Full finishing gate green:
      `just check && just typecheck && just test && just test-ct && just build`,
      plus the perf target met (§7).
- [ ] **6.2** DoD sign-off (§6 below). Confirm every item; append a final
      "PROJECT COMPLETE" §10 note. Stop.

---

## 6. Definition of Done

- The dithered fill **covers the entire block** at any size, every edge, light
  + dark — verified by screenshot at awkward sizes and by a CT assertion.
- The animated fill uses the **benchmarked-fastest** renderer; it sustains
  **≥ 55 fps at the M block** with no long task > 50ms (harness-measured,
  numbers in §9), and **pauses when offscreen / tab hidden**.
- The ripple is **parameterizable** (speed, wavelength, amplitude, origin) and
  there is **≥ 1 additional effect** (noise) plus the static vignette, all
  behind one `effect` API.
- The fill color is **subtle and token-based** (alpha steps of a base color;
  grey/transparent; `error` uses the danger token) and theme-aware.
- No new **global** color token; **no new runtime dependency** unless the
  rubric + §9 explicitly justify a small one. Fill stays `aria-hidden`; message
  stays accessible; `role` per variant intact; reduced-motion static.
- House rules honored (tokens, CSS Grid, `cx`, sharp corners, no emoji).
- Tests: vitest for `fields.ts` math; CT for render / coverage / a11y /
  reduced-motion / effect-param. `just test` + `just test-ct` green.
- A renderer benchmark table + the auto-select rationale live in §9. Stories
  cover effects + params + odd sizes. `AGENTS.md` updated. `just build` green.
  Nothing pushed.

---

## 7. Selection rubric (Phase 3 — deterministic)

For each renderer, from the §9 benchmark table. **Hard gates (must pass all,
else disqualified):** sustains **≥ 55 fps at M**; **fully covers** the block at
all sizes; can render **subtle token-based color**; supports **≥ 2 effects**.

Among survivors, **weighted score** (higher = better), each metric normalized
linearly across candidates to [0,1]:

- Sustained FPS at **M** block — weight **0.35**
- p95 JS frame time at **L** block (lower better) — weight **0.30**
- Long-task / dropped-frame count at L (lower better) — weight **0.15**
- Dither fidelity / crispness (does it still read as console blocks?) — **0.10**
- Implementation simplicity / no-new-dep (less code, zero dep better) — **0.10**

Highest score wins. Tie-break: fewer dependencies, then less code. Record the
table, the normalized scores, and the winner in §9 so it isn't relitigated.

---

## 8. Reference — house rules pointers (do not duplicate, just obey)

- `AGENTS.md` — catalogue, conventions, anti-patterns; the `NonIdealState` row.
- `AESTHETICS.md` — empty/error/loading guidance (explain what's missing; no
  whimsy; no skeuomorphic texture — but console dither is a native idiom).
- `src/tokens/tokens.css` — every `--sf-*` (colors, durations, eases).
- `src/components/NonIdealState/` — current implementation (DOM `<pre>` +
  `dither.ts`) being improved.
- `scripts/probe-graph.mjs` — the perf-harness pattern to copy for 0.3.
- `CLAUDE.md` — build chain, `*.test` vs `*.spec` split, three-place export
  registration (not needed here — props only).

---

## 9. Decision log (append-only — newest at bottom)

- **D1 — Branch.** Improvement work continues on `feat/non-ideal-state` (the
  component is there, unmerged/unreleased). No merge until a human reviews.
- **D2 — Coverage bug root cause.** The grid is computed from a hardcoded
  `CELL_W=7 / CELL_H=11`, but at the 10px monospace font the real cell is
  ~6px wide, so `cols = ceil(width/7)` under-counts and the field stops short
  of the right/bottom edge (the brief's white strip). Fix: measure the real
  cell (Phase 1); ultimately a canvas sized to the block makes coverage exact.
- **D3 — Dependency stance.** Default to **no new dependency** — raw Canvas 2D
  / WebGL. Image-dither libraries operate on bitmaps (wrong shape) and
  three.js `AsciiEffect` pulls in a 3D engine (too heavy). Phase 2.0 must
  *verify* this before committing; any lib must clear the rubric + log bundle
  cost.
- **D4 — Color.** Fill color becomes **subtle**: alpha steps of a base token
  (grey/transparent by default; `error` = `--sf-color-danger` at low alpha),
  not the current prominent muted fill. Decorative, so grey is allowed (unlike
  body text).
- **D5 — Tooling.** `scripts/screenshot-story.mjs` targets the stale port
  :61001; Ladle serves :61000 (`.ladle/config.mjs`). Fixed in Task 0.2.
- **D6 — Baseline (DOM `<pre>`, current renderer), via `probe-nonideal`.**
  | size | w×h | fps | p95FrameMs | longTasks |
  |------|-----|-----|-----------|-----------|
  | S | 240×140 | 60 | 16.7 | 0 |
  | M | 520×300 | 60 | 16.8 | 0 |
  | L | 960×540 | 60 | 16.8 | 0 |
  **Caveat:** the shipped component throttles its ripple to ~20fps (50ms), so
  rAF stays at 60 and the per-update string-rebuild cost is hidden even at L —
  the benchmark **understates** the DOM cost. Phase 2/3 prototypes must animate
  at the **full 60fps update rate** (no throttle) so the harness exposes each
  renderer's true cost; re-baseline the DOM renderer un-throttled in Phase 3
  for an apples-to-apples comparison.

## 10. Progress notes (append-only — newest at bottom)

- 2026-06-14 — Plan authored to improve the just-built `NonIdealState`.
  Targets: research + benchmark renderers (DOM `<pre>` vs Canvas-rects vs
  Canvas-`fillText` vs WebGL) and keep the fastest; parameterized ripple +
  added effects (noise) via a shared `fields.ts`; subtle token-based color;
  and fix the coverage bug (known cause: hardcoded cell metrics — D2). Build
  order: harness + coverage fix first (correctness + fair baseline), then
  research → prototypes → benchmark → auto-select → rebuild → test/doc. First
  task for the loop: **0.1**. Watch-outs: HiDPI canvas sizing, pausing
  animation offscreen/hidden, and keeping the fill `aria-hidden` while the
  message stays accessible.
