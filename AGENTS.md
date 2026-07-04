# AGENTS.md

A guide for coding agents (Claude Code, Cursor, Aider, anything else with
tool use) building UIs with `@tarassov-ch/swiss-function`. Read this
before you reach for a `<div className="bg-gray-100 p-4 rounded-lg">`.

Pair this with [AESTHETICS.md](./AESTHETICS.md), which describes *why*
the library looks the way it does. This file is *what to do*.

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

Then import components either from the barrel or per-component:

```ts
// Barrel — convenient for prototyping.
import { Button, Field, Input } from "@tarassov-ch/swiss-function";

// Per-component — better tree-shaking in production.
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
| `Field`         | Compound for any form row: `Field` + `Field.Label` + control + `Field.Description` + `Field.Error`. `Field.Help` is space-adaptive help text — beside the control when wide, a "?" tooltip after the label when narrow (`helpAt`). Don't roll your own. |
| `Input`         | Single-line text input. Monospace by design.              |
| `DigitInput`    | Fixed-capacity number entry as digit cells (`[0][4][2].[5][0] %`). Two feels via `mode`: `"push"` (default — calculator, digits push from the right, always complete) and `"mask"` (2FA-style per-cell fill, null until complete). `digits`/`decimals`/`unit`; value is `number \| null` (null = untyped mask). Doubles as a numeric PIN input. |
| `DatePicker`    | Date input + calendar popup, ISO 8601 by default (`YYYY-MM-DD`, Monday-first weeks, optional ISO week numbers). Typing is the fastest path — `2026-07`, `12 jul`, `tomorrow`, `+7` narrow the calendar and Enter commits the echoed candidate; numeric fragments are always day-first, never US month-first. Value is `Date \| null`; `minDate`/`maxDate`/`isDateDisabled` constrain. Never reach for the browser-native `type="date"`. |
| `Kbd`           | Renders a keyboard shortcut as OS-aware keycaps (`combo="mod+k"` → ⌘K on macOS, Ctrl+K elsewhere). `mod` = primary modifier; never shows ⌘ off-Mac. For labels/menus/tooltips. |
| `TextEdit`      | Multi-line / auto-growing text input.                     |
| `Checkbox`      | Binary independent toggles in lists.                      |
| `Radio`         | Single-choice within a group.                             |
| `Switch`        | Binary on/off for a setting, with an immediate effect.    |
| `ToggleGroup`   | Mutually-exclusive segmented control.                     |
| `Selector`      | Search + multi-select with a visible "bucket" of chosen items as removable chips. `layout="panel"` (separate bucket, default) or `"inline"` (tag-input). High-level: `<Selector items value onChange />`. |
| `Picker`        | Search + single-select — the one-choice sibling of `Selector` (same item shape, `value` is one string). The field shows the chosen label and doubles as the filter. High-level: `<Picker items value onChange />`. |
| `Dropzone`      | File drag-and-drop zone (+ click-to-browse) that surfaces files via `onFilesChange` and renders them as a removable list. Presentational — the upload itself is yours; feed per-file progress/error through the `fileStatus` slot. |

### Surfaces & layout

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Box`           | A surface with `elevation={0..5}`. The atom of grouping. |
| `Grid`          | The layout primitive. CSS Grid wrapper with token-sized gaps. Pass `resizable` (`"columns"` / `"rows"` / `"both"`) to make track boundaries drag/keyboard-resizable (double-click a gutter to split evenly). |
| `Pane`          | Full-height region split into Header (auto) + Body (scrollable). Compound: `Pane`, `Pane.Header`, `Pane.Body`. Nests cleanly. Use whenever a region needs to fill its parent and scroll its overflow internally. |
| `Fullscreen`    | Wraps content with a corner toggle that expands it to fill the browser viewport (a fixed overlay — not OS fullscreen, works everywhere); a single child stretches to 100%. Escape exits; locks page scroll while open. Props: `expanded`/`defaultExpanded`/`onExpandedChange`, `buttonPosition`. |
| `Reflow`        | Responsive multi-column layout. Wide: equal columns side by side; when its container is narrower than `collapseAt` it collapses to a vertical accordion or a tab switcher (`collapseMode`). Compound: `Reflow.Root` + `Reflow.Column` (each with a `title`). Reach for this to make a multi-column region usable on narrow screens. |
| `WindowArray`   | Window-manager main area, Niri-style scrollable tiling: an infinitely horizontally-scrollable strip of columns, each a vertical stack of windows with Dialog-style chrome (title, ✕, fullscreen-in-container). Declarative (`WindowArray` → `.Column` → `.Window`): you own the list; drag/Shift+Arrow rearranging reports a `WindowMove` via `onWindowMove` for you to apply. Columns resize by gutter; keyboard nav auto-scrolls the strip; opt-in `snap` (column scroll-snapping), `controls` (edge paddles), and `hotkeys` (Alt+Arrow column switching). For one floating window use `Dialog` (`draggable`/`resizable`) instead. |

