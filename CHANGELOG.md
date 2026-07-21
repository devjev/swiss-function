# Changelog

Notable changes per release. Entries up to and including **v1.15.2** were
reconstructed from the git history (`scripts/changes/backfill.mjs`) — the
project predates the changeset flow. From **v1.16.0** on, entries are generated
from the changesets in [`.changes/`](.changes/README.md) by `just release`. The
parenthesised tag on each heading is the semver bump.

## v2.14.0 — 2026-07-21

### Minor

- ColorPicker: a channel-slider colour picker across OKLCH/OKLab/RGB/HSL/HSV/LCH/Lab plus a hex field, with live gradient tracks, alpha over a checkerboard, an optional screen eyedropper, preset swatches, and sRGB-gamut handling (out-of-gamut chip + Clamp). Adds a hand-rolled colour engine at lib/color, a ColorSwatch chip, and --sf-slider-track-bg / --sf-slider-track-shadow / fill=none to Slider.
- DigitInputMicro: add fixedDecimals — always show a fixed number of decimal places, padding with trailing zeros (0.5 -> 0.500), for stable-width, decimal-aligned numeric columns. ColorPicker's channel fields use it.
- Slider: an instrument-panel fader control (wraps Base UI Slider). A recessed slot with a sharp-cornered accent fill and a square, raised fader-cap thumb; single value or a two-thumb range, tones + a dither fill, sm/md/lg sizes, ticks/marks, a floating value bubble, and vertical orientation. Drops into Field.
- Tabs: Tabs.List overflow folds tabs that don't fit into a trailing ⋯ overflow menu (the priority-plus useOverflow pattern, container-width based) instead of overrunning the row; the selected tab is always kept visible, and menuLabel names the trigger.

## v2.13.0 — 2026-07-19

### Minor

- Add Login, a terminal-styled sign-in panel: a dithered title bar, monospace identifier and password fields (DOS block caret, mono show/hide toggle), a terminal error line, and slots for a footer and other auth methods (alternatives, below a dithered divider). Self-contained: it holds the field state and reports the credentials on submit; you drive loading and error. Complements Input type=password for a bare password field and DigitInput mode=mask for 2FA/OTP/PIN.
- Add PasswordInput, an Input for a password with a monospace show/hide toggle at its end (masks by default, takes every Input prop, drops into a Field). Login now uses it for the password field, and every button in the Login panel renders monospace for full terminal consistency.

## v2.12.1 — 2026-07-19

### Patch

- Maintenance release.

## v2.12.0 — 2026-07-19

### Minor

- Add Stack, a resize-aware fill/stretch layout primitive (Stack + Stack.Fill): a column/row where a Fill region stretches to absorb the remaining space and locks to the edge as the container resizes, encapsulating the flex + min-*-size:0 chain. Adds a fill prop to TextEdit (stretch to a flexible parent, drop the resize handle), and makes Dialog.Popup a flex column so a Stack fill body works directly. Closes #74.
- TableInput and form-layout improvements against the new layout rubrics. TableInput: numeric columns auto right-align in tabular mono figures; header labels ellipsize with a title; a date width floor; an empty slot for the no-rows case; fillHeight dithers the band below sparse rows; cellPadding and cellFontSize consume the DataTable density variables; opt-in virtualize windows large arrays under a sticky header. DigitInputMicro gains an align prop (right-aligned digits with the placeholder slots leading). VerticalForm gains reserveError (a pre-allocated error slot, so an appearing error does not reflow the rows) and a per-field width cap; VerticalForm and FieldLayout labels wrap within their column, and FieldLayout fields on a wrapped line share a top edge.

### Patch

- TableInput: robust resizing. Columns now shrink toward a per-column minWidth (new minWidth column prop + minColumnWidth prop) and the table scrolls horizontally once they can't all fit, instead of collapsing and overlapping when narrow. Cells stretch and their controls fill the column, so end/center-aligned values no longer leave dead space on the left and a control never overflows into the next column. Closes #79.

## v2.11.1 — 2026-07-16

### Patch

- TableInput: even the vertical rhythm — the last data row now sits 0.5u above the divider below it, matching the header's top padding (was a tighter 0.25u), so the data region reads symmetric top-to-bottom

