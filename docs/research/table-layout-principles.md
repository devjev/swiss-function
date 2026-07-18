# Table Layout Principles

Guidance for building and evaluating table and grid components in `@tarassov-ch/swiss-function`, with a scoring rubric for driving `TableInput` toward the same standard as `DataTable`. Read alongside `AESTHETICS.md` (the why) and `docs/API.md` (the props). Everything below is written against the `--sf-*` token system; nothing here is a literal px value that a consumer cannot retune by rescaling `--sf-unit`.

## 1. Design stance

A table in this library is a precision instrument, not a content surface. It is closer to a Bloomberg terminal readout, an Airbus systems page, or a Müller-Brockmann grid than to any consumer data grid. The baseline grid on `--sf-unit` (1.5rem) is the single source of order: every width, gap, row height, and cell padding is a unit multiple. Data is foremost and full-strength (`--sf-color-fg`); chrome recedes (a muted `--sf-color-bg-subtle` header, hairline `--sf-color-border` seams, sharp `--sf-radius-default` corners at 2px). Numerals are tabular and right-aligned so columns of figures line up on the decimal and a financier can trust them at a glance. Overflow is honest: columns shrink toward a legible minimum first, then the grid pans like an instrument inside its own contained scroll region while the page around it stays put. It never reflows into cards, never stripes itself for decoration, never spends color it has not earned. Density is the default and a first-class control, not a compromise.

## 2. Principles by space

### Tight and narrow (a table squeezed into a sidebar, split pane, or ~300 to 440px column)

- **Every column has a content-type minimum width, declared in `--sf-unit` multiples**, keyed to what it holds: checkbox (~2.5u) < number or percent (~4u) < ISO date (must clear all 10 characters, ~7u) < text or name (~6u and up). A single global 3u floor is insufficient, because at the `md`/`lg` font it can be narrower than the cell's own padding plus an ellipsis.
- **Shrink first, then pan.** Tracks are `minmax(floor, preferred)`: columns contract toward their floors with no scrollbar, and only when even the floors do not fit does a horizontal scrollbar appear and the grid pans. The DOM stays one grid with constant row heights at every width. There is no card-collapse mode.
- **Truncate to one ellipsized line plus a `title` tooltip** so the full value stays recoverable and every body row keeps one constant height. Reserve wrapping for at most one designated prose column (capped at `--sf-measure`).
- **Header labels truncate the same way** (one line, ellipsis, `title`) and are **never rotated** to vertical or diagonal, which is a spreadsheet default and mangles legibility. The header row height does not reflow under compression.
- **Compress with density tokens, not sub-legible type.** Fit more columns with tighter uniform cell padding and the `sm` type size; never invent a fourth size below `sm`. Interactive hit areas (row checkbox, delete button) stay at least 24 by 24px even in compact mode.
- **Guarantee a minimum inter-column gutter of at least 1u** so two adjacent columns never abut and read as one value.

### Broad and wide (a small table in a 1600 to 2200px container)

- **Cap the useful measure and absorb slack in ONE trailing flexible or filler track** (the last column at `1fr`), not by inflating every column. Data columns keep content-sized widths; text cells carry a max measure well under `--sf-measure-wide` (80ch), typically `--sf-measure` (65ch), so lines never grow to prose length.
- **Anchor the table to the container's start (the reading edge), never centered.** A centered table floats both margins and removes the row's fixed left origin. Leftover space is one contiguous region on the trailing side.
- **Use a hybrid width contract:** fix predictable columns (status, date, actions) to content-sized tracks; let text columns flex between a real minimum (never a sliver) and a max measure; one long value overflows to a single ellipsized line plus tooltip rather than blowing out its column.
- **Fixed columns render at the same width wide or narrow.** Widening the container feeds the extra space to the filler track, not to the status or date column.

### Tall (hundreds to 100k rows)

- **Row height is fixed and an integer multiple of the baseline unit** (default 1.5u / 36px). Density is a spacing lever, not a type-shrinking one, so the virtualizer's spacer and scrollbar stay honest.
- **Virtualize:** only the visible window plus a small overscan is in the DOM (a bounded node count), and a fast scroll never flashes an empty band.
- **The sticky header is its own `position: sticky` layer**, z-ordered above the scrolling cells, never riding transformed body rows, never jittering or animating, and stays a real `th` in the accessibility tree.
- **Stay findable and announced:** the grid root exposes `aria-rowcount`/`aria-rowindex` against the true dataset (not the DOM window); `End` moves focus to the last row with a visible ring scrolled clear of the sticky header; header, frozen shadow, and edge fade render statically under `prefers-reduced-motion`.
- **Pin a grand-total row to the viewport bottom** for analytical tables (with optional per-group subtotals), column-aligned with the body, set off by a hairline `--sf-color-border` plus a muted `--sf-color-bg-subtle` fill, staying on screen while the body scrolls.
- **Keep the reader located:** a persistent "X to Y of N" record count that updates on scroll, a frozen identifier column during horizontal pan, and a static bottom edge-fade present only when more rows exist below (`pointer-events: none`, no animation).