Both `Reflow` and `MenuBar` (the latter only when given `collapseAt`) adapt to their **container** width via `ResizeObserver` (the shared `useCollapse` hook), not viewport media queries — the library's container-responsiveness mechanism, so they work inside sidebars/split panes. Use JS-measured collapse (not CSS `@container`) whenever the breakpoint must swap which subtree renders.

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
| `Tabs`          | Horizontally peer-level views in the same surface.       |

### Data display

| Component                | Use for                                            |
| ------------------------ | -------------------------------------------------- |
| `Chip`                   | Compact token — tag, filter, status marker, or removable selection. Sharp (2px) by default; `round` for the pill/badge reading. Neutral unless a `tone` (`primary`/`success`/`warning`/`danger`) makes the colour *mean* something (status/priority) — don't colour chips decoratively. `dot` adds a leading status marker; `onRemove` renders a keyboard-reachable ✕; pass `onClick` to make the whole chip an accessible filter button. `size` `sm`/`md`. Not a Button (that's for actions) and not a toggle set (that's `ToggleGroup`/`Selector`). |
| `DataTable`              | Tabular data — sorting, selection, virtualization, Column resize (on by default; `resizableColumns={false}` or per-column `resizable: false` to lock; double-click a header edge to auto-fit). Tracks are `minmax(minWidth, preferred)`: when the columns don't fit they shrink toward their minimum (no scroll); only when even the minimums don't fit does the table scroll horizontally. The last column's preferred is `1fr` (fills slack) and it has no handle. Dragging a trailing edge sets preferred widths, cascading the opposite change through the columns to its right (nearest first, skipping locked ones). Set `width` / `minWidth` per column in `--sf-unit` multiples, plus opt-in `scrollSnap` and `edgeFade`. `frozenColumns={n}` freezes the first n columns (pinned left while the rest scroll — the horizontal analogue of the sticky header; frozen columns keep a fixed width). The serious one. |
| `Markdown`               | Rendering markdown content (uses remark-gfm).      |
| `Prose`                  | Long-form markdown reading view — virtualized body + auto outline. Compound: `Prose.Root`, `Prose.Body`, `Prose.Outline`. Reach for this over bare `Markdown` for document-length content. |
| `Skeleton`               | Loading placeholder with shimmer (respects reduced-motion). |
| `Spinner`                | Inline CLI-style animated glyph (`role="status"`) for "busy" feedback. 28 monospace `variant`s (braille/line/blocks/bars/grow/bounce/arrow/quadrant/triangle/circle/corners/pipe/star/toggle/dots/pulse/scanner/arrowDouble/caret/trigram/dqpb/arc/clockface/balloon/weave/boxCorners/quadrantHeavy/static); `color` (any token) + `size`, else inherits; `speed`. Reduced-motion → static frame. The `useSpinnerFrame(variant, speed)` hook embeds the glyph in other components. |
| `NonIdealState`          | Empty / no-results / error / loading state for a region. A sizable block continuously filled (WebGL, ~0.06ms/frame, pauses offscreen) with console-style dithered shade blocks; message + action in the cleared center. Props: `variant`, `title`, `description`, `action`, `width`/`height`, `effect` (24 animated: ripple/noise/scan/plasma/rain/wave/spiral/radar/tunnel/fire/bars/metaballs/rotozoom/twister/copper/voronoi/grid/kaleidoscope/starfield/swirl/helix/checker/droplets/lissajous; per-variant defaults: empty→plasma, no-results→noise, error→scan, loading→ripple), `effectOptions` (speed/wavelength/amplitude/rate/density/seed), `speed`, `density` (overall coverage), `cellSize` (square shade-block px), `color` + `opacity`. Reduced-motion → static frame. |
| `StreamingTerminalText`  | Terminal/log output that arrives incrementally.    |

### Navigation

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Explorer`      | File-tree-style hierarchical navigation.                 |
| `Outliner`      | Outline editor with drag-reordering (dnd-kit underneath). |

### Charts

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Scatterplot`      | Points and/or lines on numeric or time axes. Series-based. |
| `BarChart`         | Categorical bars, single or grouped series.              |
| `BridgeChart`      | Waterfall / financier's bridge — totals + signed deltas. |
| `CandlestickChart` | OHLC financial candles (up = success, down = danger), index-spaced. |
| `Timeline`         | Horizontal time strip with stacked event labels and a scrubbable playhead. |
| `Heatmap`          | 2D grid of `z = f(x,y)` as filled cells, with an optional marching-squares `contours` iso-line overlay. The default, Swiss-friendly read of a 2-variable field — reach for this before a 3D surface. |
| `Surface`          | 3D surface `z = f(x,y)` (Canvas2D, axonometric, **drag-to-rotate**). For data that is genuinely 3D and loses meaning when flattened (response/optimization surfaces, terrain). Single-hue height ramp + measured cube frame. |
| `PointCloud`       | 3D scatter / point cloud — `series` of x/y/z points (clusters, 3-component embeddings). Same axonometric engine as `Surface`. |

The 2D charts default to `scaffolding="hover"` (Tufte-minimal idle, full
scale fades in on hover). Use `scaffolding="full"` for dense data,
`"minimal"` when you don't want any reveal. The 3D charts (`Surface`,
`PointCloud`) are **orthographic and drag-to-rotate only — never auto-spin**;
they're for intrinsically-3D data. **There are no 3D bars/pies/ribbons** (they
distort comparison) — for a 2-variable field reach for `Heatmap`, and for
categorical magnitudes a 2D `BarChart`.

