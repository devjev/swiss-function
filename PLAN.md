# PLAN — Resize & window interactions (Grid · DataTable · Dialog)

> **This file is the single source of truth for an autonomous ralph loop.**
> Each iteration starts with **fresh context and no memory**. Everything you
> need is in this file. Read it top-to-bottom every time before doing anything.

---

## 0. Mission

Add **direct-manipulation resizing** to three existing components in
`@tarassov-ch/swiss-function`, all opt-in and all built on one shared
low-level pointer-drag primitive (no new dependency):

1. **`Grid`** — a resizable mode where the **boundaries between tracks**
   (the gutters) become draggable. Dragging a gutter **redistributes the two
   adjacent tracks**; every item spanning those tracks resizes together. This
   is grid-native and predictable — *not* free-floating per-item resize.
2. **`DataTable`** — **Excel-style column resizing**: a grab handle on each
   leaf column header's trailing edge; drag to set width, **double-click to
   auto-fit** to the widest visible content. On by default; opt-out per table
   and per column.
3. **`Dialog`** — make the popup behave like an OS **window**: **drag it
   around** by its header and **resize** it from edge/corner handles. Plus:
   the backdrop dimming must be **VERY subtle** (a faint scrim, not the
   current heavy overlay).

**Feel is gated, not just function.** Every drag must track the pointer with
no perceptible lag and no layout thrash — resizing updates the live template
on each `pointermove`, clamped to sane minimums, without reflowing unrelated
content. Keyboard and a11y are first-class, not afterthoughts: resize gutters
and column handles are focusable `separator`s with arrow-key resize.

The path is: **shared drag hook → DataTable columns → Grid gutters → Dialog
window + subtle scrim → stories, tests, docs → finish.**

---

## 1. Ralph loop protocol — READ FIRST, EVERY ITERATION

Do this, in order, every single iteration:

1. **Read this entire file**, including the **Decision log** (§9) and
   **Progress notes** (§10). They are how past-you talks to present-you.
2. **Confirm the working branch.** All work happens on `feat/resize`.
   ```bash
   git rev-parse --abbrev-ref HEAD   # if not feat/resize:
   git checkout feat/resize 2>/dev/null || git checkout -b feat/resize main
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
   - If the task recorded a decision (an API shape, a token choice, a
     measured number), append it to **§9 Decision log**.
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
- **No new runtime dependencies.** Build resize on the in-house pointer-drag
  hook (Task 0.2). Do **not** add `react-rnd`, `re-resizable`, `interact.js`,
  etc. (see §9 D1).
- All three features are **opt-in / non-breaking**: a consumer who doesn't
  ask for resize sees identical behavior to today.
- If every box in §5 is `[x]`, the project is done: append a final note
  to §10 saying so and stop without making changes.

---

## 2. Environment & how to run things

- **NixOS**: `node`/`npm` are not on the bare PATH. This repo has `direnv`
  + a flake (`.envrc`, `flake.nix`). Commands assume the dev shell is
  active. If `npm` is missing, run inside `nix develop` / let direnv load.
- Prefer the **`just`** recipes (see `justfile`):
  - `just dev` — Ladle story server (component stories).
  - `just check` — Biome lint + format check (`just format` writes fixes).
  - `just typecheck` — `tsc --noEmit`.
  - `just test` — vitest once (matches `*.test.{ts,tsx}` only).
  - `just test-ct` — Playwright **component** tests (matches `*.spec.tsx`).
  - `just build` — library build (tsc d.ts + vite + postbuild).
- **Test-file split is load-bearing**: pointer-drag behavior must be tested
  with **Playwright CT** (`*.spec.tsx`) — real `pointerdown`/`move`/`up` with
  `mouse`/`dragTo`. Pure logic (clamping, redistribution math) goes in a
  vitest `*.test.ts`. Naming a file the wrong way means its runner silently
  ignores it.
- **Screenshots** for visual checks: `node scripts/screenshot-story.mjs
  <story-id> [outfile]` (Ladle id is `<file>--<export>`, lowercased).
  Requires `just dev` running.
- **Reference for the drag pattern**: `src/components/Graph/Minimap.tsx`
  already does `setPointerCapture` + `onPointerMove` correctly. The shared
  hook (Task 0.2) generalizes exactly that pattern.

---

## 3. Verification gate (the change is only "green" if ALL pass)

Run, in this order, scoped to what you touched but at minimum:

```bash
just typecheck      # no TS errors
just check          # Biome lint + format clean (run `just format` to fix)
just test           # vitest green
```

When the task adds or changes **drag/resize interaction**, **also**:

- Add or update a Playwright CT spec (`*.spec.tsx`) that drives the pointer
  (`page.mouse` / `locator.dragTo` / manual down→move→up) and asserts the
  resulting size/position/template. Run `just test-ct` for the touched spec.
- Start `just dev` (if not running) and screenshot the relevant story; eyeball
  it — handles visible on hover, no overlap/clipping, themed colors, cursor
  affordance (`col-resize` / `row-resize` / `nwse-resize`), drag tracks the
  pointer with no lag.

When the task touches **motion/transition**, confirm a
`@media (prefers-reduced-motion: reduce)` fallback exists (drag itself is not
animated; any snap-back / settle transition must degrade).

`just build` is required green for the **Phase 4/5** finishing tasks (slower),
not for every iteration.

---

## 4. Commit convention

```bash
git add -A
git commit -m "resize: <imperative summary of the one task>

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
> `prefers-reduced-motion` fallback, **no new global color tokens** (scope
> any new variable to the component, e.g. `--sf-dialog-backdrop`), no
> utility-class libs, no emoji/personality, no new deps. Component dir
> layout: `src/components/<Name>/{<Name>.tsx, <Name>.module.css,
> <Name>.stories.tsx, <Name>.spec.tsx, index.ts}`.

