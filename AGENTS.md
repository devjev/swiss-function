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

To get the intended typography, optionally load the bundled webfonts at app
root too: IBM Plex Sans (the family `--sf-font-sans` prefers) and JetBrains
Mono (the family `--sf-font-mono` prefers):

```ts
import "@tarassov-ch/swiss-function/fonts.css"; // optional
```

It resolves from the optional `@fontsource/ibm-plex-sans` and
`@fontsource/jetbrains-mono` dependencies (latin subset, weights 400 to 700).
Skip it and both tokens fall back to the system stacks, and nothing breaks.

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

Density works the same way. The default is **compact**: 14px text on a 20px
`--sf-unit`, so a control is 30px and a table row 25px.
`data-density="comfortable"` on any ancestor switches that subtree to 16px on
a 24px unit (36px controls and rows); `data-density="compact"` switches a
region back. Set it on the root for a whole app: a floater that portals to
`<body>` (a menu, a popover, a dialog) takes the root's density, as it takes
the root's theme. Components that need the unit in px (virtualised rows)
measure it once when they mount, so set the density before the subtree mounts.

Touch needs no setup. On a device whose primary pointer is a finger
(`@media (pointer: coarse)`) the root takes the comfortable density unless it
carries a `data-density` of its own, every text field is at least 16px (under
which iOS zooms the page on focus), and small controls answer on a 44px hit
area while keeping their size. `data-density="compact"` on the root keeps the
dense metrics on a phone. For the notch and the home indicator, add
`viewport-fit=cover` to the page's viewport meta; the surfaces that reach a
screen edge then pad themselves. See Conventions → Touch.

---

## Component catalogue

Quick reference. <!-- guide:skip -->When in doubt, open the corresponding stories in
Ladle (`npm run dev`).<!-- /guide:skip --><!-- guide:host Every prop, default and `--sf-*` variable is in [API.md](./docs/API.md). -->