### Dense-data (financial and numeric grids)

- **Numeric cells use fixed-width lining figures, right-aligned and aligned on the decimal point**, and digit width never changes as values change. Set `font-variant-numeric: tabular-nums` (and `--sf-font-mono` with `font-size-adjust: var(--sf-font-mono-adjust)` so mono matches the sans x-height). This is a hard invariant for a financier's grid.
- **Alignment is by content type and never centered:** text and identifier columns share one left edge; numeric columns share one right edge; each header adopts its column's alignment. Numeric columns auto-right-align off `edit.type`/accessor rather than requiring `align: "end"` per column. Treat an ID as an identifier (left), not a measured quantity (right).
- **Hold decimal precision constant within a column** and factor a repeated unit (`%`, `CHF`) out to the header (or one consistent trailing position) instead of repeating it per row. Uniform significant figures are what make decimal alignment line up.
- **Separator and chrome discipline:** at most one low-contrast horizontal hairline in `--sf-color-border` between rows; no zebra or alternating fills; no vertical column rules unless an explicit `gridLines` opt-in; no heavy enclosing frame. The only resting background change is transient state (hover, selected), painted as a translucent overlay ON TOP of content so a consumer cell color can never hide the state.
- **The header is a muted, `--sf-color-bg-subtle` band** that recedes against full-strength `--sf-color-fg` body cells and stays perceivable in both themes (above the WCAG 1.4.11 non-text floor). Sort state is an explicit ascending or descending arrow glyph (a shape that survives a grayscale filter), never hue alone.
- **Status color both means something and is redundant.** It resolves to a semantic token (`--sf-color-danger`/`-success`/`-warning`) and is paired with a non-color cue (leading dot, glyph, or text), so a grayscale render keeps every status distinguishable. Non-status cells carry no decorative color.
- **Format numbers by locale and keep alignment robust:** detect the decimal separator from the locale (Swiss `1'234.50`, European `1.234,50`), not a hard-coded comma-group and dot-decimal. Parenthesized or trailing-sign negatives and mixed-sign columns must not shift the decimal column. Displayed rounding must reconcile with the underlying total (a 2-dp column whose cells do not sum to the shown total is a lie).

### Many-columns (more columns than fit; 20-plus columns)

- **Pan a real grid inside a contained, keyboard-focusable scroll region;** rows keep grid semantics at every width. Never reflow rows into stacked cards or key/value lists. The page body never gains a horizontal scrollbar; the overflow is contained in the region.
- **Freeze only a column that actually identifies the row,** keep it narrow, and cap the frozen block at roughly half the container so something is always left to scroll. Reveal a hairline or token-shadow boundary once scrolled, not a heavy border. Freezing is conditional on a meaningful anchor, not automatic; the frozen identifier needs enough width (and a tooltip) to actually name the row.
- **Signal off-screen columns honestly on the panning axis:** a partially clipped last column and/or a dithered edge-fade (`--sf-dither`) or scroll-shadow that moves as you pan (the horizontal analogue of the bottom edge-fade). The overlay is `pointer-events: none` and static. Never a centered dots or pager widget.
- **At the sticky-header / frozen-column intersection, layer correctly:** the corner on top, header and frozen column above the body, body below. No cell bleeds through the corner.
- **Chunk a wide span with two-row spanning group headers,** each group cell spanning exactly its children and delineated by a hairline or spacing, not by color. This is the structural way to give the eye landmarks.
- **Dropping columns is user-controlled or reversible,** never a silent auto-hide of comparable data: a visible column chooser, or a row-detail expansion that reaches every value. To inspect one record's many attributes, transpose it into a label/value detail panel while the grid itself stays a horizontal grid.
- **The horizontal scroll container is keyboard-operable and announced:** `tabindex="0"`, `role="region"`, a non-empty accessible name, Arrow/Home/End scrolling, and a visible focus ring from `--sf-focus-ring-width` / `--sf-color-focus-ring`. Use `overscroll-behavior` so reaching the end does not scroll the page or trigger back-navigation.
- **Density adapts to CONTAINER width** (`ResizeObserver` / the `useCollapse` mechanism), not viewport media queries, so the same table renders denser inside a narrow pane on a wide screen. Any abbreviated value stays recoverable via `title`.