### Phase 0 — Shared drag primitive

- [x] **0.1** Create branch `feat/resize` off `main` (if not already on it).
      Run the baseline gate (`just typecheck && just check && just test`) and
      confirm green before any change. — created `feat/resize` from `main`; baseline typecheck/check/test all green.
- [x] **0.2** Add `src/lib/usePointerDrag.ts` — a headless hook generalizing
      the `Minimap.tsx` pattern. Signature roughly:
      `usePointerDrag({ onStart?, onMove, onEnd? }) → { onPointerDown }`
      where `onMove` receives `{ dx, dy, x, y, event }` deltas **relative to
      the drag origin**. It must: call `setPointerCapture` on pointerdown,
      track via `pointermove`, release + fire `onEnd` on `pointerup`/cancel,
      ignore non-primary buttons, and `preventDefault` to avoid text
      selection during drag. No React state churn per move (use refs;
      consumers decide what to re-render). Internal only — **not** exported
      from `src/index.ts`.
- [x] **0.3** Unit-test the pure parts in `src/lib/usePointerDrag.test.ts`
      (delta math / origin tracking via a thin testable core if extracted).
      Behavioral pointer-capture coverage comes later via component CT specs. — 4 vitest cases on `dragDelta` (origin, +/- deltas, absolute coords); green.

### Phase 1 — DataTable: Excel-style column resize

> The existing column widths come from `gridTemplateColumns`, built in
> `DataTable.tsx` from each leaf's `col.width` (in `--sf-unit` multiples) or
> `minmax(calc(--sf-unit*5), 1fr)`. Resize introduces a **width-override map
> keyed by column id** that wins over `col.width` when present.

- [x] **1.1** Add a column-width override model: internal state
      `Record<columnId, number /* px */>` plus a helper that rebuilds
      `gridTemplateColumns` so an override emits a fixed `px` track, a
      `col.width` emits the existing `calc(--sf-unit * N)`, and otherwise the
      existing fluid `minmax(...)`. No UI yet — pure plumbing, behavior
      unchanged. Add a vitest `*.test.ts` for the template builder.
- [x] **1.2** Render a resize handle on each **leaf** column header's trailing
      edge (`DataTable.module.css` + header map in `DataTable.tsx`). It is a
      thin hit-target (`role="separator"`, `aria-orientation="vertical"`),
      `cursor: col-resize`, visible on header hover / when focused, themed via
      tokens. Group (parent) headers get **no** handle. Does nothing yet.
- [x] **1.3** Wire the handle to `usePointerDrag`: on drag, set that column's
      override to `startWidth + dx`, clamped to a min (define
      `--sf-datatable-col-min`, e.g. `calc(--sf-unit * 3)`). Live update every
      move; the sticky header and body share the same template so they stay
      aligned. Stop drag → keep the width. CT spec: drag a handle right/left
      and assert the column track width changed.
- [ ] **1.4** Double-click a handle → **auto-fit**: measure the widest
      rendered content in that column among currently-mounted (virtualized)
      cells + the header, set the override to that width (clamped to min).
      CT spec asserts the override updates on double-click.