## v2.11.0 — 2026-07-16

### Minor

- DigitInput: opt-in signed prop for negative values (push mode). Adds a leading +/- cell you can click or set by typing -/+, ArrowDown steps below zero, and the value and form string carry the sign. Mask mode is unaffected (signed is push-only).

## v2.10.0 — 2026-07-16

### Minor

- TableInput: a compact editable table as a form control for entering arrays of objects. Per-column cell editors via DataTable's edit config (text/number/boolean/select/date), add-row and per-row delete, opt-in drag-to-reorder (lazy dnd-kit), min/max rows and equalColumns. Controlled value/onChange; drops into a Field

### Patch

- RadioTable: the wide layout now reads as a real table. Every row shares one label column (a CSS subgrid), so all descriptions start on the same line regardless of label width; the description text is left-aligned (was right-aligned) and hyphenates long words (hyphens: auto)
- Switch, Checkbox, Radio: in dark mode these small controls no longer carry the brutalist hard-cast elevation shadow (a zero-blur block stepping to the lower-right), which read as a misaligned rectangle rather than a shadow at their size. They use a soft resting shadow instead; light mode is unchanged. Fixes #78

## v2.9.0 — 2026-07-16

### Minor

- Chat/ChatDrawer: a ChatErrorPart (type: 'error') renders a backend error as a small NonIdealState-style glitch block with the message, optional requestId and a Retry; a new onError callback fires once when an error appears (log/toast/auto-retry), and Retry reports through onAction. Closes #77

### Patch

