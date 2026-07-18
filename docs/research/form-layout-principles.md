# Form layout principles

Guidance for `Field`, `FieldLayout`, `VerticalForm`, and `Form` in `@tarassov-ch/swiss-function`. Pair it with [AESTHETICS.md](../AESTHETICS.md) (the why) and [AGENTS.md](../AGENTS.md) (the what-to-do). This document is the reasoning behind the form layers plus a rubric you can run against them.

Throughout: widths, gaps, and heights are declared in `--sf-unit` multiples (1.5rem is the unit). Colour and type come from `--sf-*` tokens, never literals.

---

## 1. The design stance: instrument-panel forms

A form in this library is a control surface, not a landing-page sign-up. The reference points are an Airbus MCDU scratchpad, a Bloomberg entry blotter, and the fixed-legend rigor of a Leica top plate: every field has a known place, the rhythm is the baseline grid, and nothing moves under the operator unless the operator moved it.

That posture produces a small set of non-negotiables:

- **Labels are fixed legend.** They sit above the control, left-flush with it, always visible. A placeholder is never a label.
- **The grid is the order.** Vertical rhythm is 2u between sections and 1u within; the label-to-control gap is u/4. You should be able to lay a baseline grid over any form and have every row land on it.
- **Chrome recedes, data is foremost.** Hairline separation and honest spacing carry grouping. A field is not a card; a form is not a stack of cards.
- **Colour is state, not decoration.** A resting field is neutral. Saturated colour appears only when something is true: primary on focus, danger on error. No brand-colour resting borders, no success-green on valid fields, no decorative field backgrounds.
- **Copy the user must read is full strength.** `Field.Description` and `FieldLayout` hints render at the small type size in `--sf-color-fg`, never grey. This is the project's cardinal anti-pattern and it is locked here so a refactor cannot quietly grey it out.
- **Nothing jumps.** An appearing error or a dependent field must not shove the rows below it. The layout reserves the space it will need (the MCDU scratchpad principle: the message line is always there, it just fills in).

Density is a lever, not a luxury. The default is tight and on the grid; comfortable is an option, never the resting state. Whitespace is rhythm, not padding for its own sake.

---

## 2. Principles

### 2.1 Label-to-control alignment

Labels sit directly above their control, sharing the control's left edge: top-aligned, left-flush, and persistent. This is a single-fixation read (the eye does not saccade sideways to pair a label with its field) and it survives long labels and localization (German and French labels run roughly twice the length of English; a right-aligned label column goes ragged, a top-aligned one does not).

- Never beside the control as a general pattern. The beside layout (`Field` `orientation="horizontal"`) is legitimate only for switch and checkbox rows, where the control is small and the label reads as its caption.
- Never right-aligned label columns. They break under long labels and RTL.
- Never a placeholder standing in for a label. Placeholders vanish on input and are invisible to many assistive paths.

`Field` (vertical) and `FieldLayout` (label above the control) both default to this. Do not reintroduce a label column.

### 2.2 Grouping by rhythm versus boxes

Group with the baseline grid and, at most, a hairline. Roughly 2u between sections and 1u within a section is enough separation for the eye; a section title carries the rest.

Do **not** wrap each field or field-group in a bordered or elevated box. Card-per-field grouping fragments a dense form into a stack of trays, adds four borders where one gap would do, and reads as a consumer product. A section is a title plus rhythm, not a container with a perimeter.

This is a live tension in `VerticalForm`, whose default `elevation={1}` gives every row a Box surface. For dense instrument forms, prefer `bare` (rhythm-and-hairline grouping) and reserve the surface for the rare case where a row genuinely needs to read as a distinct panel.

### 2.3 Density

Density comes from spacing and the type scale, not from shrinking type below legibility. There are three type sizes (`sm`, `md`, `lg`); a dense form uses `sm` and tighter uniform gaps, never a fourth invented sub-legible size. Interactive hit areas stay usable even when compact.

Row height is a spacing decision, and it is an integer multiple of the baseline unit so the rhythm holds. Do not adopt a 48px touch-target row as the default; that is consumer-grid folklore, not an instrument row.

### 2.4 Justified fields