- [ ] **1.5** Keyboard + a11y: handle is focusable (`tabIndex=0`); ArrowLeft/
      ArrowRight resize by a step (e.g. `--sf-unit`), Shift = larger step;
      set `aria-valuenow`/`aria-label`. Document keys in the story. Don't let
      separator focus interfere with the cell-grid roving tabindex.
- [ ] **1.6** Opt-out controls: `resizableColumns?: boolean` on `DataTableProps`
      (**default `true`** — Excel-like), and per-column `resizable?: boolean`
      on `LeafColumnDef` (default true). When off, no handle renders and
      widths behave exactly as today. Optional `onColumnResize?(id, px)` +
      `columnWidths?` for controlled mode — add only if it stays small;
      otherwise note as out-of-scope in §10.
- [ ] **1.7** Consolidate/finish the DataTable CT spec(s): drag-resize,
      double-click auto-fit, keyboard resize, and the opt-out path (no handle
      when `resizableColumns={false}`). `just test-ct` green for the spec.

### Phase 2 — Grid: draggable track gutters

> Grid currently serializes `grid-template-columns/rows` from props into inline
> style (`buildTrackList`). Resizable mode owns the **resolved** track sizes in
> state and renders gutter separators between adjacent tracks.

- [ ] **2.1** Add `resizable?: boolean | "columns" | "rows" | "both"` to
      `GridProps` (default `false`/today's behavior). When enabled, on first
      interaction **freeze the affected axis**: measure current track sizes via
      the grid container's `getComputedStyle(...).gridTemplateColumns/Rows`
      (resolved px) and move them into internal state, so `fr`/`auto`/`repeat`
      become concrete, draggable px tracks. Pure setup task — no handles yet;
      confirm a non-resizable Grid is byte-identical to today.
- [ ] **2.2** Render gutter separators positioned over each interior track
      boundary for the enabled axis (a thin overlay sized to the gap, or
      absolutely-positioned strips). `role="separator"`,
      `aria-orientation` per axis, `cursor: col-resize` / `row-resize`,
      visible affordance on hover, themed via tokens. Sharp corners; no
      handle on the outer edges.
- [ ] **2.3** Drag a gutter → **redistribute the two adjacent tracks**: track[i]
      grows by `dx`, track[i+1] shrinks by `dx` (sum preserved), each clamped
      to `--sf-grid-track-min` (e.g. `calc(--sf-unit * 2)`); when a neighbor
      hits min, stop. Apply live each move. CT spec: drag a column gutter and
      assert the two adjacent track widths changed by ±delta and the total is
      unchanged.
- [ ] **2.4** Keyboard + a11y on gutters: focusable; Arrow keys nudge the
      boundary by a step (Shift = larger); `aria-valuenow` reflects the
      leading track's size. Roving/tab order sane with the grid's own content.
- [ ] **2.5** Polish: `minTrackSize?` prop (overrides the token default);
      `onTrackSizesChange?(axis, sizes)` callback; a `reset()`-style escape
      (e.g. double-click a gutter restores the two tracks to equal share).
      `prefers-reduced-motion` fallback for any settle transition.
- [ ] **2.6** Grid CT spec: gutter drag for columns and rows, min-clamp at a
      neighbor, keyboard nudge, and double-click reset. `just test-ct` green.

### Phase 3 — Dialog: window drag + resize + subtle scrim

> `Dialog.Popup` is Base UI's popup, `position: fixed` centered via
> `transform: translate(-50%,-50%)`, with open/close opacity+transform
> transitions. The backdrop uses the shared `--sf-color-overlay` token.

- [ ] **3.1** **Subtle backdrop.** Stop using the heavy shared
      `--sf-color-overlay` for the dialog scrim. Introduce a **component-local**
      variable `--sf-dialog-backdrop` defined in `Dialog.module.css` (NOT a
      global token — see §9 D3) set to a very faint scrim
      (e.g. `rgb(0 0 0 / 0.08)` light, a touch higher in dark mode via the
      existing `[data-theme]` mechanism), and have `.backdrop` use it.
      Overridable by consumers at any scope. Screenshot light + dark to
      confirm it reads as "barely there," and that the popup still has enough
      separation (its border + `--sf-shadow-xl` carry the elevation).
- [ ] **3.2** **Draggable.** Add `draggable?: boolean` to the `Popup` wrapper.
      When on, the popup exposes a drag region — default the **header area**
      (wire `Dialog.Title`, or a new optional `Dialog.Handle`, as the grab
      target with `cursor: move`). Dragging updates an `{x,y}` offset (state)
      applied as a CSS var / inline transform that **composes with** the
      centering transform, so the window moves. Clamp so the header stays
      within the viewport (never drag fully off-screen). Don't break Base UI's
      open/close transition — only override transform while/after a user drag.
- [ ] **3.3** **Resizable.** Add `resizable?: boolean` to the `Popup`. Render
      edge handles (E/S/W/N) + corner handles (SE at minimum) with correct
      `*-resize` cursors. Drag updates width/height state (overriding the
      `max-width`/`width` defaults), clamped to a min size
      (`--sf-dialog-min-w` / `--sf-dialog-min-h`) and the viewport. SE corner
      is the priority; add the others if they stay clean.
- [ ] **3.4** Lifecycle correctness: reset drag offset + size when the dialog
      **closes and reopens** (next open is centered at default size), so a
      moved/resized window doesn't "remember" stale geometry unexpectedly.
      Use `setPointerCapture`; ensure dragging a handle doesn't trigger Base
      UI's outside-press/close. Verify focus trap + Escape still work.
- [ ] **3.5** a11y: drag/resize handles are labelled and keyboard-reachable
      where it makes sense (at minimum the SE resize handle is a focusable
      `separator` with arrow-key resize; document that pointer is the primary
      affordance). Dialog role/labelledby/describedby from Base UI unchanged.
- [ ] **3.6** Dialog CT spec: drag by header moves the popup, resize from SE
      corner changes its box, min-size clamp holds, and reopen resets geometry.
      `just test-ct` green.

### Phase 4 — Stories, docs, exports

- [ ] **4.1** Grid stories: a `Resizable` story (columns), one for rows, one
      for `"both"`, each with a few `Grid.Item`s so the redistribution is
      visible. Include a Playground with the `resizable` arg.
- [ ] **4.2** DataTable story: a `ResizableColumns` story demonstrating drag,
      double-click auto-fit, keyboard resize, and a locked (`resizable:false`)
      column. Note the keys in the story description.
- [ ] **4.3** Dialog story: a `Window` story with `draggable resizable` and the
      subtle backdrop, plus a plain `Default` left intact for contrast.
- [ ] **4.4** Update `AGENTS.md`: document `Grid` `resizable`, `DataTable`
      `resizableColumns` + per-column `resizable`, and `Dialog.Popup`
      `draggable`/`resizable` + the subtle-dim default. Add a row to the
      relevant tables. Keep it terse; AGENTS.md is the usage contract.
- [ ] **4.5** Confirm the public surface: these are **props on existing
      components**, so no new `package.json` `exports` entries and no
      `src/index.ts` change are needed. Verify `usePointerDrag` is internal
      (not re-exported). If any new type needs exporting (e.g. a resize
      callback signature), add it to the component's `index.ts` only.

### Phase 5 — Finish

- [ ] **5.1** Full finishing gate, all green:
      `just check && just typecheck && just test && just test-ct && just build`.
      Fix anything red; one fix = one commit if it's substantive.
- [ ] **5.2** DoD sign-off (§6). Walk every item, confirm true, append a final
      "PROJECT COMPLETE" note to §10. Stop.

---

## 6. Definition of Done

A feature is done only when **all** hold:

- **Grid**: opt-in `resizable` mode renders gutter separators; dragging
  redistributes the two adjacent tracks (sum preserved), clamped to a min;
  works for columns, rows, and `"both"`; keyboard-resizable; double-click
  resets a pair. A non-resizable Grid is identical to pre-change behavior.
- **DataTable**: leaf columns are drag-resizable (default on), double-click
  auto-fits, keyboard resizes; per-table and per-column opt-out work; header
  and body stay aligned during/after resize; virtualization unaffected.
- **Dialog**: popup is draggable by its header and resizable from at least the
  SE corner, both clamped to the viewport/min size; geometry resets on
  reopen; focus trap + Escape + outside-press semantics intact; **backdrop is
  very subtle** and themed for light + dark.
- **Shared**: one internal `usePointerDrag` hook backs all three; **no new
  runtime dependency** was added; no new **global** color token (component-
  scoped vars only).
- **House rules**: tokens not literals, CSS Grid, `cx()`, sharp corners, no
  grey body text, `prefers-reduced-motion` fallbacks present, no emoji.
- **a11y**: every resize/gutter handle is a focusable `separator` with
  orientation + `aria-valuenow` + keyboard resize; cursors are correct.
- **Tests**: Playwright CT specs cover drag, keyboard, and double-click for
  each of the three; vitest covers the pure math (template builder,
  redistribution clamp). `just test` and `just test-ct` green.
- **Docs/stories**: a resizable story per component; `AGENTS.md` documents the
  new props. `just build` green. Nothing pushed (human merges).

---

## 7. Design constraints & gotchas (read before each phase)

- **No resize library.** The whole point is one ~80-line hook. If you reach
  for `react-rnd`/`re-resizable`, stop — that's a §1 hard-rule violation.
- **Live template updates, not transforms-on-content.** Resizing changes the
  grid track template / column widths directly; don't fake it by scaling
  content. The DataTable header and body are two separate grids sharing one
  computed `gridTemplateColumns` string — update them from one source.
- **`fr`/`auto` must be frozen to px on first drag** (Grid) or you can't
  redistribute deterministically. Read resolved sizes via `getComputedStyle`.
- **Pointer capture or you'll drop fast drags.** Use `setPointerCapture`
  (see `Minimap.tsx`) so move events keep firing outside the handle.
- **Base UI Dialog uses transform for centering and transitions.** A drag
  offset must **compose** with `translate(-50%,-50%)` and not fight the
  open/close transition. Prefer a CSS custom property the popup's transform
  reads, toggled only after user interaction.
- **Don't break the DataTable roving-tabindex grid.** Separator focus must not
  hijack the cell keyboard model — separators are siblings of the grid, not
  cells.
- **Subtle is the spec for the dialog scrim.** When in doubt, err fainter; the
  popup's border + `--sf-shadow-xl` already separate it from the page.

---

## 8. Reference — house rules pointers (do not duplicate, just obey)

- `AGENTS.md` — component catalogue, conventions, "reach for Y", anti-patterns.
- `AESTHETICS.md` — why the library looks the way it does.
- `src/tokens/tokens.css` — every `--sf-*` variable (overlay, shadow,
  elevation, z-index, durations/eases all live here).
- `src/components/Graph/Minimap.tsx` — the canonical in-house pointer-drag
  (`setPointerCapture` + `onPointerMove`) to generalize in Task 0.2.
- `CLAUDE.md` — build chain, the `*.test` vs `*.spec` runner split, the
  three-place component registration (not needed here — props only).

---

## 9. Decision log (append-only — newest at bottom)

- **D1 — No resize dependency.** Resize is built on a single in-house hook
  (`src/lib/usePointerDrag.ts`), generalizing the existing `Minimap.tsx`
  pattern. No `react-rnd` / `re-resizable` / `interact.js`. Rationale:
  AGENTS.md forbids unnecessary deps; the surface is small; full control over
  tokens/a11y/SSR. (Set at plan creation, 2026-06-14.)
- **D2 — Grid resize model = track gutters.** Resizing the Grid means dragging
  the **boundary between tracks** and redistributing the two adjacent tracks
  (sum preserved, min-clamped). **Not** free-floating per-item resize (which
  fights the grid model and overlaps neighbors). Chosen by the user over
  "free per-item resize" and "both" on 2026-06-14. This mirrors the DataTable
  column-resize mental model (a column = a track).
- **D3 — Dialog scrim is component-local, not a new global token.** The "very
  subtle" backdrop is achieved with a `--sf-dialog-backdrop` variable defined
  inside `Dialog.module.css` (overridable by consumers), **not** by adding a
  new top-level `--sf-color-*` token and **not** by changing the shared
  `--sf-color-overlay` (other overlays may rely on it). Respects the
  "no new top-level color tokens without consultation" rule. (2026-06-14.)
- **D4 — DataTable column resize defaults ON.** "Behave like Excel columns"
  ⇒ `resizableColumns` defaults `true`, with per-table and per-column opt-out,
  and double-click = auto-fit. (2026-06-14.)

## 10. Progress notes (append-only — newest at bottom)

- 2026-06-14 — Plan authored. Scope: Grid gutter-resize, DataTable Excel
  columns, Dialog window drag+resize + subtle scrim, all on a shared internal
  `usePointerDrag` hook, no new deps. Build order is DataTable → Grid → Dialog
  (most-contained first; each reuses the Phase-0 primitive). Branch
  `feat/resize` to be created in Task 0.1. Key risks flagged in §7: freezing
  `fr`→px before redistribution, composing the dialog drag offset with Base
  UI's centering transform, and keeping the DataTable header/body templates in
  sync. First task for the loop: **0.1**.