- Minimap: maxMarkerSize now compresses the rail (shrinks the content height so the capped blocks pack together) instead of only clamping each block's rendered height and leaving the rail full-height with gaps. VerticalForm's maxBlock inherits this
- Minimap: while dragging the focus band on a scrollable rail, the band now pins at the rail edge instead of dipping below the visible bottom (the fold); the edge auto-scroll flows content under the pinned band
- RadioTable: in the wide layout every cell (radio, label, description) is vertically centered, so a tall multi-line description no longer leaves the radio/label floating at the top; and the label no longer collapses/overlaps the description (the query container moved off the option grid, and Base UI's hidden input is taken out of grid flow)
- VerticalForm: bare option renders rows without the surrounding box (no surface, no padding) for a minimal look

## v2.8.0 — 2026-07-16

### Minor

- Add RadioTable: a bordered, hairline-divided table of radio options, each a radio + label + description; the description sits right of the label when wide and below it when narrow (tight, unit-scaled). Compound RadioTable + RadioTable.Option, built on RadioGroup/Radio
- Add VerticalForm: a scrollable vertical field stack (one field per row) navigated by a Minimap rail. Each row reads on the rail as a filled dither block (the density read) with its field name as a label riding on top; an errored field tones both its block and its rail label danger. VerticalForm.Section titles group fields and read in italics on the rail, with their fields indented under them. When a row is wide the field's description moves to the right of the control (a container query on the row), dropping back below it when narrow. Opt-in `nav` adds a bottom bar with a searchable Picker of every title (sections and indented fields): selecting one scrolls to it, and scrolling updates the Picker to the title at the viewport top; `navSize` sizes that Picker (default sm); selecting a title centers the field in the viewport (accounting for its own height and the nav bar) and the Picker tracks the centered title (defaulting to the first at rest). `minBlock`/`maxBlock` bound the rail block heights in units (default min 0.5u): a dense form's rail no longer compresses its blocks away, it scrolls. Fields lay out on a columnless grid with a consistent half-unit vertical rhythm and baseline line-heights. Compound VerticalForm.Section / VerticalForm.Field, presentational (wrap in Form for validation).
- Menu.Popup and MenuBar.Content: add returnFocus (default true); set false to keep focus off the trigger when the menu closes, so a custom hotkey layer isn't disturbed and a stray Space/Enter doesn't reopen it (maps to Base UI finalFocus)
- Minimap: minMarkerSize keeps block spans from compressing below a floor; when the content is too dense the rail's inner content grows taller than the rail and the rail itself scrolls, auto-following the viewport band (so more labels survive). maxMarkerSize caps block height for sparse content. jumpAlign='center' lands a label-click jump (and the active anchor) at the viewport middle rather than the top. In the scrollable-rail mode, dragging the viewport band to the rail's top/bottom edge keeps the rail (and the content) scrolling, so the drag can reach content beyond the visible rail

### Patch

- ChatDrawer: forward the new reveal prop to its inner Chat (default mode), so drawer consumers can reach mode="stream" / charIntervalMs / reveal=false (fixes #76)
- Minimap: heading labels use a smaller (0.65rem) size via the new --sf-minimap-label-size token and are rendered as a tight caption that hugs its text (a small opaque background pill, level indent applied as position not padding) rather than a full-width chip, so dither block markers stay the main density read and headings ride on top of them. A label on a block-span marker now sits at the block's top, so it lines up with the block and with the viewport band when that content is scrolled to the top (a bare heading rule still centers its label). Adjacent block spans are trimmed a few rail px apart so a stack of them reads as separate blocks. A toned marker's label now takes its tone's colour (a danger heading reads red in its text, not only its block). Per-level label indent is a quarter-unit (down from a half), and a new marker `emphasis` renders its label in italics (used for grouping headings). The viewport focus band renders above the labels (a translucent overlay), and the active-label accent is an inset shadow rather than a border. The default rail width (--sf-minimap-width) is now 3u (72px), down from 6u, for a slimmer rail; override the token or the width prop to widen it.
- Picker: opening the dropdown after a selection now shows the whole list and starts a fresh search on the first keystroke, instead of keeping the selected label as the filter (which matched only that item and made typing append to it)

## v2.7.0 — 2026-07-15

### Minor

- Add Minimap: a scroll overview rail with structural markers, clickable heading labels, and a proportional viewport indicator
- Chat: add reveal prop to tune or opt out of the streaming-text terminal reveal (forwards mode/charIntervalMs/tailLength to StreamingTerminalText, or false for plain Markdown); StreamingTerminalText gains mode="stream" that tracks a live token stream instead of lagging then bursting
- DataTable: highlights prop for persistent coloured range overlays (Excel coloured-range-reference look: light fill + perimeter border). Positional and declarative; several distinct colours mark separate ranges (e.g. charting series), driven from onSelectionChange

### Patch

- DataTable: rework the columnFill / fillHeight dither into one continuous backdrop behind the grid (was two measured, absolutely-positioned panels). Removes the L-shaped seam, halves the animated WebGL contexts to one, and drops all fill geometry measurement

## v2.6.0 — 2026-07-14

### Minor

- DataTable: fillHeight holds a fixed height with too few rows and dithers the empty band below the last row

## v2.5.1 — 2026-07-14

### Patch

- CodeEditorInline: the sm size now rests at 1u (was ~30px) and lg at ~2u, so the size rungs land on the standard control heights (sm 1u / md 1.5u / lg 2u).

## v2.5.0 — 2026-07-14

### Minor

- Add CodeEditorInline: a CodeEditor that rests as a single line and expands to a multi-line editor on focus (the code sibling of TextEditInline). Collapsed shows line 1 syntax-highlighted (a live CodeMirror, not a label); focus floats the full editor over the content below (elevation-3), growing to maxRows then scrolling and vertically resizable by drag while active; blur collapses back. Takes every CodeEditor prop plus maxRows / collapsedElevation.
- DataTable and Explorer: new cellPadding and cellFontSize props (each xs | sm | md | lg, default md) to set cell density and text size independently — from tight, small-font grids for dense financial tables to roomy, larger-font ones. Applies to header and body cells.

### Patch

- CodeEditor: make the block caret more visible (opacity 0.4 -> 0.6) so it's easier to spot while still letting the glyph read through. Applies to CodeEditor and CodeEditorInline.
- DataTable: an editable column's resting cell display now matches what its editor shows — boolean cells read True/False (not true/false), select cells show the option's label (not the raw value), numbers get their decimals + unit, and dates render as ISO — so activating a cell no longer jumps the value's text. Columns with a custom cell renderer are unaffected.
- DataTable: fix the boolean/select cell editor (a Picker) overflowing a narrow cell into the next column. The Picker's 12rem standalone min-width floor (added in 2.3.1 for issue #69) leaked into the inline editor; the editor now zeroes that floor and fills the cell.

## v2.4.1 — 2026-07-14

### Patch

- Dark-mode elevation now reads depth three ways, all carried by the same --sf-elevation-N token so every elevated component gets them: the brutalist hard cast (kept), plus a slight full-bleed lightening film above level 1 (the surface reads a touch lighter than the page) and a 1px inset edge that brightens with the level (bordered rims read progressively lighter). Light mode unchanged.
- DataTable: drop the scrollbar-gutter reservation added in 2.3.2. It was unnecessary — DataTable already mirrors the header width onto the body, which keeps the columns aligned regardless of the scrollbar — and it reserved permanent gutter space. (The real #70 fix was the same mirror, now added to Explorer.)
- Explorer: fix the header/body column borders drifting out of alignment when a vertical scrollbar is present (issue #70). The sticky header spans the full scroll width while the body shrank to the scrollbar-reduced client width, so the columns fell progressively out of line toward the right. The body is now mirrored to the header's measured width (the same mechanism DataTable already uses), keeping every column aligned regardless of the scrollbar.

## v2.4.0 — 2026-07-14

### Minor

- Progress: the track/fill corner radius is now a component-scoped token, --sf-progress-radius (default --sf-radius-default). Set it to 0 to square the bar to match the blocky dither family without overriding the shared --sf-radius-default for the whole subtree (issue #71).

### Patch

- Consistent scrollbars: every scrollable surface in the library now uses the shared scroll-surface tokens (thin, invisible-until-hover, primary thumb on region hover) via the `scrollable` utility. Previously only DataTable, Pane, Prose and WindowArray did; now Chat, Dialog, Drawer, Explorer, Notebook, Picker, Selector, SplitPane, ThemeBuilder, Timeline, the Combobox dropdown, Markdown code blocks, and the CodeEditor (CodeMirror) scroller match too.
- Timeline / chart date axes: cache the Intl.DateTimeFormat used for tick labels instead of rebuilding one per label via toLocaleString. Tick formatting was the dominant cost when a view with a Timeline mounts (~120ms in a profiled route switch-back, issue #72); the cached formatter is ~40x cheaper per label with identical output.

## v2.3.2 — 2026-07-13

### Patch

- DataTable: reserve the vertical scrollbar gutter (scrollbar-gutter: stable) on the scroll viewport, so the content-box width stays constant whether or not a classic (space-taking) scrollbar is showing and the header/body column tracks can't drift apart when it appears (addresses #70). No-op with overlay scrollbars.

## v2.3.1 — 2026-07-13

### Patch

- Selector (layout=compact): a width set on the control (className or inline style) now fills the field again, instead of leaving the input group at its content width in empty space (regression, issue #69). The compact root shrinks to content so it still tucks into a toolbar, but an explicit width wins and the group fills it.

## v2.3.0 — 2026-07-13

### Minor

- Add two animated dither effects to the shared set (NonIdealState / Skeleton / DataTable / Progress): cascade (wave crests rolling top to bottom) and crosswave (the same rolling left to right).
- DataTable: copying cells (Cmd/Ctrl+C) now prepends the selected columns' header names as the first row, so a paste into a spreadsheet or document is self-labelling. Controlled by the new copyWithHeaders prop (default true); set it false for a values-only copy.

## v2.2.0 — 2026-07-13

### Minor

- Add Progress: an accessible progress bar (Base UI Progress) with determinate/indeterminate value, color/dither/animated fills (reusing the shared WebGL dither engine, loaded lazily), tones, elevation, xs-lg thickness, and an optional inline percentage readout.

### Patch

- Selector and Picker: stop the field collapsing to the search input's min-content in a shrink-to-fit parent (an inline-flex toolbar, a float, an auto grid track), where inline-size: 100% is inert. panel/inline Selector and Picker now hold a 12rem width floor (tunable via --sf-selector-min-inline-size / --sf-picker-min-inline-size, 0 disables); compact stays fit-content. A narrow definite cell still clamps the control so it fills rather than overflows (issue #25 unchanged).

## v2.1.2 — 2026-07-12

### Patch

- Dark-mode elevation: brutalist hard offset in the border color (no blur/spread), replacing the soft blurred key shadows.

## v2.1.1 — 2026-07-12

### Patch

- Dark-mode elevation: the elevation, recess, and legacy shadow tokens now encode depth as a luminance cascade in dark mode (a translucent surface-lightening layer per level plus strengthened key shadows) instead of near-invisible black shadows on the near-black ground. Token-only change; light mode untouched.
- Migrate the Menu, Dialog, Combobox, DatePicker, and Map popups off the legacy --sf-shadow-* scale onto the --sf-elevation-* tokens everything else uses (Dialog to elevation-5, the dropdowns to elevation-3, the Map tooltip to elevation-2), and remove the now-unused, undocumented --sf-shadow-sm/md/lg/xl tokens (light and dark). Closes #68.

## v2.1.0 — 2026-07-11

### Minor

- 2D chart polish: measured axis labels (thin/ellipsize, never rotate; measured y column via --sf-axis-label-width), rAF-coalesced resize with no blank first paint and stable label sets (step hysteresis, survivor bias), device-pixel-snapped chrome, tabular numerals, unified crosshair/tooltip anchor with a flash-free tooltip, Heatmap de-stretched to seam-free px-space cells with cell-center ticks, Timeline measured lanes with hover-revealed overflow labels and a pxPerDay scroll extent, Scatterplot halo instead of per-point shadows, formatNumber suffix labels capped at 4 significant digits.

## v2.0.0 — 2026-07-11

### Major

- Notebook analysis feature: the Notebook component (reactive cells over consumer-provided engines via the public CellType contract), createSqlCellType and proseCellType, the in-house reactive scheduler, and fromArrow (Arrow results to plain rows with Date coercion and a BigInt policy) at lib/from-arrow. New entries: ./notebook and ./lib/from-arrow. The engine stays the consumer's: the library ships no execution language, no data engine, and no eval.

### Minor

- Add the Form composition primitives (Form, FormField, FormError) — form-level submit + validation on top of Field, with a bring-your-own resolver. Closes #49.
- Add the Icon system — an Icon primitive plus a curated, tree-shakeable line-weight set (41 glyphs, 16x16, currentColor, square caps, --sf-unit sizing) matched to the Swiss/monospace posture; createIcon for custom glyphs. Closes #51.
- Add ThemeBuilder — a live editor for the --sf-* tokens (edit palette/unit/radius/typography/motion, live preview, copy CSS/JSON), plus a token pipeline that emits tokens.json / tokens.js / a Style-Dictionary tree from the canonical tokens.css. Closes #50.

### Patch

- Add a self-hosted visual-regression gate (npm run vrt) — dev tooling, no runtime change. Closes #47.
- Add changesets-driven release automation (.changes/ + just release). Closes #48.
- Back-fill CHANGELOG.md with the full release history reconstructed from git (scripts/changes/backfill.mjs); fix the changeset release-notes insertion to preserve the changelog preamble.

## v1.15.2 — 2026-07-07 (patch)

- DataTable: inline cell editors inherit the cell font-size (14px)

## v1.15.1 — 2026-07-07 (patch)

- DataTable: in-cell editors fill flush (drop the double frame)
- DataTable: boolean & select cells edit with Picker

## v1.15.0 — 2026-07-06 (minor)

- Rename DigitField -> DigitInputMicro; dithered placeholder glyph

## v1.14.0 — 2026-07-06 (minor)

- DataTable edit experience: DigitField + rich cell editors + edit-activation

## v1.13.2 — 2026-07-06 (patch)

- DigitInput: resolve Base UI OTP field across the export rename

## v1.13.1 — 2026-07-06 (patch)

- Tabs: stop the row reflowing when the bold active tab is selected

## v1.13.0 — 2026-07-06 (minor)

- CodeEditor: monochrome themes (minimal/bold/primary), block caret, elevation

## v1.12.0 — 2026-07-06 (minor)

- Add CodeEditor (CodeMirror 6, token theme, opt-in vim)

## v1.11.0 — 2026-07-06 (minor)

- Add TextEditInline; fix FieldLayout dither story

## v1.10.1 — 2026-07-06 (patch)

- ci(publish): harden Forgejo release + tarball asset step
- feat(tokens): ship JetBrains Mono as an optional webfont

## v1.10.0 — 2026-07-06 (minor)

- Charts: zoomOutLimit — allow zooming out past the data extent
- Chart stories: name the full interactive widget "ChartWindow" everywhere

## v1.9.0 — 2026-07-05 (minor)

- CI: automatic release on v* tags (Forgejo Actions)
- ci(publish): create the Forgejo release + tarball asset after publishing
- docs: record the issue workflow in AGENTS.md (planning, milestones, shipping)
- docs: align AGENTS.md and CLAUDE.md — one guide, symlinked
- WindowArray: per-axis size state + vertical band cap (closes #31)
- Explorer/DataTable: audit the overlap, extract the last shared piece, add Explorer gridLines (closes #28)
- FieldLayout: justified form rows of rigid/flexible/filler fields (closes #33)
- Field: remove Field.Help — Field.Description is enough
- test(DatePicker): pin the 168px field-overflow scenario (closes #34)
- WindowArray: directional wheel — plain wheel follows the strip axis, Shift crosses it (closes #37)
- Charts: uniform interactive scaffolding across all 2D charts (closes #35)
- Hotkeys: expose primitives for a consumer-owned central shortcut layer (closes #32)
- Flows: per-period fund-flow ribbon chart (closes #36)

## v1.8.1 — 2026-07-05 (patch)

- Marquee zoom: own the gesture fully while armed (fixes premature zooms)

## v1.8.0 — 2026-07-05 (minor)

- Interactive charts: zoom/pan viewport, adaptive axes, annotations, drill-down (#27); recessed input fills (closes #29)
- Chart window: controls toolbar, marquee zoom, annotation editing, fullscreen/frame (closes #27); DatePicker (closes #30)

## v1.7.0 — 2026-07-04 (minor)

- WindowArray: export WindowButton for chrome-matching custom actions (closes #26)
- Field.Help: space-adaptive help text; useCollapse observer fix; no gray copy

## v1.6.0 — 2026-07-04 (minor)

- Add DigitInput
- Fix lint errors that slipped past a piped check before v1.5.0
- Perf milestone 2 (closes #14, closes #15, closes #16, closes #17, closes #18, closes #19, closes #20, closes #21, closes #22, closes #23, closes #24)
- Picker/compact Selector: stop the hidden search input flooring control width (closes #25)

## v1.5.0 — 2026-07-04 (minor)

- performance milestone 1
- Perf: fix all five milestone-5 issues (closes #7, closes #8, closes #9, closes #10, closes #11)

## v1.4.0 — 2026-07-04 (minor)

- tunable focus rings
- Make focus rings tunable via --sf-focus-ring-width/-offset (closes #13)

## v1.3.0 — 2026-07-04 (minor)

- WindowArray vertical orientation + fading paddles; Accordion goes internal

## v1.2.5 — 2026-07-03 (patch)

- theme-reactive canvas fills + Picker/Selector elevation

## v1.2.3 — 2026-07-02 (patch)

- WindowArray window elevation prop
- Add three-layer local performance testing: bench, perf probes, size
- Fix re-render hot paths surfaced by the perf probes
- Add MIT license
- CI: add audit/test:ci scripts, biome devDep; rename LICENCE.md to LICENSE

## v1.2.2 — 2026-07-02 (patch)

- ChatDrawer cellSize prop for the thinking-effect grain

## v1.2.1 — 2026-07-02 (patch)

- WindowArray dithered desk background + scrollbar refinements

## v1.2.0 — 2026-07-02 (minor)

- add WindowArray (Niri-style scrollable window strip)

## v1.1.2 — 2026-07-01 (patch)

- align sm control height across Picker/Selector

## v1.1.1 — 2026-07-01 (patch)

- remove debug console.logs from stories

## v1.1.0 — 2026-07-01 (minor)

- Explorer data-grid parity; drop public Combobox

## v1.0.0 — 2026-06-30 (major)

- add Picker (single-select) + Dropzone (file upload)
- Add ContextMenu (right-click menu)
- Add Map: geographic map chart (MapLibre GL JS)
- Refine Map basemap styling and fix color-mix resolution

## v0.38.0 — 2026-06-30 (minor)

- Heatmap cell values + sensitivity-analysis stories

## v0.37.2 — 2026-06-30 (patch)

- frameless thinking block, dimmed text, stable chevron

## v0.37.1 — 2026-06-29 (patch)

- soften structural border to a subtle hairline
- test: exclude .direnv from vitest so the flake snapshot isn't double-run

## v0.37.0 — 2026-06-29 (minor)

- Dialog window chrome (maximize/close) + initial size
- ci(publish): guard tag must be on main + idempotent publish
- Chat thinking state, neutral chat chrome, unified borders, full-resize Dialog

## v0.36.0 — 2026-06-29 (minor)

- integrated 3D charts + visual effects
- Feat/chatdrawer views icon bar
- datatable frozen columns and popover zindex
- 3d charts
- extract effects

## v0.31.0 — 2026-06-26 (minor)

- Reflow + Toolbar responsive layout helpers, customizable scrollbars

## v0.30.4 — 2026-06-25 (patch)

- subtler Kbd keycaps in dark mode

## v0.30.3 — 2026-06-24 (patch)

- richer 3D Kbd keycaps (raised top face + lip)

## v0.30.2 — 2026-06-24 (patch)

- Kbd skeuomorphic 3D keycaps + AESTHETICS exception

## v0.30.1 — 2026-06-24 (patch)

- dial down Kbd keycap font size

## v0.30.0 — 2026-06-24 (minor)

- Kbd (OS-aware shortcut keycaps) + fix v0.29.0 publish

## v0.29.0 — 2026-06-24 (minor)

- SplitPane (and ChatDrawer) gain a "top" side

## v0.28.0 — 2026-06-24 (minor)

- --sf-recess-* token scale + recessed ChatDrawer panel

## v0.27.0 — 2026-06-24 (minor)

- ChatDrawer panel header (caption + fullscreen + close)

## v0.26.4 — 2026-06-24 (patch)

- customizable ChatDrawer wash

## v0.26.3 — 2026-06-24 (patch)

- Chat send-button bottom-align + ChatDrawer persistent wash

## v0.26.2 — 2026-06-24 (patch)

- ChatDrawer static full-pane thinking wash

## v0.26.1 — 2026-06-24 (patch)

- SplitPane divider straddles the seam (no white gap)

## v0.26.0 — 2026-06-24 (minor)

- SplitPane (resizable push panel); rebuild ChatDrawer on it

## v0.25.1 — 2026-06-23 (patch)

- fix DataTable columnFill body collapse when viewport < columns

## v0.25.0 — 2026-06-23 (minor)

- ChatDrawer composite (chat in a drawer with thinking background)

## v0.24.0 — 2026-06-23 (minor)

- Chat blocks redone as TUI + auto-scroll follow

## v0.23.0 — 2026-06-23 (minor)

- Chat rich message parts (text/choices/tree/custom)

## v0.22.0 — 2026-06-23 (minor)

- Drawer + Chat streaming reveal fix
- Drawer: edge panels (left/right/bottom) via Base UI Drawer

## v0.21.0 — 2026-06-23 (minor)

- CandlestickChart, DataTable column reorder + filtering
- Add CandlestickChart (OHLC financial chart)
- DataTable: drag-and-drop column reordering

## v0.20.0 — 2026-06-23 (minor)

- Game of Life + subtle toggling-dot NonIdealState effects

## v0.19.1 — 2026-06-23 (patch)

- DataTable columnFill animation speed

## v0.19.0 — 2026-06-23 (minor)

- DataTable columnFill + persisted widths, Timeline rangeOpacity + tactile value labels, snap easing
- docs: expand API.md to cover all 35 components

## v0.18.0 — 2026-06-23 (minor)

- Selector compact layout, Timeline tickSpacing, Button tight fix, API docs

## v0.17.0 — 2026-06-23 (minor)

- Button tight variant
- DataTable: avoid assign-in-expression in getColumnEdges (lint gate)

## v0.16.0 — 2026-06-23 (minor)

- Timeline color prop + DataTable arrow scroll/fade/selection fixes

## v0.15.0 — 2026-06-23 (minor)

- Selector dithered chips + DataTable snap fix + Timeline tweaks

## v0.14.0 — 2026-06-23 (minor)

- Timeline size classes + Selector fixed-height strip
- Selector: lock the inline strip to a fixed per-size height
- Timeline: sm/md/lg size classes for the control strip

## v0.13.0 — 2026-06-23 (minor)

- DataTable merged cells + Timeline value labels/elevation + menu z-index fix
- Timeline: compact strip is one unit tall; no text selection on drag
- Timeline: compact labels float above the box + bordered option
- Timeline: floating scrub-value labels + elevation on bordered strip
- CommandBar/Menu: lift dropdown z-index to the Positioner
- DataTable: visually merged (spanning) cells & headers

## v0.12.1 — 2026-06-23 (patch)

- Combobox/Selector Clear button uses sans
- Combobox: render the Clear button in sans, not mono

## v0.12.0 — 2026-06-23 (minor)

- Selector/Timeline/Skeleton/DataTable features + fixes
- DataTable: constant-width cascading column resize + locked-column hint
- Combobox: fix dropdown rendering behind sticky content (issue #2)
- Selector: size presets (sm/md/lg), mirroring Input
- Selector: inline chip overflow expands as an elevated overlay
- Typography: optically match monospace to sans via font-size-adjust
- Timeline: compact variant — labels on hover/scrub only
- Timeline: range selection variant (two handles + draggable band)
- Skeleton: optional NonIdealState-style dithered effects
- DataTable: elastic scroll-snap + dithered bottom edge-fade
- Selector: inline layout stays one row (no vertical growth)
- DataTable: minmax layout engine — shrink-to-fit before scroll + overflow fix

## v0.11.0 — 2026-06-22 (minor)

- Selector component + Combobox multi-select

## v0.10.0 — 2026-06-19 (minor)

- Grid flexible-track resize + Graph fill/frame/auto-fit (issue #1)

## v0.9.0 — 2026-06-18 (minor)

- Graph relationship editing + dark-mode fixes

## v0.8.1 — 2026-06-14 (patch)

- Graph fullscreen toggle + inspector anchor fix

## v0.8.0 — 2026-06-14 (minor)

- ErrorState story uses glitch effect
- Fullscreen container component

## v0.7.0 — 2026-06-14 (minor)

- NonIdealState component (dithered fills)

## v0.6.0 — 2026-06-14 (minor)

- drag-resize for Grid, DataTable, Dialog

## v0.5.0 — 2026-06-14 (minor)

- Graph component + build/doc fixes

## v0.4.1 — 2026-06-09 (patch)

- Fix probe-virtualization.mjs lint: blank line after imports

## v0.4.0 — 2026-06-09 (minor)

- Maintenance release (no code changes).

## v0.3.1 — 2026-06-06 (patch)

- Maintenance release (no code changes).

## v0.3.0 — 2026-06-05 (minor)

- Maintenance release (no code changes).

## v0.2.2 — 2026-06-05 (patch)

- Maintenance release (no code changes).

## v0.2.1 — 2026-06-05 (patch)

- Add top-level CODING-AGENT and AESTHETICS docs
- Replace CODING-AGENT.md with AGENTS.md

## v0.2.0 — 2026-06-04 (minor)

- Maintenance release (no code changes).

## v0.1.0 — 2026-06-04 (initial)

- Initial commit
- Update: flake
- Establish design aesthetic and add Grid + Skeleton
- Add DataTable, refine aesthetics, drop Tooltip + Select
- Add TextEdit, Markdown, Outliner; share TreeChevron in src/lib
- Add Box and CommandBar; refactor Popover to use Box; aesthetic tweaks
- Add Explorer; CommandBar Logo/Search; DataTable drag-select fix; Accordion refresh
- Add ButtonGroup (visual) + ToggleGroup (segmented control)
- Add Field + Timeline; unify control elevations; subtle Input border
- Timeline: add snap="events"|"ticks" scrub modes
- Add StreamingTerminalText + Chat; align TextEdit single-line to 1.5u
- Wire up Gitea npm publishing