### Form controls

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Button`        | Any clickable action. Variants: primary, secondary, ghost, danger. Sizes: sm, md, lg. `surface` picks the face: `"flat"` (default), `"dish"` (a keycap scoop, for a key up to about two units wide), `"dome"`. `build="solid"` is the machined front-panel key built like `Knob` (a cap over a side wall set away from the light, the cast on the wall, an engraved label, a press that travels the full height; `aria-pressed` latches it), with opt-in `round` (a power button, its wall a bevel ring) and `finish` brushed or plain. |
| `ButtonGroup`   | A row of related buttons sharing a cascading size.        |
| `Field`         | Compound for any form row: `Field` + `Field.Label` + control + `Field.Description` (supplementary copy, full-strength fg) + `Field.Error`. Don't roll your own. |
| `FieldLayout`   | Whole-form layout: justified rows of rigid / flexible / filler fields. Sections of `FieldLayout.Field`s in a `flex-wrap` container, where each row fills left-to-right (flexible fields and `FieldLayout.Filler`s grow), strict source order (fields never migrate lines), gradual container-driven collapse with no breakpoints. `kind="rigid"` (fixed width, e.g. a DatePicker at 8u) / `"flexible"` (default, 10 to 36u) / `"prose"` (wide text) / `"filler"`. Rhythm on the unit: 2u between sections, 1u between fields/rows. Reach for this to lay out a form (Fields alone still work for a single row). |
| `Form`          | The layer above `Field`/`FieldLayout`: form-level submit + validation wiring. `Form` (orchestration; **bring-your-own `resolver`**, headless about Zod/Valibot/RHF), `FormField` (binds one control to a named field: label + control + description + live error), `FormError` (a form-level message, `role="alert"`). Two tiers: per-field `validate`/native constraints, then a whole-form `resolver` on submit that gates `onSubmit(values)`. Consolidated `errors` prop for server errors. Composes with `FieldLayout` (wrap each `FormField` in a `FieldLayout.Field`). Reach for this for a whole form with state/validation; use bare `Field` for a single labelled row. |
| `Input`         | Single-line text input. Monospace by design.              |
| `PasswordInput` | An `Input` for a password with a monospace show/hide toggle at its end. Masks by default; takes every `Input` prop. Drop it in a `Field`; `Login` uses it for its password field. |
| `DigitInput`    | Fixed-capacity number entry as digit cells (`[0][4][2].[5][0] %`). Two feels via `mode`: `"push"` (default, calculator-style, digits push from the right, always complete) and `"mask"` (2FA-style per-cell fill, null until complete). `digits`/`decimals`/`unit`; value is `number \| null` (null = untyped mask). Opt-in `signed` adds a leading `+`/`-` cell for negatives (push mode). Doubles as a numeric PIN input. |
| `DigitInputMicro` | Variable-length numeric input: a regular text input that shows a few faded, dithered placeholder digit slots (`░░ ░░`) at rest and fills them left-to-right (the "mask" hint), but grows past them as you type. `slots`/`decimals`/`unit`/`min`/`max`/`placeholderChar`; value is `number \| null`. The lighter sibling of `DigitInput`: reach for it when the width is a hint, not a fixed capacity. Native caret/selection/paste. |
| `DatePicker`    | Date input + calendar popup, ISO 8601 by default (`YYYY-MM-DD`, Monday-first weeks, optional ISO week numbers). Typing is the fastest path: `2026-07`, `12 jul`, `tomorrow`, `+7` narrow the calendar and Enter commits the echoed candidate; numeric fragments are always day-first, never US month-first. Value is `Date \| null`; `minDate`/`maxDate`/`isDateDisabled` constrain. `precision` picks whole ISO weeks / months / years instead of days (value = the period start, field shows `YYYY-Www` / `YYYY-MM` / `YYYY`; type `w29`, `jul`, `2028`). `path` turns the popup into a drill-down instead: `path={["year", "month", "day"]}` asks for the year, then its months, then that month's days, one step at a time, the header carrying the trail (each value a button back to its step) and the paddles stepping the context. Steps are `year` / `quarter` / `month` / `week` / `day`, each narrowing the one before it; the last step is the precision (so `["year", "quarter"]` commits a quarter start and shows `2026-Q3`), and the field is read-only. `isDateDisabled(date, level)` vetoes a whole year, quarter, month, week or day. Never reach for the browser-native `type="date"`. |
| `ColorPicker`   | A channel-slider colour picker: labelled sliders with live gradient tracks, switchable across **OKLCH** (default) / OKLab / RGB / HSL / HSV / LCH / Lab, plus a hex field, alpha over a checkerboard, an optional screen `eyedropper`, `swatches`, and an `OUT OF GAMUT` chip + Clamp for out-of-sRGB colours. Reads as an instrument panel, not a consumer swatch. Value is a CSS colour string; `onChange(value, color)` also gives the parsed colour. Built on the hand-rolled `lib/color` engine. `ColorSwatch` is the paired chip (over a checkerboard) for previews / presets / a `Popover` trigger, and opt-in `diagram` shows a colour-filled CIE 1931 chromaticity diagram (`ChromaticityDiagram`) with a dot at the current colour that you can click/drag to pick. Never reach for the browser-native `<input type="color">`. Pairs with `ThemeBuilder` for editing `--sf-*` tokens. |
| `Kbd`           | Renders a keyboard shortcut as OS-aware keycaps (`combo="mod+k"` → ⌘K on macOS, Ctrl+K elsewhere). `mod` = primary modifier; never shows ⌘ off-Mac. For labels/menus/tooltips. `surface` (dish by default) picks the cap face; `variant="outline"` is a flat ruled box per key that fits in a line of text. A space in the combo separates the steps of a sequence (`"g u"`). |
| `LaunchButton`  | A guarded, missile-launch-style two-step control: a hinged protective lid (hazard stripes, engraved `guardLabel`) over a recessed well; flip the guard open, then press the revealed action. `mode="button"` (default) fires `onClick` once and the guard snaps shut; `mode="switch"` holds an on/off armed state (`checked`/`onCheckedChange`) and closing the guard forces it off, like the physical guard. Escape / focus leaving cancel without firing. `tone="danger"` (default) or `"primary"`; `orientation="vertical"` is the fighter-panel column (a bat-handle toggle lever between engraved ON/OFF marks). For destructive or irreversible actions that deserve a physical confirm. `surface` picks the lid face (dish by default). |
| `Login`         | A terminal-styled sign-in panel: a dithered title bar, monospace identifier + password fields (DOS block caret, a mono show/hide toggle), a terminal error line, and slots for a `footer` and for other auth methods (`alternatives`, below a dithered "or"). Self-contained: holds the field state and reports it on submit; the authentication (and the `loading`/`error` it drives) is yours. There is no separate password primitive: a password field is `<Input type="password" />`, and a 2FA/OTP/PIN code is `DigitInput mode="mask"`. |
| `TextEdit`      | Multi-line / auto-growing text input.                     |
| `TextEditInline`| Single line at rest, expands to a multi-line editor on hover/focus. The overlay *floats over* the content below (`elevation-3`) instead of pushing it down, auto-grows with content and is vertically resizable while active; collapses back to one ellipsized line on blur. `size` (`sm`/`md`/`lg`, matches Input heights), `maxRows`. Reach for this in dense rows/tables where a note is usually short but occasionally long. |
| `CodeEditor`    | Editing source / config / structured text (JS, JSON, SQL, YAML…). A thin CodeMirror 6 wrapper, themed to `--sf-color-code-*` tokens (dark/light via `[data-theme]`), block caret, with opt-in `vim`. Three restrained syntax themes via `theme` (`minimal`/`bold`/`primary`, never a rainbow). Bring the language via `extensions` (e.g. `javascript()`, installing the `@codemirror/lang-*` package; none are bundled). `value`/`onChange`, `readOnly`, `lineNumbers`, `lineWrapping`, `tabSize`, `elevation`. Auto-grows; set a root `height` to fix + scroll. Not for prose (that's `TextEdit`/`Markdown`). |
| `CodeEditorInline` | The `CodeEditor` as a one-liner that expands to a multi-line overlay on focus (the code sibling of `TextEditInline`). Collapsed shows line 1 *syntax-highlighted* (a live CodeMirror, not a label); focus floats the full editor over the content below (`elevation-3`), growing to `maxRows` then scrolling; blur collapses back. Takes every `CodeEditor` prop plus `maxRows` / `collapsedElevation`. Reach for this in dense forms/tables holding a short expression that occasionally needs room. |
| `Checkbox`      | Binary independent toggles in lists.                      |
| `Radio`         | Single-choice within a group.                             |
| `RadioTable`    | A bordered, hairline-divided table of radio options, each a radio + label + description (a "pick one, each with a title and detail" list: plan pickers, settings). Compound: `RadioTable` + `RadioTable.Option` (`value`/`label`/`description`/`disabled`). The description sits right of the label when wide, below when narrow. Built on `RadioGroup`/`Radio`. Reach for this over bare `Radio` when each choice needs a description. |
| `Switch`        | Binary on/off for a setting, with an immediate effect. The rail is a flush groove; `surface` (dome by default) picks the thumb face. |
| `Slider`        | Pick a value (or a `[start, end]` range) along a scale by dragging: a recessed slot with an accent fill and a square, raised fader-cap thumb. `tone`/`color`/`fill="dither"`, `size`, `marks` (ticks), a `valueLabel` bubble, `orientation="vertical"`, and range (array value = two thumbs). Drop it in a `Field`. For a typed number / PIN reach for `DigitInput` instead (this is for a *dragged* value). `surface` (flat by default, a fader cap) can dome the thumb. |
| `Knob`          | A rotary control, the round sibling of `Slider`: a volume knob on a hi-fi front panel. A machined cylinder (a domed cap over a knurled side wall, in the material layer's one light) turns in a recessed sector well that holds the accent value arc; ticks and labels print on the panel around it. Same value API as `Slider` (`value`/`onValueChange`, `min`/`max`/`step`, `tone`/`color`/`fill="dither"`, `marks`, `valueLabel`, `surface` (dome by default)/`curve`, `elevation`), plus `sweep` (270° by default, `360` for a full turn), `fillOrigin="center"` for a bipolar control (balance, pan, tone), `drag="rotate"` (the value follows the pointer's angle) or `"vertical"` (mixing-console drag, Shift for fine), opt-in `wheel`, and `finish`. Wraps Base UI Slider (keyboard, aria, `Field` labelling, form submission). Drop it in a `Field`. For a dragged value along a track reach for `Slider`. |
| `ToggleGroup`   | Mutually-exclusive segmented control. Items are raised keys like Button; the pressed one sits down. `surface` (flat by default) picks the face. |
| `Selector`      | Search + multi-select with a visible "bucket" of chosen items as removable chips. `layout="panel"` (separate bucket, default) or `"inline"` (tag-input). An item's optional `group` files it under a section header in the dropdown (groups cluster in first-appearance order; ungrouped items list first), and clicking a header selects/deselects the whole group. High-level: `<Selector items value onChange />`. |
| `Picker`        | Search + single-select, the one-choice sibling of `Selector` (same item shape, `value` is one string; `group` sections work the same). The field shows the chosen label and doubles as the filter. High-level: `<Picker items value onChange />`. |
| `Dropzone`      | File drag-and-drop zone (+ click-to-browse) that surfaces files via `onFilesChange` and renders them as a removable list. Presentational: the upload itself is yours; feed per-file progress/error through the `fileStatus` slot. |
| `TableInput`    | A compact editable table used as a **form control**, for entering an **array of objects** (one row per object). `columns` name a row property and pick a cell editor via DataTable's `edit` config (text→`TextEditInline`, number→`DigitInputMicro`, boolean→`Checkbox`, select/date→`Picker`/`DatePicker`), cells are always-on editors. A footer button adds a blank row, a per-row trash deletes; opt-in `reorderable` drags to reorder (lazy dnd-kit), `minRows`/`maxRows` bound the count, `equalColumns` evens the widths. Controlled `value`/`onChange`. Drop it in a `Field`. Not `DataTable` (that's a display grid at scale, no add/remove-row UI). |

### Surfaces & layout

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Box`           | A surface with `elevation={0..5}`. The atom of grouping. |
| `Grid`          | The layout primitive. CSS Grid wrapper with token-sized gaps. Pass `resizable` (`"columns"` / `"rows"` / `"both"`) to make track boundaries drag/keyboard-resizable (double-click a gutter to split evenly). `minColumnWidth` (units or a CSS length) instead of `columns` gives as many equal columns as fit, down to one on a phone, with no breakpoint. |
| `Pane`          | Full-height region split into Header (auto) + Body (scrollable). Compound: `Pane`, `Pane.Header`, `Pane.Body`. Nests cleanly. Use whenever a region needs to fill its parent and scroll its overflow internally. |
| `Stack`         | Resize-aware fill/stretch layout (issue #74): a column (or `direction="horizontal"` row) where children keep their natural size and a `Stack.Fill` region stretches to absorb the remaining space and stays locked to the edge as the container (a resizable `Dialog.Popup`, a panel) resizes. Encapsulates the fiddly flex + `min-*-size: 0` chain. `fill` makes the stack itself grow to fill its parent; `gap` in `--sf-unit`. Pair with `<TextEdit fill />` inside `Stack.Fill` for a field that grows to the bottom edge. `Dialog.Popup` is a flex column, so `<Stack fill>` works as its body directly. Reach for `Pane` instead when it's just header + one scrollable body. |
| `Minimap`       | VS Code-style scroll-overview rail beside a component-owned scroll container, built from **structural markers**, not a scaled clone: `block` markers are dither rules (density read), `header` markers are clickable, level-indented heading labels with active tracking. The viewport indicator is the honestly proportional band of the document visible in the main view (markers inside it = content on screen); a 24px invisible grab/focus zone (`role="scrollbar"`, keyboard-operable) makes it grabbable on long documents. Drag / press-to-jump / wheel forwarding / label click-to-jump; rail hides when content fits. You supply the `markers` array in content coordinates, which is what makes it work over virtualized bodies (re-supply on measurement change + `onJump`); for content you do not lay out yourself, `useMinimapMarkers(rootRef, [{ selector: "h2, h3", kind: "header" }, { selector: "p" }])` measures them from the DOM and re-measures on resize and mutation. Parent must constrain the height, like `Pane`. Not `Graph.Minimap`/`Map.Minimap` (canvas camera overviews). |
| `Fullscreen`    | Wraps content with a corner toggle that expands it to fill the browser viewport (a fixed overlay, not OS fullscreen, works everywhere); a single child stretches to 100%. Escape exits; locks page scroll while open. Props: `expanded`/`defaultExpanded`/`onExpandedChange`, `buttonPosition`. |
| `PopOut`        | Pop content out into a separate **browser window**: closed it renders children in place, open it `window.open`s a same-origin popup, clones the opener's stylesheets (kept in sync) and mirrors the root theme/palette attributes (`data-theme`/`data-colors`/class/`color-scheme`), and portals the children into it. `open`/`defaultOpen`/`onOpenChange(open, reason)` (`closed`/`escape`/`blocked`), `title`, `rect` (screen placement), `name`, `windowRef`. Toggle from a click handler or popup blockers refuse it; the subtree remounts on each transition. `pip` prefers a **chromeless** Picture-in-Picture window (no `about:blank` address bar) where the browser supports it (Chromium; one at a time, always-on-top), falling back to `window.open`. Library floaters (Menu, Popover, Picker, DatePicker, ...) opened inside popped content follow into the popup window (a `PortalContainerProvider` they all read). The multi-monitor sibling of `Fullscreen` (which overlays the same viewport); `WindowArray popOutable` and `Dialog.PopOut` build on it. A `pip` window has no OS chrome, so the popped content gets a maximize toggle (`maximizable`; WindowArray puts it in its own popped title bar via `usePopOutWindow()`). |
| `Reflow`        | Responsive multi-column layout. Wide: equal columns side by side; when its container is narrower than `collapseAt` it collapses to a vertical accordion or a tab switcher (`collapseMode`). Compound: `Reflow.Root` + `Reflow.Column` (each with a `title`). Reach for this to make a multi-column region usable on narrow screens. |
| `VerticalForm`  | A tall, one-field-per-row form that scrolls and is navigated by a `Minimap` rail. Each row is a `Box` surface holding a vertical `Field` (label, control, description, optional error), or a plain unadorned row when `bare` (no surface, no padding, for a minimal look); the field names (and `VerticalForm.Section` titles) become clickable markers on the rail, and an errored field shows a danger tick. Compound: `VerticalForm` → `VerticalForm.Section` (titled group) → `VerticalForm.Field` (`label`/`description`/`error`/`required`, control as child). Presentational (layout + navigation; wrap in `Form` for state/validation). Opt-in `nav` adds a bottom bar with a searchable `Picker` of all titles (jump-to, and it tracks the title scrolled to the top). Parent must constrain the height. The vertical, scrollable sibling of `FieldLayout` (which packs justified, wrapping rows). |
| `WindowArray`   | Window-manager main area, Niri-style scrollable tiling: an infinitely horizontally-scrollable strip of columns, each a vertical stack of windows with Dialog-style chrome (title, ✕, fullscreen-in-container). Declarative (`WindowArray` → `.Column` → `.Window`): you own the list; drag/Shift+Arrow rearranging reports a `WindowMove` via `onWindowMove` for you to apply. Columns resize by gutter; keyboard nav auto-scrolls the strip; opt-in `snap` (column scroll-snapping) and `controls` (edge paddles for a mouse; hidden on touch, where a swipe scrolls the strip). In a narrow container the strip turns vertical (columns become full-width bands) and a band wraps its windows onto further lines so that none is narrower than `windowMinWidth` (240px by default): on a phone each window takes a full-width line, and Up/Down, the paddles and `apiRef.switchColumn` step one line at a time. Opt-in `splittable` adds a split button to each window's chrome: a picker dialog pairs it with a second window and the two fill the container as flush halves (`splitIds`/`defaultSplitIds`/`onSplitChange`; Escape exits; mutually exclusive with fullscreen). Opt-in `popOutable` adds a pop-out button: the whole window (title bar, custom actions, body) opens alone in a separate browser window (via `PopOut`; `poppedIds`/`defaultPoppedIds`/`onPopOutChange`) and leaves the strip so the neighbours fill the space; closing the popup or the pressed pop-out button brings it back. Wins over fullscreen/split. Column switching is driven by the consumer via `apiRef` (`switchColumn`/`focusActive`); the component binds no global shortcut. For one floating window use `Dialog` (`draggable`/`resizable`) instead. Window title bars are raised keys (`surface`, flat by default), pressed while dragged. |
Both `Reflow` and `MenuBar` (the latter only when given `collapseAt`) adapt to their **container** width via `ResizeObserver` (the shared `useCollapse` hook), not viewport media queries. This is the library's container-responsiveness mechanism, so they work inside sidebars/split panes. Use JS-measured collapse (not CSS `@container`) whenever the breakpoint must swap which subtree renders.

### Overlays

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Dialog`        | Modal interruption. Confirmations, forms, destructive actions. Backdrop dim is deliberately very subtle. For a window-like dialog, add `draggable` + `resizable` to `Dialog.Popup` and wrap the header in `Dialog.Handle`; drop a `Dialog.Actions` row inside the handle with `Dialog.Maximize` (fullscreen toggle), `Dialog.PopOut` (move the content into a separate browser window; the dialog stays open as a placeholder, `poppedOut`/`defaultPoppedOut`/`onPoppedOutChange`), and `Dialog.CloseButton` (icon ✕) for window chrome. A sized popup never exceeds the viewport, and `fullscreen` (`true`, or `"narrow"`: under a 30rem viewport) fills the screen edge to edge; a `draggable` / `resizable` popup is `"narrow"` by default, since a floating window has no room on a phone. |
| `Drawer`        | Edge panel sliding from left/right/bottom (`side`). Non-modal by default; render `Drawer.SwipeArea` outside the `Portal` for a persistent reopen handle. |
| `Popover`       | Anchored, click-triggered floating content.              |
| `Menu`          | Button/trigger-anchored dropdown menus.                  |
| `ContextMenu`   | Right-click (context) menu. Same parts/styling as `Menu`; `ContextMenu.Trigger` marks the right-clickable region instead of a button. |
| `MenuBar`       | Application menu bar (`role="menubar"`; wraps Base UI Menubar/Menu) at the top or bottom edge. `MenuBar.Trigger` opens a `MenuBar.Content` dropdown of `MenuBar.Item` (with `shortcut`) / `.Separator` / `.Submenu`. Slots: `.Logo` (left), `.Search` (right). It can also host in-place controls via `.Control` (any Button/Switch/Input; `label` shows in the collapsed panel) plus `.Spacer`. Responsive (container-width): `collapse="all"` (with `collapseAt`) folds the whole bar behind one ☰; `collapse="items"` folds items progressively into a ⋯ overflow menu from the trailing edge. **Not** a Cmd-K palette. |

### Disclosure

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Tabs`          | Horizontally peer-level views in the same surface. `Tabs.List overflow` folds tabs that don't fit into a trailing `⋯` menu (priority-plus, container-width based) instead of overrunning the row, keeping the selected tab visible. Folder tabs: raised cards on the sheet's edge, the selected one lifted and merged with the panel (`surface` on the list, flat by default). |
### Data display

| Component                | Use for                                            |
| ------------------------ | -------------------------------------------------- |
| `Icon`                   | The icon primitive + a curated, tree-shakeable line-weight set (issue #51): a `16×16`, `currentColor`, square-capped glyph on the `--sf-unit` grid, with no fills, no colour, no emoji/mascot art. Each icon is its own named export (`<Check />`, `<ChevronDown />`, `<Search />`, …) so unused ones tree-shake. `size` (number = `--sf-unit` multiples, default `1em` so it tracks text), `label` (omit → decorative `aria-hidden`; set → `role="img"` + `<title>`), `strokeWidth`. `createIcon(name, path)` for custom glyphs; the `Icon` primitive renders any `16×16` path as `children`. **Use this instead of an emoji or a raw inline `<svg>`.** **Pluggable (issue #89):** the library renders its own glyphs through `<Glyph slot="…" fallback={…} />`, so a consumer can redirect any of them (or their own) to Feather/Lucide/Tabler with `<IconProvider icons={{ close: iconAdapter(X), … }}>`. Zero dependency by default; `SF_ICON_SLOTS`/`IconSlot` is the append-only slot vocabulary. See API.md. |
| `Calendar`               | A scheduling calendar with **Month**, **Week**, and **Year** views (switchable at runtime), a prev / next / today toolbar, and a view switcher. Shows events / schedules, not a date field: distinct from `DatePicker` (which picks a value). `CalendarEvent`s carry an optional time (`allDay` for whole-day items); the week view lays overlapping timed events into side-by-side columns and pins all-day / multi-day events in a strip above a scrollable 24-hour grid, and multi-day events span as bars (month view + strip) with continuation markers at week boundaries. Weeks start Monday (ISO 8601). Colour by `tone` (status) or an explicit `color` (a consumer-owned category palette). Display + click only (v1: no drag / authoring): wire `onEventClick` / `onDateClick`; focused date (`value`/`defaultValue`) and `view`/`defaultView` are each controlled or uncontrolled. The year view drills into a month/week. Give the parent a height (the week grid scrolls inside it). `showWeekNumbers`, `renderEvent`. The calendar adapts to its own width (a ResizeObserver on its root, in units, so it follows the container and the density): with `weekDays="auto"` (default) the week view shows the ISO week when each day column gets 5 units, three days from the focused date when each gets 4, and one day under that, and prev / next step by the days shown; `weekDays={7 | 3 | 1}` fixes the count. In a narrow calendar the toolbar wraps onto a second line, week headings stack the number under the weekday, an event block shows its time and title whole or not at all, and the month grid shortens `+4 more` to `+4` and drops the label of a bar too narrow for a few characters (the coloured rule stays, and the bar stays a button). **Note:** shares the bare name `Calendar` with an `Icon` glyph; the component wins the barrel, import the glyph from `/icon`. |
| `Chip`                   | Compact token: tag, filter, status marker, or removable selection. Sharp (2px) by default; `round` for the pill/badge reading. Neutral unless a `tone` (`primary`/`success`/`warning`/`danger`) makes the colour *mean* something (status/priority); don't colour chips decoratively. `variant="solid"` fills the chip with its tone and sets the label in the colour that reads on it, for the one chip that must stand out (a count, the active filter). `dot` adds a leading status marker; `onRemove` renders a keyboard-reachable ✕; pass `onClick` to make the whole chip an accessible filter button. `size` `sm`/`md`. Not a Button (that's for actions) and not a toggle set (that's `ToggleGroup`/`Selector`). |
| `DataTable`              | Tabular data: sorting, selection, virtualization, Column resize (on by default; `resizableColumns={false}` or per-column `resizable: false` to lock; double-click a header edge to auto-fit). `columnFit="content"` sizes every column to the narrowest width that still shows its content, at mount and again when the data changes; `headerMenu` adds a right-click Fit this column / Fit all columns. Tracks are `minmax(minWidth, preferred)`: for a mouse, when the columns don't fit they shrink toward their minimum (no scroll), and only when even the minimums don't fit does the table scroll horizontally. `columnShrink` (`"auto"` by default) picks this: `"squeeze"` is that behaviour, `"hold"` keeps every column at its width and scrolls sideways at once, and `"auto"` holds where the primary pointer is a finger (the `--sf-table-column-hold` token), where a dithered fade on the trailing edge shows while there is more to scroll (`edgeFade`, whose default follows it). At rest the last column's preferred is `1fr` (fills slack). Resizing is the spreadsheet model: a drag changes the dragged column alone, its neighbours keep their widths and the row's total width follows (scrolls when wider than the viewport, leaves slack when narrower); the first resize freezes every column at its measured width and ends the `1fr` filler, and every resizable column has a trailing handle, the last one included. Set `width` / `minWidth` per column in `--sf-unit` multiples, plus opt-in `scrollSnap` and `edgeFade`. `columnFill` fills the space right of fixed-width columns with a dither panel, and `fillHeight` holds the given `height` when rows are too few and dithers the empty band below the last row (so a sparse fixed-height table reads as one filled panel). `cellBackground` paints a body cell's whole background from its own data, so the colour follows the row through a sort (conditional formatting), while `highlights` overlays persistent coloured range markers (the Excel "coloured range reference" look: light fill + a solid border around each block); positional, declarative, several distinct colours for separate ranges (e.g. charting series), driven from `onSelectionChange`. `frozenColumns={n}` freezes the first n columns (pinned left while the rest scroll, the horizontal analogue of the sticky header; frozen columns keep a fixed width, and release to scroll with the rest while they are wider than half the table). Excel row/column selection: `rowNumbers` adds a frozen numbered gutter (click a number = whole row, drag = a row span, corner = whole grid; not a data column, so `col` coordinates don't shift), every leaf header has a slim select zone on its top edge (click = whole column; the label still sorts), and Shift+Space / Ctrl+Space select the active row/column; full rows and columns flow through `onSelectionChange` as ordinary ranges. `selectionMode="row"`/`"column"` makes a plain cell click select its whole row (list/master-detail) or column instead of one cell. With `editable`, each column's `edit` config picks a purpose-built cell editor: `text`→`TextEditInline`, `number`→`DigitInputMicro` (`decimals`/`slots`/`unit`), `date`→`DatePicker` (commits a `Date`), `boolean`→a two-option `Picker` (True/False), `select`→a searchable `Picker`. Typing on an editable cell opens its editor seeded with the keystroke (with a finger, a second tap on the active cell opens it), Delete/Backspace clears the selected block through `onCellChange`, and `apiRef` (`setActive`, `startEdit`, `getSelection`) lets a host such as a formula bar move the cursor or open an editor from outside. The serious one. Column headers are raised keys (`headerSurface`, flat by default) over an ink rule; the sorted column's header sits pressed, and a column `color` tints that key (hue only, mixed in OKLCH, so the material survives). A per-column `minWidth` is a floor every resize path keeps: the drag, the keyboard and auto-fit. A drag is live with a width readout under the handle (`min` at the floor, where the cursor turns one-way); a focused handle takes arrows, Page keys, Home (the floor), End / Enter / Space (auto-fit) and Escape (restore). A full-column selection resizes together, Shift+drag moves the edge between two columns with the total held, group titles constrain their leaves, and `apiRef.autoFitColumns()` fits them all. **A column is never narrower than its title**: the header's need (title on one line plus its chevron, funnel, reserved sort arrow and padding) is measured and raises the floor on every path, the container squeeze included (the table scrolls instead of wrapping a title). `headerLines` (table or column) allows a title N lines: the key grows to hold them and the floor is where the title would need one more. Body cells have three overflow modes (`cellOverflow` on the table, `overflow` per column): `clamp` (one line, an ellipsis, the default), `wrap` (within the lines `rowHeight` holds), and `hash` (Excel's `####` while a value does not fit; for numeric and date columns). A column's `total` (`"sum"` / `"avg"` / `"min"` / `"max"` / `"count"` / `"countUnique"`, or a function of the rows) adds the **totals row**: one summary line pinned to the bottom edge of the grid (`totals={{ position: "top" }}` puts it under the header), covering every filtered row rather than the page on screen (a tree table totals its roots), in Swiss number format. `totals` tunes the row's label and position, `totals={false}` drops it; it carries no cell coordinates, so selection and copy never reach it. On a tree table (`getSubRows`) a column filter reaches every level: a row stays when it or a descendant matches, and the path to a match shows open while the filter is active, without changing the `expanded` state. **Alignment follows the data type** when a column declares none: a `number` edit column ends (cells and heading), a `boolean` centres, everything else starts; an explicit `align` wins. |
| `Markdown`               | Rendering markdown content (uses remark-gfm; `remarkPlugins` adds syntax extensions). `variant="terminal"` sets it as a terminal renders markdown: one monospace size, headings told by weight and their `###`, fences kept and no box around code, known languages highlighted in the CodeEditor's restrained `primary` style, `-` bullets, tables ruled like box drawing (what `Chat` uses for a reply). |
| `Prose`                  | Long-form markdown reading view: virtualized body + auto outline. Compound: `Prose.Root`, `Prose.Body`, `Prose.Outline`. A `split` root stacks the outline above the body in a narrow container. Reach for this over bare `Markdown` for document-length content. |
| `Notebook`               | Notebook-like analysis inside the app: reactive cells (edit one, dependents re-run) over consumer-provided engines. `document`/`onDocumentChange` (controlled JSON), `cellTypes` registry: `proseCellType` built in, `createSqlCellType({executor})` for SQL over the app's DuckDB-WASM (or any engine), any further language via the public `CellType` contract (`findDependencies`/`execute`/`renderResult`). Results render through DataTable/Markdown; the library ships no engine and no eval. `fromArrow` (also at `/lib/from-arrow`) converts Arrow results (Date coercion, BigInt policy) for DataTable. |
| `Progress`               | Progress bar: determinate 0..100% `value`, or indeterminate (`value={null}`). Wraps Base UI Progress (`role="progressbar"`). Three fills via `fill`: solid `color`, static `dither`, or `animated` (the WebGL dither engine, loaded lazily). `tone`/`color`, `elevation`, thickness `size` (`xs`/`sm`/`md`/`lg`), optional `showValue` readout. Reduced-motion → static frame. Not a `Meter` (static gauge). |
| `Stat`                   | A statistic / KPI card: a labelled figure with an optional change indicator (`delta`, arrow + good/bad colour via `goodDirection` so a churn drop reads green), a `line`/`bar` `trend` sparkline, a leading `icon`, and a muted `caption`. Tabular-mono value; a numeric `value` is formatted in **Swiss typography** (apostrophe thousands, `1'284'500`) with `decimals`/`valueUnit`. Colour only where it means status (`tone` for the value). Sizes `xs`/`sm`/`md`/`lg`/`xl`. The value is never cut: in a narrow card it shrinks to fit (down to two fifths of its size). Standalone with `elevation`, or lay several out in `Stat.Group` (a responsive, hairline-divided panel that reflows as it narrows). For dashboards. Not a `Chip` (a compact token) or a chart (`Scatterplot`/`BarChart` plot series on axes). The Swiss number formatter is exported as `formatNumber` (also `/lib/format`). |
| `Skeleton`               | Loading placeholder with shimmer (respects reduced-motion). |
| `Spinner`                | Inline CLI-style animated glyph (`role="status"`) for "busy" feedback. 28 monospace `variant`s (braille/line/blocks/bars/grow/bounce/arrow/quadrant/triangle/circle/corners/pipe/star/toggle/dots/pulse/scanner/arrowDouble/caret/trigram/dqpb/arc/clockface/balloon/weave/boxCorners/quadrantHeavy/static); `color` (any token) + `size`, else inherits; `speed`. Reduced-motion → static frame. The `useSpinnerFrame(variant, speed)` hook embeds the glyph in other components. |
| `NonIdealState`          | Empty / no-results / error / loading state for a region. A sizable block continuously filled (WebGL, ~0.06ms/frame, pauses offscreen) with console-style dithered shade blocks; message + action in the cleared center. Props: `variant`, `title`, `description`, `action`, `width`/`height`, `effect` (24 animated: ripple/noise/scan/plasma/rain/wave/spiral/radar/tunnel/fire/bars/metaballs/rotozoom/twister/copper/voronoi/grid/kaleidoscope/starfield/swirl/helix/checker/droplets/lissajous; per-variant defaults: empty→plasma, no-results→noise, error→scan, loading→ripple), `effectOptions` (speed/wavelength/amplitude/rate/density/seed), `speed`, `density` (overall coverage), `cellSize` (square shade-block px), `color` + `opacity`. Reduced-motion → static frame. |
| `StreamingTerminalText`  | Terminal/log output that arrives incrementally.    |
| `ThemeBuilder`           | Live editor for the `--sf-*` tokens (issue #50): tweak the curated palette / unit / radius / typography / motion, watch a component sample retheme instantly (overrides applied as inline custom properties on the preview scope), then copy the result as a CSS theme or JSON. Colours edit per light/dark; the rest are theme-agnostic. `tokens.css` stays canonical, so this makes *overriding* it ergonomic (it does not change the default palette). Also exports `themeToCss`/`themeToJson`. Pairs with the build-time token pipeline <!-- guide:skip -->(`npm run tokens:build`) <!-- /guide:skip -->that emits `tokens.json` / `tokens.js` (`vars` accessors) / `tokens.style-dictionary.json` from the same canonical CSS. |

### Navigation

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Explorer`      | File-tree-style hierarchical navigation: virtualized tree grid with rename-in-place, row drag-to-reorder, and DataTable's column affordances (sort/filter/resize/reorder). With a finger, a swipe scrolls the tree, a rest then a move drags a row, and a long press opens the context menu. `gridLines` gives it full spreadsheet borders. `columnShrink` works as in DataTable (`"auto"`: the columns squeeze for a mouse and hold their width on touch, where the tree scrolls sideways with the header following and a fade on the trailing edge). **Explorer vs DataTable**: reach for Explorer when the data is inherently a tree the user *manipulates* (rename/move/reorder rows); reach for DataTable for tabular data at scale (cell selection/editing, column groups, frozen columns, pagination, 100k+ rows). They share their column machinery (`src/lib/columns`, `src/lib/filter`) by design, but don't merge them further: the tree-vs-flat data pipelines, row-vs-cell selection and rename-vs-cell-editor models are deliberately separate (issue #28). Column headers are raised keys (`headerSurface`, flat by default), the sorted one pressed, and a column is never narrower than its title (the measured header floor, as in DataTable), with DataTable's resize gestures: the width readout, the one-way cursor at the floor, and the splitter keys on a focused handle. |
| `Outliner`      | An outline edited as one document, after Roam Research and Logseq: a block is a textarea over its markdown while the caret is in it and rendered markdown otherwise, with a bullet per block and indent guides. Enter splits at the caret, Backspace at the start merges into the block above, the arrows cross blocks keeping the caret column, Tab/Shift+Tab indent and outdent, Alt+Shift+Arrows move a block, Mod+Up/Down fold. Escape leaves the text with the block selected (arrows walk the tree), Escape again releases. Blocks select in runs (Shift+Arrows, Shift+click, a drag across blocks; a block includes its children) for indent, move, delete, and copy / cut / paste as a markdown list (pasted lists become nested blocks). One undo stack covers text and structure (Mod+Z / Mod+Shift+Z). Typing help: brackets pair and wrap a selection, Mod+B / Mod+I / Mod+K format, `==text==` is a highlight and `=={green}text==` one in a named colour (six: yellow, green, blue, pink, orange, purple, on `--sf-color-highlight-*` tokens; Mod+Shift+H highlights and, pressed again, steps through the colours, `/highlight` picks one), Mod+Enter makes a block a task (`[ ] ` / `[x] `, shown as a checkbox), `#tags` render as wiki links, `@2026-11-25` is a due-date chip that opens a calendar, and `completions` feeds a caret-anchored list for `[[page`, `((block`, `#tag` and `/command` (the app supplies the entries; the outline knows no pages). A click on a bullet (or Mod+.) zooms into its block: the block becomes the title, its children the first level, a breadcrumb leads back (`root`/`defaultRoot`/`onRootChange`, `zoomable`, `rootLabel`). Dragging a bullet moves the block, or the selected blocks, to the gap and depth the pointer picks (`reorderable`, on by default; lazy dnd-kit, joins an `SfDndProvider`). A block's type is read from its text (no type field): `# ` headings (Mod+Alt+1 to 3), `> ` quotes, `> [!warning]` callouts, `---` dividers, fenced code, `1. ` numbered items (the number takes the bullet's place; renumbered by place), `key:: value` properties (`blockProperties(bullet)` reads them), an image alone in a block (drag its edge to size it; `onUpload` takes pasted and dropped files), `{{table}}` and `{{kanban}}` over the block's children (cards drag between columns), and `{{embed ((id))}}`, the block itself shown again and editable in place. Tasks also have in progress (`[/] `) and cancelled (`[-] `), and a parent counts its tasks (`2/5`). `/` lists block commands (`/heading`, `/table`; `commands={false}` turns them off). `blockTypes` registers types of the app's own (`{ name, match, render, command, inline }`); an inline span such as `$x$` also renders in the breadcrumb, the drag label, board column titles and query results, and `OutlinerLabel` gives a block type of the app's own the same one-line rendering, and the separate `outliner-blocks` entry has six, most of which take the app's engine: `createQueryBlockType` (`{{query words}}`), `createMathBlockType` (`$$ … $$` and `$x$` inside a line, set by KaTeX, a dependency loaded on first use), `createDiagramBlockType` (a fenced `mermaid` block), `createDataBlockType` (a fenced `csv` / `json` block as a `DataTable`), `createCodeBlockType` (a fenced block edited in a `CodeEditor`) and `createLinkPreviewBlockType` (a block that is one URL). `virtualized` renders only the rows on screen for outlines of thousands of blocks (give the outline a height), `frame={false}` drops the border, and `apiRef` drives it from outside (`focus`, `select`, `edit(id, offset)`, `getSelection`, `undo`/`redo`). On a touch device the structure commands are keys on a bar above the on-screen keyboard while a block is edited (`toolbar`, `"auto"` by default: shown where the primary pointer is a finger; `true` on any device, `false` never): outdent, indent, move up, move down, task, undo, redo, and a key that leaves the text. Each key runs the command its chord runs and does not take the focus, so the caret and the keyboard stay; a key that would change nothing is disabled. The bar is fixed to the bottom of the visual viewport (`window.visualViewport`), renders through the portal container, and the outline ends with room for it so the last block scrolls clear. Controlled `value`/`onChange` (a `Bullet[]` tree; text is live, one `onChange` per keystroke), `readOnly`, `generateId`, `[[wiki links]]` (`onWikiLinkClick`) and `((block-id))` references (`resolveBlockRef`). |

### Charts

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Scatterplot`      | Points and/or lines on numeric or time axes. Series-based. |
| `BarChart`         | Categorical bars: series side by side, or piled into one bar per category with `stacked` (`"percent"` for the 100% mix; negatives hang below the baseline, uncoloured segments step the neutral ramp or `fill="dither"`). |
| `BridgeChart`      | Waterfall / financier's bridge: totals + signed deltas. |
| `Flows`            | Per-period fund-flow ribbon, each period a within-period waterfall (open → subscriptions → redemptions → performance → fx → close), periods connected close→open. The compact, candle-like read of AUM dynamics over time. |
| `CandlestickChart` | OHLC financial candles (up = success, down = danger), index-spaced. |
| `Timeline`         | Horizontal time strip with stacked event labels and a scrubbable playhead. |
| `Heatmap`          | 2D grid of `z = f(x,y)` as filled cells, with an optional marching-squares `contours` iso-line overlay. The default, Swiss-friendly read of a 2-variable field: reach for this before a 3D surface. |
| `Surface`          | 3D surface `z = f(x,y)` (Canvas2D, axonometric, **drag-to-rotate**). For data that is genuinely 3D and loses meaning when flattened (response/optimization surfaces, terrain). Single-hue height ramp + measured cube frame. |
| `PointCloud`       | 3D scatter / point cloud: `series` of x/y/z points (clusters, 3-component embeddings). Same axonometric engine as `Surface`. |
| `BoxPlot`          | Compare distributions across categories: each cell is a five-number summary (raw `values` per category summarised under Tukey or min/max `whiskers`, or precomputed `stats`), drawn in Tufte's reduced quartile form by default (whisker lines to the quartiles, a median dot, the IQR as the gap, hollow outlier dots), as the classic box under `scaffolding="full"`, or as a `shape="violin"` (mirrored kernel density). Several series group side by side; `orientation="horizontal"` runs categories down the side. Shares the 2D scaffolding (value-axis `zoomable`, `annotations`, `controls`, `frame`, `fullscreen`, `selectable`) and the measured-label recipe. |
| `Histogram`        | The distribution of one numeric variable: values binned on a nice-number threshold ladder (automatic Freedman-Diaconis count, a count hint, or explicit irregular thresholds) as flush bars, in `normalize` units of count / percent / density, with an optional Gaussian `density` curve and a `cumulative` (ECDF) step-line mode. Several `series` overlay on one shared set of bins. Same scaffolding as the other 2D charts (`frame`, `fullscreen`, `controls`, `zoomable` x axis, `annotations`, `selectable`), `onPointActivate` per bin. One-pass binning: 100k values are fine. Not `BarChart` (categorical magnitudes) and not `BoxPlot` (distributions compared across categories). |
| `Slopegraph`       | Change or rank between two or more states, after Tufte: one thin line per entity between the columns, its name and number as the axis (labels typographically aligned to the line ends, ties stacked, names thinned when the height runs out while the lines stay). `y="rank"` with more columns is the bump chart. `tone="direction"` (rising success / falling danger), `highlight` for the entities that matter, `labels` / `showValues`, the shared `frame` / `fullscreen` / `scaffolding` (column rules on hover), `ChartSelectionProps` pinning an entity, `onPointActivate`. No value axis, no zoom: the numbers are the axis. |
| `HorizonChart`     | Dozens of time series in dense rows, each folded into layered bands (Saito's horizon graph): a row of height h shows `bands` times h of range, the darker the fill the larger the move, accent above the baseline and danger below, mirrored upward by default (`mode="offset"` hangs negatives from the ceiling). `baseline` (0 / mean / first), `sharedScale` (one range across rows, or per row), `labels` (a measured column, an overlay, or none), `showValues` (the last value per row), `height` (rows scroll inside it). The crosshair reads every row at the hovered x. Takes the shared scaffolding: zooms the time axis with the calendar ladder and decimation, annotations (y is a row index), selection, `onPointActivate`. For 50 tickers or 40 server metrics on one screen; for a few series on one value axis use `Scatterplot` with lines. |
| `PieChart`         | Parts of one whole as slices of a circle: an asset mix, a budget split, where a quarter's revenue came from. `innerRadius` makes it a donut, whose hole takes a `center` readout (given the hovered or pinned slice). Slices sort biggest-first from 12 o'clock and carry their share as a printed figure; `maxSlices` groups the tail into one named remainder, `fill` steps the neutral ink ramp or the house halftone, and the posture draws a percent tick ring around the arc so a share can be read off the circumference instead of guessed from an angle. Labels sit outside on measured, ellipsized, thinned lines, never rotated. Reach for it for **a few parts of a total the reader already understands as one whole**; past six or seven parts use `maxSlices`, or `Treemap` for a hierarchy. No 3D, no explode, no rainbow. |
| `Treemap`          | Hierarchical part-to-whole by area (Shneiderman's treemap, squarified): a `TreemapNode` tree (`name`, `value`, `children`, optional `change`), leaf values summing upward, groups with a header strip, cells as HTML with names and values printed where they fit (measured, ellipsized, never rotated). `colorBy="change"` is the market map (area = value, a diverging success / danger tint = change); `colorBy="group"` tints per top-level group on one hue with dither, never a rainbow. `layout` picks squarify / slice / dice / sliceDice, `depth` aggregates deeper levels, `root` draws a subtree (drill-down is consumer state: `onPointActivate` on a group, then `root = datum.id`, breadcrumb from `treemapPath`). `frame` / `fullscreen` from the shared scaffolding, `selectable` pins a cell. Reach for this over `PieChart` when the data is a hierarchy, when there are more parts than a circle can carry, or when the cells must print names and numbers. |
| `DotPlot`          | Ranked comparison of many categories with almost no ink (Cleveland's dot plot): categories down the side, one dot per series along a shared value axis. `range` joins two series into a dumbbell (`rangeTone="direction"` colours the move), `marker` adds a current-value tick per row (a last price inside a 52-week range), `lollipop` grows a stem from a meaningful baseline, `sort` ranks by a series. Every category keeps its row: labels ellipsize but never thin, and the chart grows past `height` rather than squeeze rows under one unit. `orientation="vertical"` puts the categories along the bottom. Reach for this where a horizontal bar chart would go and the baseline carries no meaning. |
| `SankeyChart`      | Weighted flows between nodes in layers: a budget from revenue to line items, fund flows from share classes through funds into strategies, a funnel. Nodes are columns sized by their flow, links are ribbons as thick as their value; the layout (longest-path layering, barycenter ordering) is hand-rolled, no dependency. `align` (`justify` by default), `sort`, `linkFill` (`neutral` / `source` / `target` / `dither`), measured labels that never collide, `showValues`. Hovering a node lights its incident ribbons. Frame / fullscreen / posture from the shared scaffolding (no continuous axis, so no zoom), click-to-freeze `selectable`, `onPointActivate` for drill-down. `Flows` and `BridgeChart` read change along time; this reads flow between categories. |
| `BulletChart`      | A bullet graph (Stephen Few): a KPI as a thin measure bar over a band of qualitative tiers with a target tick and optional comparative ticks, one row per item, stacking as a panel. The gauge replacement: linear, dense, monochrome except for the measure (`tone` per chart or per item; `rangeFill` dither densities or grey shades; `goodDirection="down"` for churn-style metrics). One shared `domain` gives the panel a single axis (zoomable, annotatable); without it each row has its own scale, shown on hover. `size` sets the row height, `showValues` prints Swiss-formatted values, `orientation="vertical"` lays rows out as columns. Same scaffolding, selection and drill-down props as the other 2D charts. Pairs with `Stat`. Still the answer to a gauge: a dial reads a single value worse than a bar does, and `PieChart` is for parts of a whole, not for one value against a target. |
| `Marimekko`        | A 100% stacked column chart whose column widths carry a second measure (market share by segment within regions sized by revenue; revenue mix by product and country): two part-to-whole readings in one panel. `categories` + `series` (`{ name, values, color? }`), `widthBy` (column totals or an explicit measure), `normalize={false}` for value-unit stacks whose value axis zooms, `orientation="horizontal"`, `fill="ramp"` (ink ramp, default) or `"dither"`, `showValues` (share / value / both, printed only where they fit), `columnLabels="name+share"`. Same scaffolding and selection mixins as the other 2D charts; drill-down via `onPointActivate`. This is the part-to-whole chart with a second measure; one whole split once is `PieChart`. |
| `Multiples`        | Tufte's small multiples: a grid of N panels of the same chart over different slices (one `render(item, shared)` per item, a `title` or `titleKey` per panel) with shared scales and linked zoom: the shared `xDomain` / `yDomain` flow into every panel through `shared`, a panel's zoom reports back through `shared.onXDomainChange` / `onValueDomainChange` and every panel follows; a reset returns them all. `columns="auto"` fits as many panels of `minPanelWidth` as the **container** allows (ResizeObserver, as Reflow), or a fixed `columns` / `rows`; `panelHeight` (6u by default, keep it above the chart's own minimum), `gap`, `dividers`. `axes="outer"` hides the panels' own axes and draws one x axis per column and one y axis per row over the measured plots (needs the domains given or reported); `link` picks x / y / both / none; `frame` / `fullscreen` wrap the whole grid. A layout, not a mark: it multiplies Scatterplot, BarChart, Histogram, any chart with a domain prop. |

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
annotations array) and optionally `fullscreen` and `frame`. On a plot narrower
than the tool palette (a phone) the toolbar folds itself into one tool key that
opens the tools as a named menu, with Reset and, while something is selected,
Delete beside it; there is nothing to configure. By default zoom-out
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

**Number and label formatting is uniform too** (issue #97): the same
`ChartFormatProps` mixin is accepted by every chart, with one function per job.
`valueFormat` retitles every number printed *as data* (tooltips, printed labels,
a mark's accessible name); `tickFormat(value, axis)` the axis ticks (it falls
back to `valueFormat`, so one prop usually does the whole chart, and it is told
which axis it is printing); `categoryFormat(label, index)` a label that names a
**position** (a band, a node, a cell, a slice, an item row, a column header);
and `seriesFormat(name, index)` a label that names a **dataset** drawn across
those positions, meaning whatever came in through the chart's `series` prop,
everywhere the chart prints it (the legend, a tooltip line, a mark's accessible
name). Category and series labels are formatted before they are measured, so
thinning and ellipsizing see what will be drawn. A chart takes `seriesFormat`
exactly when it has a `series` prop; a few take a subset elsewhere, where their
own surface is richer or a job does not exist on them (Heatmap and Treemap keep
their datum-aware `valueFormat`; Slopegraph has no ticks to format; Timeline and
Multiples take only `tickFormat`). See docs/API.md → Chart formatting.

Click-to-freeze selection is likewise uniform: the same `ChartSelectionProps`
mixin (`selectable`, `selection`/`defaultSelection`/`onSelectionChange`,
`renderSelection`) is accepted by all five 2D charts. `selectable` pins a
popover to the clicked mark (a point, bar, candle, or heatmap cell) that stays
open and tracks the mark through zoom/pan (the anchor is re-derived from the
mark's data coordinates each render); `renderSelection` supplies interactive
content, defaulting to the hover tooltip. Dismiss by clicking the mark again,
clicking away, Escape, or the popover's ✕. Single-selection.

### Graphs & networks

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Graph`   | Node-link networks (dependency graphs, mind maps, concept trees) up to ~10k nodes interactively. Force / tree / org / radial / concentric / grid layouts (switchable at runtime, each tunable via `layoutOptions`: force iterations/gravity/scalingRatio, radial/concentric scale, tree root/direction/levelGap, grid columns, org root/direction/gaps/stacking), pan/zoom/fit + keyboard nav, minimap, right-click menu, and node labels highlighted on hover, plus a built-in fullscreen toggle (`fullscreen` prop, default on). Hovering a node lights up its incident edges (both directions) + neighbours and fades the rest (`highlightConnectionsOnHover`, default on; `onNodeHover` reports the hovered id). Pass `editable` for relationship editing: a Connect toggle appears in `Graph.Controls` (drag node→node to add an edge), and edges can be removed via right-click "Delete" or select-then-Delete/Backspace, so wire `onEdgeCreate` / `onEdgeDelete` and mirror the change in `data` (updates reconcile in place, so camera + layout stay put). Per-edge line styles (`renderEdge` → `style: "dashed"/"dotted"`, kept on arrows and org elbows) and per-state edge overrides (`edgeStateVisuals`: selected / hover-incident / faded). Edge label/metadata editing is consumer-owned: use the `edge` `contextMenuItems` target (or `onEdgeClick`) to open your own editor, then update `data`. Layout: `fill` makes it take the parent's height (give the parent one) and it re-fits the canvas on container resize, not just window resize; `frame={false}` drops its own border when embedding inside a framed container. **Org charts**: `layout="org"` + `nodeStyle="card"` renders a tidy hierarchy of rectangular cards (node `label` + `sublabel` title inside, kind-coloured accent stripe) wired with orthogonal elbow connectors, spaced by real card sizes; horizontal space is managed by stacking (`layoutOptions.org.stack`: `"leaves"` lists leaf children vertically under their parent like an IC list, `{ depth }` stacks whole subtrees, `"auto"` picks the least stacking that fits the container's aspect). Compound: `Graph`, `Graph.Controls`, `Graph.Minimap`. Distinct from the charts above: those plot values on axes; this draws relationships. |