## 3. Reject list (anti-patterns we will not adopt)

- **Zebra striping / alternating row fills.** Decorative color; collides with hover, selected, and disabled tints into indistinguishable greys. Track rows with one hairline plus tabular alignment.
- **A ~48px comfortable default row.** Consumer touch-target folklore; clashes with the dense 1.5u default. Default dense; offer comfortable as an option.
- **Avatar or photo columns.** A feed signifier with no data value on a working grid.
- **Card-ified rows (a bordered or elevated box per row).** Each card costs at least 1u of padding on four sides plus a border; it destroys density. Group with hairlines and spacing.
- **Rotated or diagonal header labels.** A spreadsheet default that mangles legibility. Truncate to one line plus `title` instead.
- **Centering an under-filled table.** Floats both margins and removes the row's fixed left origin. Anchor to the reading edge.
- **Pale-blue selection wash or any decorative hue.** Selection and status are semantic; paint them with tokens as translucent overlays, not a friendly tint.
- **A centered dots or pager widget for horizontal overflow.** Dishonest about position. Use a moving edge-fade.
- **Card or stacked "mobile view" reflow at a breakpoint.** A data grid stays a grid at every width; it pans, it does not restack.
- **Flag, star, or emoji glyphs in cells.** Emoji are user content, not iconography.
- **Grey body, description, or hint text.** The cardinal sin. Body and helper copy stay full-strength `--sf-color-fg`; only genuine metadata uses `--sf-color-fg-subtle`.
- **A pulsing skeleton while data loads in 150ms.** Motion without information. Either show immediately or convey real progress.
- **A second structural border tier.** There is one `--sf-color-border`; `-strong`/`-subtle` are aliases. Separate things with elevation and spacing, not a lighter line.
- **Hard-coded px minimum widths.** They drift when `--sf-unit` or the density tokens rescale. Declare floors in unit multiples.
- **A GOV.UK-style error-summary block on a fully-visible panel.** Redundant chrome that competes with the data. Inline-at-field errors suffice when nothing is off-screen.
- **Free-form density values.** Density is discrete `xs`/`sm`/`md`/`lg` ladders on the type and space scale, not arbitrary numbers.
- **Entrance or celebration animation on rows and cells** (rows growing in, saved-confetti, checkmark zoom). An instrument redraws; it does not perform.
- **Right-aligned label columns in forms as a general pattern.** They break under long labels and DE/FR localization (roughly twice EN width). Top-aligned, left-flush is the rule.

## 4. The rubric

A numbered, testable checklist for a Playwright improvement loop to score `TableInput` (and any grid) under each adverse condition. Each item states a measurable pass condition. Run each condition in both themes. Score is items passed over items applicable.

### U. Universal (every condition, every width)

- **U1** The component root is a single grid: at the narrowest and widest tested widths the header and every data row have the same N cells, and a data row's computed `display` is `grid`/`table-row` (never `block`); `thead`/header is not `display: none`.
- **U2** The page body has no horizontal scrollbar at any tested width; horizontal overflow is contained inside the component's own scroll region.
- **U3** Description and error copy computed `color` equals `--sf-color-fg` and `--sf-color-danger` respectively; `--sf-color-muted` and `--sf-color-fg-subtle` appear on no body or helper text.
- **U4** Resting corners compute to 2px (`--sf-radius-default`); no cell or row has a larger radius.
- **U5** Under emulated `prefers-reduced-motion: reduce`, no header, edge-fade, frozen-shadow, or row has a running `transition`/`animation`.
- **U6** Every interactive hit target (row checkbox, delete, add, drag handle) measures at least 24 by 24px.

### T. Tight and narrow (containers at 640 / 440 / 300px)

- **T1** A horizontal scrollbar appears only at the narrowest width, not at 640px where columns merely shrink; row heights stay identical across all three widths.
- **T2** An ISO-date column still shows all 10 characters at 300px; no leaf column renders below its declared content-type floor; no cell clips to fewer than ~3 characters.
- **T3** A 200-character string in a narrow text column renders exactly one row-height tall, ends in an ellipsis, and has a `title` equal to the full string; two adjacent rows measure identical heights.
- **T4** A long header label has computed `transform: none`, ends in an ellipsis, exposes its full text via `title`, and the header row height equals the untruncated case.
- **T5** Computed body `font-size` equals the `sm` token (never below); horizontal cell padding equals the compact token.
- **T6** Between any two right-aligned columns the gap from the left column's rightmost glyph to the right column's leftmost glyph never drops below ~1u across all rows.

