# Work plan

Detailed, grounded steps for the next batch of work. Each item keeps the
original intent note, then current-state facts, approach, steps, and how to
verify. File paths are relative to repo root.

---

## 1. DataTable — scrollable container with elastic edge-snap + dithered edge fade

**Intent:** A data-table container we can make scrollable, where scrolling snaps
*elastically* to the nearest column edge (horizontal) or row edge (vertical),
and the rows/columns nearest the scroll edge fade out with a *dithered* fade.
The header is sticky and does **not** scroll vertically.

**Current state**
- Scroll container is `.viewport` (`overflow: auto`); header is `.headerRow`
  (`position: sticky; top: 0; z-index: 1`). `DataTable.tsx` ~lines 623–771,
  `DataTable.module.css` lines 10–28. No scroll-snap, no masks today.
- Body rows: paginated (normal flow) or virtualized (`@tanstack/react-virtual`,
  `position: absolute; transform: translateY(start)`, `overscan: 8`).
- **Horizontal scroll is inherent, not a new mode.** The 1fr filler keeps the
  table at constant width *only while the columns fit*. With many/wide columns
  the fixed widths sum past the container, the filler collapses to its min, and
  the table overflows ⇒ horizontal scroll. Two regimes:
  - *Columns fit:* filler absorbs slack, table fills container, no h-scroll.
  - *Columns overflow:* table exceeds container, h-scroll, filler at min.
  So the column-axis features (horizontal snap, column edge-fade) have a natural
  home — the overflow regime — and we do **not** need a separate `layout="scroll"`
  mode. (Earlier framing of an opt-in scroll layout is dropped.)
- **Latent layout bug — CONFIRMED, fix first (prerequisite for column features).**
  Measured in a CT diagnostic (3 columns forced wide in a 400px container):
  `viewport.scrollWidth = 1032` vs `clientWidth = 398` (overflow + h-scroll is
  real), but `.headerRow` box width = **398** while the last header's right edge
  is at **1033** — so when scrolled right the sticky header background (and the
  row separators) stop at 398px and the overflowed cells have no background.
  - The obvious CSS fix (`width: max-content; min-width: 100%` on `.headerRow` /
    `.body` / `.row`) fixes the **header** and the **paginated** body (real grid
    elements) but **NOT the virtualized body**: its rows are `position: absolute`,
    and abs-positioned children don't contribute to a parent's `max-content`, so
    the body stays clamped to the container. Virtualization is the default.

- **Chosen layout engine: per-column minimum + `minmax()` (decided).** Give each
  column a `minWidth` (per-column override, defaulting to the global
  `COLUMN_MIN_UNITS`). Size tracks as `minmax(minWidth, preferred)` for normal
  columns and `minmax(minWidth, 1fr)` for the filler. CSS grid then does the
  requested behaviour automatically:
  - columns fit at their preferred widths → filler absorbs slack, table fills
    the container — *behaves like now*;
  - preferred widths exceed the container but the minimums still fit → columns
    shrink from preferred toward their minimums (the 1fr gives up space first) to
    stay within 100% — still no scroll;
  - even the minimums exceed the container → columns pin at min, table overflows
    → horizontal scroll.
  The browser owns the fit↔scroll threshold; no JS width math for the common
  cases. **Overflow — and therefore the header-bg/virtualized-body fix — is now
  confined to the genuine "too many columns to fit even at min" case.**