`FieldLayout` justifies each wrapped line: flexible fields and fillers grow so the line fills from the left padding to the right padding. This gives a Bloomberg-blotter read (rows that align to a common right edge) while keeping strict source order.

Two rules keep justification honest:

- **Field width should signal expected input length.** A year, a code, a quantity, or a date is a bounded datum and should render visibly narrower than an address or a name. Use `rigid` (fixed unit width) for bounded controls; do not stretch every field to a uniform column just to justify the line. A four-character field next to a long text field should be less than half its width.
- **Absorb slack in one place.** Leftover horizontal space belongs in a single flexible or filler track, not distributed as sparse inter-column padding and never as a centered block (centering floats both margins and removes the row's fixed left origin). When data under-fills a wide container, cap the fields to their content width, anchor them to the reading edge (left), and let one `Filler` hold the remainder (optionally dithered so the emptiness reads as marked, not blank).

Because the mechanism is `flex-wrap` (not grid auto-flow), fields keep strict source order and never migrate lines. Narrowing carries fewer fields per line: gradual, container-driven collapse with no breakpoints. Horizontally-adjacent fields (at most three) are legitimate only when they are fragments of one datum (date parts, city and postcode, first and last name); unrelated fields from two sections never share a line.

### 2.5 Mixed control sizes

When several controls share one wrapped line, align their tops (or a shared baseline) across different intrinsic heights and different label line-counts. An `sm` Input beside a taller Selector, or a one-word label beside a wrapped 60-character label, must not stagger one control below its neighbour. A wrapped multi-line label must push nothing off the rhythm.

The failure to avoid: centering each field independently on the line. Centre alignment lets a tall control drag its short neighbours to the vertical middle, breaking the shared control baseline that makes a justified row read as one row.

### 2.6 Validation and error display

Two rules, both about not surprising the operator:

- **Reserve the message row.** The description or error slot is pre-allocated so an appearing validation error overwrites it in place and never reflows the fields below it. Trigger an error on a middle field and every field beneath it must keep its y-position; only the reserved slot changes. The same applies to a dependent field that appears based on another's value: reserve its space or accept that the layout will jump.
- **Reward early, punish late.** Never flag a field being filled for the first time mid-keystroke; validate on blur or submit while it is still empty or still valid. Once a field is *in* error, re-validate per keystroke so the error clears the instant the input becomes valid, not on the next blur.

Error text is `--sf-color-danger` adjacent to its control. Description text is `--sf-color-fg` at the small size. Neither is ever muted. A submit or busy state must be reflected on the button so the form cannot be double-submitted.

For a fully-visible dense panel, inline-at-field errors are sufficient. A separate top-of-form error-summary block is warranted only when errors can scroll off-screen (long or multi-step forms); on a compact panel it is redundant chrome that competes with the data.

### 2.7 Long labels

A long field label is an adverse case, not an edge case, and it needs a contract:

- Cap the label measure and either wrap predictably beneath its own control (never pushing the control's start point sideways) or truncate to one line with a `title` revealing the full text.
- Never rotate a label to vertical or diagonal.
- A section title is subject to the same cap; it must not reflow the header height or clip in a tight container.

The measure cap uses the system tokens (`--sf-measure` / `--sf-measure-wide`), so it tracks the type scale rather than a hard-coded character count.

---

## 3. Reject list

Named anti-patterns. If a form does any of these, it is wrong for this library.

- **Placeholder-as-label.** The label disappears the moment the field is useful.
- **Card-per-field grouping.** A bordered or elevated box around every field or field-group. Grouping is rhythm plus a hairline, not a perimeter.
- **Right-aligned label columns** as a general layout. Breaks under long labels and RTL.
- **Labels beside controls** for ordinary fields. Reserve the beside layout for switch and checkbox rows only.
- **Uniform field widths.** Stretching a year field and an address field to the same column erases the input-length signal.
- **Centered under-filled forms.** A short form centered in a wide container floats both margins and loses its fixed left origin. Anchor left; hold slack on the trailing side.
- **Reflowing on validation.** An error that inserts a line and shoves the rest of the form down.
- **Punishing early.** Turning a field red while the user is still typing into it for the first time.
- **Decorative colour on resting fields.** Brand-colour borders, tinted backgrounds, success-green on valid fields. Colour is reserved for focus and error state.
- **Grey body copy.** Muted `Field.Description` or hint text. Full-strength `--sf-color-fg` at the small size.
- **Rotated or clipped-without-recovery labels.** No vertical text; no truncation without a `title`.
- **Required-vs-optional by hue alone.** The distinction must survive a grayscale screenshot (a `*` glyph or text marker, not just colour).
- **A fourth, sub-legible type size** to cram more in. Compress with spacing tokens and the `sm` size, not with unreadable type.
- **48px comfortable rows as the default.** That is a touch-target minimum from consumer grids, not a dense-instrument row height.

---

## 4. The rubric

A testable checklist for `VerticalForm` (and, where noted, `FieldLayout`) under adverse conditions. Each item is written so it can be verified by measurement or by a grayscale or before-and-after diff. Drive the relevant story in Ladle with Playwright in both themes.

### A. Baseline (any width)

- [ ] **A1 Labels top-aligned and left-flush.** For every field row, `label.bottom <= control.top` and `|label.left - control.left| < 2px`. No field uses placeholder-as-label.
- [ ] **A2 No card-per-field.** In the dense default, a field group's perimeter has no continuous four-sided border or shadow; the count of bordered boxes used purely for grouping is 0.
- [ ] **A3 Grid rhythm.** Between-section gap is approximately 2u; between-field gap is approximately 1u; label-to-control gap is approximately u/4. Every row height is an integer multiple of the unit.
- [ ] **A4 Neutral at rest, colour on state.** Sampling every resting field's border and background yields only neutral tokens. Focusing one field makes its focus ring the only newly-saturated element. Required versus optional stays distinguishable when the screenshot is desaturated.
- [ ] **A5 Copy is full strength.** Computed colour of description text equals `--sf-color-fg`; error text equals `--sf-color-danger`. No `--sf-color-muted` or `--sf-color-fg-subtle` appears on either.

### B. Many fields (a tall form, 20-plus rows)

- [ ] **B1 Position rail present.** In a fixed-height frame, a 20-field form renders a position rail with at least 20 markers and a jump control listing the titles.
- [ ] **B2 Height-required footgun documented.** The same form with no height constraint on the parent renders no rail (the parent must constrain height). This is expected and must be documented, not silently broken.
- [ ] **B3 Errored fields marked on the rail.** A field with an error contributes a danger-toned tick on the rail.
- [ ] **B4 Sparse form does not read as unfinished.** A short form in a tall container either holds its height with a marked (dithered) band or anchors cleanly to the top; it does not leave an ambiguous blank rectangle that reads as still-loading.

### C. Long labels

- [ ] **C1 Label has a measure contract.** A 60-character label in a normal-width row wraps predictably beneath its own control or truncates to one line with a `title` equal to the full text. Its computed `transform` is `none` (never rotated).
- [ ] **C2 Label does not shove the control.** A wrapped multi-line label does not move its control's left edge or push the control below its neighbour on a shared line.
- [ ] **C3 Section title holds.** A long section title does not reflow the header height and does not clip in a tight container.

### D. Narrow container (inside a sidebar or split pane, roughly 300 to 440px)

- [ ] **D1 Single-column collapse.** Fields fall to one per line by carrying fewer fields per wrapped line, in strict source order; no field migrates past a neighbour and no field reorders.
- [ ] **D2 No horizontal page scroll.** Overflow is contained; the page body has no horizontal scrollbar at the narrowest supported width.
- [ ] **D3 Controls stay legible.** Bounded controls keep enough width to show their content; type stays at the `sm` token (never below).
- [ ] **D4 Wide-row reflow tracks the unit scale.** Any container-query breakpoint that moves a description beside its control is expressed in `--sf-unit` multiples, so it moves in step if a consumer rescales the unit.

### E. Broad container (a form under-filling a wide region, roughly 1600px-plus)

- [ ] **E1 Content-width cap, left-anchored.** Fields cap at their content width and anchor to the container's left (reading) edge; the form is not centered with two floating margins.
- [ ] **E2 Slack in one track.** Leftover horizontal space is one contiguous region on the trailing side (a single flexible or filler track), not distributed as sparse inter-field padding.
- [ ] **E3 Width signals length.** A bounded field (date, code, quantity) is visibly narrower than a long text field: `bounded.width < 0.5 * text.width`. A rigid control's width is unchanged between a wide and a narrow container while a flexible sibling absorbs the slack.

### F. Mixed control sizes on one line

- [ ] **F1 Shared top or baseline.** An `sm` Input beside a taller control on one wrapped line have top edges aligned within roughly 4px; a tall control does not drag its short neighbours to the vertical centre.
- [ ] **F2 Uneven labels do not stagger.** A one-word label beside a wrapped long label on the same line render their controls on a shared baseline; the long label renders fully without pushing its control down relative to the neighbour.

### G. Validation (interaction)

- [ ] **G1 No reflow on error.** Triggering an error on a middle field leaves every field below it at its original y-position; only the reserved message slot changes.
- [ ] **G2 Reward early.** Typing two characters into a fresh required field without blurring shows no error and no danger styling.
- [ ] **G3 Punish late, clear immediately.** Typing the correction into an already-errored field clears the error on the keystroke that makes it valid, not on the next blur.

---

## 5. Teardown: VerticalForm and FieldLayout against the rubric

What the two layout layers do today, and the concrete, named gaps. Line references are into `src/components/VerticalForm/` and `src/components/FieldLayout/`.

### VerticalForm

Passes:

- **A1, A3, A5** hold. Rows compose a vertical `Field`: label above control (`Field.Label`), u/4 row gap (`Field.module.css` `.root row-gap: calc(var(--sf-unit) / 4)`), section-to-field rhythm of 2u (content grid `row-gap: var(--sf-unit)` between rows plus the u/2 tighter within-section gap, `VerticalForm.module.css:9,19`), and description in `--sf-color-fg` (`Field.module.css:48-53`).
- **B1, B2, B3** hold. The Minimap rail is built from measured row offsets (`buildMarkers`, `measure`), each Section and Field registers a marker, errored fields set `tone: "danger"` (`VerticalForm.tsx:502,509`), and the rail only appears when the parent constrains height (the documented footgun, called out in the module header and prop docs).

Gaps:

- **Gap V1 (A2, card-per-field): default `elevation={1}` card-ifies every row.** `Root` defaults `elevation = 1` (`VerticalForm.tsx:209,424`) and each Field renders inside a `Box` surface (`VerticalForm.tsx:546-555`). The dense-form default therefore violates A2 out of the box. `bare` exists (`BareContext`, `.rowBare`) but is opt-in. The stance in section 2.2 says dense instrument forms should default toward bare, hairline grouping; today the consumer must remember to pass `bare`.
- **Gap V2 (G1, reflow on error): the error slot is not reserved.** The error is rendered conditionally (`{error != null ? <Field.Error ...> : null}`, `VerticalForm.tsx:524-528`). When it appears it inserts a line and grows the row; the component's own `ResizeObserver` exists precisely because "an error line appearing shifts every marker below it" (`VerticalForm.tsx:328-330`). That confirms the reflow: the rows below move. No pre-allocated message row. Fails G1.
- **Gap V3 (D4, unit scale): the wide-row split is a hard-coded px breakpoint with rem literals.** The description-moves-beside-control reflow is `@container (min-inline-size: 24rem)` with a `minmax(8rem, 12rem)` second column (`VerticalForm.module.css:85-87`). This is the one place in the form stack using rem literals instead of `--sf-unit` multiples, so it does not track the unit or density scale and will not move if a consumer rescales `--sf-unit`. Fails D4.
- **Gap V4 (E3, width signals length): rows are full-bleed.** `.fieldControl { min-inline-size: 0 }` (`VerticalForm.module.css:63-65`) and the control fills the row width; there is no per-field width contract. Every control, bounded or open, stretches to the row. Fails E3: VerticalForm cannot make a date field visibly narrower than an address field.
- **Gap V5 (B4, sparse fill): no vertical fill.** The content grid is content-driven (`.content { display: grid; row-gap: var(--sf-unit) }`); a short form in a tall container leaves genuine blank space. Unlike `DataTable` (which has `fillHeight` plus a dither band), the form body has no "hold the height, mark the emptiness" behaviour. The rail fills, but the form surface does not. Weak on B4.
- **Gap V6 (C1, C3, long labels): no label measure contract.** `.sectionTitle` (`VerticalForm.module.css:22-27`) and the field label (`Field.module.css:31-38`, `line-height: tight`, no `max-width`, no `overflow`/`text-overflow`, no measure cap) have no truncation or wrap contract. A long label wraps unpredictably and a long section title reflows the row. Fails C1 and C3.

### FieldLayout

Passes:

- **A1, A3** hold. Label above control (`.field { flex-direction: column }`, `.label` then `.body`, `FieldLayout.module.css:27-51`); rhythm is 2u between sections, 1u within, u/4 label-to-control (`.root gap: calc(2 * var(--sf-unit))`, `.section gap: var(--sf-unit)`, `.field gap: calc(var(--sf-unit) / 4)`).
- **D1, D2** hold. Because a Section is `flex-wrap` (not grid auto-flow), fields keep strict source order and never migrate lines (`FieldLayout.tsx` header comment, `.section flex-wrap: wrap`); narrowing carries fewer fields per line with no breakpoints. `min-inline-size: 0` on root and section contains overflow.
- **E2** holds. Slack is absorbed by flexible/filler `flex-grow` into whichever tracks grow, not by inter-field padding; `Filler` gives the single trailing track (optionally dithered, `FieldLayout.tsx:206-230`).
- **A5** holds. The hint reads at the small size in `--sf-color-fg` (`.hint`, `FieldLayout.module.css:64-69`), explicitly not grey.
- **E3 (partial)** holds for the bounded case: `rigid` pins a fixed unit width that does not shrink under a hint (`FieldLayout.tsx:129-136,182-185`), so a rigid control stays fixed while a flexible sibling absorbs slack.

Gaps:

- **Gap F1 (F1, F2, mixed control sizes): the row centres each field, with no cross-field baseline.** `.body { align-items: center }` (`FieldLayout.module.css:45-51`) centres each field's control-and-hint independently, and there is no subgrid or shared baseline across the fields on one wrapped line. A tall control on a line pulls its short neighbours to the vertical middle rather than a shared top or baseline. Fails F1 and F2 directly; this is the section 2.5 failure mode, present in the code.
- **Gap F2 (E3, width signals length): flexible fields grow uniformly to justify.** The default kind is `flexible` with `grow: 1, basis: 14u, min: 10u, max: 36u` (`FieldLayout.tsx:73-78`). Because every flexible field on a line grows with equal weight to justify it, sibling flexible fields tend toward equal widths regardless of expected input length. The input-length signal exists only if the author reaches for `rigid` (or hand-tunes `preferred`/`grow`) on every bounded field; nothing defaults a bounded datum to a narrower track. Partial fail on E3: bounded-versus-open width is manual, not enforced.
- **Gap F3 (C1, C2, long labels): the label has no measure contract.** `.label` (`FieldLayout.module.css:37-41`) has no `max-width`, no ellipsis, no `--sf-measure` cap. A long label wraps to as many lines as it needs and, because the label is a block above the control, a very long label in a narrow flexible field wraps unpredictably and grows the field's height, staggering the line (compounding Gap F1). Fails C1; contributes to C2.
- **Gap F4 (B4/E1 vertical fill): fills only horizontally.** `Filler` absorbs horizontal slack, but there is no vertical fill for a short form in a tall container. Consistent with VerticalForm's Gap V5: the "filled instrument panel" read is horizontal-only in the form layers.

### Cross-cutting

- **Reward-early / punish-late (G2, G3)** is untestable against these two components alone: both are presentational, so validation timing lives in `Form` and the consumer. The rubric's G items should be run against a `Form`-wrapped story, and `Form`'s validation policy is where the reward-early/punish-late invariant must actually be enforced.
- The two most valuable fixes, ranked: (1) reserve the message row so an appearing error stops reflowing the form (Gap V2), the highest-frequency real jump; (2) re-express VerticalForm's 24rem/8rem/12rem breakpoint in `--sf-unit` multiples (Gap V3), the one place the stack leaves the unit grid. Both are small and both close a stated principle.