### B. Broad and wide (containers at 1200 / 2000px, under-filled data)

- **B1** With ~5 content columns, the summed content-column width is bounded and a single contiguous trailing track holds the remainder; re-running at 1200px keeps those columns near-identical widths (the extra space went to the filler).
- **B2** The table's left edge sits at the container's start gutter, not at `(container - table) / 2`; leftover space is one region on the trailing side.
- **B3** No text cell's rendered line exceeds its column max measure; an over-long value renders one ellipsized line with a `title` revealing the full string.
- **B4** A fixed column (status, date, actions) has the same computed width at 1200px and 2000px.

### L. Tall (100k-row dataset)

- **L1** The DOM holds a bounded number of row nodes (well under the dataset size); every row's measured height is identical and a multiple of the baseline unit.
- **L2** A rapid scroll to a mid-list offset shows populated cells after one frame (no white gap).
- **L3** Header pixels at `scrollTop = 0` and scrolled to row ~250 are identical and anchored at `y = 0` while body pixels differ; no `transform`/`transition` animates the header.
- **L4** `aria-rowcount` equals the full dataset length while the DOM holds a window; `End` focuses the last row (correct `aria-rowindex`) into view with a visible focus ring below the sticky header.
- **L5** With a pinned total enabled, the total row occupies the same bottom-edge `y` at `scrollTop = 0` and at the last row; its numeric cells right-align on the same column `x` as body cells; a hairline sits above it.
- **L6** A record count renders and updates after scrolling; the bottom edge-fade is present when not at the end, absent at the last row, and has `pointer-events: none`.

### D. Dense-data (mixed-magnitude numeric + status columns)

- **D1** In a numeric column of values like `9.50`, `1234.00`, `12.75`, the decimal-point x (or right edge) is identical across rows within ~1px; computed `font-variant-numeric` is `tabular-nums` (or the family is `--sf-font-mono`).
- **D2** For a text column, header plus all cells share a common left x-edge; for a numeric column, a common right x-edge; a number-typed column is right-aligned with no per-column config.
- **D3** Every cell in a numeric column shows the same decimal-place count; the unit symbol appears once in the header, not per row.
- **D4** Backgrounds of consecutive resting rows are byte-identical (no alternation); a sample between columns equals the body background (no vertical rule); on hover exactly one row's background changes; separator luminance delta versus background is small.
- **D5** The header-versus-body background luminance delta is small (muted, not a bold bar); triggering a sort renders a direction arrow that survives a grayscale filter.
- **D6** A status column re-rendered in grayscale keeps every status distinguishable (dot plus label); status colors resolve to semantic tokens; non-status rows contain no colored fill.
- **D7** With a European/Swiss locale, thousands and decimal separators format per locale and the decimal column still aligns; a negative value in a mixed-sign column does not shift the decimal x.

### M. Many-columns (22 columns, wider than the container)

- **M1** At the narrowest width the DOM is one grid with the same N header cells; a data row's computed `display` is grid/table-row; the horizontal scrollbar lives inside the region.
- **M2** With a frozen first column, `scrollLeft = 0` versus `400` leaves the frozen column pixel-identical while later columns translate; the frozen region's right edge is at most 50% of the container and at least one column stays scrollable.
- **M3** At horizontal overflow a partially clipped column and/or a right-edge fade is painted; scrolling fully right moves the fade to the left edge; the overlay has `pointer-events: none` and no animation; no centered dot or pager element exists.
- **M4** Scrolling both axes so a body cell would pass under the top-left corner, a pixel sample of the corner equals the header/frozen background (nothing scrolled shows through).
- **M5** The header's group row has cells whose left/right edges coincide with their first and last child column edges; adjacent groups are separated by a hairline or spacing, not color.
- **M6** Shrinking below all columns' combined min-width leaves the header-cell count unchanged OR exposes a visible column-chooser/overflow control; a data column never vanishes with no control and no detail row.
- **M7** Tabbing reaches the scroll region with a visible focus outline; `ArrowRight`/`End` increases `scrollLeft`; an accessibility snapshot shows `role="region"` with a non-empty accessible name.
- **M8** The same table renders differently full-bleed versus inside a narrow `SplitPane` at one viewport width (container-driven, not viewport media queries); hovering an abbreviated cell exposes the full value.