- **Overflow-case rendering fix (only when mins don't fit):** the table really
  scrolls, so header bg + row separators + the virtualized body must render at
  the *content* width (= Σ resolved widths). Header + paginated body get this via
  `width: max-content`; the virtualized body needs an explicit width set in JS
  (Σ column widths) since abs rows don't size their parent.
- **Reconcile with the shipped resize cascade:** the cascade assumes fixed px
  widths summing to the container. With `minmax` auto-shrink, decide whether a
  manual resize sets a column's *preferred* (max) width and lets CSS redistribute
  (simpler; naturally subsumes the min-clamping the cascade already does) or
  keeps the explicit pixel cascade. Lean toward "resize sets preferred; CSS
  minmax + filler do the rest."
- The header-bg fix is worth shipping on its own — it's a real bug with many/wide
  columns today.

**Approach**
- **Elastic snap:** CSS `scroll-snap-type` on `.viewport` with `proximity`
  (gentle/elastic — only snaps when released near a boundary; `mandatory` would
  feel rigid). Snap targets: `.row { scroll-snap-align: start }` for the
  vertical axis; header (and first-row) cells `scroll-snap-align: start` for the
  horizontal axis. Gate via a `scrollSnap?: "none" | "rows" | "columns" | "both"`
  prop → sets `scroll-snap-type: y|x|both proximity`.
- **Dithered edge fade:** the NonIdealState dither is a **WebGL fragment shader**
  (`NonIdealState/webglFill.ts`) and is *not* extractable as a CSS mask. But a
  *static* dithered fade is achievable in pure CSS by compositing two mask
  layers on an edge overlay: `mask-image: <bayer-dot pattern>, linear-gradient(...)`
  with `mask-composite: intersect` — the gradient gives the fade ramp, the Bayer
  pattern quantises the alpha into dither dots. Static ⇒ reduced-motion-safe.
  - Render an overlay element per fading edge (bottom for rows, inline-end for
    columns) as a sibling inside `.viewport`, `position: sticky` to the edge,
    `background: var(--sf-color-bg)`, masked so it dither-fades content beneath.
    The overlay sits *below* the sticky header in z-order so the header stays
    crisp; the bottom overlay never overlaps the header anyway.
  - This overlay approach is **independent of virtualization** (it fades by
    screen position, not by row index) — avoids per-virtual-row opacity math.
  - Gate via `edgeFade?: "none" | "rows" | "columns" | "both"`.

**Steps**
1. Decide layout mode (a) vs (b) above; if (a), add `layout` prop +
   `buildColumnTemplate` branch that omits the `1fr` filler in `scroll` mode.
2. Add `scrollSnap` prop + CSS: `.viewport[data-snap~="rows"] { scroll-snap-type: y proximity }`,
   `.row { scroll-snap-align: start }`; columns analogously on header cells.
3. Add `edgeFade` prop + edge-overlay elements + the Bayer-dither mask CSS
   (define the Bayer dot pattern as an inline SVG data-URI mask).
4. Stories: a tall/wide dataset showing snap + dither fade in both axes; dark mode.
5. Respect `prefers-reduced-motion`: snapping is fine; ensure no animated fade.

**Verify:** Ladle DataTable stories — scroll vertically (rows snap, bottom edge
dither-fades, header stays sticky/crisp) and horizontally in `scroll` layout
(columns snap, trailing edge dither-fades). CT: assert overlay elements present
and `scroll-snap-type` set. `npm run check/typecheck/build`.

**Layout engine: decided** — per-column `minWidth` + `minmax()` tracks (browser
handles fit→shrink-to-min→scroll). Remaining open items: (1) the overflow-case
content-width render fix (header bg + virtualized body); (2) reconcile manual
resize (preferred-width vs the explicit cascade). The header-bg fix is worth
doing on its own — it's a latent bug today with many/wide columns.

---

## 2. Skeleton — reuse the NonIdealState dithered effects (not just shimmer)

**Intent:** Skeleton currently uses a shimmer sweep; give it the same animated
dithered effects as NonIdealState.

**Current state**
- `Skeleton` is a static box with a CSS `::after` shimmer (`Skeleton.module.css`),
  props: `shape`, `width/height/size`. Reduced-motion → shimmer hidden.
- NonIdealState owns the effect engine: `createWebglFill(canvas)` +
  `NonIdealState.tsx` (RAF loop, resize, IntersectionObserver pause,
  visibilitychange pause, reduced-motion static frame). 24 effects in
  `effects.ts`. Effect props: `effect`, `speed`, `density`, `cellSize`,
  `effectOptions`, `color`, `opacity`.

**Approach**
- Extract the canvas plumbing (create/resize/RAF/observers/reduced-motion) out of
  `NonIdealState.tsx` into a reusable internal hook or component — e.g.
  `src/components/NonIdealState/useDitheredFill.ts` (returns a `ref` + takes the
  effect params) or a `<DitheredFill>` internal component. Refactor NonIdealState
  to consume it (no behaviour change — keep its tests green).
- Add effect support to Skeleton: a `effect?: EffectName` prop (+ pass-through
  `speed`/`density`/`cellSize`/`color`/`effectOptions`). When set, render a
  `<canvas>` filling `.root` (driven by the shared hook) and drop the shimmer
  `::after`; when unset, keep today's shimmer (default, backward-compatible).
- Reduced-motion: inherited from the shared hook (static `t=0` frame).

**Steps**
1. Refactor: lift the WebGL/RAF/observer logic from `NonIdealState.tsx` into the
   shared hook/component; rewire NonIdealState to use it; run NonIdealState tests.
2. Add `effect` (+ effect params) to `SkeletonProps`; render the canvas when
   present; gate the shimmer `::after` to the no-effect case.
3. Stories: Skeleton with shimmer (default) and with a couple of effects.

**Verify:** NonIdealState stories/tests unchanged; Skeleton stories show shimmer
and effect modes; reduced-motion shows a static frame. Gates green.

**Note:** the dither is GPU/WebGL — Skeleton with an effect mounts a canvas +
GL context, heavier than the CSS shimmer. Keep shimmer the default.

---

## 3. Selector — inline chip overflow expands as a downward overlay (no reflow)

**Intent:** In `layout="inline"`, when chips exceed one row, don't grow the box
in place / push content down. On click/focus, raise elevation and expand
*downward as an overlay* that covers content below; collapse back to one row on
blur.

**Current state**
- `Selector.tsx` inline layout wraps `Combobox.Chips` + `Combobox.Input` (+ Clear)
  in `Combobox.InputGroup`. `Combobox.module.css` `.inputGroup` is
  `flex-wrap: wrap; min-block-size: calc(--sf-unit * 1.5)` ⇒ today it grows taller
  in normal flow (pushes page content).
- Elevation pattern exists: `Box` `data-elevation` + `--sf-elevation-1..5`;
  `Popover.Popup` renders as `<Box elevation={3}>`. Z tokens: `--sf-z-dropdown`
  1000 … `--sf-z-popover` 1300.

**Approach**
- Wrap the inline group in a `position: relative` shell that **reserves the
  collapsed (one-row) height** so surrounding layout never shifts. The inner
  group is the overlay:
  - Collapsed (not focused): `max-block-size: <one row>`, `overflow: hidden`,
    show a trailing "+N" overflow indicator when chips are clipped.
  - Expanded (`:focus-within`): `position: absolute; inset-inline: 0; top: 0`,
    `max-block-size: none` (auto height, wraps all chips), `z-index:
    var(--sf-z-dropdown)`, elevation shadow (`--sf-elevation-3`), so it floats
    over content below instead of pushing it.
  - Prefer pure CSS `:focus-within` (no JS); if "+N" needs the hidden count, use a
    small `expanded` state / `ResizeObserver`-free count (number of selected −
    a CSS-derived visible count is hard, so compute "+N" only when collapsed and
    chips overflow — acceptable to show total count e.g. "3 selected" collapsed).
- The dropdown popup (Combobox.Positioner/Popup) is separate and already floats;
  ensure it stacks above the expanded chip overlay (see item 8 z-index fix).

**Steps**
1. Restructure inline JSX: relative shell + inner overlay group; add a collapsed
   overflow indicator element.
2. CSS in `Selector.module.css` (inline-specific, so we don't disturb Combobox's
   generic `.inputGroup`): collapsed `max-height` + clip; `:focus-within`
   expanded absolute + elevation + z-index; transition (reduced-motion fallback).
3. Decide the collapsed indicator: "+N" vs "N selected" vs fade — see open Q.
4. Stories: inline Selector with many chips; show collapse/expand over content.

**Verify:** Ladle — many chips, collapsed shows one row + indicator and does not
push the element below; focusing expands downward as an elevated overlay; blur
collapses. Dark mode; reduced-motion (no transition). CT for expand-on-focus.

**Open question:** collapsed overflow affordance — "+N more" chip, a count, or a
gradient fade? (Recommend a small "+N" pill at the trailing edge.)

---

## 4. Selector — size presets (sm / md / lg), mirroring Input

**Intent:** Give Selector size presets like `Input`.

**Current state**
- `Input` has `inputSize?: "sm" | "md" | "lg"` → `.sizeSm` / `.sizeLg` classes
  (md is the unclassed default). They set `block-size`, `padding-inline`,
  `font-size` (`Input.module.css` ~lines 79–89).

**Approach & steps**
1. Add `size?: "sm" | "md" | "lg"` (default `md`) to `SelectorProps`.
2. Add sizing classes to `Selector.module.css` and the inline group in
   `Combobox.module.css` (`.inputGroup` sm/lg variants) — `block-size`/
   `min-block-size`, `font-size`, `padding` mirroring Input's three steps; scale
   chip font-size with the control size.
3. Thread the size to the rendered `Combobox.Input` / `InputGroup` (data-attr or
   class). Keep the panel layout's search field sized too.
4. Stories: all three sizes, panel + inline.

**Verify:** Ladle three sizes line up with `Input` heights; chips scale; gates green.

---

## 5. Timeline — compact variant (labels only on hover / scrub)

**Intent:** A compact Timeline with no always-visible labels; labels appear on
hover and while scrubbing.

**Current state**
- `Timeline.tsx`: events render `.eventConnector` + `.eventLabel` + `.eventMarker`;
  labels are **always visible** (`Timeline.module.css` `.eventLabel`, lanes via
  `lanes.ts`). Scrub uses inline pointer handlers + `setPointerCapture`
  (`dateFromClientX`), not `usePointerDrag`. Markers have a hover scale.

**Approach**
- Add `compact?: boolean` (or `labels?: "always" | "auto"`). In compact:
  `.eventLabel { opacity: 0; transition: opacity … }`, revealed on
  `.event:hover/:focus-within .eventLabel { opacity: 1 }`.
- While scrubbing, reveal the label(s) near the playhead: track an `isScrubbing`
  state (set on pointerdown, cleared on up) + the active date; mark the nearest
  event(s) with a `data-active` flag → CSS reveals their labels.
- In compact mode, lane stacking can collapse (labels are transient) → can reduce
  default `maxLanes`/height; keep markers + axis always visible.

**Steps**
1. Add the prop; thread `data-compact` on the viewport.
2. CSS opacity toggle (hover/focus + `[data-active]`); reduced-motion → no
   transition (instant show/hide).
3. Scrub-reveal: add `isScrubbing` state; compute nearest event to the current
   scrub date; set `data-active` on it (and within a small window).
4. Stories: compact timeline; verify labels appear on hover and during scrub.

**Verify:** Ladle — compact hides labels at rest; hover/focus shows one; scrub
reveals labels near the playhead. Reduced-motion. Gates green.

---

## 6. Timeline — range select / scrub variant

**Intent:** A Timeline variant where you can select/scrub a *range* (not just a
single playhead).

**Current state**
- Single playhead via `value?: Date` + `onChange?(date)`; one scrubbable track.

**Approach (API decision needed)**
- Add a range mode. Cleanest API: a discriminated `mode`:
  - default (today): `value?: Date`, `onChange?(date)`.
  - range: `value?: [Date, Date]`, `onChange?([start, end])` —选 either an
    explicit `mode="range"` prop or infer from a tuple `value`. Recommend an
    explicit `range` boolean (or `mode`) to keep types clean.
- Render two playhead handles + a highlighted region between them. Pointer logic
  (reuse `dateFromClientX` + snapping per handle):
  - drag a handle → move that bound (clamp to the other bound + [start,end]);
  - drag the region body → translate both bounds together;
  - click on empty track → optionally move the nearest bound.
- Keyboard a11y: handles focusable, arrow keys nudge (mirror the resize/keyboard
  pattern), with `aria-valuemin/max/now` and role="slider".

**Steps**
1. Decide API (`range`/`mode` + value/onChange shape); update `TimelineProps`.
2. Render two handles + brush region (new CSS: `.rangeHandle`, `.rangeRegion`).
3. Pointer handlers for each handle + region drag; per-handle snapping; clamping.
4. Keyboard handles (role=slider, arrows).
5. Stories: range timeline with events; controlled value.

**Verify:** Ladle — drag each handle, drag the region, snapping works, bounds
clamp; keyboard moves handles. Gates green. (Heavier item — consider a separate
PR.)

---

## 7. Typography — monospace looks larger than sans at the same `font-size`

**Intent:** Research why mono reads larger than sans at equal size; apply the
right correction.

**Current state / cause**
- Tokens (`tokens.css` ~71–93): `--sf-font-sans` (system UI sans),
  `--sf-font-mono` (JetBrains Mono first). Size ladder sm/md/lg. **No
  `font-size-adjust` anywhere.**
- Cause is **x-height ratio**: JetBrains Mono has a notably tall x-height (~0.55
  em) and wide fixed-width glyphs, so at an equal `font-size` it appears larger
  and heavier than the system sans (whose x-height differs). This is the textbook
  `font-size-adjust` problem.
- Mono is used in: Input, TextEdit, Combobox/Selector input + chips, DataTable
  code cells, Timeline/BarChart/BridgeChart/axis tick labels, CommandBar,
  Markdown code, Outliner, Scatterplot tooltip. Sans is the body default.

**Approach**
- Preferred: `font-size-adjust` so mono is normalised to the same *perceived*
  x-height as sans. Modern support: Chrome 127+, Firefox 3+, Safari 16.4+
  (`font-size-adjust: <number>` and `from-font`). Apply to the mono base so all
  mono text shrinks to match — e.g. set `font-size-adjust` matching the sans
  x-height ratio (research the exact JetBrains Mono vs system-sans x-heights;
  ~0.52–0.53 is a plausible target). 
- Fallback for older engines: a tuned `--sf-font-mono-scale` (~0.92–0.94) applied
  as `font-size: calc(<size> * var(--sf-font-mono-scale))` on mono usages, OR a
  shared `.mono` utility. Prefer `font-size-adjust` with the scale as the
  `@supports not` fallback.

**Steps**
1. Research & document the x-height ratios (cite sources) and pick the target
   `font-size-adjust` value; prototype on Input + Timeline ticks (mono next to
   sans) to tune by eye.
2. Add the correction at the token/base level (a `--sf-*` token or a shared rule
   applied wherever `--sf-font-mono` is set), with an `@supports` fallback scale.
3. Visually verify mono/sans optical size match across components; check that
   monospace alignment (the reason mono is used) is preserved.

**Verify:** side-by-side mono vs sans at sm/md/lg read as the same size; Input,
ticks, chips, code cells look right in light/dark; no layout breakage. Gates green.

---

## 8. Fix issue #2 — Combobox/Selector dropdown renders behind the sticky DataTable header

Issue: https://code.tarassov.ch/ux/swiss-function/issues/2 (affects v0.11.0).

**Intent / bug:** The Combobox/Selector dropdown popup declares
`z-index: var(--sf-z-dropdown)` (1000) but sits on a `position: static` element,
so the z-index is inert. Base UI's Positioner establishes a stacking context via
`transform: translate(...)` with `z-index: auto`, trapping the popup. Result: a
DataTable sticky header (`z-index: 1`) paints **over** the dropdown — the first
list item hides behind the header row.

**Current state**
- `Combobox.module.css` `.popup` has `z-index: var(--sf-z-dropdown)` but the popup
  isn't positioned, so the value does nothing. `Combobox.Positioner`
  (`BaseCombobox.Positioner`) is currently a pass-through (unstyled).

**Approach (root-cause fix, central in Combobox so Selector inherits it)**
- Give the **positioner** the z-index (it's the element that creates the
  transformed stacking context), so the whole floating context lifts above page
  content. Wrap `BaseCombobox.Positioner` to apply a `styles.positioner` class
  with `z-index: var(--sf-z-dropdown)`. Alternatively/additionally set
  `.popup { position: relative }` so its own z-index participates. Prefer styling
  the positioner.
- Audit the **same latent bug** in other Base UI Positioner-based components:
  `Menu`, `Popover` (Popover sets z-index on `.popup` too — check it's effective),
  `CommandBar`. Apply the positioner-z-index fix where needed.

**Steps**
1. In `Combobox.tsx`, wrap `Positioner` to add `styles.positioner`; add
   `.positioner { z-index: var(--sf-z-dropdown) }` in `Combobox.module.css`
   (keep/也 set `.popup { position: relative }` as belt-and-suspenders).
2. Grep other components for `Positioner` pass-throughs + `.popup { z-index }` on
   static elements; fix the same way (Menu/Popover/CommandBar).
3. Regression test: a Selector/Combobox positioned above a DataTable with a
   sticky header — open the dropdown, assert the first option is visible above
   the header (CT: compare bounding boxes / `toBeVisible` + not occluded).

**Verify:** Ladle repro (Selector over a DataTable) — dropdown's first item is no
longer hidden by the sticky header, in light/dark. CT regression. Gates green.
This is small + high-value; good candidate to fix and release first (v0.11.1).

---

## Suggested sequencing

1. **#8** (z-index) — small, fixes a shipped bug; release as v0.11.1.
2. **#4** (Selector sizes) and **#3** (Selector overflow overlay) — related, do together.
3. **#7** (mono/sans size) — small, broad polish.
4. **#5** (compact Timeline), then **#6** (range Timeline — heaviest).
5. **#2** (Skeleton effects, needs the NonIdealState refactor) and **#1**
   (DataTable scroll/snap/fade — needs the layout-mode decision) — larger, last.