### Maps & geography

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Map`     | Geographic maps (MapLibre GL JS). Plot **points** (`points`), **areas**/polygons (`areas`), and **vectors**/routes (`vectors`, with `arrow`/`dashed`), all in GeoJSON `[lng, lat]` order, or pass raw `geojson`. Customize appearance via `basemap`: `"minimal"` (default: restrained vector style colored from `--sf-*` tokens, re-tints with dark mode), `"street"`, `"terrain"`, or override entirely with `styleUrl` (self-hosted/keyed tiles). `onFeatureClick` / `renderTooltip` for interaction; `fill` / `frame={false}` / `fullscreen` like `Graph`. Compound: `Map`, `Map.Controls` (zoom/fit/reset/basemap), `Map.Minimap` (overview inset, a 2nd WebGL context). **Two CSS imports are required** at app root: `tokens.css` **and** `maplibre-gl/dist/maplibre-gl.css`. Free no-key tile providers are best-effort (no SLA); tile attribution must stay visible. Not for non-geographic x/y data (that's the charts). |

### Communication

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Chat`          | A conversation window structured as a terminal agent's (after the pi coding agent) and set like a terminal: one monospace column on the unit grid, full-width entries one line apart, no bubbles and no right-aligned voice. The user's turn is a band in a tint of the accent; a reply sits on the page as terminal markdown (`Markdown variant="terminal"`); a tool call (`type: "tool"`: `name`, `args`, `status`, `output`, `note`, `error`) is a neutral band whose output is cut to its last lines and opens on its marker or on Ctrl+O, a failure marked by the danger rule. Under the transcript a dock stays put: `aboveEditor` / `belowEditor` slots, the editor between two rules with the `working` indicator set into the top one (`onInterrupt` on Escape), and `footer` status lines (left gives way, right stays). `header` is a start banner that scrolls away. `fonts={{ text, user, code }}` (or `--sf-chat-font`, `--sf-chat-font-user`, `--sf-chat-font-code` app-wide) chooses the faces: replies and chrome, the user's text and editor, code and tool calls; monospace throughout by default. `variant="log"` is the dense view for a panel: no blank lines and no bands, the user's line marked by a `>` and set in the accent, the reply indented under it, a tool call one line with its status at the end and its output folded to one line (`└ … +N lines`), code shown highlighted without its fences; the chat drops its frame (`frame`). **A host adds its own elements as parts**: a `type: "table"` part (or `ChatTable`) draws a real table as a terminal draws one (Swiss numbers, end-aligned, scrolling inside itself when wide), `renderPart` renders any other part (a `Widget`, a chart, a `DataTable`) in the transcript's column, and `ChatBlock` gives one a shell (`band`, the default, with a `[title]`; `framed`; `plain`). Other built-in parts: a choices list (`→` on the focused row, `[x]` toggles), a directory-tree decision / orchestration tree with per-node `status` marks (the spinner while running, else an icon-set glyph through the `check` / `fail` / `pending` slots; only a failure is toned), a **`thinking`** line that expands into a live fan-out, and an **`error`** line (`Error: …` with a `requestId` and a `[Retry]` key; `onError` fires when it appears). Interactions report through `onAction`. Enter submits, Shift+Enter breaks the line, Up and Down in an empty field walk the earlier messages; the send key shows only on touch (`sendKey`). On a phone it behaves as a messaging app: Return breaks the line and the send key sends (`enterSends`), it raises no keyboard on its own, `[stop]` stands in for Escape, the status lines step aside while the keyboard is up, and a `ChatDrawer` fits its panel to the part the keyboard leaves. `completions` lists entries under the editor while a trigger is typed (`/` at the start for commands, `@` and `#` at a word start; sync or async; `partial` for a directory step, `onSelect` for a command that acts), and `prompt` puts a question in the editor's place (`select`, `confirm`, `input`, `custom`); `useChatPrompt()` asks from code and awaits the answer (`await ui.confirm("Delete?")`). The view holds the bottom as the reply streams and as the editor grows under it, lets go the moment you scroll away from it, and offers a reverse-video `↓ latest` label that takes the accent once something arrived below the fold; the transcript is a focusable `role="log"`. Opt-in `minimap` swaps the transcript's scrollbar for a `Minimap` rail: the questions you asked become clickable labels down the side in the accent, the replies neutral dithered blocks (`{ side, width }` tunes it, or `--sf-chat-minimap-width` app-wide; `ChatDrawer` forwards it). Streaming assistant text reveals through `StreamingTerminalText`; tune it with `reveal` (for a **live token stream** pass `reveal={{ mode: "stream" }}`; `reveal={false}` renders plain Markdown as tokens arrive). |
| `ChatDrawer`    | A `Chat` in a resizable side panel that **pushes** the app content aside (built on `SplitPane`). Pass the app as `children`. While `thinking`, an animated effect blooms and fills the padding gutter; `onThinkingStart`/`onThinkingEnd` fire on the transitions, and the chat's working indicator follows `thinking` (`working` overrides it; `header`, `footer`, `aboveEditor`, `belowEditor`, `onInterrupt`, `completions` and `prompt` pass through). `variant="log"` fills the panel with the chat's log view: no gutter, no frame, the header ruled off. `minimap` gives the transcript a rail instead of its scrollbar (a panel is where a long conversation is read). The header is an icon bar: add your own buttons with `actions`, or pass `views` (`{ id, icon, label, content }[]`) to host multiple icon-switched panels, so chat becomes just one view. Opt-in `centered` floats the chat (or the active view) as a centered column whose width you drag from either edge, mirrored so it stays on the panel's centre axis (`defaultChatWidth`/`minChatWidth`/`maxChatWidth`/`onChatWidthChange`); for wide panels and fullscreen. `chatAlign` parks that column flush left or right instead, its one free edge resizing alone and the whole leftover width going to the single remaining margin. Centered mode's side margins are app-ownable slots (`margins={{ left, right }}`): park widgets dragged out of the chat, notes, reminders; their content auto-hides (mounted, state kept) when the margins drop under `marginMinWidth`; `marginGap` sets the gutter between margin content and the column (1u by default). |
| `SplitPane`     | Resizable split layout: `SplitPane.Main` + a collapsible `SplitPane.Panel` that pushes content aside with a draggable divider (not an overlay). For overlay sheets use `Drawer` instead. `size` / `defaultSize` take px or a percentage of the container (`"30%"`, kept across container resizes); a px panel is clamped to a shrunken container; `onSizeChange(px, fraction)`. In a container narrower than `overlayAt` (20 units by default: a phone) the panel lies over the main pane instead of squeezing it, and a tap on the strip beside it or Escape closes it; `overlayAt={false}` keeps pushing. `ChatDrawer` inherits this. |
| `ContextEditor` | Assemble an LLM's context window: a budget gauge beside a reorderable list of labelled context blocks (system prompt, docs, tool output, memory, message history). Drag the grip to reorder (keyboard-operable, lazy dnd-kit); set `enabled: false` to drop a block from the packed window and `pinned` to hold it. The gauge stacks blocks by token share (`scale="log"` for a small used fraction against a huge window), marks an **effective-context** cutoff (the "lost in the middle" degrade) and a cap danger zone, and flags each block strong / buried / wasted (attention = position × salience). Controlled `value`/`onChange` (block array); you supply token counts and make the model call. Not a `Chat` (the message stream) and not a `CodeEditor` (source text). |
| `Widget`        | The shell of a **chat widget**: a framed card whose title bar carries the widget's input parameters. One or two params edit inline in the bar (`params`: a `date` at `precision="month"` after "Net flows", a `select`, a `number`, `text`, `boolean`); three or more fold behind a settings key that opens a dialog with a table of them, applied at once (`onParamsChange(values, changed)`; `inlineParams` moves the threshold). `actions` (a remove key), `loading` (a thin bar under the header), `error` (replaces the body), `size="sm"` for a shelf. Standard widgets fill the body: `KpiWidget` (a Stat), `ChartWidget` (a BarChart), `TableWidget` (a DataTable), `ProgressWidget`. Render them from `Chat`'s `renderPart` and keep them alive on a `ChatDrawer` margin shelf after a drag (the Megachat story). |