### F. Forms (when the table is a form control inside `Field`)

- **F1** Each field's label sits above and left-flush with its control (`label.bottom <= control.top`, `|label.left - control.left| < 2px`); no placeholder stands in for a label.
- **F2** The description/error row is pre-allocated: triggering an error on a middle field keeps every field below at the same `y`; only the reserved message slot changes.
- **F3** A fresh required field typed into (without blur) shows no error; an already-errored field clears its error on the keystroke that makes it valid, not on blur.
- **F4** Every resting field border/background is a neutral token; focusing one field makes its ring the only newly-saturated element; required versus optional stays distinguishable when desaturated.
- **F5** Bounded controls (date, code, quantity) render visibly narrower than open text; a rigid control's width is unchanged between two container widths while a flexible sibling absorbs the slack.

## 5. Current gaps in TableInput (and where to reuse DataTable's engine)

`TableInput` (`src/components/TableInput/`) is a compact controlled grid for editing an array of objects. It already reuses DataTable's `EditConfig` editors and copies the shrink-then-scroll `minmax` overflow model, but it grows several things itself that it should instead share with DataTable's engine. Against the rubric above, these are the open gaps:

- **Numerals are not tabular (fails D1).** `TableInput.module.css` sets no `font-variant-numeric` and no `--sf-font-mono` on cells; numeric editors render in the inherited proportional sans, so digits do not column-align. It should adopt `font-variant-numeric: tabular-nums` (with `--sf-font-mono` + `--sf-font-mono-adjust`) on `edit.type === "number"` cells, the same fix DataTable still owes.
- **No automatic right-alignment for numbers (fails D2).** `align` defaults to `"start"` for every column, including numeric ones (see `RowCells`: `data-align={column.align ?? "start"}`). It should default `align: "end"` when `edit.type === "number"`, keyed off the edit type, not left to the consumer.
- **Header labels do not ellipsize (fails T4/M-header).** `.headerCell` sets `white-space: nowrap` but no `overflow`/`text-overflow`/`title`, so a long header overflows its cell inconsistently with the body (which truncates). It should truncate to one line plus `title`, matching body behavior; reuse DataTable's header-cell treatment rather than diverge.
- **No content-type floor for dates (weakens T2).** `floorFor` gives `boolean` 2.5u and `number` 4u but funnels `date`/`select`/`text` through the generic `minColumnWidth` (6u), which can clip a 10-character ISO date. Add a date-specific floor (~7u) drawn from the same content-type floor table DataTable should expose.
- **No row virtualization (fails L1/L2).** `TableInput` renders the entire `value` array to the DOM with a content-driven height; it has no windowing, no max-height/scroll story, and shares none of DataTable's TanStack `useVirtualizer`. This is a scale cliff past a handful of rows. When a consumer needs more than a small form array, it should reuse DataTable's virtualizer rather than reimplement one.
- **Density is under-controlled (fails T5 parity, D-density).** `size` is only `sm`/`md`, with no `cellPadding`/`cellFontSize` knobs, and editors are pinned to `sm`. A dense (`xs`) DataTable and a `TableInput` cannot be tuned to the same visual density. It should consume DataTable's density var system (`--sf-cell-pad-x`, the `cellFontSize` ladder) instead of its own two-value `size`.
- **Seams are real borders, not the erasable hairline system.** `TableInput` uses `border-block-start: 1px solid var(--sf-color-border)` per row and a 1px root border, where DataTable draws per-cell inset box-shadow seams via `--sf-cell-edge-r`/`-b` that any single seam can zero (for merges and frozen edges). If `TableInput` ever needs cell merging, frozen columns, or a pinned total, it should adopt that seam mechanism rather than grow parallel border rules.
- **No frozen columns, pinned total, horizontal edge-fade, sort, or filter (M2/M3/L5 not applicable yet).** These are DataTable engine features living in `src/lib/columns` and the DataTable viewport. `TableInput` should not reimplement any of them; if a use case demands one, route it through the shared column machinery, keeping the split that issue #28 established for Explorer versus DataTable (shared column/width/density/virtualization layer, separate selection and editing models). For `TableInput` the shared axis is the column-template, width-floor, density, and virtualization layer; its always-on-editor, add/delete/reorder model is the deliberate divergence and should stay local.
- **No empty/loading/error state.** A zero-row `TableInput` shows only a header plus the add button, and a pending or failed load has no story. If it is ever fed async data, it should render an honest `NonIdealState` in the body while preserving the header and column context, the same primitive DataTable should use for its own empty state.