When the user asks for interactive/explorable charts ("zoom into this",
"Bloomberg-style", "drill down"): `Scatterplot` and `CandlestickChart` take
`zoomable` (wheel zooms at the cursor, drag pans, double-click resets,
keyboard ←/→ `+` `-` `0`; axes re-tick adaptively — calendar ladder on dates,
step-derived precision on numbers; large series decimate automatically, so
tens of thousands of points are fine). Both take `annotations` — serializable,
data-anchored `hline`/`vline`/`line`/`rect`/`text`/`measure` overlays that
survive zoom/pan (persist the array as-is). Drill-down is an event, not
behavior: wire `onPointActivate` (all three axis charts) and swap the data
yourself; `onXDomainChange` / `onVisibleRangeChange` are the hooks for loading
finer-grained data as the user zooms in.

For an actual chart **window** — visible zoom buttons and drawing tools, the
trading-terminal look — add `controls` (toolbar overlay — zoom is a mode: arm it, drag the region to zoom to) plus
`onAnnotationsChange` (arms the tool palette: trend line, h/v lines, region,
text note, measure; select/drag/Delete editing, all flowing through the
annotations array) and optionally `fullscreen` and `frame`.

### Graphs & networks

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Graph`   | Node-link networks — dependency graphs, mind maps, concept trees — up to ~10k nodes interactively. Force / tree / radial / concentric / grid layouts (switchable at runtime), pan/zoom/fit + keyboard nav, minimap, right-click menu, and node labels highlighted on hover, plus a built-in fullscreen toggle (`fullscreen` prop, default on). Pass `editable` for relationship editing: a Connect toggle appears in `Graph.Controls` (drag node→node to add an edge), and edges can be removed via right-click "Delete" or select-then-Delete/Backspace — wire `onEdgeCreate` / `onEdgeDelete` and mirror the change in `data` (updates reconcile in place, so camera + layout stay put). Edge label/metadata editing is consumer-owned: use the `edge` `contextMenuItems` target (or `onEdgeClick`) to open your own editor, then update `data`. Layout: `fill` makes it take the parent's height (give the parent one) and it re-fits the canvas on container resize, not just window resize; `frame={false}` drops its own border when embedding inside a framed container. Compound: `Graph`, `Graph.Controls`, `Graph.Minimap`. Distinct from the charts above — those plot values on axes; this draws relationships. |

### Maps & geography

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Map`     | Geographic maps (MapLibre GL JS). Plot **points** (`points`), **areas**/polygons (`areas`), and **vectors**/routes (`vectors`, with `arrow`/`dashed`) — all in GeoJSON `[lng, lat]` order — or pass raw `geojson`. Customize appearance via `basemap`: `"minimal"` (default — restrained vector style colored from `--sf-*` tokens, re-tints with dark mode), `"street"`, `"terrain"`, or override entirely with `styleUrl` (self-hosted/keyed tiles). `onFeatureClick` / `renderTooltip` for interaction; `fill` / `frame={false}` / `fullscreen` like `Graph`. Compound: `Map`, `Map.Controls` (zoom/fit/reset/basemap), `Map.Minimap` (overview inset — a 2nd WebGL context). **Two CSS imports are required** at app root: `tokens.css` **and** `maplibre-gl/dist/maplibre-gl.css`. Free no-key tile providers are best-effort (no SLA); tile attribution must stay visible. Not for non-geographic x/y data — that's the charts. |