### Development

| Component     | Use for                                                  |
| ------------- | -------------------------------------------------------- |
| `GridOverlay` | The unit grid drawn over a region with its cells named, for talking about layout: a cell is one unit square, `row:col` counted from 1 at the top left, row first (`3:2`); a range joins two cells, `3:2-5:10`. Draws cell edges (stronger every `major`), `row:col` labels, the body baseline in every unit line (measured), and the pointer's cell. The panel's **Pick** names a cell or a dragged range, copies it and calls `onPick`; `marks` outlines places by name. Takes no pointer events outside pick mode. `cell` (1, 2, 4 units), `fixed` for the viewport.<!-- guide:skip --> In the story server: `?grid`, `&mark=…`, Alt+Shift+G.<!-- /guide:skip --> A development tool: render it behind a dev flag. |

### Media

| Component     | Use for                                                  |
| ------------- | -------------------------------------------------------- |
| `AudioPlayer` | A self-contained audio player: play/pause/stop, a quantized wave visualization, a mono elapsed/total readout, and a cycling rate button. Pass `src`; it owns a hidden `<audio>` element and reports via callbacks / `apiRef` (`play`/`pause`/`stop`/`seek`). `visualization="waveform"` (default) decodes the track once and draws mirrored quantized columns that double as the seek slider (pointer scrub + `←`/`→`/`Home`/`End`/`Space`); `"bars"` draws live log-spaced analyser stacks while playing (for streams / very long files; waveform falls back to it automatically when the file can't be decoded). `layout="inline"` (default) is one dense row; `"panel"` is the deck reading: the wave display stacked over a control bar of raised buttons in one bordered chassis. `color`/`size`/`elevation`/`rates`/`loop`/`crossOrigin`; visualizing cross-origin media needs CORS. Reach for this over a bare `<audio controls>`. |

---

## Conventions

These are not suggestions.

### Use tokens, not literals

- **Color**: `var(--sf-color-fg)`, `var(--sf-color-bg)`,
  `var(--sf-color-primary)`. Never hex.
- **Lines**: three tones, picked by what the line does.
  `--sf-color-border-strong` outlines a region (a table, a panel, a window,
  a popup) and draws the rules of its chrome (a title bar's underline, a
  pane splitter). `--sf-color-border` is the edge of a control (a field, a
  secondary button, a checkbox, a chip) and of a small box nested in a
  region. `--sf-color-border-subtle` separates repeated things (cells, rows,
  days, menu separators, axis lines). A divider in the frame tone cages the
  content; a frame in the divider tone dissolves the region.
- **Status colour without a tint**: a status chip, an event, an error
  banner is the page colour with its rim, a 3px leading rule and its label
  in the status colour at full strength (4.5:1 as text, except dark primary and danger at 4.3 and 4.4). The
  one fill allowed is the full-strength one (`Chip variant="solid"`): the
  status colour as the fill with the label in the page colour (the tone's
  `-fg` token on primary and danger). Keep `color-mix` tints for state: hover, selection,
  a drop target.
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
- **Vertical rhythm**: every block is a whole number of units tall, and the
  gaps are the library's: 2u between sections or messages, 1u between the
  parts, rows or paragraphs inside one. Text lines are 1u (`--sf-leading-base`:
  20px at the default compact density, 24px at the comfortable one), a title
  bar or control 1.5u, and a frame's 1px borders come
  out of its padding or bar (`calc(var(--sf-unit) * 1.5 - 1px)`), never on
  top of it. A half-unit gap is fine inside a block if the block's sum is
  whole (Stat, Widget). Never a line-height, margin or padding that isn't a
  fraction of the unit; check with `GridOverlay`<!-- guide:skip --> (or `?grid` on a story)<!-- /guide:skip --> when in doubt. Never
  write a size in px or rem that should follow the density: a control's box,
  a row, a column floor are unit multiples (`round(calc(...), 1px)` when a
  small disc or cap must land on a whole pixel). In JS, read the unit with
  `useCssPx(ref, "var(--sf-unit)", DEFAULT_UNIT_PX)` from `lib/useCssPx`
  instead of assuming 24 or 20.
- **Links**: a text link is styled from the `--sf-link-*` tokens, the text
  (`-color`, `-font-weight`, `-font-style`) and the decoration
  (`-decoration-line`, `-decoration-style`, `-decoration-color`,
  `-decoration-thickness`, `-underline-offset`, plus `-hover-*`) apart, with
  a set per kind (`--sf-link-wiki-*`, `--sf-link-tag-*`,
  `--sf-link-external-*`) falling back to the base. Set them on any ancestor
  to restyle links; never out-specify `.rendered a`. See docs/API.md →
  Markdown → Text links.
- **Motion**: `var(--sf-duration-fast)` / `-base` / `-slow` with
  `--sf-ease-out` or `--sf-ease-in-out`.
- **Elevation**: `var(--sf-elevation-N)` for surface depth, including
  inside SVG (use `filter: drop-shadow(...)` with equivalent values).
- **Material (depth on controls)**: every tactile recipe reads one light,
  `--sf-light-x` / `-y` (from the top left by default; a document-level
  setting, set it on `:root` or the theme element, never on a subtree), and
  so do the `--sf-elevation-N` / `--sf-recess-N` casts. A
  key wears `var(--sf-edge)` (1px lit and shade bands) plus a cast:
  `box-shadow: var(--sf-edge), var(--sf-elevation-2)`. A small cap
  (checkbox, radio, thumb) takes the theme-aware `--sf-cap-rest` /
  `--sf-cap-pressed` (`-round` for discs). A text field, a slider track or
  a switch rail is a slot: `var(--sf-groove)`, flush, with a cast only when
  the consumer passes `elevation`. Pressed is travel (one step lower and
  1px down), never an inverted dent. A curved face comes from
  `lib/surface`: set `--sf-cap` to the element's colour and add
  `surfaceClass.dish` or `.dome` for a key, `.concave` for a slot's floor
  (and the composed `bowl` class for a face too big for one ramp: the dish
  hollowed on both axes)
  (`--sf-curve` sets the amplitude, `--sf-curve-scale` or the components'
  `curve` prop multiplies it); Button, Kbd, Switch, Slider,
  LaunchButton, ToggleGroup and Knob expose it as `surface`, and so do DigitInput
  (concave by default), Input and DigitInputMicro. A ramp belongs on a cap
  of one or two units (a keycap, a thumb, a knob, a digit cell): on a wide
  face it reads as a gradient, so Button, ToggleGroup, WindowArray title
  bars and table headers are flat by default. In the light theme a cast is
  hard at every level: `--sf-elevation-1` to `-5` are a zero-blur offset of
  1, 2, 3, 4 and 6px in the frame's ink, and no level blurs. Never write
  `inset 0 1px 0 rgb(255 255 255 / 0.18)` or a per-component dark-mode
  highlight override again: the tokens carry their dark values.
- **Focus rings**: every component's `:focus-visible` ring reads
  `--sf-focus-ring-width` (default `2px`) and `--sf-focus-ring-offset`
  (per-rule default). Set them on any ancestor to restyle a subtree's
  rings, or `--sf-focus-ring-width: 0` to disable them where a container
  already communicates focus (an active window frame, a focused pane).
  Never suppress a ring by out-specificity-ing component CSS.
- **Stacking**: overlays stack in the browser's top layer, in the order
  they open (issue #83). Every overlay's portal (Dialog, Drawer, Popover,
  Menu/ContextMenu, MenuBar dropdowns, Picker/Selector/Combobox lists, the
  DatePicker calendar) and the Outliner's keyboard bar enter it as they
  mount, so the one opened last is on top: a menu in a dialog, a dialog
  opened from a popover, a second dialog over the first. You do **not**
  need app-side z-index overrides for library overlays; if you carried any,
  drop them. A page element at any z-index sits under an open overlay: an
  app's own toast that must show above a dialog enters the top layer after
  it (`popover="manual"`, then `showPopover()`). The `--sf-z-*` scale
  (`-dropdown` 1000 … `-tooltip` 1400) orders what is not in the top layer
  (the full-screen forms, and every overlay where the browser has no Popover
  API). A new component that renders a Base UI `Portal` passes
  `useTopLayerPortalRef(ref)` and `topLayerPortalClass` from `lib/topLayer`
  to it, as the Dialog and Menu wrappers do.

### Touch

The library runs on a phone with the same components. These rules keep it so<!-- guide:skip -->;
`npm run mobile` and the guard test `src/tokens/touch.test.ts` check them<!-- /guide:skip -->.

- **Hover is for a mouse.** Every `:hover` rule sits inside
  `@media (hover: hover) and (pointer: fine) { … }`: a tap leaves `:hover`
  applied until the next tap elsewhere, which on a touch screen is a stuck
  highlight. Give a press its feedback with `:active`. In JS, act on hover
  only for `event.pointerType === "mouse"`. Nothing may be reachable by hover
  alone: what a hover reveals (a row's fold arrow) also shows on the active
  item, or always under `@media not ((hover: hover) and (pointer: fine))`.
  The exception is a shortcut for something a finger does directly:
  `WindowArray`'s edge paddles stay hidden on touch, where a swipe scrolls
  the strip and a tap activates a window.
- **Hit areas grow, controls do not.** A control under 44px on a side takes a
  class from `lib/hitArea` (`hitArea.both`, `.block` in a row of siblings,
  `.inline` in a column, `.tight` with neighbours on both axes, `.handle` for
  a splitter, `.thumb` for a slider thumb): an invisible pseudo-element grows
  the area it answers a finger on, up to `--sf-hit-min` (44px on touch, 0 for a
  mouse) or `--sf-hit-tight` (24px, the WCAG 2.5.8 minimum). Never enlarge a
  control for touch by hand, and never let an area grow into a sibling: pick
  the variant by the control's neighbours.
- **Text entry is never under 16px on touch.** A text field's font size is
  `max(<its size>, var(--sf-text-entry-min))`. An input that inherits its font
  takes `max(1em, var(--sf-text-entry-min))`.
- **A surface that fills the screen fits the keyboard.** A phone lays its
  on-screen keyboard over the page and pans the page to show a focused field,
  so a full-screen surface pads itself by what is out of sight while a keyboard
  is open: `useVisibleInsets(ref)` from `lib/keyboard` (as `ChatDrawer` does).
  Never raise the keyboard uninvited: with a finger, focus a text field only on
  the user's tap, not on mount or when a run ends.
- **Viewport units.** `dvh` for anything sized to the viewport, never `vh`
  (taller than what a phone shows between its toolbars). A surface that
  reaches a screen edge pads itself by `--sf-safe-top` / `-right` / `-bottom` /
  `-left`. A canvas that fills the screen (`Graph`, `Map`) stays edge to edge
  and moves what sits in its corners in: the full-screen root publishes the
  insets as `--sf-fs-top` / `-right` / `-bottom` / `-left`, and an overlay adds
  them to its own offset (the fullscreen key already does).
- **`touch-action: none` only on a dedicated handle** (a grip, a splitter, a
  thumb, a chart's plot): an element that sets it can no longer scroll the
  page under a finger. A row or a heading that is also draggable keeps
  scrolling; the drag sensors below tell a drag from a swipe.
- **Drags** use `useSfSensors()` (`lib/dnd`), never a bare `PointerSensor`: a
  mouse drags after 4px of travel; a finger drags after resting 250ms (moving
  sooner scrolls), or as a mouse does on a handle (an element with
  `touch-action: none`). A draggable that wires `listeners.onPointerDown` by
  hand must wire `listeners.onTouchStart` too.
- **A right-click menu needs a long press.** iOS Safari fires no `contextmenu`
  event. Base UI's `ContextMenu` handles the long press itself; a component
  that opens its own menu from `onContextMenu` adds `useLongPress`
  (`lib/useLongPress`) and opens the same menu.
- **A double click needs a touch form.** A finger has no reliable double tap
  and no key to press before a field is focused. DataTable opens a cell's
  editor on a second tap of the active cell; give any new double-click
  gesture a tap, a key in the chrome, or a menu item.
- **A click reads its own position.** A tap sends no pointer move before its
  click, and the pointer leaves the element when the finger lifts, so a
  reading kept from the last hover is missing or stale by then. A handler that
  acts on where the press fell (a chart row, a plot position) takes it from
  the click event's own coordinates, as `HorizonChart` does.
- **A hover reading needs a rest.** A finger cannot hover, a drag scrolls the
  page or pans the chart, and a tap reads one mark. A chart's crosshair and
  tooltip follow a finger that rests 300ms on the plot (`useScrub` in
  `lib/chart`, wired by `useChartScaffold`): it replays `pointerover` on the
  nearest `data-idx` mark, or `pointermove` over a plot that reads the
  position. A new chart with a hover reading takes it from the scaffold or
  calls `useScrub(plotRef)`.
- **An overlay fits its frame.** A toolbar laid over a plot or a canvas must
  not be wider than it: fold it (the chart toolbar becomes one tool key and a
  menu under the palette's width) or let it scroll inside itself
  (`Graph.Controls`). A control that runs past the screen edge with nothing to
  scroll it back fails the phone audit.
- **Width follows the container.** A layout that needs room collapses on the
  measured container width (`useCollapse`, or the component's own
  ResizeObserver), as `Reflow` and `MenuBar` do: `SplitPane` overlays its
  panel under `overlayAt`, `Prose` stacks its outline, `Calendar` shows fewer
  days, `Grid minColumnWidth` reflows its columns. Only a fixed overlay
  follows the viewport (`Dialog fullscreen="narrow"`, via `useMediaQuery`).
- **Table columns hold their width on touch.** A column squeezed to its
  minimum on a phone shows an ellipsis in every cell, and the table scrolls
  anyway. `DataTable` and `Explorer` keep each column at its width on a coarse
  pointer and scroll sideways (`columnShrink="auto"`, the
  `--sf-table-column-hold` token: 0 for a mouse, 1 for a finger), with a
  dithered fade on the trailing edge while there is more to scroll. The choice
  is in the track's minimum, `max(floor, calc(preferred * var(--sf-column-hold)))`
  (`lib/columns/columnHold`): a new column template takes its minimum from
  `holdMin`, so it needs no pointer test in JS. Frozen columns that take more
  than half of a `DataTable`'s width release and scroll with the rest.
- **A figure is never truncated.** A number cut by an ellipsis reads as a
  different number: fit it (`useFitText`, as `Stat` does) or let the region
  scroll.

### Talking about layout: grid names

When a person describes a layout in grid names (`3:2`, `5:1-12:16`), they mean
`GridOverlay`'s cells: one unit square each, rows and columns counted from 1 at
the top left of the region the overlay covers<!-- guide:skip --> (a story's top left in the story
server)<!-- /guide:skip -->, row first; a range runs from its top-left cell to its bottom-right
cell, both included. So `3:2-5:10` is three units tall and nine wide, starting
two units down and one unit in. Answer in the same names, and show what you
mean: <!-- guide:skip -->render the story with `?grid&mark=<names>&mode=preview` and share that
screenshot.<!-- /guide:skip --><!-- guide:host render the overlay with `marks={["<names>"]}` and share a screenshot. --> A size in cells is a size in units, so it maps straight onto
`calc(var(--sf-unit) * n)`.

### Body text is never grey

This is the project's most-cited anti-pattern. Default to
`--sf-color-fg`. Reach for `--sf-color-fg-subtle` (#3d3d3d) or
`--sf-color-muted` (#5e5e5e) only for legitimately secondary metadata
(timestamps, axis labels, row/week numbers, byte counts, captions).
Never for prose the user is meant to read, and never for **labels**:
control captions, column titles, tags, group/section headers, and
descriptions are reading text and stay full-strength. Don't gray a
label to signal state (weekend, pending, inactive); use an indicator
or a background tint. Placeholders (`::placeholder`) and non-text
glyphs may be subtle.

**And never all-caps**: no `text-transform: uppercase` anywhere.
Differentiate a heading or label by size and weight, not caps.
Acronym/ticker strings (MCP, FX) are fine as data.

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

### One drag-and-drop context: `SfDndProvider`

Every widget with drag (`DataTable` column reorder, `Explorer`,
`WindowArray`, `TableInput`, `ContextEditor`, `AgentComposer`, `Outliner`
and its `{{kanban}}` boards) renders its own dnd-kit `DndContext` by default. If the host app runs its own dnd-kit,
don't nest contexts (dnd-kit forbids it) and don't add a second DnD
library. Instead wrap the subtree in `SfDndProvider` (from
`@tarassov-ch/swiss-function/lib/dnd`): the widgets auto-detect the
provider and join its single context, existing call sites are unchanged.
The host can then drag its own `useDraggable` elements onto a widget's
rows/nodes and read the drop from that widget's `onExternalDrop`. A row
can also be dragged *out* of one widget onto another: a drop over a
different registered region fires the target's `onExternalDrop` (the
source's internal reorder is skipped), so widget-to-widget drag needs no
wiring beyond the target's `onExternalDrop`. See
[docs/API.md](./docs/API.md) → SfDndProvider.

Keyboard reorder is deliberately not uniform: it works through a focusable
grip (`TableInput`, `ContextEditor`) or a component-owned chord
(`WindowArray` Shift+Arrows, `AgentComposer` Alt+Arrows, `Outliner`
Alt+Shift+Arrows). Header cells (`DataTable`/`Explorer` column
reorder) are pointer-drag only: Enter/Space on a header belongs to
sorting, so headers spread dnd-kit's `listeners` but never its
`attributes` (announcing an inoperable keyboard pickup is worse than none).

Every widget takes its sensors from `useSfSensors()` (exported from
`lib/dnd`, and the provider's default): a mouse drags after 4px, a finger
after resting 250ms or at once on a handle (see Conventions → Touch). A host
that passes its own `sensors` to the provider should build on it, or its
touch drags will fight page scrolling.

Bundle note: `TableInput`, `ContextEditor`, `AgentComposer` and `Outliner`
load dnd-kit lazily (only when their drag feature is on); `DataTable`,
`Explorer` and `WindowArray` still import it statically, so their entries
carry dnd-kit in the consumer bundle even with drag off. Unifying on the
lazy pattern is issue #93.

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
| "multi-select" / "pick several from a list" / "tag input" / "add items to a bucket" | `Selector` (items take `group` for section headers) |
| "single-select" / "pick one from a searchable list" / "searchable dropdown" / "options grouped in sections" | `Picker` (items take `group` for section headers) |
| "radio options with descriptions" / "a plan picker" / "pick one, each with a title and detail" / "settings-style option table" | `RadioTable` (+ `.Option`); bare `Radio`/`RadioGroup` when there are no descriptions |
| "file upload" / "drop files here" / "drag-and-drop files" / "attach files" | `Dropzone` |
| "an app menu bar" / "File/Edit/View menus" / "toolbar of controls" | `MenuBar` (no dedicated Cmd-K palette exists; use `Dialog` + `Picker`/`Selector` for a quick switcher) |
| "show a keyboard shortcut" / "render a hotkey / keycap" | `Kbd` (OS-aware; `mod` → ⌘/Ctrl)             |
| "an icon" / "a glyph" / "a chevron/close/search/trash icon" | `Icon` set (`<Check />`, `<ChevronDown />`, … tree-shakeable; `createIcon` for custom). Never an emoji or a raw inline `<svg>`. |
| "a hotkey to jump to a field" / "handle shortcuts centrally" | `Field hotkey="…"` (shows the keys as outline `Kbd` boxes in the label row + tags `data-hotkey`) + `focusFieldHotkey(combo)` to jump. The library owns **no** keyboard listener; you run the central hotkey engine in your app and call the helper (or `WindowArray`'s `apiRef`). |
| "a tag" / "a badge" / "a status pill" / "a filter chip" / "a removable token" | `Chip` (`tone` for status, `round` for the pill/badge reading, `onRemove` to dismiss, `onClick` for a filter) |
| "fill the rest of the page" / "header + scrollable body" | `Pane` with `Pane.Header` + `Pane.Body`     |
| "show the baseline grid" / "a layout grid overlay" / "debug the layout" / "name the cells so I can point at them" | `GridOverlay` (behind a dev flag<!-- guide:skip -->; `?grid` on any story<!-- /guide:skip -->) |
| "make it work on a phone" / "responsive" / "mobile layout" / "touch-friendly" | Nothing to switch on: the touch tokens and the comfortable density apply on a coarse pointer. Lay out with the parts that follow their container: `Grid minColumnWidth`, `Reflow`, `FieldLayout`, `Stat.Group`, `SplitPane` (overlays under `overlayAt`), `Tabs.List overflow`, `MenuBar collapse`, `Dialog fullscreen="narrow"`, a bottom `Drawer` for a sheet.<!-- guide:skip --> Check with `npm run mobile`.<!-- /guide:skip --> |
| "cards that reflow" / "a responsive grid of tiles" / "columns that wrap on a phone" | `Grid minColumnWidth={8}` (as many equal columns as fit, down to one) |
| "the keyboard covers the chat on a phone" / "the input is hidden behind the keyboard" / "the header scrolls away when I type on mobile" | `ChatDrawer` fits itself; a full-screen page of your own pads itself by `useVisibleInsets(ref)` from `lib/keyboard` |
| "bigger tap targets" / "the buttons are too small on a phone" | Already 44px hit areas on touch (`lib/hitArea`); for a custom control add `hitArea.both` / `.block` / `.inline` / `.tight`. Do not enlarge the control |
| "a side panel that becomes a drawer on mobile" | `SplitPane` (`overlayAt`, on by default) or `ChatDrawer` |
| "a full-screen dialog on mobile" / "a bottom sheet" | `Dialog.Popup fullscreen="narrow"` / `Drawer side="bottom"` |
| "the table is cut off on a phone" / "cells show ... on mobile" / "let the table scroll sideways" | Nothing on touch: `DataTable` and `Explorer` hold their column widths and scroll (`columnShrink="auto"`). `columnShrink="hold"` for a mouse too, `"squeeze"` to keep every column in view; `columnFit="content"` to size the columns to their content first |
| "keep the dense layout on a tablet" / "don't enlarge on touch" | `data-density="compact"` on the root (the hit areas and the 16px text-entry floor stay) |
| "stretch a field to the bottom edge" / "fill region that locks to the edge on resize" / "a growing region in a resizable dialog/panel" | `Stack` + `Stack.Fill` (with `<TextEdit fill />` for a stretching text field) |
| "a long scrollable form" / "a form with a navigation minimap" / "one field per row, top to bottom" | `VerticalForm` (+ `.Section` / `.Field`); `FieldLayout` for packed justified rows, `Form` for state/validation |
| "a window manager / tiling windows / multi-window workspace / scrollable strip of panels" | `WindowArray` (`Dialog draggable` for a single floating window) |
| "pop out a window" / "open in a separate browser window" / "move a panel to another monitor" | `WindowArray popOutable` (per-window pop-out + placeholder), or bare `PopOut` around any content |
| "a number input" / "a numeric field" / "a quantity / percent field with digit placeholders" (variable length) | `DigitInputMicro` (`slots`/`decimals`/`unit`/`min`/`max`; value `number \| null`) |
| "a PIN / 2FA code input" / "a fixed-digit amount" / "a percent / price the user types into" / "instrument-panel number entry" | `DigitInput` (`digits`/`decimals`/`unit`; calculator-style push typing) |
| "a slider" / "a range slider" / "a fader / volume / opacity / threshold control" / "pick a number on a track" | `Slider` (`tone`/`fill="dither"`/`marks`/`orientation="vertical"`; range = a two-entry array value). For a *typed* numeric field use `DigitInputMicro`/`DigitInput` instead |
| "a knob" / "a dial" / "a rotary control" / "a volume / gain / pan / balance knob" / "a hi-fi / synth / mixer control" | `Knob` (`marks`, `fillOrigin="center"` for bipolar, `sweep`, `drag="vertical"`; `Slider` when the value runs along a track) |
| "a confirm-before-fire button" / "guarded switch" / "arm then fire" / "a protective cover over an action" / "two-step destructive action inline" | `LaunchButton` (`mode="switch"` for an armed on/off state; `Dialog` when the confirmation needs explanation text) |
| "a login form" / "sign-in" / "auth screen" / "username + password" | `Login` (terminal-styled sign-in panel; `alternatives` slot for passkey/SSO, `footer` for links). A standalone password field with a reveal toggle is `PasswordInput` (or bare `Input type="password"`); a 2FA/OTP code is `DigitInput mode="mask"` |
| "a date picker" / "pick a date" / "a calendar input" / "due date field" | `DatePicker` (ISO by default; type `2026-07`, `12 jul`, `tomorrow`, not `type="date"`) |
| "pick a week / month / year" / "a week picker" / "a reporting-period / billing-month field" | `DatePicker precision="week" / "month" / "year"` (whole ISO periods; value = period start) |
| "a hierarchical date dropdown" / "pick the year, then the month, then the day" / "a date wizard" / "drill down to a date" / "pick a quarter then a month" | `DatePicker path={["year", "month", "day"]}` (steps: `year`/`quarter`/`month`/`week`/`day`; the last step is the precision, `isDateDisabled(date, level)` greys out a whole step) |
| "a calendar" / "show events / schedules / appointments" / "weekly / monthly / annual view" / "an agenda / event calendar" | `Calendar` (Month / Week / Year scheduling views; events with optional times, `allDay`, multi-day spanning bars, `tone`/`color`; `onEventClick`/`onDateClick`). Not `DatePicker` (that picks a date into a field). |
| "a colour picker" / "choose a colour" / "an OKLCH / RGB / HSL picker" / "colour channels / sliders" / "an eyedropper" / "a colour swatch" | `ColorPicker` (channel sliders across OKLCH/OKLab/RGB/HSL/HSV/LCH/Lab + hex, alpha, gamut handling; value is a CSS string). `ColorSwatch` for a preview / preset / `Popover` trigger. Colour maths at `lib/color`. Never `<input type="color">`. |
| "a table"                                          | `DataTable` (almost always; it handles a lot)   |
| "fit the columns to the content" / "auto-size columns" / "make the columns as narrow as the text allows" / "shrink columns to fit" | `DataTable columnFit="content"` (at mount and on data change), `headerMenu` for a right-click Fit this column / Fit all columns, double-click a header edge for one, or `apiRef.autoFitColumns()` on demand |
| "colour a cell by its value" / "conditional formatting" / "red/amber/green cells" / "a heatmap in a table" | `DataTable cellBackground` (data-driven, follows the row through a sort). `highlights` instead when the colour marks a fixed *region* of the grid |
| "a totals row" / "sum a column" / "a footer with sums" / "subtotals under the table" / "count the rows" | A column `total` on `DataTable` (`"sum"`/`"avg"`/`"min"`/`"max"`/`"count"`/`"countUnique"`, or a function); `totals` tunes its label / position. Covers every filtered row, not the page |
| "right-align the numbers" / "align a column by its type" | Nothing: a `number` edit column already ends and a `boolean` centres. Declare `align` on the column to override |
| "wrap text in cells" / "multi-line cells" / "show #### when a number doesn't fit" / "Excel-style overflow" / "a column that can't be narrowed under its title" | `DataTable cellOverflow` / a column `overflow` (`wrap` needs a `rowHeight` of 2.5 units or more: 50px at the default density; `hash` on numeric and date columns). The title floor is automatic; `headerLines` for a two-line title |
| "colour a column heading" / "tint the header" / "group my columns by colour" | A column `color` on a leaf or a group (tints the heading key, keeps its material) |
| "a column that can't be squeezed below N" / "a minimum column width" | `LeafColumnDef.minWidth` (in `--sf-unit` multiples; honoured by the drag, the keyboard and auto-fit) |
| "edit an array of objects" / "a form field that's a small editable table" / "add/remove rows of inputs" / "a repeatable row input" / "input a list of records" | `TableInput` (compact editable table as a form control; add/delete rows, `reorderable`, reuses DataTable's `edit` cell editors). Use `DataTable` instead for display/analysis at scale. |
| "tabs" / "too many tabs to fit" / "tabs that collapse into a ⋯ menu" | `Tabs` (add `Tabs.List overflow` to fold overflowing tabs into a `⋯` menu) |
| "collapsible sections"                             | No dedicated component; use `Tabs` for peer views, or `Reflow` (collapses to accordion-style sections when narrow) |
| "a sidebar file tree"                              | `Explorer`                                       |
| "a minimap" / "scroll overview" / "VS Code-style scroller" / "scrollspy outline rail" | `Minimap` (structural markers + clickable heading labels; `Graph.Minimap`/`Map.Minimap` are different: canvas camera overviews) |
| "an outline / nested list editor" / "a Roam / Logseq / Workflowy-style block editor" / "bullet notes with indent and fold" | `Outliner` (a `Bullet[]` tree, markdown per block; the consumer owns pages, links and storage, and answers `completions` for `[[` / `((` / `#` / `/`; `root` zooms into a block, `virtualized` for thousands of blocks, `apiRef.edit(id, offset)` to jump to a block from a search result; headings, callouts, code, numbered lists, properties, tables, boards, embeds and images are written as text in a block) |
| "a query block / math / a diagram / a data table / a link preview inside an outline" / "a custom block type in the outliner" | `Outliner blockTypes` with the factories from `@tarassov-ch/swiss-function/outliner-blocks` (the app passes the engine: Mermaid, its search; math uses KaTeX, a dependency), or a type of its own (`{ name, match, render }`) |
| "a timeline with events"                           | `Timeline`                                       |
| "a chart" / "graph this"                           | `BarChart` / `Scatterplot` / `BridgeChart` based on shape |
| "a stacked bar chart" / "stack the series" / "a 100% stacked bar" / "the mix per category over time" | `BarChart stacked` (`stacked="percent"` for the 100% reading; `Marimekko` when the column widths must carry a second measure, `PieChart` for one whole split once) |
| "format the numbers / labels on a chart" / "show units / currency" / "shorter axis labels" / "rename the categories" / "rename the series in the legend" | `valueFormat` / `tickFormat` / `categoryFormat` / `seriesFormat`, the shared `ChartFormatProps`, accepted by every chart. `categoryFormat` names a position (a band, a slice, a node), `seriesFormat` names a dataset from the `series` prop (see docs/API.md → Chart formatting) |
| "fund flows" / "AUM bridge over time" / "subscriptions vs redemptions per period" | `Flows` (per-period waterfall ribbon; `BridgeChart` for a single-total decomposition instead) |
| "candlestick" / "OHLC" / "stock chart"             | `CandlestickChart`                                        |
| "a heatmap" / "contour plot" / "z = f(x,y) field"  | `Heatmap` (filled cells + optional `contours`)   |
| "a 3D surface" / "response/optimization surface" / "terrain" | `Surface` (orthographic, drag-to-rotate) |
| "a 3D scatter / point cloud" / "3-component embedding" | `PointCloud`                                  |
| "a box plot" / "compare distributions" / "quartiles / percentiles per category" / "a violin plot" / "latency or return distributions across services / strategies" | `BoxPlot` (`values` or precomputed `stats` per category; `whiskers="tukey"` for outlier dots; `shape="violin"`; `orientation="horizontal"` for long category names; `Histogram` for one variable's distribution) |
| "a histogram" / "a distribution" / "the spread of returns / latencies / sizes" / "a density plot / KDE" / "an ECDF / cumulative distribution" / "how are the values distributed" | `Histogram` (`bins`, `normalize="percent"`, `density`, `cumulative`, several `series` overlaid; `BoxPlot` to compare distributions across categories) |
| "a slopegraph" / "before and after" / "compare two years / two states per entity" / "a bump chart" / "rank over time" / "who went up and who went down" | `Slopegraph` (`tone="direction"`, `highlight`; `y="rank"` for ranks over several periods) |
| "a horizon chart" / "many time series at once" / "dense metrics rows" / "a wall of sparklines with a shared time axis" / "50 tickers on one screen" | `HorizonChart` (`bands`, `baseline`, `sharedScale`, `showValues`, `height` to scroll; `Scatterplot` for a few series on one axis) |
| "a pie chart" / "a donut chart" / "share of total" / "the split" / "the mix" (a few parts of one whole) | `PieChart` (`innerRadius` for the donut, `center` for a readout in the hole, `maxSlices` to group the tail, `showValues` for the printed share). Past six or seven parts, or with a hierarchy, `Treemap` |
| "a treemap" / "part-to-whole with a hierarchy" / "portfolio exposure" / "a market map" / "disk usage" / "budget breakdown" | `Treemap` (`colorBy="change"` for the market map, `colorBy="group"` for categories, `depth` / `root` for drill-down; a 100% stacked bar for two measures across categories is `Marimekko`) |
| "a dot plot" / "a dumbbell chart" / "a lollipop chart" / "a horizontal bar chart" / "a ranked list of values" / "before vs after per category" / "a 52-week range" | `DotPlot` (`sort` to rank, `range` + `rangeTone` for the dumbbell, `marker` for the current value, `lollipop` when the baseline means something; `BarChart` when the bars themselves carry the reading) |
| "a sankey" / "flows between categories" / "where does the money / traffic / energy go" / "a funnel" / "an alluvial diagram" | `SankeyChart` (`nodes` + `links`; `linkFill="target"` to colour by destination; `Flows` for per-period fund flows, `BridgeChart` for a single-total decomposition) |
| "a bullet graph" / "a bullet chart" / "a gauge" / "KPI vs target" / "actual vs target with ranges" / "a scorecard row" | `BulletChart` (`items` with `value`/`target`/`ranges`; shared `domain` for one axis; `Stat` for the number itself). Not a dial, and not a pie: a pie shows parts of a whole, not one value against a target |
| "a marimekko" / "a mosaic chart" / "market share by segment and region" / "a 100% stacked bar with widths" / "two part-to-whole measures in one chart" | `Marimekko` (`widthBy` for the width measure, `normalize={false}` for units, `fill="dither"`; `Treemap` for a hierarchy, `BarChart` for plain categories) |
| "small multiples" / "a grid of charts" / "one chart per region / ticker / portfolio" / "facets" / "compare many series in separate panels" / "the same chart repeated" | `Multiples` (`render` a Scatterplot / BarChart / Histogram per item, `link` the domains, `axes="outer"` for one axis per row and column; `Reflow` for non-chart columns) |
| "a 3D bar / 3D pie chart" / "an exploded pie"      | none; chartjunk, so use `Heatmap`, `Surface`, a 2D `BarChart`, or a flat `PieChart` |
| "a network / dependency graph / mind map"          | `Graph`                                          |
| "an org chart" / "a hierarchy of people / teams" / "a reporting-structure chart" / "a tree of cards" | `Graph` with `layout="org"` + `nodeStyle="card"` (`sublabel` for titles; `layoutOptions.org.stack` for tight horizontal space) |
| "a map" / "plot points on a map" / "geographic / GIS / route / region" | `Map` (points/areas/vectors; `street`/`terrain` basemaps) |
| "loading state"                                    | `Skeleton` (inline placeholder) / `NonIdealState variant="loading"` (whole region) |
| "a spinner" / "busy / activity indicator"          | `Spinner` (inline glyph; `useSpinnerFrame` to embed) |
| "a progress bar" / "percent complete" / "upload/download progress" / "a determinate/indeterminate bar" | `Progress` (`value` number or `null`; `fill="color"/"dither"/"animated"`, `tone`, `size`, `showValue`) |
| "a KPI card" / "a stat / metric card" / "a number with an up/down trend" / "dashboard stat tiles" / "a sparkline stat" | `Stat` (+ `Stat.Group` for a responsive divided panel); `delta`/`goodDirection` for the change, `trend` for a sparkline, `tone` for a status value |
| "empty state" / "no results" / "error state"       | `NonIdealState` (variant per case)               |
| "streaming logs" / "terminal output"               | `StreamingTerminalText`                          |
| "markdown rendering"                               | `Markdown` (`Prose` for document-length content with an outline) |
| "a code / config editor" / "syntax highlighting" / "JSON/SQL/JS editor" / "vim mode" | `CodeEditor` (CodeMirror 6; language via `extensions`, opt-in `vim`) |
| "an inline / one-line code field that expands" / "an editable expression in a form row or cell" | `CodeEditorInline` (rests at one line, expands over content on focus; `maxRows`) |
| "a theme editor / token playground" / "customize the palette live" / "export a theme" | `ThemeBuilder` (edit `--sf-*` live, copy CSS/JSON; token pipeline emits `tokens.json`/`tokens.js`) |
| "a notebook" / "notebook-like analysis over my data" / "SQL cells" / "in-app analysis over DuckDB" | `Notebook` (+ `createSqlCellType` wired to the app's engine; `proseCellType` for text cells) |
| "an audio player" / "play a recording / voice note" / "audio with a waveform" / "podcast / voice-message playback" | `AudioPlayer` (waveform doubles as the seek slider; `visualization="bars"` for streams; never a bare `<audio controls>`) |
| "chat UI"                                          | `Chat`                                           |
| "a chat in a drawer / assistant side panel / chat that shows it's thinking" | `ChatDrawer` (`thinking` + `onThinkingStart`/`End`) |
| "a minimap for the chat" / "navigate a long conversation" / "jump back to a question" / "a scroll overview instead of the scrollbar" | `Chat minimap` (forwarded by `ChatDrawer`); `{ side, width }` tunes the rail. For non-chat content it is `Minimap` + `useMinimapMarkers` |
| "a terminal-style chat" / "a coding-agent window" / "a status line / footer under the chat" / "show the agent is working, Escape to stop" | `Chat` as it comes: `header`, `footer` (status lines), `working` + `onInterrupt`, `aboveEditor` / `belowEditor` for a queue or a plan |
| "change the chat font" / "a sans-serif chat with monospace code" / "set the chat's typeface" | `Chat fonts={{ text, user, code }}`, or `--sf-chat-font` / `--sf-chat-font-user` / `--sf-chat-font-code` on an ancestor for every chat |
| "a denser chat" / "less space around the chat" / "the chat wastes space" / "a log view of the conversation" | `Chat variant="log"` (no blank lines, no bands, no frame); `ChatDrawer variant="log"` also drops the gutter around it |
| "slash commands in the chat" / "@ to mention a file" / "autocomplete in the chat input" | `Chat completions` (`/`, `@`, `#`; return entries, now or as a promise; `onSelect` for a command that acts, `partial` for a directory step) |
| "the agent asks the user to confirm / pick / type something" / "a tool needs approval" / "a model picker in the chat" | `useChatPrompt()` + `Chat prompt={ui.prompt}`: `await ui.confirm(…)`, `ui.select(…)`, `ui.input(…)`, `ui.custom(…)`; the question takes the editor's place |
| "show a tool call / command output in the chat" / "collapsible logs in a reply" | A `tool` part on the message (`name`, `args`, `status`, `output`, `note`, `error`); `ChatTool` inside a `renderPart` block of your own |
| "a table in a chat reply" / "the app adds its own table to the conversation" | A `table` part (`columns`, `rows`, `caption`) or `ChatTable`; a `TableWidget` or `DataTable` from `renderPart` when it must sort, select or hold thousands of rows |
| "style the chat messages" / "message bubbles" / "how the user vs the agent shows up" | Not a bubble chat: the user's turn is a band, a reply sits on the page. Retune the bands with `--sf-chat-user-bg` / `--sf-chat-block-bg` |
| "in-chat choice menu / decision tree / custom block in a chat reply" | `Chat` `parts` (+ `renderPart` for custom, `ChatBlock` for its shell) + `onAction` |
| "a prompt / context editor" / "assemble the context window" / "manage prompt blocks with a token budget" / "an LLM context builder" | `ContextEditor` (budget gauge + editable, reorderable list of context blocks; controlled `value`/`onChange`, you supply token counts and the model call) |
| "a widget in a chat reply" / "a KPI / chart / table card the assistant returns" / "a widget with input parameters" / "a card with a month / currency picker in its header" / "a dashboard tile I can drag out of the chat" | `Widget` (shell with `params`; `KpiWidget` / `ChartWidget` / `TableWidget` / `ProgressWidget` for the common bodies; three or more params open the settings dialog) |

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

### Don't hand-roll an inline SVG glyph in a component

A component that needs a chevron, close ✕, zoom control, or any glyph
renders it through `<Glyph slot="…" fallback={<BespokeIcon />} />` (from
`lib/icons`), never a local `<svg>` or an `ICON_PROPS` object copied
between files (issue #89). The `slot` is what lets a consumer's
`IconProvider` redirect it; a raw inline `<svg>` is invisible to that and
drifts in stroke/size. If the glyph you need has no bespoke icon yet, add
one to `components/Icon/icons.tsx` (its own named export, on the 16-grid,
square cap) and a slot to `SF_ICON_SLOTS`. This applies to shared helpers
too: `lib/TreeChevron` (tree/accordion expand-collapse) and the
`lib/filter` funnel route their glyphs through the chevron / `filter`
slots, so a consumer's `IconProvider` reaches every visible glyph. The
only exceptions are chart bodies and canvas drawing (not glyphs), and a
control's own animated indicator mark (the `Checkbox` check /
indeterminate paths, whose CSS draws the stroke).

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
│   └── fonts.css      # optional webfont glue (IBM Plex Sans, JetBrains Mono)
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

- `npm run dev`: Ladle story server at http://localhost:61000 (primary way to view components). `?grid` on a story shows the unit grid over it with named cells (`?grid=2` for 2u cells, `&mark=3:2-5:10` to outline places, Alt+Shift+G toggles it)
- `npm run check`: Biome lint + format check (the lint gate; `npm run format` writes fixes)
- `npm run typecheck`: `tsc --noEmit`
- `npm run test`: Vitest, runs **only `*.test.{ts,tsx}`**
- `npm run test:ct`: Playwright Component Testing, runs **only `*.spec.tsx`**
- `npm run build`: full library build (see the build chain below)
- `npm run mobile`: the phone audit (below; needs Ladle running)
- `npm run audit`: known advisories in production dependencies, high and above fail (the CI gate; `npm audit` for the whole tree, dev tools included)

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
  on the baseline machine. The probes run the full Chromium build on the
  GPU (ANGLE over EGL): Playwright's default headless shell only has
  software GL, which made a 10k-node Graph frame 190ms instead of 2.5ms.
  `PERF_GL=software` restores the old setup; the baseline records the GL
  renderer and a mismatch warns. Ladle's dev server runs React's
  development build, which inflates render-heavy numbers; for absolute
  figures, point `--base-url` at a `ladle build` output served statically.
  Each input→paint probe names its `anchor` (`ANCHOR` in
  `scripts/perf/runner.mjs`): the DOM event the component's handler runs
  on (`click` for a sort, `pointerdown` for a combobox opening on
  mousedown, a keydown for one key). The clock starts when that event
  arrives, so Playwright's actionability wait and hover stay outside it.
  A run on a busy machine shows as a high `readyMs`; rerun it.
- `npm run size`: per-entry bundle cost through the dist ESM import
  graph (gzip bytes). Fails on > max(5%, 2KB) growth vs
  `perf/size-baseline.json`; `npm run size:update` rewrites. Needs a
  fresh `npm run build`.

**Phone gate:**

- `npm run mobile`: `scripts/mobile/audit.mjs` renders every story in
  `vrt/stories.json` at 390 x 844 with touch emulation and counts page
  overflow, controls clipped by an ancestor or cut by the screen edge, text
  printed over text (an annotation label over a mark's own label is layering
  and does not count), text
  wrapped into a sliver, hit areas under 24px and text fields under 16px.
  **Ladle must already be running on :61000** (`LADLE_URL` overrides). It
  fails when a count exceeds `perf/mobile-baseline.json`; `npm run
  mobile:update` rewrites the baseline. The counts depend on the stories, so
  the baseline is committed. `--only <regex>` audits a few stories without
  comparing. `VRT_PHONE=1 npm run vrt` adds the same viewport to the pixel
  gate (two more projects, opt-in). Chromium's emulation has no on-screen
  keyboard, no focus zoom and no safe areas: those need a real phone.

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

`npm run build` is five steps, and the CSS handling is fragile by design:

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
4. `scripts/tokens/build.mjs` emits `tokens.json` / `tokens.js` /
   `tokens.style-dictionary.json` from `tokens.css`.
5. `scripts/guide/build.mjs` builds `dist/guide/`, the guide a host project
   writes with `npx swiss-function guide` (`bin/`): this file without the
   "(for contributors)" sections, with a host intro and closing, beside copies
   of `docs/API.md` and `AESTHETICS.md`. A sentence in the host sections that
   only makes sense inside this repository (a story server parameter, an
   `npm run` script) goes between `<!-- guide:skip -->` and
   `<!-- /guide:skip -->`; text only the guide should carry goes in
   `<!-- guide:host … -->`. `scripts/guide/build.test.ts` fails when the host
   guide mentions `npm run`, Ladle, `src/` or the story server, so a new
   section that does is caught.

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
   the tag is on `main`, audits the production dependencies (a high or
   critical advisory blocks the release; `.gitea/workflows/audit.yml` runs the
   same audit on every push to `main` and weekly, plus a critical-level check
   of the whole tree), publishes to the Forgejo npm registry, and creates the
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
