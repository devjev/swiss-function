# AGENTS.md

A guide for coding agents (Claude Code, Cursor, Aider, anything else with
tool use) building UIs with `@tarassov-ch/swiss-function`, and, in the
"for contributors" sections at the end, for agents working on the library
itself. `CLAUDE.md` is a symlink to this file: every agent reads the same
guidance. Read this before you reach for a
`<div className="bg-gray-100 p-4 rounded-lg">`.

Pair this with [AESTHETICS.md](./AESTHETICS.md), which describes *why*
the library looks the way it does, and [docs/API.md](./docs/API.md), the
per-component prop reference (keep it in sync: when a documented
prop/default/`--sf-*` variable changes or a component is added, update
API.md in the same change). This file is *what to do*.

---

## What this library is

A small, opinionated React component library:

- **Headless primitives** wrapped from [Base UI](https://base-ui.com/).
  Accessibility, focus management, keyboard handling already solved.
- **CSS Modules + CSS custom property tokens.** No utility classes, no
  CSS-in-JS, no Tailwind.
- **Cascade Layers** under `@layer sf.tokens` so consumer styles can
  override predictably.
- **Built for dense, professional interfaces.** Form-heavy apps, data
  tables, dashboards, internal tools. Not landing pages.

If you're building a marketing site or a feed-style consumer product,
this is the wrong library.

---

## Setup

Two imports are mandatory, once, at the app root:

```ts
import "@tarassov-ch/swiss-function/tokens.css";
import "@tarassov-ch/swiss-function/reset.css";
```

`tokens.css` defines every `--sf-*` custom property and the dark theme.
`reset.css` is a minimal box-model and base-font reset.

To get the intended monospace aesthetics, optionally load the bundled
JetBrains Mono webfont (the family `--sf-font-mono` prefers) at app root too:

```ts
import "@tarassov-ch/swiss-function/fonts.css"; // optional
```

It resolves from the optional `@fontsource/jetbrains-mono` dependency (latin
subset, weights 400 to 700). Skip it and `--sf-font-mono` falls back to the
system monospace stack, and nothing breaks.

Then import components either from the barrel or per-component:

```ts
// Barrel: convenient for prototyping.
import { Button, Field, Input } from "@tarassov-ch/swiss-function";

// Per-component: better tree-shaking in production.
import { Button } from "@tarassov-ch/swiss-function/button";
import { Field } from "@tarassov-ch/swiss-function/field";
```

Theme toggling is done via `data-theme="light" | "dark"` on any ancestor
element (typically `<html>` or the app root). All color tokens swap
automatically.

---

## Component catalogue

Quick reference. When in doubt, open the corresponding stories in
Ladle (`npm run dev`).

### Form controls

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Button`        | Any clickable action. Variants: primary, secondary, ghost, danger. Sizes: sm, md, lg. |
| `ButtonGroup`   | A row of related buttons sharing a cascading size.        |
| `Field`         | Compound for any form row: `Field` + `Field.Label` + control + `Field.Description` (supplementary copy, full-strength fg) + `Field.Error`. Don't roll your own. |
| `FieldLayout`   | Whole-form layout: justified rows of rigid / flexible / filler fields. Sections of `FieldLayout.Field`s in a `flex-wrap` container, where each row fills left-to-right (flexible fields and `FieldLayout.Filler`s grow), strict source order (fields never migrate lines), gradual container-driven collapse with no breakpoints. `kind="rigid"` (fixed width, e.g. a DatePicker at 8u) / `"flexible"` (default, 10 to 36u) / `"prose"` (wide text) / `"filler"`. Rhythm on the unit: 2u between sections, 1u between fields/rows. Reach for this to lay out a form (Fields alone still work for a single row). |
| `Form`          | The layer above `Field`/`FieldLayout`: form-level submit + validation wiring. `Form` (orchestration; **bring-your-own `resolver`**, headless about Zod/Valibot/RHF), `FormField` (binds one control to a named field: label + control + description + live error), `FormError` (a form-level message, `role="alert"`). Two tiers: per-field `validate`/native constraints, then a whole-form `resolver` on submit that gates `onSubmit(values)`. Consolidated `errors` prop for server errors. Composes with `FieldLayout` (wrap each `FormField` in a `FieldLayout.Field`). Reach for this for a whole form with state/validation; use bare `Field` for a single labelled row. |
| `Input`         | Single-line text input. Monospace by design.              |
| `PasswordInput` | An `Input` for a password with a monospace show/hide toggle at its end. Masks by default; takes every `Input` prop. Drop it in a `Field`; `Login` uses it for its password field. |
| `DigitInput`    | Fixed-capacity number entry as digit cells (`[0][4][2].[5][0] %`). Two feels via `mode`: `"push"` (default, calculator-style, digits push from the right, always complete) and `"mask"` (2FA-style per-cell fill, null until complete). `digits`/`decimals`/`unit`; value is `number \| null` (null = untyped mask). Opt-in `signed` adds a leading `+`/`-` cell for negatives (push mode). Doubles as a numeric PIN input. |
| `DigitInputMicro` | Variable-length numeric input: a regular text input that shows a few faded, dithered placeholder digit slots (`░░ ░░`) at rest and fills them left-to-right (the "mask" hint), but grows past them as you type. `slots`/`decimals`/`unit`/`min`/`max`/`placeholderChar`; value is `number \| null`. The lighter sibling of `DigitInput`: reach for it when the width is a hint, not a fixed capacity. Native caret/selection/paste. |
| `DatePicker`    | Date input + calendar popup, ISO 8601 by default (`YYYY-MM-DD`, Monday-first weeks, optional ISO week numbers). Typing is the fastest path: `2026-07`, `12 jul`, `tomorrow`, `+7` narrow the calendar and Enter commits the echoed candidate; numeric fragments are always day-first, never US month-first. Value is `Date \| null`; `minDate`/`maxDate`/`isDateDisabled` constrain. `precision` picks whole ISO weeks / months / years instead of days (value = the period start, field shows `YYYY-Www` / `YYYY-MM` / `YYYY`; type `w29`, `jul`, `2028`). Never reach for the browser-native `type="date"`. |
| `ColorPicker`   | A channel-slider colour picker: labelled sliders with live gradient tracks, switchable across **OKLCH** (default) / OKLab / RGB / HSL / HSV / LCH / Lab, plus a hex field, alpha over a checkerboard, an optional screen `eyedropper`, `swatches`, and an `OUT OF GAMUT` chip + Clamp for out-of-sRGB colours. Reads as an instrument panel, not a consumer swatch. Value is a CSS colour string; `onChange(value, color)` also gives the parsed colour. Built on the hand-rolled `lib/color` engine. `ColorSwatch` is the paired chip (over a checkerboard) for previews / presets / a `Popover` trigger, and opt-in `diagram` shows a colour-filled CIE 1931 chromaticity diagram (`ChromaticityDiagram`) with a dot at the current colour that you can click/drag to pick. Never reach for the browser-native `<input type="color">`. Pairs with `ThemeBuilder` for editing `--sf-*` tokens. |
| `Kbd`           | Renders a keyboard shortcut as OS-aware keycaps (`combo="mod+k"` → ⌘K on macOS, Ctrl+K elsewhere). `mod` = primary modifier; never shows ⌘ off-Mac. For labels/menus/tooltips. |
| `Login`         | A terminal-styled sign-in panel: a dithered title bar, monospace identifier + password fields (DOS block caret, a mono show/hide toggle), a terminal error line, and slots for a `footer` and for other auth methods (`alternatives`, below a dithered "or"). Self-contained: holds the field state and reports it on submit; the authentication (and the `loading`/`error` it drives) is yours. There is no separate password primitive: a password field is `<Input type="password" />`, and a 2FA/OTP/PIN code is `DigitInput mode="mask"`. |
| `TextEdit`      | Multi-line / auto-growing text input.                     |
| `TextEditInline`| Single line at rest, expands to a multi-line editor on hover/focus. The overlay *floats over* the content below (`elevation-3`) instead of pushing it down, auto-grows with content and is vertically resizable while active; collapses back to one ellipsized line on blur. `size` (`sm`/`md`/`lg`, matches Input heights), `maxRows`. Reach for this in dense rows/tables where a note is usually short but occasionally long. |
| `CodeEditor`    | Editing source / config / structured text (JS, JSON, SQL, YAML…). A thin CodeMirror 6 wrapper, themed to `--sf-color-code-*` tokens (dark/light via `[data-theme]`), block caret, with opt-in `vim`. Three restrained syntax themes via `theme` (`minimal`/`bold`/`primary`, never a rainbow). Bring the language via `extensions` (e.g. `javascript()`, installing the `@codemirror/lang-*` package; none are bundled). `value`/`onChange`, `readOnly`, `lineNumbers`, `lineWrapping`, `tabSize`, `elevation`. Auto-grows; set a root `height` to fix + scroll. Not for prose (that's `TextEdit`/`Markdown`). |
| `CodeEditorInline` | The `CodeEditor` as a one-liner that expands to a multi-line overlay on focus (the code sibling of `TextEditInline`). Collapsed shows line 1 *syntax-highlighted* (a live CodeMirror, not a label); focus floats the full editor over the content below (`elevation-3`), growing to `maxRows` then scrolling; blur collapses back. Takes every `CodeEditor` prop plus `maxRows` / `collapsedElevation`. Reach for this in dense forms/tables holding a short expression that occasionally needs room. |
| `Checkbox`      | Binary independent toggles in lists.                      |
| `Radio`         | Single-choice within a group.                             |
| `RadioTable`    | A bordered, hairline-divided table of radio options, each a radio + label + description (a "pick one, each with a title and detail" list: plan pickers, settings). Compound: `RadioTable` + `RadioTable.Option` (`value`/`label`/`description`/`disabled`). The description sits right of the label when wide, below when narrow. Built on `RadioGroup`/`Radio`. Reach for this over bare `Radio` when each choice needs a description. |
| `Switch`        | Binary on/off for a setting, with an immediate effect.    |
| `Slider`        | Pick a value (or a `[start, end]` range) along a scale by dragging: a recessed slot with an accent fill and a square, raised fader-cap thumb. `tone`/`color`/`fill="dither"`, `size`, `marks` (ticks), a `valueLabel` bubble, `orientation="vertical"`, and range (array value = two thumbs). Drop it in a `Field`. For a typed number / PIN reach for `DigitInput` instead (this is for a *dragged* value). |
| `ToggleGroup`   | Mutually-exclusive segmented control.                     |
| `Selector`      | Search + multi-select with a visible "bucket" of chosen items as removable chips. `layout="panel"` (separate bucket, default) or `"inline"` (tag-input). High-level: `<Selector items value onChange />`. |
| `Picker`        | Search + single-select, the one-choice sibling of `Selector` (same item shape, `value` is one string). The field shows the chosen label and doubles as the filter. High-level: `<Picker items value onChange />`. |
| `Dropzone`      | File drag-and-drop zone (+ click-to-browse) that surfaces files via `onFilesChange` and renders them as a removable list. Presentational: the upload itself is yours; feed per-file progress/error through the `fileStatus` slot. |
| `TableInput`    | A compact editable table used as a **form control**, for entering an **array of objects** (one row per object). `columns` name a row property and pick a cell editor via DataTable's `edit` config (text→`TextEditInline`, number→`DigitInputMicro`, boolean→`Checkbox`, select/date→`Picker`/`DatePicker`), cells are always-on editors. A footer button adds a blank row, a per-row trash deletes; opt-in `reorderable` drags to reorder (lazy dnd-kit), `minRows`/`maxRows` bound the count, `equalColumns` evens the widths. Controlled `value`/`onChange`. Drop it in a `Field`. Not `DataTable` (that's a display grid at scale, no add/remove-row UI). |

### Surfaces & layout

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Box`           | A surface with `elevation={0..5}`. The atom of grouping. |
| `Grid`          | The layout primitive. CSS Grid wrapper with token-sized gaps. Pass `resizable` (`"columns"` / `"rows"` / `"both"`) to make track boundaries drag/keyboard-resizable (double-click a gutter to split evenly). |
| `Pane`          | Full-height region split into Header (auto) + Body (scrollable). Compound: `Pane`, `Pane.Header`, `Pane.Body`. Nests cleanly. Use whenever a region needs to fill its parent and scroll its overflow internally. |
| `Stack`         | Resize-aware fill/stretch layout (issue #74): a column (or `direction="horizontal"` row) where children keep their natural size and a `Stack.Fill` region stretches to absorb the remaining space and stays locked to the edge as the container (a resizable `Dialog.Popup`, a panel) resizes. Encapsulates the fiddly flex + `min-*-size: 0` chain. `fill` makes the stack itself grow to fill its parent; `gap` in `--sf-unit`. Pair with `<TextEdit fill />` inside `Stack.Fill` for a field that grows to the bottom edge. `Dialog.Popup` is a flex column, so `<Stack fill>` works as its body directly. Reach for `Pane` instead when it's just header + one scrollable body. |
| `Minimap`       | VS Code-style scroll-overview rail beside a component-owned scroll container, built from **structural markers**, not a scaled clone: `block` markers are dither rules (density read), `header` markers are clickable, level-indented heading labels with active tracking. The viewport indicator is the honestly proportional band of the document visible in the main view (markers inside it = content on screen); a 24px invisible grab/focus zone (`role="scrollbar"`, keyboard-operable) makes it grabbable on long documents. Drag / press-to-jump / wheel forwarding / label click-to-jump; rail hides when content fits. You always supply the `markers` array in content coordinates (no DOM scan), which is what makes it work over virtualized bodies (re-supply on measurement change + `onJump`). Parent must constrain the height, like `Pane`. Not `Graph.Minimap`/`Map.Minimap` (canvas camera overviews). |
| `Fullscreen`    | Wraps content with a corner toggle that expands it to fill the browser viewport (a fixed overlay, not OS fullscreen, works everywhere); a single child stretches to 100%. Escape exits; locks page scroll while open. Props: `expanded`/`defaultExpanded`/`onExpandedChange`, `buttonPosition`. |
| `Reflow`        | Responsive multi-column layout. Wide: equal columns side by side; when its container is narrower than `collapseAt` it collapses to a vertical accordion or a tab switcher (`collapseMode`). Compound: `Reflow.Root` + `Reflow.Column` (each with a `title`). Reach for this to make a multi-column region usable on narrow screens. |
| `VerticalForm`  | A tall, one-field-per-row form that scrolls and is navigated by a `Minimap` rail. Each row is a `Box` surface holding a vertical `Field` (label, control, description, optional error), or a plain unadorned row when `bare` (no surface, no padding, for a minimal look); the field names (and `VerticalForm.Section` titles) become clickable markers on the rail, and an errored field shows a danger tick. Compound: `VerticalForm` → `VerticalForm.Section` (titled group) → `VerticalForm.Field` (`label`/`description`/`error`/`required`, control as child). Presentational (layout + navigation; wrap in `Form` for state/validation). Opt-in `nav` adds a bottom bar with a searchable `Picker` of all titles (jump-to, and it tracks the title scrolled to the top). Parent must constrain the height. The vertical, scrollable sibling of `FieldLayout` (which packs justified, wrapping rows). |
| `WindowArray`   | Window-manager main area, Niri-style scrollable tiling: an infinitely horizontally-scrollable strip of columns, each a vertical stack of windows with Dialog-style chrome (title, ✕, fullscreen-in-container). Declarative (`WindowArray` → `.Column` → `.Window`): you own the list; drag/Shift+Arrow rearranging reports a `WindowMove` via `onWindowMove` for you to apply. Columns resize by gutter; keyboard nav auto-scrolls the strip; opt-in `snap` (column scroll-snapping) and `controls` (edge paddles). Opt-in `splittable` adds a split button to each window's chrome: a picker dialog pairs it with a second window and the two fill the container as flush halves (`splitIds`/`defaultSplitIds`/`onSplitChange`; Escape exits; mutually exclusive with fullscreen). Column switching is driven by the consumer via `apiRef` (`switchColumn`/`focusActive`); the component binds no global shortcut. For one floating window use `Dialog` (`draggable`/`resizable`) instead. |

Both `Reflow` and `MenuBar` (the latter only when given `collapseAt`) adapt to their **container** width via `ResizeObserver` (the shared `useCollapse` hook), not viewport media queries. This is the library's container-responsiveness mechanism, so they work inside sidebars/split panes. Use JS-measured collapse (not CSS `@container`) whenever the breakpoint must swap which subtree renders.

### Overlays

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Dialog`        | Modal interruption. Confirmations, forms, destructive actions. Backdrop dim is deliberately very subtle. For a window-like dialog, add `draggable` + `resizable` to `Dialog.Popup` and wrap the header in `Dialog.Handle`; drop a `Dialog.Actions` row inside the handle with `Dialog.Maximize` (fullscreen toggle) and `Dialog.CloseButton` (icon ✕) for window chrome. |
| `Drawer`        | Edge panel sliding from left/right/bottom (`side`). Non-modal by default; render `Drawer.SwipeArea` outside the `Portal` for a persistent reopen handle. |
| `Popover`       | Anchored, click-triggered floating content.              |
| `Menu`          | Button/trigger-anchored dropdown menus.                  |
| `ContextMenu`   | Right-click (context) menu. Same parts/styling as `Menu`; `ContextMenu.Trigger` marks the right-clickable region instead of a button. |
| `MenuBar`       | Application menu bar (`role="menubar"`; wraps Base UI Menubar/Menu) at the top or bottom edge. `MenuBar.Trigger` opens a `MenuBar.Content` dropdown of `MenuBar.Item` (with `shortcut`) / `.Separator` / `.Submenu`. Slots: `.Logo` (left), `.Search` (right). It can also host in-place controls via `.Control` (any Button/Switch/Input; `label` shows in the collapsed panel) plus `.Spacer`. Responsive (container-width): `collapse="all"` (with `collapseAt`) folds the whole bar behind one ☰; `collapse="items"` folds items progressively into a ⋯ overflow menu from the trailing edge. **Not** a Cmd-K palette. |

### Disclosure

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Tabs`          | Horizontally peer-level views in the same surface. `Tabs.List overflow` folds tabs that don't fit into a trailing `⋯` menu (priority-plus, container-width based) instead of overrunning the row, keeping the selected tab visible. |

### Data display

| Component                | Use for                                            |
| ------------------------ | -------------------------------------------------- |
| `Icon`                   | The icon primitive + a curated, tree-shakeable line-weight set (issue #51): a `16×16`, `currentColor`, square-capped glyph on the `--sf-unit` grid, with no fills, no colour, no emoji/mascot art. Each icon is its own named export (`<Check />`, `<ChevronDown />`, `<Search />`, …) so unused ones tree-shake. `size` (number = `--sf-unit` multiples, default `1em` so it tracks text), `label` (omit → decorative `aria-hidden`; set → `role="img"` + `<title>`), `strokeWidth`. `createIcon(name, path)` for custom glyphs; the `Icon` primitive renders any `16×16` path as `children`. **Use this instead of an emoji or a raw inline `<svg>`.** |
| `Chip`                   | Compact token: tag, filter, status marker, or removable selection. Sharp (2px) by default; `round` for the pill/badge reading. Neutral unless a `tone` (`primary`/`success`/`warning`/`danger`) makes the colour *mean* something (status/priority); don't colour chips decoratively. `dot` adds a leading status marker; `onRemove` renders a keyboard-reachable ✕; pass `onClick` to make the whole chip an accessible filter button. `size` `sm`/`md`. Not a Button (that's for actions) and not a toggle set (that's `ToggleGroup`/`Selector`). |
| `DataTable`              | Tabular data: sorting, selection, virtualization, Column resize (on by default; `resizableColumns={false}` or per-column `resizable: false` to lock; double-click a header edge to auto-fit). Tracks are `minmax(minWidth, preferred)`: when the columns don't fit they shrink toward their minimum (no scroll); only when even the minimums don't fit does the table scroll horizontally. The last column's preferred is `1fr` (fills slack) and it has no handle. Dragging a trailing edge sets preferred widths, cascading the opposite change through the columns to its right (nearest first, skipping locked ones). Set `width` / `minWidth` per column in `--sf-unit` multiples, plus opt-in `scrollSnap` and `edgeFade`. `columnFill` fills the space right of fixed-width columns with a dither panel, and `fillHeight` holds the given `height` when rows are too few and dithers the empty band below the last row (so a sparse fixed-height table reads as one filled panel). `highlights` overlays persistent coloured range markers (the Excel "coloured range reference" look: light fill + a solid border around each block); positional, declarative, several distinct colours for separate ranges (e.g. charting series), driven from `onSelectionChange`. `frozenColumns={n}` freezes the first n columns (pinned left while the rest scroll, the horizontal analogue of the sticky header; frozen columns keep a fixed width). With `editable`, each column's `edit` config picks a purpose-built cell editor: `text`→`TextEditInline`, `number`→`DigitInputMicro` (`decimals`/`slots`/`unit`), `date`→`DatePicker` (commits a `Date`), `boolean`→a two-option `Picker` (True/False), `select`→a searchable `Picker`. The serious one. |
| `Markdown`               | Rendering markdown content (uses remark-gfm).      |
| `Prose`                  | Long-form markdown reading view: virtualized body + auto outline. Compound: `Prose.Root`, `Prose.Body`, `Prose.Outline`. Reach for this over bare `Markdown` for document-length content. |
| `Notebook`               | Notebook-like analysis inside the app: reactive cells (edit one, dependents re-run) over consumer-provided engines. `document`/`onDocumentChange` (controlled JSON), `cellTypes` registry: `proseCellType` built in, `createSqlCellType({executor})` for SQL over the app's DuckDB-WASM (or any engine), any further language via the public `CellType` contract (`findDependencies`/`execute`/`renderResult`). Results render through DataTable/Markdown; the library ships no engine and no eval. `fromArrow` (also at `/lib/from-arrow`) converts Arrow results (Date coercion, BigInt policy) for DataTable. |
| `Progress`               | Progress bar: determinate 0..100% `value`, or indeterminate (`value={null}`). Wraps Base UI Progress (`role="progressbar"`). Three fills via `fill`: solid `color`, static `dither`, or `animated` (the WebGL dither engine, loaded lazily). `tone`/`color`, `elevation`, thickness `size` (`xs`/`sm`/`md`/`lg`), optional `showValue` readout. Reduced-motion → static frame. Not a `Meter` (static gauge). |
| `Skeleton`               | Loading placeholder with shimmer (respects reduced-motion). |
| `Spinner`                | Inline CLI-style animated glyph (`role="status"`) for "busy" feedback. 28 monospace `variant`s (braille/line/blocks/bars/grow/bounce/arrow/quadrant/triangle/circle/corners/pipe/star/toggle/dots/pulse/scanner/arrowDouble/caret/trigram/dqpb/arc/clockface/balloon/weave/boxCorners/quadrantHeavy/static); `color` (any token) + `size`, else inherits; `speed`. Reduced-motion → static frame. The `useSpinnerFrame(variant, speed)` hook embeds the glyph in other components. |
| `NonIdealState`          | Empty / no-results / error / loading state for a region. A sizable block continuously filled (WebGL, ~0.06ms/frame, pauses offscreen) with console-style dithered shade blocks; message + action in the cleared center. Props: `variant`, `title`, `description`, `action`, `width`/`height`, `effect` (24 animated: ripple/noise/scan/plasma/rain/wave/spiral/radar/tunnel/fire/bars/metaballs/rotozoom/twister/copper/voronoi/grid/kaleidoscope/starfield/swirl/helix/checker/droplets/lissajous; per-variant defaults: empty→plasma, no-results→noise, error→scan, loading→ripple), `effectOptions` (speed/wavelength/amplitude/rate/density/seed), `speed`, `density` (overall coverage), `cellSize` (square shade-block px), `color` + `opacity`. Reduced-motion → static frame. |
| `StreamingTerminalText`  | Terminal/log output that arrives incrementally.    |
| `ThemeBuilder`           | Live editor for the `--sf-*` tokens (issue #50): tweak the curated palette / unit / radius / typography / motion, watch a component sample retheme instantly (overrides applied as inline custom properties on the preview scope), then copy the result as a CSS theme or JSON. Colours edit per light/dark; the rest are theme-agnostic. `tokens.css` stays canonical, so this makes *overriding* it ergonomic (it does not change the default palette). Also exports `themeToCss`/`themeToJson`. Pairs with the build-time token pipeline (`npm run tokens:build`) that emits `tokens.json` / `tokens.js` (`vars` accessors) / `tokens.style-dictionary.json` from the same canonical CSS. |

### Navigation

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Explorer`      | File-tree-style hierarchical navigation: virtualized tree grid with rename-in-place, row drag-to-reorder, and DataTable's column affordances (sort/filter/resize/reorder). `gridLines` gives it full spreadsheet borders. **Explorer vs DataTable**: reach for Explorer when the data is inherently a tree the user *manipulates* (rename/move/reorder rows); reach for DataTable for tabular data at scale (cell selection/editing, column groups, frozen columns, pagination, 100k+ rows). They share their column machinery (`src/lib/columns`, `src/lib/filter`) by design, but don't merge them further: the tree-vs-flat data pipelines, row-vs-cell selection and rename-vs-cell-editor models are deliberately separate (issue #28). |
| `Outliner`      | Outline editor with drag-reordering (dnd-kit underneath). |

### Charts

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Scatterplot`      | Points and/or lines on numeric or time axes. Series-based. |
| `BarChart`         | Categorical bars, single or grouped series.              |
| `BridgeChart`      | Waterfall / financier's bridge: totals + signed deltas. |
| `Flows`            | Per-period fund-flow ribbon, each period a within-period waterfall (open → subscriptions → redemptions → performance → fx → close), periods connected close→open. The compact, candle-like read of AUM dynamics over time. |
| `CandlestickChart` | OHLC financial candles (up = success, down = danger), index-spaced. |
| `Timeline`         | Horizontal time strip with stacked event labels and a scrubbable playhead. |
| `Heatmap`          | 2D grid of `z = f(x,y)` as filled cells, with an optional marching-squares `contours` iso-line overlay. The default, Swiss-friendly read of a 2-variable field: reach for this before a 3D surface. |
| `Surface`          | 3D surface `z = f(x,y)` (Canvas2D, axonometric, **drag-to-rotate**). For data that is genuinely 3D and loses meaning when flattened (response/optimization surfaces, terrain). Single-hue height ramp + measured cube frame. |
| `PointCloud`       | 3D scatter / point cloud: `series` of x/y/z points (clusters, 3-component embeddings). Same axonometric engine as `Surface`. |

The 2D charts default to `scaffolding="hover"` (Tufte-minimal idle, full
scale fades in on hover). Use `scaffolding="full"` for dense data,
`"minimal"` when you don't want any reveal. The 3D charts (`Surface`,
`PointCloud`) are **orthographic and drag-to-rotate only, never auto-spin**;
they're for intrinsically-3D data. **There are no 3D bars/pies/ribbons** (they
distort comparison): for a 2-variable field reach for `Heatmap`, and for
categorical magnitudes a 2D `BarChart`.

When the user asks for interactive/explorable charts ("zoom into this",
"Bloomberg-style", "drill down"): `Scatterplot` and `CandlestickChart` take
`zoomable` (wheel zooms at the cursor, drag pans, double-click resets,
keyboard ←/→ `+` `-` `0`; axes re-tick adaptively, with a calendar ladder on dates,
step-derived precision on numbers; large series decimate automatically, so
tens of thousands of points are fine). Both take `annotations`: serializable,
data-anchored `hline`/`vline`/`line`/`rect`/`text`/`measure` overlays that
survive zoom/pan (persist the array as-is). Drill-down is an event, not
behavior: wire `onPointActivate` (all three axis charts) and swap the data
yourself; `onXDomainChange` / `onVisibleRangeChange` are the hooks for loading
finer-grained data as the user zooms in.

For an actual chart **window** (visible zoom buttons and drawing tools, the
trading-terminal look) add `controls` (toolbar overlay; zoom is a mode: arm it, drag the region to zoom to) plus
`onAnnotationsChange` (arms the tool palette: trend line, h/v lines, region,
text note, measure; select/drag/Delete editing, all flowing through the
annotations array) and optionally `fullscreen` and `frame`. By default zoom-out
stops at the data extent; pass `zoomOutLimit` (a multiple of the data span, or
`Infinity`) to zoom out into empty margin around the data, the trading-terminal
"pull back to see context" gesture. Applies to every zoomable chart; reset still
snaps back to the data.

This scaffolding is **uniform across every 2D data chart** (issue #35): the same
`ChartScaffoldingProps` mixin (`frame`, `fullscreen`, `controls`, `zoomable`,
`annotations`/`onAnnotationsChange`, `xLabel`/`yLabel`, `scaffolding`) is
accepted by `Scatterplot`, `CandlestickChart`, `BarChart`, `BridgeChart` and
`Heatmap` alike, so "interactive, framed, annotatable" is a property of any 2D
chart, not a lucky few. `zoomable` windows whichever axis is continuous: the x
axis on Scatterplot/Candlestick, and the **value axis** on the categorical
charts: `BarChart`/`BridgeChart` zoom y (via `onValueDomainChange`), `Heatmap`
zooms a vertical sub-range of rows. Only `Graph` and the 3D charts (`PointCloud`,
`Surface`) stay out; they have their own interaction models.

### Graphs & networks

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Graph`   | Node-link networks (dependency graphs, mind maps, concept trees) up to ~10k nodes interactively. Force / tree / radial / concentric / grid layouts (switchable at runtime), pan/zoom/fit + keyboard nav, minimap, right-click menu, and node labels highlighted on hover, plus a built-in fullscreen toggle (`fullscreen` prop, default on). Pass `editable` for relationship editing: a Connect toggle appears in `Graph.Controls` (drag node→node to add an edge), and edges can be removed via right-click "Delete" or select-then-Delete/Backspace, so wire `onEdgeCreate` / `onEdgeDelete` and mirror the change in `data` (updates reconcile in place, so camera + layout stay put). Edge label/metadata editing is consumer-owned: use the `edge` `contextMenuItems` target (or `onEdgeClick`) to open your own editor, then update `data`. Layout: `fill` makes it take the parent's height (give the parent one) and it re-fits the canvas on container resize, not just window resize; `frame={false}` drops its own border when embedding inside a framed container. Compound: `Graph`, `Graph.Controls`, `Graph.Minimap`. Distinct from the charts above: those plot values on axes; this draws relationships. |

### Maps & geography

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Map`     | Geographic maps (MapLibre GL JS). Plot **points** (`points`), **areas**/polygons (`areas`), and **vectors**/routes (`vectors`, with `arrow`/`dashed`), all in GeoJSON `[lng, lat]` order, or pass raw `geojson`. Customize appearance via `basemap`: `"minimal"` (default: restrained vector style colored from `--sf-*` tokens, re-tints with dark mode), `"street"`, `"terrain"`, or override entirely with `styleUrl` (self-hosted/keyed tiles). `onFeatureClick` / `renderTooltip` for interaction; `fill` / `frame={false}` / `fullscreen` like `Graph`. Compound: `Map`, `Map.Controls` (zoom/fit/reset/basemap), `Map.Minimap` (overview inset, a 2nd WebGL context). **Two CSS imports are required** at app root: `tokens.css` **and** `maplibre-gl/dist/maplibre-gl.css`. Free no-key tile providers are best-effort (no SLA); tile attribution must stay visible. Not for non-geographic x/y data (that's the charts). |

### Communication

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Chat`          | Message-stream UI for chat-style interfaces. Assistant messages can carry rich `parts` rendered in a terminal (TUI) style: text, a monospace choices menu, a directory-tree decision/orchestration tree, a **`thinking`** block (a spinner that expands into a live orchestration fan-out, a status tree, then collapses to a summary), an **`error`** block (a small glitch-effect micro-element for a backend error, with a `message`/`requestId` and an optional Retry; `onError` fires when it appears, Retry via `onAction`), or custom blocks via `renderPart` (wrap them in `ChatBlock`). Tree nodes take a `status` (pending/running/done/error) → per-node spinner/✓/✗. Interactions report through `onAction`. Streaming assistant text reveals through `StreamingTerminalText`; tune it with `reveal` (for a **live token stream** pass `reveal={{ mode: "stream" }}` so it tracks the tokens instead of lagging then bursting; `reveal={false}` renders plain Markdown as tokens arrive). |
| `ChatDrawer`    | A `Chat` in a resizable side panel that **pushes** the app content aside (built on `SplitPane`). Pass the app as `children`. While `thinking`, an animated effect blooms and fills the padding gutter; `onThinkingStart`/`onThinkingEnd` fire on the transitions. The header is an icon bar: add your own buttons with `actions`, or pass `views` (`{ id, icon, label, content }[]`) to host multiple icon-switched panels, so chat becomes just one view. |
| `SplitPane`     | Resizable split layout: `SplitPane.Main` + a collapsible `SplitPane.Panel` that pushes content aside with a draggable divider (not an overlay). For overlay sheets use `Drawer` instead. |

---

## Conventions

These are not suggestions.

### Use tokens, not literals

- **Color**: `var(--sf-color-fg)`, `var(--sf-color-bg)`,
  `var(--sf-color-primary)`. Never hex.
- **Spacing**: multiples of `var(--sf-unit)` (e.g.,
  `calc(var(--sf-unit) / 2)`, `calc(var(--sf-unit) * 2)`). Avoid the
  `--sf-space-N` ladder unless you need a non-unit fraction. The
  baseline grid is the source of truth.
- **Radius**: `var(--sf-radius-default)` for almost everything. Reach
  for `--sf-radius-full` only for genuinely circular things.
- **Typography**: `var(--sf-font-size-md)` etc. Three sizes total
  (`sm`, `md`, `lg`). Don't invent a fourth; reach for weight, spacing,
  or a rule line. For long-form prose, cap line length with
  `var(--sf-measure)`. When you set `font-family: var(--sf-font-mono)`, also set
  `font-size-adjust: var(--sf-font-mono-adjust)` so mono matches the sans
  x-height (mono otherwise reads optically larger at the same `font-size`).
- **Motion**: `var(--sf-duration-fast)` / `-base` / `-slow` with
  `--sf-ease-out` or `--sf-ease-in-out`.
- **Elevation**: `var(--sf-elevation-N)` for surface depth, including
  inside SVG (use `filter: drop-shadow(...)` with equivalent values).
- **Focus rings**: every component's `:focus-visible` ring reads
  `--sf-focus-ring-width` (default `2px`) and `--sf-focus-ring-offset`
  (per-rule default). Set them on any ancestor to restyle a subtree's
  rings, or `--sf-focus-ring-width: 0` to disable them where a container
  already communicates focus (an active window frame, a focused pane).
  Never suppress a ring by out-specificity-ing component CSS.

### Body text is never grey

This is the project's most-cited anti-pattern. Default to
`--sf-color-fg`. Reach for `--sf-color-fg-subtle` (#4b5563) or
`--sf-color-muted` (#6b7280) only for legitimately secondary metadata
(timestamps, axis labels, captions). Never for prose the user is meant
to read.

If the user explicitly asks for muted text, do it. Otherwise, don't.

### Use CSS Grid, not Flexbox

Layout in this codebase is `display: grid` with explicit
`grid-template-*`, `min/max/clamp`, container queries, and subgrid where
it pays off. Flexbox is fine for a row of icons inside a button; it is
not the layout primitive of the system.

### Use the Field compound for form fields

```tsx
<Field orientation="vertical" required>
  <Field.Label>Email</Field.Label>
  <Input type="email" />
  <Field.Description>We never share your address.</Field.Description>
  <Field.Error>Please enter a valid email.</Field.Error>
</Field>
```

This is the supported way to lay out, label, describe, and error a
form control. Don't reinvent label + input + helper-text composition.

### Use `cx()` for className composition

```ts
import { cx } from "@tarassov-ch/swiss-function/lib/cx";

className={cx(styles.root, isActive && styles.active, className)}
```

There is no `clsx` / `classnames` dependency. Use the project's helper.

### Sharp corners by default

`--sf-radius-default` is 2px. Don't override to 8px / 12px / 16px to
"soften" a card. If the design feels too sharp, that is the design.

### Respect `prefers-reduced-motion`

Every CSS transition or animation must have a `@media (prefers-reduced-motion: reduce)` fallback. Look at any existing component's `.module.css` for the pattern.

---

## When the user asks for X, reach for Y

Common requests and the right component:

| User says                                          | Use                                              |
| -------------------------------------------------- | ------------------------------------------------ |
| "a button" / "an action"                           | `Button` (variant chosen by destructiveness)     |
| "a form" (single row / static)                     | `Field` per row + the right control inside  |
| "a form with validation / submit handling / form state / errors" | `Form` + `FormField` per row + `FormError` (bring-your-own `resolver`; `errors` prop for server errors) |
| "a modal" / "a popup" / "confirm dialog"           | `Dialog`                                         |
| "a drawer" / "sheet" / "overlay panel"             | `Drawer`                                          |
| "a resizable split / panel that pushes content / IDE-style side panel" | `SplitPane` |
| "a tooltip" / "hover info"                         | `Popover` (or chart components' built-in tooltip) |
| "a dropdown" / "a menu off a button"               | `Menu`                                           |
| "a right-click menu" / "context menu"              | `ContextMenu`                                    |
| "multi-select" / "pick several from a list" / "tag input" / "add items to a bucket" | `Selector` |
| "single-select" / "pick one from a searchable list" / "searchable dropdown" | `Picker` |
| "radio options with descriptions" / "a plan picker" / "pick one, each with a title and detail" / "settings-style option table" | `RadioTable` (+ `.Option`); bare `Radio`/`RadioGroup` when there are no descriptions |
| "file upload" / "drop files here" / "drag-and-drop files" / "attach files" | `Dropzone` |
| "an app menu bar" / "File/Edit/View menus" / "toolbar of controls" | `MenuBar` (no dedicated Cmd-K palette exists; use `Dialog` + `Picker`/`Selector` for a quick switcher) |
| "show a keyboard shortcut" / "render a hotkey / keycap" | `Kbd` (OS-aware; `mod` → ⌘/Ctrl)             |
| "an icon" / "a glyph" / "a chevron/close/search/trash icon" | `Icon` set (`<Check />`, `<ChevronDown />`, … tree-shakeable; `createIcon` for custom). Never an emoji or a raw inline `<svg>`. |
| "a hotkey to jump to a field" / "handle shortcuts centrally" | `Field hotkey="…"` (shows a `Kbd` badge + tags `data-hotkey`) + `focusFieldHotkey(combo)` to jump. The library owns **no** keyboard listener; you run the central hotkey engine in your app and call the helper (or `WindowArray`'s `apiRef`). |
| "a tag" / "a badge" / "a status pill" / "a filter chip" / "a removable token" | `Chip` (`tone` for status, `round` for the pill/badge reading, `onRemove` to dismiss, `onClick` for a filter) |
| "fill the rest of the page" / "header + scrollable body" | `Pane` with `Pane.Header` + `Pane.Body`     |
| "stretch a field to the bottom edge" / "fill region that locks to the edge on resize" / "a growing region in a resizable dialog/panel" | `Stack` + `Stack.Fill` (with `<TextEdit fill />` for a stretching text field) |
| "a long scrollable form" / "a form with a navigation minimap" / "one field per row, top to bottom" | `VerticalForm` (+ `.Section` / `.Field`); `FieldLayout` for packed justified rows, `Form` for state/validation |
| "a window manager / tiling windows / multi-window workspace / scrollable strip of panels" | `WindowArray` (`Dialog draggable` for a single floating window) |
| "a number input" / "a numeric field" / "a quantity / percent field with digit placeholders" (variable length) | `DigitInputMicro` (`slots`/`decimals`/`unit`/`min`/`max`; value `number \| null`) |
| "a PIN / 2FA code input" / "a fixed-digit amount" / "a percent / price the user types into" / "instrument-panel number entry" | `DigitInput` (`digits`/`decimals`/`unit`; calculator-style push typing) |
| "a slider" / "a range slider" / "a fader / volume / opacity / threshold control" / "pick a number on a track" | `Slider` (`tone`/`fill="dither"`/`marks`/`orientation="vertical"`; range = a two-entry array value). For a *typed* numeric field use `DigitInputMicro`/`DigitInput` instead |
| "a login form" / "sign-in" / "auth screen" / "username + password" | `Login` (terminal-styled sign-in panel; `alternatives` slot for passkey/SSO, `footer` for links). A standalone password field with a reveal toggle is `PasswordInput` (or bare `Input type="password"`); a 2FA/OTP code is `DigitInput mode="mask"` |
| "a date picker" / "pick a date" / "a calendar input" / "due date field" | `DatePicker` (ISO by default; type `2026-07`, `12 jul`, `tomorrow`, not `type="date"`) |
| "pick a week / month / year" / "a week picker" / "a reporting-period / billing-month field" | `DatePicker precision="week" / "month" / "year"` (whole ISO periods; value = period start) |
| "a colour picker" / "choose a colour" / "an OKLCH / RGB / HSL picker" / "colour channels / sliders" / "an eyedropper" / "a colour swatch" | `ColorPicker` (channel sliders across OKLCH/OKLab/RGB/HSL/HSV/LCH/Lab + hex, alpha, gamut handling; value is a CSS string). `ColorSwatch` for a preview / preset / `Popover` trigger. Colour maths at `lib/color`. Never `<input type="color">`. |
| "a table"                                          | `DataTable` (almost always; it handles a lot)   |
| "edit an array of objects" / "a form field that's a small editable table" / "add/remove rows of inputs" / "a repeatable row input" / "input a list of records" | `TableInput` (compact editable table as a form control; add/delete rows, `reorderable`, reuses DataTable's `edit` cell editors). Use `DataTable` instead for display/analysis at scale. |
| "tabs" / "too many tabs to fit" / "tabs that collapse into a ⋯ menu" | `Tabs` (add `Tabs.List overflow` to fold overflowing tabs into a `⋯` menu) |
| "collapsible sections"                             | No dedicated component; use `Tabs` for peer views, or `Reflow` (collapses to accordion-style sections when narrow) |
| "a sidebar file tree"                              | `Explorer`                                       |
| "a minimap" / "scroll overview" / "VS Code-style scroller" / "scrollspy outline rail" | `Minimap` (structural markers + clickable heading labels; `Graph.Minimap`/`Map.Minimap` are different: canvas camera overviews) |
| "an outline / nested list editor"                  | `Outliner`                                       |
| "a timeline with events"                           | `Timeline`                                       |
| "a chart" / "graph this"                           | `BarChart` / `Scatterplot` / `BridgeChart` based on shape |
| "fund flows" / "AUM bridge over time" / "subscriptions vs redemptions per period" | `Flows` (per-period waterfall ribbon; `BridgeChart` for a single-total decomposition instead) |
| "candlestick" / "OHLC" / "stock chart"             | `CandlestickChart`                                        |
| "a heatmap" / "contour plot" / "z = f(x,y) field"  | `Heatmap` (filled cells + optional `contours`)   |
| "a 3D surface" / "response/optimization surface" / "terrain" | `Surface` (orthographic, drag-to-rotate) |
| "a 3D scatter / point cloud" / "3-component embedding" | `PointCloud`                                  |
| "a 3D bar / 3D pie chart"                          | none; chartjunk, so use `Heatmap`, `Surface`, or a 2D `BarChart` |
| "a network / dependency graph / mind map"          | `Graph`                                          |
| "a map" / "plot points on a map" / "geographic / GIS / route / region" | `Map` (points/areas/vectors; `street`/`terrain` basemaps) |
| "loading state"                                    | `Skeleton` (inline placeholder) / `NonIdealState variant="loading"` (whole region) |
| "a spinner" / "busy / activity indicator"          | `Spinner` (inline glyph; `useSpinnerFrame` to embed) |
| "a progress bar" / "percent complete" / "upload/download progress" / "a determinate/indeterminate bar" | `Progress` (`value` number or `null`; `fill="color"/"dither"/"animated"`, `tone`, `size`, `showValue`) |
| "empty state" / "no results" / "error state"       | `NonIdealState` (variant per case)               |
| "streaming logs" / "terminal output"               | `StreamingTerminalText`                          |
| "markdown rendering"                               | `Markdown` (`Prose` for document-length content with an outline) |
| "a code / config editor" / "syntax highlighting" / "JSON/SQL/JS editor" / "vim mode" | `CodeEditor` (CodeMirror 6; language via `extensions`, opt-in `vim`) |
| "an inline / one-line code field that expands" / "an editable expression in a form row or cell" | `CodeEditorInline` (rests at one line, expands over content on focus; `maxRows`) |
| "a theme editor / token playground" / "customize the palette live" / "export a theme" | `ThemeBuilder` (edit `--sf-*` live, copy CSS/JSON; token pipeline emits `tokens.json`/`tokens.js`) |
| "a notebook" / "notebook-like analysis over my data" / "SQL cells" / "in-app analysis over DuckDB" | `Notebook` (+ `createSqlCellType` wired to the app's engine; `proseCellType` for text cells) |
| "chat UI"                                          | `Chat`                                           |
| "a chat in a drawer / assistant side panel / chat that shows it's thinking" | `ChatDrawer` (`thinking` + `onThinkingStart`/`End`) |
| "in-chat choice menu / decision tree / custom block in a chat reply" | `Chat` `parts` (+ `renderPart` for custom) + `onAction` |

Don't try to compose any of these from scratch. They exist for a reason.

---

## Anti-patterns to avoid in this codebase

In addition to the general taste rules in [AESTHETICS.md](./AESTHETICS.md):

### Don't add a utility-class library

No Tailwind, no UnoCSS, no styled-components. CSS Modules + tokens is
the path. If you find yourself wanting `tw\`...\``, the answer is
either an existing component or a new `.module.css`.

### Don't hard-code colors

Especially not `#fff`, `#000`, `gray-500`, `rgba(0,0,0,0.5)`. They look
fine in light mode and wrong in dark mode. Use tokens; `color-mix()` if
you need to derive.

### Don't introduce new top-level color tokens without consultation

The palette is intentionally small. If you think you need a new semantic
color, you almost certainly need to reuse an existing one or accept that
two things can share a hue.

### Don't import from internal module paths

```ts
// No.
import { Button } from "@tarassov-ch/swiss-function/dist/components/Button/Button";

// Yes.
import { Button } from "@tarassov-ch/swiss-function/button";
```

The public `exports` field in `package.json` is the contract. Internal
file paths can move; export paths can't.

### Don't fork a component to "tweak" its style

If a component needs a new variant, add a prop (`variant="..."`,
`size="..."`, etc.) and a CSS class in its `.module.css`. Don't copy
the file into the consumer codebase and edit it there.

### Don't bypass Base UI for primitives you can wrap

Buttons, dialogs, popovers, menus, comboboxes, switches, etc. Base UI
already handles the hard parts (focus traps, ARIA roles, keyboard
navigation). When extending, wrap; don't reimplement.

### Don't add personality

No emoji icons. No "✨" or "🎉" in copy. No mascot illustrations in
empty states. No celebratory animations on save. See AESTHETICS.md for
the long version.

---

## File layout (for contributors)

If extending the library itself:

```
src/
├── tokens/
│   ├── tokens.css     # all --sf-* custom properties (the canonical list)
│   ├── reset.css      # base-font + box-model reset
│   └── fonts.css      # optional JetBrains Mono webfont glue
├── lib/
│   ├── cx.ts          # className helper (use this, not clsx)
│   ├── chart/         # internal chart math (scales, ticks, viewport, annotations)
│   ├── graph/         # Graph layout/rendering internals
│   └── effects/       # animated WebGL "dither" fills (NonIdealState/Skeleton/DataTable)
└── components/
    └── <Name>/
        ├── <Name>.tsx           # forwardRef component
        ├── <Name>.module.css    # CSS Module with all styles
        ├── <Name>.stories.tsx   # Ladle stories
        ├── <Name>.spec.tsx      # optional component tests (Playwright CT)
        └── index.ts             # barrel re-export
```

When adding a component:

1. Wrap a Base UI primitive when possible. Compound components (Dialog,
   Field, Pane, Graph, …) expose Base UI's compound API as object
   namespaces (`Dialog.Root`, `Field.Label`, …).
2. Use forwardRef, accept HTML attributes, spread `...rest` to the root.
3. Use `cx()` to merge the internal class with consumer `className`.
4. Tokens for everything stylistic; no literals. Dark mode is
   `[data-theme="dark"]` swapping token values; never branch on theme in JS.
5. Add stories. Multiple variants. The Playground story uses Ladle args.
6. **Register in three places.** A new component is invisible until you:
   add `export * from "./components/<Name>"` to `src/index.ts`, add
   `"<Name>"` to the `componentNames` array in `vite.config.ts`, and add
   the per-component entry to `package.json`'s `exports` field. Miss any
   one and the barrel, the build, or the deep import
   (`@tarassov-ch/swiss-function/<name>`) breaks. The `exports` field is
   the public contract; consumers must never import internal `dist/…`
   paths.

---

## Environment & commands (for contributors)

Node/npm are not on `PATH` by default (NixOS). The dev shell comes from
`flake.nix` + direnv (`.envrc`); if `npm` isn't found, the environment
hasn't been activated.

`just` lists all recipes; each recipe wraps the matching npm script.

- `npm run dev`: Ladle story server at http://localhost:61000 (primary way to view components)
- `npm run check`: Biome lint + format check (the lint gate; `npm run format` writes fixes)
- `npm run typecheck`: `tsc --noEmit`
- `npm run test`: Vitest, runs **only `*.test.{ts,tsx}`**
- `npm run test:ct`: Playwright Component Testing, runs **only `*.spec.tsx`**
- `npm run build`: full library build (see the build chain below)

Run a single test: `npx vitest run path/to/File.test.tsx` (or `-t "name"`
to filter). Single CT spec:
`npx playwright test -c playwright-ct.config.ts path/to/File.spec.tsx`.
Pre-publish gate (`npm run prepublishOnly`): check → typecheck → build.

**The test-file split is load-bearing.** `*.test.tsx` → Vitest;
`*.spec.tsx` → Playwright CT. The runners match disjoint globs
(`vitest.config.ts` vs `playwright-ct.config.ts`); naming a file the
wrong way means its runner silently ignores it. `*.bench.ts` is a third
disjoint glob: micro-benchmarks, run only by `npm run bench`.

**Performance gates (three layers, all local-only):**

- `npm run bench`: vitest micro-benchmarks of pure logic (`*.bench.ts`,
  colocated; shared options + seeded PRNG in `perf/benchOptions.ts`, where
  bench data must never use `Math.random`).
- `npm run perf`: interaction-latency probes via `scripts/perf/run.mjs`
  drives `Perf/*` Ladle stories (`*.perf.stories.tsx`, deterministic
  data, root marks `[data-perf-ready]`) headlessly and reports medians.
  **Ladle must already be running on :61000.** Compares against
  `perf/baseline.json` (±20% + 5ms floor); `npm run perf:update`
  rewrites it. Timings are machine-specific, so update only deliberately
  on the baseline machine.
- `npm run size`: per-entry bundle cost through the dist ESM import
  graph (gzip bytes). Fails on > max(5%, 2KB) growth vs
  `perf/size-baseline.json`; `npm run size:update` rewrites. Needs a
  fresh `npm run build`.

**Visual regression gate (issue #47, also local-only):**

- `npm run vrt`: self-hosted pixel-diff over the Ladle stories
  (`playwright-vrt.config.ts`, test glob `vrt/*.vrt.ts`, disjoint from CT's
  `*.spec.tsx`). Renders every story in `vrt/stories.json` in **both themes**
  with reduced motion and diffs against a baseline via Playwright's
  `toHaveScreenshot`. `npm run vrt:update` seeds/refreshes baselines;
  `npm run vrt:list` refreshes the story manifest. Like the perf/size
  baselines, the reference images are machine-specific and **not committed**
  (git-ignored); the harness + manifest are versioned. Canvas/WebGL stories
  are non-deterministic, so drop them with `VRT_EXCLUDE`. See `vrt/README.md`.
  This is the automated form of the manual "visual pass in both themes" below.

---

## Build architecture (for contributors)

`npm run build` is three steps and the CSS handling is fragile by design:

1. `tsc -p tsconfig.build.json --emitDeclarationOnly` + `vite-plugin-dts`
   → `.d.ts` files.
2. `vite build` in library mode with `preserveModules: true`, one JS
   chunk per source module, not a single bundle. Per-component entries
   are listed explicitly in `vite.config.ts` (`componentNames`).
   `libInjectCss` injects side-effect CSS imports so consumer bundlers
   don't tree-shake the styles away (a real bug at v0.2.0).
3. `scripts/postbuild.mjs` rewrites `dist/`: renames `*.module.css` →
   `*.css` and moves the side-effect CSS import from the
   `.module.css.js` shim into the component's own `.js`, so consumer
   bundlers don't re-process already-scoped CSS as fresh CSS Modules.
   Read the header comment in `postbuild.mjs` before touching build
   output.

Peer/runtime deps (react, `@base-ui/react`, `@dnd-kit/*`, `@tanstack/*`,
react-markdown, remark-*) are externalized, never bundled.

---

## Issue workflow (for contributors: planning → tracking → shipping)

Issues live on the self-hosted Forgejo at `code.tarassov.ch/ux/swiss-function`.
The `tea` CLI is installed and authenticated (run it from the repo dir):
`tea issues edit <n> --description "$(cat plan.md)"`, `tea comment <n> "…"`.
Read raw issue bodies via the public API
(`curl -s https://code.tarassov.ch/api/v1/repos/ux/swiss-function/issues/<n>`),
because fetching the HTML page paraphrases the markdown.

1. **Plan in the issue body.** Research first (codebase current-state, prior
   art, dependency evaluation). Then edit the body: keep the original request
   verbatim at the top, append `---` and a structured `# Plan`: scope, design
   sections keyed to the asks, anti-scope, milestones (M1…Mn), testing/gates
   plan, and open questions each *with a recommendation* (implement the
   recommendation; don't block on the question).
2. **Research goes in comments**, numbered ("Research 1/3, current state",
   "2/3, prior art with sources", "3/3, dependency evaluation with a
   verdict matrix"). Scope corrections update the body in place plus an
   addendum comment.
3. **Track with milestones.** Partially-done issues stay open; post an
   implementation-report comment per completed chunk: what shipped, test/gate
   results, deviations from plan, bugs found during visual verification, and
   which milestones remain.
4. **Close via commit message** (`closes #N`) only when the issue is complete
   end-to-end. Commits go straight to `main` (solo repo, no PRs). Land a
   **changeset** with the change (issue #48): `just changeset <bump> "<note>"`
   writes `.changes/<slug>.md` declaring the version bump + release note. See
   `.changes/README.md`.
5. **Ship with `just release`** (issue #48): it aggregates the pending
   `.changes/` entries into a single bump (highest wins), prepends the generated
   notes to `CHANGELOG.md`, runs `npm version`, deletes the consumed changesets,
   then commits + tags + pushes `--follow-tags`. Pass an explicit bump
   (`just release patch`) to force one with no changesets. CI
   (`.gitea/workflows/publish.yml`, note `.gitea/` not `.forgejo/`) guards that
   the tag is on `main`, publishes to the Forgejo npm registry, and creates the
   Forgejo Release with the packed tarball attached **and the CHANGELOG section
   as its body** (no hand-written notes). Never `npm publish` manually; CI races
   you. `just changes-status` shows what a release would ship.
6. **Quality bar per issue**: colocated unit tests for pure logic, Playwright
   CT for interactions, Ladle stories, a visual pass in *both* themes (drive
   Ladle with Playwright and look at the screenshots; this catches real
   bugs), API.md/AGENTS.md updated in the same change, and deliberate
   `size:update`/`perf:update` with the numbers stated.

---

## Where to look for more

- **Live demos**: `npm run dev` (Ladle). Browse component stories.
- **Token list**: `src/tokens/tokens.css`, every available variable.
- **AESTHETICS.md**: why the library looks the way it does.
- **README.md**: package metadata and install instructions.

When in doubt: open the corresponding component's `.tsx` and
`.module.css` and read how the existing patterns are expressed. The
codebase is small and consistent on purpose.