### Communication

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Chat`          | Message-stream UI for chat-style interfaces. Assistant messages can carry rich `parts` rendered in a terminal (TUI) style: text, a monospace choices menu, a directory-tree decision/orchestration tree, a **`thinking`** block (a spinner that expands into a live orchestration fan-out — a status tree — then collapses to a summary), or custom blocks via `renderPart` (wrap them in `ChatBlock`). Tree nodes take a `status` (pending/running/done/error) → per-node spinner/✓/✗. Interactions report through `onAction`. |
| `ChatDrawer`    | A `Chat` in a resizable side panel that **pushes** the app content aside (built on `SplitPane`). Pass the app as `children`. While `thinking`, an animated effect blooms and fills the padding gutter; `onThinkingStart`/`onThinkingEnd` fire on the transitions. The header is an icon bar: add your own buttons with `actions`, or pass `views` (`{ id, icon, label, content }[]`) to host multiple icon-switched panels — chat becomes just one view. |
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
  (`sm`, `md`, `lg`). Don't invent a fourth — reach for weight, spacing,
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
<Field.Root orientation="vertical" required>
  <Field.Label>Email</Field.Label>
  <Input type="email" />
  <Field.Description>We never share your address.</Field.Description>
  <Field.Error>Please enter a valid email.</Field.Error>
</Field.Root>
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
| "a form"                                           | `Field.Root` per row + the right control inside  |
| "a modal" / "a popup" / "confirm dialog"           | `Dialog`                                         |
| "a drawer" / "sheet" / "overlay panel"             | `Drawer`                                          |
| "a resizable split / panel that pushes content / IDE-style side panel" | `SplitPane` |
| "a tooltip" / "hover info"                         | `Popover` (or chart components' built-in tooltip) |
| "a dropdown" / "a menu off a button"               | `Menu`                                           |
| "a right-click menu" / "context menu"              | `ContextMenu`                                    |
| "multi-select" / "pick several from a list" / "tag input" / "add items to a bucket" | `Selector` |
| "single-select" / "pick one from a searchable list" / "searchable dropdown" | `Picker` |
| "file upload" / "drop files here" / "drag-and-drop files" / "attach files" | `Dropzone` |
| "an app menu bar" / "File/Edit/View menus" / "toolbar of controls" | `MenuBar` (no dedicated Cmd-K palette exists — use `Dialog` + `Picker`/`Selector` for a quick switcher) |
| "show a keyboard shortcut" / "render a hotkey / keycap" | `Kbd` (OS-aware; `mod` → ⌘/Ctrl)             |
| "a tag" / "a badge" / "a status pill" / "a filter chip" / "a removable token" | `Chip` (`tone` for status, `round` for the pill/badge reading, `onRemove` to dismiss, `onClick` for a filter) |
| "fill the rest of the page" / "header + scrollable body" | `Pane` with `Pane.Header` + `Pane.Body`     |
| "a window manager / tiling windows / multi-window workspace / scrollable strip of panels" | `WindowArray` (`Dialog draggable` for a single floating window) |
| "a PIN / 2FA code input" / "a fixed-digit amount" / "a percent / price the user types into" / "instrument-panel number entry" | `DigitInput` (`digits`/`decimals`/`unit`; calculator-style push typing) |
| "a date picker" / "pick a date" / "a calendar input" / "due date field" | `DatePicker` (ISO by default; type `2026-07`, `12 jul`, `tomorrow` — not `type="date"`) |
| "a table"                                          | `DataTable` (almost always — it handles a lot)   |
| "tabs"                                             | `Tabs`                                           |
| "collapsible sections"                             | No dedicated component — use `Tabs` for peer views, or `Reflow` (collapses to accordion-style sections when narrow) |
| "a sidebar file tree"                              | `Explorer`                                       |
| "an outline / nested list editor"                  | `Outliner`                                       |
| "a timeline with events"                           | `Timeline`                                       |
| "a chart" / "graph this"                           | `BarChart` / `Scatterplot` / `BridgeChart` based on shape |
| "candlestick" / "OHLC" / "stock chart"             | `CandlestickChart`                                        |
| "a heatmap" / "contour plot" / "z = f(x,y) field"  | `Heatmap` (filled cells + optional `contours`)   |
| "a 3D surface" / "response/optimization surface" / "terrain" | `Surface` (orthographic, drag-to-rotate) |
| "a 3D scatter / point cloud" / "3-component embedding" | `PointCloud`                                  |
| "a 3D bar / 3D pie chart"                          | none — chartjunk; use `Heatmap`, `Surface`, or a 2D `BarChart` |
| "a network / dependency graph / mind map"          | `Graph`                                          |
| "a map" / "plot points on a map" / "geographic / GIS / route / region" | `Map` (points/areas/vectors; `street`/`terrain` basemaps) |
| "loading state"                                    | `Skeleton` (inline placeholder) / `NonIdealState variant="loading"` (whole region) |
| "a spinner" / "busy / activity indicator"          | `Spinner` (inline glyph; `useSpinnerFrame` to embed) |
| "empty state" / "no results" / "error state"       | `NonIdealState` (variant per case)               |
| "streaming logs" / "terminal output"               | `StreamingTerminalText`                          |
| "markdown rendering"                               | `Markdown` (`Prose` for document-length content with an outline) |
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

Buttons, dialogs, popovers, menus, comboboxes, switches, etc. — Base UI
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
│   ├── tokens.css     # all --sf-* custom properties
│   └── reset.css      # base-font + box-model reset
├── lib/
│   ├── cx.ts          # className helper (use this, not clsx)
│   └── chart/         # internal chart math (scales, ticks, axis, tooltip, crosshair)
└── components/
    └── <Name>/
        ├── <Name>.tsx           # forwardRef component
        ├── <Name>.module.css    # CSS Module with all styles
        ├── <Name>.stories.tsx   # Ladle stories
        ├── <Name>.spec.tsx      # optional component tests
        └── index.ts             # barrel re-export
```

When adding a component:

1. Wrap a Base UI primitive when possible.
2. Use forwardRef, accept HTML attributes, spread `...rest` to the root.
3. Use `cx()` to merge the internal class with consumer `className`.
4. Tokens for everything stylistic; no literals.
5. Add stories. Multiple variants. The Playground story uses Ladle args.
6. Add the export to `src/index.ts` and per-component entry to
   `package.json`'s `exports` field.

---

## Where to look for more

- **Live demos**: `npm run dev` (Ladle). Browse component stories.
- **Token list**: `src/tokens/tokens.css` — every available variable.
- **AESTHETICS.md** — why the library looks the way it does.
- **README.md** — package metadata and install instructions.

When in doubt: open the corresponding component's `.tsx` and
`.module.css` and read how the existing patterns are expressed. The
codebase is small and consistent on purpose.
