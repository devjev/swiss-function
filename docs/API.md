# API reference

Per-component prop/element reference for every exported component in the library.

> For "when the user asks for X, reach for Y" guidance, token/`cx()` conventions,
> and anti-patterns, see [AGENTS.md](../AGENTS.md). For *why* the library looks
> the way it does, see [AESTHETICS.md](../AESTHETICS.md).
>
> **Maintenance:** keep this file in sync with the code. Whenever a documented
> prop, default, element, or `--sf-*` variable changes, update the matching
> section in the same change. When a component is added, add a section for it.

## Conventions

- Every component is `forwardRef`, spreads unknown props to its root element, and
  merges `className` via `src/lib/cx.ts`.
- Sizes (`sm`/`md`/`lg`) map to `--sf-unit` multiples: `1` / `1.5` / `2`
  (24 / 36 / 48px at the default unit).
- "u" means one `--sf-unit`. e.g. `0.25u` = `calc(var(--sf-unit) / 4)`.
- Styling is overridden through `--sf-*` custom properties, never by branching in
  JS. Dark mode is `[data-theme="dark"]` on any ancestor.
- Text-entry controls (Input, TextEdit, Combobox, DigitInput) rest on
  `--sf-color-input-bg` (a shade below the page) and lift to `--sf-color-bg` on
  focus. Override `--sf-color-input-bg` on any ancestor to retint or flatten
  them (`--sf-color-input-bg: var(--sf-color-bg)` restores the old look).
- Focus rings are tunable everywhere: every `:focus-visible` rule draws
  `var(--sf-focus-ring-width, 2px) solid var(--sf-color-focus-ring)` with
  `outline-offset: var(--sf-focus-ring-offset, <per-rule default>)`. Set the
  variables on any ancestor to restyle rings for that subtree, or
  `--sf-focus-ring-width: 0` to disable them, e.g. inside a container that
  already communicates focus itself. `--sf-focus-ring-offset` has no global
  default on purpose; each rule keeps its own fitting offset until you set it.
- Required props show `n/a` in the Default column. Props "extend `HTMLAttributes`"
  means native attributes pass through to the root and aren't re-listed.
- Many compound components are thin wrappers over Base UI (`@base-ui/react`);
  their parts forward props to the underlying primitive; see the Base UI docs
  for the full surface.

**Components (A to Z):** BarChart · Box · BridgeChart · Button ·
ButtonGroup · Chat · Checkbox · CodeEditor · DataTable · DatePicker · Dialog · DigitInput · DigitInputMicro · Dropzone ·
Explorer · Field · FieldLayout · Fullscreen · Graph · Grid · Heatmap · Input · Markdown · Menu ·
MenuBar · NonIdealState · Outliner · Pane · Picker · PointCloud · Popover · Prose · Radio ·
Reflow · Scatterplot · Selector · Skeleton · Spinner · StreamingTerminalText ·
Surface · Switch · Tabs · TextEdit · TextEditInline · Timeline · ToggleGroup · WindowArray

---

## BarChart

`import { BarChart } from "@tarassov-ch/swiss-function/bar-chart"`

Responsive bar chart with Tufte/hover/full scaffolding modes. Mixes in the shared `ChartScaffoldingProps` (frame/fullscreen/controls/zoom/annotations/labels/posture, the same set as Scatterplot/CandlestickChart, issue #35). Extends `HTMLAttributes<HTMLDivElement>`.

All 2D charts share the measured-label behavior (chart-polish milestone): tick and category labels are measured with real text metrics, thinned until nothing collides (first and last always survive), and long categorical labels are ellipsized with the full text in a `title`, never rotated. The y-axis column auto-sizes to the widest measured label via `--sf-axis-label-width` on the chart root; set that variable yourself on a container to pin several stacked charts to one column width. Hairline chrome (gridlines, ticks, wicks, cell edges) is device-pixel-snapped; numerals are tabular; resize tracks 1:1 with coalesced recomputes and stable label sets (step hysteresis).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `categories` | `string[]` | n/a | x-axis category labels. |
| `series` | `BarSeries[]` | n/a | `{ name, values, color? }` per series. |
| `yDomain` | `[number, number]` | auto-fit | Y range (zero-anchored when all positive). While zoomed, the value axis follows this extent. |
| `xLabel` / `yLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `showLegend` | `boolean` | `true` when >1 series | Legend below the x-axis. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. |
| `zoomable` | `boolean` | `false` | Interactive **value-axis (y) zoom**, x is categorical, so wheel/drag/`↑`/`↓`/`+`/`-`/`0` window the continuous value axis; the toolbar marquee zooms to a y-band; `aria-live` range announcements. |
| `zoomOutLimit` | `number` | `1` | How far zoom-out may go **past** the data, as a multiple of the data span; `Infinity` = arbitrary. `1` stops at the data. Reset (`0`/double-click) still returns to the data. |
| `onValueDomainChange` | `(domain: [number, number] \| null) => void` | n/a | Fires on every value-axis zoom/pan (`null` = reset to the full range). |
| `annotations` | `ChartAnnotation[]` | n/a | Data-anchored overlays (see Scatterplot); `hline` is the natural reference level. `x` anchors to a fractional category index. |
| `onAnnotationsChange` | `(annotations: ChartAnnotation[]) => void` | n/a | With `controls`, enables annotation editing (same interactions as Scatterplot). |
| `controls` | `boolean` | `false` | On-chart toolbar: zoom cluster (when `zoomable`) + annotation tools (when editable). |
| `fullscreen` | `boolean` | `false` | Maximize-to-viewport toggle; Escape exits. |
| `frame` | `boolean` | `false` | 1px structural border + padding. |
| `onPointActivate` | `(datum: BarTooltipDatum) => void` | n/a | Click/Enter on a bar, a drill-down hook; swap the data yourself and render your own breadcrumb. |
| `renderTooltip` | `(datum: BarTooltipDatum) => ReactNode` | default formatter | Custom tooltip. |

## Box

`import { Box } from "@tarassov-ch/swiss-function/box"`

Flexible container with elevation, optional texture, and unit-based padding. Extends `HTMLAttributes<HTMLElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `0` | Shadow depth. |
| `texture` | `boolean` | `false` | Subtle monochrome noise overlay (`mix-blend-mode: multiply`). |
| `padding` | `number \| string` | `1` | `number` → `--sf-unit` multiples; `string` → raw CSS. |
| `render` | `useRender.RenderProp` | `<div />` | Base UI render prop to swap the root element. |

## BridgeChart

`import { BridgeChart } from "@tarassov-ch/swiss-function/bridge-chart"`

Waterfall/bridge chart of cumulative deltas and totals. Mixes in the shared `ChartScaffoldingProps` (frame/fullscreen/controls/zoom/annotations/labels/posture, issue #35). Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `BridgeItem[]` | n/a | `{ label, value, kind: "total" \| "delta" }`. |
| `yDomain` | `[number, number]` | auto-fit | Y range. While zoomed, the value axis follows this extent. |
| `xLabel` / `yLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `showConnectors` | `boolean` | `true` | Dashed connectors between bars. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. |
| `zoomable` | `boolean` | `false` | Interactive **value-axis (y) zoom**, the waterfall's x is categorical, so wheel/drag/`↑`/`↓`/`+`/`-`/`0` window the value axis; toolbar marquee zooms to a y-band. |
| `zoomOutLimit` | `number` | `1` | How far zoom-out may go **past** the data, as a multiple of the data span; `Infinity` = arbitrary. `1` stops at the data. Reset (`0`/double-click) still returns to the data. |
| `onValueDomainChange` | `(domain: [number, number] \| null) => void` | n/a | Fires on every value-axis zoom/pan (`null` = full range). |
| `annotations` | `ChartAnnotation[]` | n/a | Data-anchored overlays; an `hline` is the natural reference level on a waterfall. |
| `onAnnotationsChange` | `(annotations: ChartAnnotation[]) => void` | n/a | With `controls`, enables annotation editing. |
| `controls` | `boolean` | `false` | On-chart toolbar (zoom + annotation tools). |
| `fullscreen` | `boolean` | `false` | Maximize-to-viewport toggle; Escape exits. |
| `frame` | `boolean` | `false` | 1px structural border + padding. |
| `renderTooltip` | `(datum: BridgeTooltipDatum) => ReactNode` | default formatter | Receives label, value, kind, cumulative. |

## Button

`import { Button } from "@tarassov-ch/swiss-function/button"`

A single `<button>`. Extends `ButtonHTMLAttributes<HTMLButtonElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"primary"` | Colour role. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Height + font. Inherits from an enclosing `<ButtonGroup size>`; explicit `size` wins. |
| `tight` | `boolean` | `false` | Compact horizontal padding (`3/16u`) + `0.25u` icon/text gap. Height still comes from `size`, so tight buttons line up with peers. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth (`--sf-elevation-N`). `ghost` is always flat. |

```tsx
<Button variant="secondary" size="sm" tight>
  <span aria-hidden="true">↻</span>
  Refresh
</Button>
```

## ButtonGroup

`import { ButtonGroup } from "@tarassov-ch/swiss-function/button-group"`

Container (`role="group"`) that cascades a size to child Buttons. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `"sm" \| "md" \| "lg"` | n/a | Cascades to child Buttons; an explicit Button `size` wins. |

## CandlestickChart

`import { CandlestickChart } from "@tarassov-ch/swiss-function/candlestick-chart"`

OHLC financial candlestick chart. Candles are spaced evenly (index-based, no
time gaps); up candles (`close >= open`) are success-coloured, down candles
danger-coloured. Extends `HTMLAttributes<HTMLDivElement>`.
`Candle = { x: number | Date; open; high; low; close }`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `candles` | `Candle[]` | n/a | OHLC bars, chronological. |
| `yDomain` | `[number, number]` | auto-fit | Price range; auto-fit is padded and **not** zero-anchored. While zoomed, auto-fit follows the visible candles. |
| `yLabel` / `xLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis/gridline posture (same as the other charts). |
| `zoomable` | `boolean` | `false` | Interactive viewport in **bar-index space** (weekends stay collapsed): wheel zooms at the cursor (plain wheel after a click; ctrl/⌘+wheel and pinch always), drag pans, double-click resets; ←/→ `+` `-` `0` on the focused chart; `aria-live` range announcements; Reset button while zoomed. Far out, candles aggregate into true OHLC groups. Dated candles get calendar-boundary ticks with promoted (bolder) month/year labels. |
| `zoomOutLimit` | `number` | `1` | How far zoom-out may go **past** the data (into empty index space to the sides), as a multiple of the data span; `Infinity` = arbitrary. `1` stops at the data. Reset still returns to the data. |
| `visibleRange` | `[number, number]` | uncontrolled | Controlled window as fractional candle indices; pair with `onVisibleRangeChange`. |
| `onVisibleRangeChange` | `(range: [number, number] \| null) => void` | n/a | Fires on every viewport change (`null` = reset). Lazy-history hook: prepend older candles when the window nears index 0. |
| `annotations` | `ChartAnnotation[]` | n/a | Data-anchored overlay (see Scatterplot); `x` anchors are timestamps, mapped onto the gap-free bar axis. |
| `onAnnotationsChange` | `(annotations: ChartAnnotation[]) => void` | n/a | With `controls`, enables annotation editing (same interactions as Scatterplot). Drawn `x` anchors are interpolated timestamps (`Date`s when the candles carry Dates). |
| `controls` | `boolean` | `false` | On-chart toolbar: zoom-to-region mode (drag a band, bar-index space), step zoom out, Reset + annotation tools. Absorbs the corner Reset button. |
| `fullscreen` | `boolean` | `false` | Maximize-to-viewport toggle; Escape exits. |
| `frame` | `boolean` | `false` | 1px structural border + padding. |
| `onPointActivate` | `(candle: Candle, index: number) => void` | n/a | Click/Enter on a candle, a drill-down hook. |
| `renderTooltip` | `(c: Candle) => ReactNode` | mono O/H/L/C | Hover tooltip body. |

## Chat

`import { Chat } from "@tarassov-ch/swiss-function/chat"`

Conversational UI with message history, auto-scroll, and streaming. Auto-focuses the input when `disabled` flips to false. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `messages` | `ChatMessage[]` | n/a | `{ id, role: "user" \| "assistant", content?, parts?, isStreaming? }`. |
| `onSubmit` | `(text: string) => void` | n/a | Enter submits (Shift+Enter = newline); input clears. |
| `renderPart` | `(part, ctx) => ReactNode` | n/a | Render a custom (non-built-in) part by `type`. Return null to skip. |
| `onAction` | `(action: ChatAction) => void` | n/a | Fired when a user interacts with a choices / tree / custom block. |
| `onError` | `(error: ChatErrorContext) => void` | n/a | Fired **once** when an error part appears in the transcript (a notification hook: log / toast / auto-retry). `ChatErrorContext` is `{ messageId, partId?, message, requestId? }`. A `retryable` error's Retry reports separately through `onAction` (`type: "error", value: "retry"`). |
| `placeholder` | `string` | `"Ask anything…"` | Input placeholder text. |
| `sendLabel` | `string` | `"Send"` | Caption for the submit button. |
| `sendVariant` | `ButtonVariant` | `"secondary"` | Submit button variant. Non-primary by default; pass `"primary"` to accent it. |
| `borderColor` | `string` | `var(--sf-color-border)` | Input field border colour. Neutral by default; pass e.g. `var(--sf-color-primary)` for the accented look. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 20)` | Container height. |
| `disabled` | `boolean` | n/a | Blocks submit (e.g. while streaming). |
| `reveal` | `false \| { mode?: "dramatic" \| "stream"; charIntervalMs?: number; tailLength?: number }` | n/a | How streaming assistant text is revealed. Omit for the default terminal reveal (dramatic, per-character). An object is forwarded to `StreamingTerminalText`: for a **live token stream**, pass `{ mode: "stream" }` so the text tracks the arriving tokens (only the shade tail shimmers) instead of lagging behind a fast source and then bursting at the end. `false` skips the reveal: streaming text renders as plain `Markdown`, landing exactly as tokens arrive (no shimmer). |

### Rich (non-text) responses

An assistant message can carry ordered **`parts`** instead of (or as well as) a single markdown `content` string. When `parts` is present it takes precedence; while streaming, only the trailing `text` part animates.

Built-in blocks render with a hard **terminal (TUI) aesthetic**: monospace, hairline-framed panels (`ChatBlock`), box-drawing tree guides, caret/`[x]` selection markers.

`ChatPart` is a union:

- `{ type: "text"; text }`: markdown (streams when it's the active block).
- `{ type: "choices"; prompt?; options: ChatChoice[]; multiple?; partId? }`: a terminal choice menu built on `Button` (monospace). Single-select shows a `›` caret on the hovered/focused row and submits on click; multi-select toggles `[x]`/`[ ]` and submits via Confirm. `ChatChoice` is `{ id, label, description?, value? }`, where `description` renders as a dim `# comment`. Selection → `onAction({ type: "choices", value })` (`value` is the choice id, or `string[]` when `multiple`).
- `{ type: "tree"; roots: ChatTreeNode[]; partId? }`: a decision / orchestration tree rendered as a terminal directory tree (ASCII `├─ └─ │` guides). `ChatTreeNode` is `{ id, label, children?, status? }`, where `status` (`"pending" | "running" | "done" | "error"`, = `ChatStepStatus`) shows a per-node glyph: a live `Spinner` while `running`, `✓`/`✗` when `done`/`error`. Node click → `onAction({ type: "tree", value: nodeId })`.
- `{ type: "thinking"; status: "running" | "done" | "error"; label?; steps?: ChatTreeNode[]; summary?; defaultExpanded?; partId? }`: an assistant "working on it" block, rendered as quiet de-emphasized text (70% opacity, no frame): a spinner header ("Thinking…") that **expands into the orchestration fan-out** (`steps`, a status tree) and collapses to `summary` (default `Ran N steps`) when `done`. **Omit `steps` for a bare thinking indicator** (just the spinner + label, no fan-out). Auto-expanded while running, auto-collapsed when `done`; click the header to toggle. Drive it by updating the message over time (like `isStreaming`). Node click → `onAction({ type: "thinking", value: nodeId })`.
- `{ type: "error"; message; requestId?; retryable?; partId? }`: a backend error (e.g. an overloaded/timeout response) shown as a small `NonIdealState`-style block with the `glitch` effect fill, the danger-toned `message`, an optional mono `requestId`, and a **Retry** when `retryable`. The app parses its raw payload into a clean `message`/`requestId` (Chat is display-only). `onError` fires once when it appears; Retry → `onAction({ type: "error", value: "retry" })`.
- `{ type: string; partId?; [key]: unknown }`: any custom micro-UI; rendered by `renderPart`. Wrap it in **`ChatBlock`** (`import { ChatBlock } from "@tarassov-ch/swiss-function/chat"`; props `{ title?, children }`) to match the built-in TUI frame.

`onAction` receives `{ messageId, partId?, type, value }`. `Chat` stays headless: the app decides what an interaction does (e.g. append the picked option as the next user turn and stream a reply).

```tsx
<Chat
  messages={[{
    id: "a1", role: "assistant",
    parts: [
      { type: "text", text: "Pick a template:" },
      { type: "choices", partId: "tpl", options: [
        { id: "react", label: "React app", description: "Vite + TS" },
        { id: "node", label: "Node service" },
      ] },
    ],
  }]}
  onSubmit={handleSubmit}
  onAction={(a) => append(a.value)}
/>
```

## ChatDrawer

`import { ChatDrawer } from "@tarassov-ch/swiss-function/chat-drawer"`

A composite: a `Chat` in a **resizable side panel that pushes the main content aside** (built on [SplitPane](#splitpane), a split, not an overlay). You pass the main app as `children`; the chat lives in the panel. While the agent is **thinking**, an animated `NonIdealState` effect blooms from the centre outward (starting from zero) and fills the padding gutter around the chat, then clears when thinking ends. `thinking` and `open` are controlled by the consumer.

The panel **header acts as an icon bar**: it always carries the fullscreen toggle and close button, and you can add your own icon buttons via `actions`. For more than a chat, pass `views`, a list of `{ id, icon, label, content }` (the `ChatDrawerView` shape), and the header renders one icon per view (built on [Tabs](#tabs)) while the body swaps to the active view. Chat is then just one view you supply (`content={<Chat … />}`); `messages`/`onSubmit` are ignored in `views` mode. Inactive views stay mounted, so a chat keeps its state while you're on another view. Give each view's content its own surface (e.g. an elevated `Chat`/`Box`) so it reads against the panel wash.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | n/a | The main app content (gets pushed; render your open/close toggle here). |
| `side` | `"left" \| "right" \| "top" \| "bottom"` | `"right"` | Edge the panel sits on. |
| `open` / `defaultOpen` / `onOpenChange` | n/a | n/a | Panel open state. |
| `title` | `ReactNode` | n/a | Caption shown at the left of the panel header. The header also carries a fullscreen toggle (pops the panel to a viewport overlay; Escape exits) and a close button (collapses the panel) on the right. |
| `resizable` | `boolean` | `true` | Drag the divider to resize; `false` = fixed panel, no divider. |
| `defaultSize` | `number` | `360` | Panel size in px (remembered across open/close). |
| `minSize` / `maxSize` | `number` | n/a | px clamps. |
| `onSizeChange` | `(px: number) => void` | n/a | Fired when a resize settles; persist it. |
| `padding` | `number \| string` | `1` | Gutter around the chat (the visible effect frame). `number` → `--sf-unit` multiples. |
| `thinking` | `boolean` | `false` | While true, the effect blooms behind the chat. |
| `onThinkingStart` / `onThinkingEnd` | `() => void` | n/a | Fired on the `thinking` false↔true transitions. |
| `effect` | `EffectName` | `"ripple"` | Background effect (any `NonIdealState` effect). |
| `color` | `string` | `var(--sf-color-primary)` | Effect colour (any CSS colour). |
| `speed` | `number` | `1` | Effect animation speed multiplier. |
| `cellSize` | `number` | `7` | Grain of the effect: shade-block size in px (square). Smaller = finer dither. |
| `wash` | `string \| false` | n/a | The always-on panel tint behind the chat. A CSS colour overrides it; `false` disables it. Default: a faint 7% wash of `color`. |
| `messages` / `onSubmit` / `onAction` / `onError` / `renderPart` / `placeholder` / `sendLabel` / `sendVariant` / `borderColor` / `reveal` | n/a | n/a | Passed through to the built-in `Chat`. `messages`/`onSubmit` are required **only** in default mode (no `views`). `reveal` tunes the streaming-text reveal (`{ mode: "stream" }` for a live token stream, `false` for plain Markdown). In `views` mode you render your own `Chat`, so pass `reveal` there directly. |
| `disabled` | `boolean` | `thinking` | Disables the input; defaults to locking while thinking. |
| `actions` | `ReactNode` | n/a | Extra icon buttons in the header, before the fullscreen/close pair. Works in both modes. |
| `views` | `ChatDrawerView[]` | n/a | Multi-view mode: one header icon per view; the body shows the active one. `ChatDrawerView` = `{ id: string; icon: ReactNode; label: string; content: ReactNode }`. |
| `activeView` / `defaultActiveView` / `onActiveViewChange` | n/a | first view | Active view id (controlled / uncontrolled / change callback). |

The container must have a height (e.g. `100vh`) so the split fills it. The bloom is a `clip-path` circle growing from the centre; under `prefers-reduced-motion` it appears without the grow transition.

```tsx
const [open, setOpen] = useState(true);
const [busy, setBusy] = useState(false);
<div style={{ height: "100vh" }}>
  <ChatDrawer
    open={open} onOpenChange={setOpen}
    thinking={busy}
    messages={messages}
    onSubmit={async (text) => {
      setBusy(true);
      push(await llm(text));
      setBusy(false);
    }}
  >
    <YourApp />            {/* gets pushed aside; put a toggle button in here */}
  </ChatDrawer>
</div>
```

## Checkbox

`import { Checkbox } from "@tarassov-ch/swiss-function/checkbox"`

Wraps Base UI's Checkbox with token styling. Extends `HTMLAttributes<HTMLButtonElement>` and Base UI Checkbox props (`checked`, `onCheckedChange`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth (`--sf-elevation-N`). |

## Chip

`import { Chip } from "@tarassov-ch/swiss-function/chip"`

A compact token: tag, filter, status marker, or removable selection. Renders a `<span>`; extends `HTMLAttributes<HTMLSpanElement>`. Sharp (2px) by default; reach for `round` only for the tag/badge reading. Neutral unless a `tone` gives the colour meaning.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tone` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger"` | `"neutral"` | Semantic colour. Use a tone only when the colour is information (status, priority), not decoratively. Tints surface, rim, and text from one accent (theme-aware via `color-mix`). |
| `size` | `"sm" \| "md"` | `"md"` | `md` is 1.25u tall; `sm` is 1u (aligns with a small `Button`). |
| `round` | `boolean` | `false` | Pill form (`--sf-radius-full`) instead of the sharp default. |
| `dot` | `boolean` | `false` | Leading status marker tinted to the tone: a small square, or a dot when `round`. |
| `onRemove` | `() => void` | n/a | Renders a keyboard-reachable ✕ button. Fires on click/Enter and stops propagation, so it won't also trigger the chip's `onClick`. |
| `removeLabel` | `string` | `"Remove"` | Accessible label for the ✕ button. |
| `onClick` | `MouseEventHandler` | n/a | When set, the whole chip becomes a button-like filter: `role="button"`, `tabIndex=0`, focus ring, and Enter/Space activation. |
| `disabled` | `boolean` | `false` | Dims the chip and blocks `onClick` and remove. |

```tsx
<Chip>design</Chip>                                  // neutral tag
<Chip tone="danger" dot>failed</Chip>                // status marker
<Chip round onRemove={() => drop(tag)}>{tag}</Chip>  // removable pill
<Chip round tone={active ? "primary" : "neutral"} onClick={toggle}>open</Chip>  // filter
```

The `--chip-accent` custom property is the single knob a tone sets; the dot, hover tint, and remove-button hover all derive from it, so a consumer override is one line.

## CodeEditor

`import { CodeEditor } from "@tarassov-ch/swiss-function/code-editor"`

A code editor, a thin wrapper over **CodeMirror 6**, themed entirely through `--sf-color-code-*` tokens (light/dark is the usual `[data-theme]` swap, never a JS branch), with opt-in Vim mode. All syntax themes are deliberately restrained (**no rainbow**): pick via `theme`: `minimal` (comments dimmed only), `bold` (weight/slant, no hue), or `primary` (adds the single brand accent on keywords/tags/links). The caret is a full-cell **block**. Bring your own language via `extensions` (e.g. `javascript()` from `@codemirror/lang-javascript`; language packages are peer/consumer-installed, none are bundled). The `EditorView` is created once and reconfigured in place via compartments, so undo history and cursor survive prop changes. Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`/`defaultValue`).

Auto-grows with content by default; give the root a `height` (via `style`/`className`) to fix its size and let it scroll. `CodeEditor` requires the `@codemirror/*` + `@replit/codemirror-vim` packages (declared dependencies, externalized like `react-markdown`); `sfCodeTheme` is also exported for advanced composition.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | n/a | Controlled document text. |
| `defaultValue` | `string` | `""` | Initial text when uncontrolled. |
| `onChange` | `(value: string) => void` | n/a | Fires with the full document on every edit. |
| `extensions` | `Extension[]` | `[]` | Language / feature extensions. **Memoize**: a new array each render reconfigures the editor. |
| `theme` | `"minimal" \| "bold" \| "primary"` | `"primary"` | Syntax theme (all restrained). `minimal` dims comments only; `bold` adds weight/slant; `primary` adds the brand accent. |
| `vim` | `boolean` | `false` | Enable Vim keybindings (`@replit/codemirror-vim`). |
| `readOnly` | `boolean` | `false` | Read-only (still selectable/focusable). |
| `editable` | `boolean` | `true` | Whether content is editable. |
| `placeholder` | `string` | n/a | Shown when empty. |
| `lineNumbers` | `boolean` | `true` | Line-number + fold gutter. |
| `lineWrapping` | `boolean` | `false` | Soft-wrap instead of horizontal scroll. |
| `tabSize` | `number` | `2` | Spaces per indent level. |
| `autoFocus` | `boolean` | `false` | Focus on mount. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth, same `--sf-elevation-N` scale as `Box`/`Input`. |
| `onCreateEditor` | `(view: EditorView) => void` | n/a | Receive the underlying CodeMirror `EditorView`. |

The palette lives in tokens: `--sf-color-code-{bg,fg,comment,accent,punctuation,cursor,gutter-fg,selection,active-line,matched-bracket}`: monochrome, so only `accent`/`cursor` carry the brand hue; every value rides a semantic token or `color-mix`, so dark mode needs no override.

## CodeEditorInline

`import { CodeEditorInline } from "@tarassov-ch/swiss-function/code-editor-inline"`

A `CodeEditor` that rests as a **single line** and expands to a full multi-line
editor on focus, the code sibling of [TextEditInline](#texteditinline). The
editor is always a live CodeMirror instance, so the collapsed first line shows
**syntax-highlighted** (a real preview, not a label) and undo/cursor survive
across expand/collapse. Expanded, it's absolutely positioned so it **floats
over** the content below (`elevation-3`) instead of pushing it down, grows with
the document up to `maxRows` (then scrolls) and is vertically resizable by drag
while active; blur collapses it back to one line.
Takes every `CodeEditor` prop (`value`/`onChange`/`extensions`/`theme`/…) plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Resting one-line height on the control ladder (≈ 1u / 1.5u / 2u); scales the code font + padding together. |
| `maxRows` | `number` | `12` | Max code lines the expanded overlay grows to before it scrolls. |
| `collapsedElevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `1` | Resting depth; the expanded overlay is always `elevation-3`. |
| `lineNumbers` | `boolean` | `false` | Default off for a one-liner (`true` shows the gutter in both states). |

The one-line and `maxRows` heights are measured from the live editor's line
height. Reach for this in dense forms/tables where a cell holds a short
expression that occasionally needs room to read.

## DataTable

`import { DataTable } from "@tarassov-ch/swiss-function/data-table"`

Virtualized, spreadsheet-style data grid (`DataTable<T>`). Extends `HTMLAttributes<HTMLElement>` (minus `children` / `onChange`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `T[]` | n/a | Rows. |
| `columns` | `ColumnDef<T>[]` | n/a | Column tree (leaves + groups). |
| `editable` | `boolean` | `false` | Click-to-edit + paste-to-update. Per-column via `edit`. An editable column with no custom `cell` renders its resting display the way its editor shows the value (boolean → `True`/`False`, select → the option's label, number → decimals + unit, date → ISO), so activating a cell doesn't jump the text. |
| `editOn` | `"single" \| "double"` | `"double"` | How editing starts on an editable cell. `"double"` = double-click / F2 / Enter; `"single"` also opens on a single click. Override per column (`LeafColumnDef.editOn`) or per cell (`getEditActivation`). |
| `getEditActivation` | `(ctx: { rowIndex; columnId; row }) => "single" \| "double" \| undefined` | n/a | Per-cell override for the edit trigger (wins over column + table). Return `undefined` to fall through. |
| `onCellChange` | `(changes: CellChange[]) => void` | n/a | Edit/paste committed; consumer updates `data`. |
| `copyWithHeaders` | `boolean` | `true` | Prepend the selected columns' header names as the first row when copying cells (Cmd/Ctrl+C), so a paste into a spreadsheet/doc is self-labelling. Set `false` for a values-only copy (e.g. pasting straight back into editable cells). A non-string (`ReactNode`) header copies as the column `id`. |
| `cellPadding` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` | Horizontal cell padding (the cell "margins"): 6 / 8 / 12 / 18px. Header + body. |
| `cellFontSize` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` | Cell text size: 12 / 13 / 14 / 16px. Header + body. Independent of `cellPadding`. |
| `onSelectionChange` | `(selection: Selection) => void` | n/a | Active cell / range changed. |
| `highlights` | `DataTableHighlight[]` | n/a | Persistent coloured range overlays (the Excel "coloured range reference" look: a light fill plus a solid border around the block). Each is `{ id?, range: CellRange, color?, label? }`. **Positional** (visible coordinates, like the selection and cell spans): a highlight marks a screen region and stays put when data is sorted or filtered. `color` is any CSS colour/token; omit it and colours cycle the semantic tokens by array position. Use several distinct colours to mark separate ranges (e.g. charting series). Declarative: to add one "with the mouse", capture the selection via `onSelectionChange` and push a highlight with a colour. |
| `paginate` | `PaginateConfig` | n/a | Opt into pagination instead of virtualization. |
| `rowHeight` | `number` | `36` | Px (matches `--sf-unit * 1.5`). |
| `height` | `number \| string` | `400` | Viewport cap; sizes to content when it fits. |
| `empty` | `ReactNode` | n/a | Empty-state slot. |
| `resizableColumns` | `boolean` | `true` | Drag/keyboard column resize; lock one via `resizable: false`. |
| `frozenColumns` | `number` | `0` | Freeze the first N leaf columns (pinned left while the rest scroll, the horizontal sticky-header analogue). Frozen columns keep a fixed width and don't shrink. A column group is pinned only when its whole span is inside the frozen region (a straddling group scrolls). |
| `scrollSnap` | `"none" \| "rows" \| "columns" \| "both"` | `"none"` | Proximity scroll-snap. |
| `edgeFade` | `boolean \| { rows?: number; density?: number }` | `false` | Dithered bottom-edge fade. `rows` = depth in rows (2), `density` = peak dot opacity 0 to 1 (1). |
| `columnFill` | `boolean \| { animated?: boolean; effect?: EffectName; color?: string; density?: number; speed?: number }` | `false` | Don't stretch the last column; keep columns fixed and fill the leftover space with a dither panel. `true` = static CSS dither; object opts into the animated WebGL dither / tunes it (`speed` is the animation rate, animated only). |
| `fillHeight` | `boolean` | `false` | Hold the full `height` even with too few rows (instead of shrinking to content), and dither the empty band below the last row — so a sparse table reads as one filled panel. Uses `columnFill`'s look when set, else a static dither; together with `columnFill` it fills both the right gutter and the bottom band. |
| `defaultColumnWidth` | `number` | `8` | Standard preferred width (in `--sf-unit` multiples) for columns without their own `width`. |
| `reorderableColumns` | `boolean` | `false` | Drag a leaf header to reorder columns (a leaf only moves within its own group). Click still sorts; the edge still resizes. |
| `filterableColumns` | `boolean` | `false` | Show a per-column header filter (funnel). Control type follows the column's `edit.type` (text/select/boolean/date → value checklist; number → min/max range). Exclude a column with `filterable: false`. Applies live. |
| `columnFilters` | `ColumnFiltersState` | n/a | Controlled filters (TanStack), with `onColumnFiltersChange`. |
| `defaultColumnFilters` | `ColumnFiltersState` | n/a | Uncontrolled initial filters. |
| `onColumnFiltersChange` | `(filters: ColumnFiltersState) => void` | n/a | Fired on each filter change. Persist to save it. |
| `columnOrder` | `string[]` | n/a | Controlled column order (leaf ids), with `onColumnOrderChange`. |
| `defaultColumnOrder` | `string[]` | n/a | Uncontrolled initial order (e.g. restored from storage). |
| `onColumnOrderChange` | `(order: string[]) => void` | n/a | Fired with the full order on each reorder. Persist to save it. |
| `columnWidths` | `Record<string, number>` | n/a | Controlled px width overrides by column id (with `onColumnWidthsChange`). |
| `defaultColumnWidths` | `Record<string, number>` | n/a | Uncontrolled initial px overrides (e.g. restored from storage). |
| `onColumnWidthsChange` | `(widths: Record<string, number>) => void` | n/a | Fired on resize/auto-fit. Persist it to "save" the user's widths. |
| `getCellSpan` | `CellSpanFn<T>` | n/a | Visually merge cells (return `{ rowSpan, colSpan }` at the lead cell). |
| `getSubRows` | `(row: T) => T[] \| undefined` | n/a | Tree rows. |
| `treeColumn` | `string` | first leaf | Column owning the tree chevron + indent. |
| `defaultExpanded` | `ExpandedState` | n/a | Initial expansion (`true` = all). |
| `expanded` / `onExpandedChange` | `Record<string, boolean>` / fn | n/a | Controlled expansion. |
| `columnGroupsCollapsed` / `onColumnGroupsCollapsedChange` | `Record<string, boolean>` / fn | n/a | Controlled column-group collapse. |

**ColumnDef** is `LeafColumnDef<T> | GroupColumnDef<T>`:
- Leaf: `id`, `header`, `accessor` (`keyof T | (row) => unknown`), `cell?`,
  `width?` (u), `minWidth?` (u, default 3), `resizable?`, `align?`
  (`start|center|end`), `edit?` (`EditConfig`), `editOn?` (`"single" | "double"`,
  overrides the table's `editOn`), `sortable?`, `filterable?`.
- Group: `id`, `header`, `columns`, `defaultCollapsed?`, `collapsedCell?`.
- `EditConfig`, the cell editor, keyed by `type`:
  - `{ type: "text" }` is a `TextEditInline` (the floating expand-on-focus editor;
    Enter commits, Shift+Enter inserts a newline).
  - `{ type: "number"; decimals?; slots?; unit? }` is a `DigitInputMicro`; the extra
    fields are forwarded to it. Commits a `number | null`.
  - `{ type: "boolean" }` is a two-option `Picker` (True / False); commits a `boolean`.
  - `{ type: "select"; options: { value; label }[] }` is a searchable single-choice `Picker`.
  - `{ type: "date"; minDate?; maxDate? }` is a `DatePicker`; commits a `Date`.
    Render the read view via the column's `cell` (e.g. ISO). Its header filter
    falls back to a value checklist over the stringified dates.

**Keyboard / selection:**
- With a selected cell, arrows move the active cell one cell and scroll it into
  view; Tab/Enter navigate Excel-style; Cmd/Ctrl+C/V copy/paste; Cmd/Ctrl+A
  selects all.
- With **no** selected cell, arrows scroll the viewport exactly one row / one
  column, snapped to the row-height grid and leaf-column boundaries.
- The range tint is a translucent overlay painted *on top* of cell content, so a
  consumer-set cell background never hides the highlight.

```tsx
<DataTable data={rows} columns={columns} scrollSnap="rows"
           edgeFade={{ rows: 4, density: 0.6 }} />
```

## DatePicker

`import { DatePicker } from "@tarassov-ch/swiss-function/date-picker"`

Date input + calendar popup, ISO 8601 by default: the field renders `YYYY-MM-DD`, weeks start on Monday, week numbers are ISO. The text field is the primary control: typing narrows the calendar (`2026-07` jumps to July; `2026-07-1` highlights the 1st and 10th to 19th; `12 jul`, `12/7` and `12.7.2026` parse **day-first, never month-first**; `today`/`tomorrow`/`yesterday`/`+7`/`-3` work) and Enter commits the candidate echoed in the popup footer. The grid is keyboard-navigable from the field via ArrowDown (arrows move by day/week, PageUp/PageDown by month, Shift+PageUp/PageDown by year, Home/End to week bounds, Enter selects). Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `Date \| null` | n/a | Selected date (controlled; pair with `onChange`). |
| `defaultValue` | `Date \| null` | n/a | Initial selection (uncontrolled). |
| `onChange` | `(date: Date \| null) => void` | n/a | Fires on commit or clear. |
| `placeholder` | `string` | `"YYYY-MM-DD"` | Field placeholder. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Field size, mirrors `Input`. |
| `disabled` | `boolean` | `false` | Disable the control. |
| `clearable` | `boolean` | `true` | × button once a date is selected. |
| `minDate` / `maxDate` | `Date` | n/a | Inclusive selectable range (day granularity). |
| `isDateDisabled` | `(date: Date) => boolean` | n/a | Per-day veto on top of min/max; disabled days are struck through and skipped by keyboard nav. |
| `showWeekNumbers` | `boolean` | `false` | ISO week numbers in a leading column. |
| `formatValue` | `(date: Date) => string` | ISO `YYYY-MM-DD` | Custom display format for the committed value; parsing still accepts ISO and day-first fragments. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | flat | Resting depth of the field (`--sf-elevation-N`). |
| `aria-label` | `string` | n/a | Accessible name when not wrapped in a `Field`. |

## Dialog

`import { Dialog } from "@tarassov-ch/swiss-function/dialog"`

Compound modal dialog with optional dragging, resizing, and window chrome
(maximize / close). Wraps Base UI's Dialog.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Backdrop`, `Popup`, `Handle`
(drag grip + title-bar row, active only in a draggable Popup), `Actions`
(right-aligned chrome-button row, place inside `Handle`), `Maximize` (icon button
that toggles fullscreen), `Title`, `Description`, `Close` (Base UI close, render
your own button), `CloseButton` (pre-styled icon ✕).

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `draggable` | `Popup` | `boolean` | n/a | Drag by `Handle`; sets `--sf-dialog-x` / `--sf-dialog-y`. |
| `resizable` | `Popup` | `boolean` | n/a | Resize from any edge or corner; the opposite edge stays anchored. Arrow keys adjust the focused (SE) grip, Escape exits. |
| `defaultWidth` | `Popup` | `number` | n/a | Initial width in px (else content-driven, capped at 32rem). A resize takes over. |
| `defaultHeight` | `Popup` | `number` | n/a | Initial height in px (else content-driven, capped at viewport). A resize takes over. |

`Maximize` reads the Popup's fullscreen state from context (so it must live
inside a `Popup`); while maximized the Popup fills the viewport (`inset: 0`), drag
and resize are suspended, and the geometry restores on toggle-off. `Maximize` /
`CloseButton` swallow pointer-down, so placing them in a draggable `Handle` never
starts a drag. Fullscreen state is internal and resets each time the dialog
reopens.

## DigitInput

`import { DigitInput } from "@tarassov-ch/swiss-function/digit-input"`

Fixed-capacity numeric input rendered as individual digit cells (`[0][4][2].[5][0] %`) with two typing models. **`mode="push"`** (default, calculator): the whole control is one focus target (a hidden real input overlays the cells), digits push in from the right, always leaving a complete number; no per-cell cursor. **`mode="mask"`** (2FA style, built on Base UI's OTPField): each cell is a focus stop, typing fills left-to-right with auto-advance, Backspace steps back, and the value stays `null` until every cell is filled. Untouched, both show a faded `_` mask and report `null`. With `decimals={0}` and no `unit` it doubles as a numeric PIN/code input. Extends `HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `digits` | `number` | n/a | Integer places. The capacity is the input's contract; max value is all-nines. |
| `decimals` | `number` | `0` | Decimal places. |
| `mode` | `"push" \| "mask"` | `"push"` | Typing model: calculator vs 2FA-cell (see above). Not meant to change at runtime (a flip remounts the control). |
| `decimalSeparator` | `ReactNode` | `"."` | Display glyph only. The form/clipboard value always uses `"."`. |
| `unit` | `ReactNode` | n/a | Suffix inside the control (e.g. `"%"`). String units join `aria-valuetext`. |
| `signed` | `boolean` | `false` | Allow negatives: a leading `+`/`-` cell (click to toggle, or type `-`/`+`), ArrowDown crosses zero, and the value + form string carry the sign. **`push` mode only** (mask has no sign position; dev-warns and ignores it there). |
| `value` / `defaultValue` / `onValueChange` | `number \| null` | `null` | `null` = pristine mask. Reported values are always complete (untyped positions are 0). Controlled values clamp to capacity + round to `decimals` (dev-warn on clamp). With `signed`, a negative value shows the minus; without it, negatives clamp to 0. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Cell heights 1u / 1.5u / 2u (Input parity). |
| `elevation` | `0` to `5` | `2` | Resting cell depth, cascading to every cell. |
| `name` | `string` | n/a | Form participation; submits the canonical string (e.g. `"4.25"`). |

Keyboard (`push`): **0 to 9** push in from the right; **Backspace** pops (last digit → pristine `null`); **Delete** clears to pristine in one keystroke; **ArrowUp/Down** step ±1 least-significant unit, clamped to `[0, max]` (from pristine: down → 0, up → 1 ulp); Enter/Tab/Escape pass through (form submit, Field validation). Typing at full significant capacity is ignored. No wheel handling (deliberate). Paste/autofill parse free-form text (`"42 %"`, `"1,234.56"`, comma separators); a leading `-` in pasted text sets the sign when `signed`, otherwise negatives clamp to 0. With `signed`, `-`/`+` set the sign, ArrowDown steps below zero, and the ± magnitude clamps to capacity in both directions.

Keyboard (`mask`): OTPField's native model: typing fills the focused cell and advances, Backspace clears and steps back, ArrowLeft/Right move between cells; there is no ulp stepping. Paste is decimal-aware: text containing a separator (`"12.34"`) fills positionally (→ `012.34`), plain digit strings fill left-to-right like typing.

The hidden input is `role="spinbutton"` with `aria-valuemin/max/now/valuetext` (typing is intercepted, so spinbutton value announcements are the reliable screen-reader channel). Works inside `Field`: label and description wire to the hidden input automatically. Focus is indicated by the least-significant cell rendering as an inverse-video block caret, and there is deliberately **no** focus ring (an exception to the `--sf-focus-ring-*` convention; the caret is the indicator). The changed cell gets one `--sf-ease-snap` micro-pop per edit; disabled under `prefers-reduced-motion`.

```tsx
<DigitInput digits={3} decimals={2} unit="%" onValueChange={setPct} />
<DigitInput digits={4} decimals={2} decimalSeparator="," unit="CHF" />
<DigitInput digits={6} />  {/* numeric PIN entry */}
```

## DigitInputMicro

`import { DigitInputMicro } from "@tarassov-ch/swiss-function/digit-input-micro"`

A regular, **variable-length** numeric input that shows a few faded placeholder
digit slots at rest and fills them left-to-right as you type (the "mask" hint),
but never caps length: type past the slots and the number just grows. The lighter
sibling of `DigitInput` (a fixed-capacity grid of digit cells): this is a single,
ordinary text input, so caret, selection, backspace and paste are all native.
Value is `number | null` (`null` while empty or holding an incomplete number like
a lone `-` or `.`). Reach for this for numeric cells/fields where the width is a
hint, not a contract; reach for `DigitInput` when the capacity IS the contract
(PINs, fixed-width amounts). Extends `HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `slots` | `number` | `4` | Faded placeholder digit slots shown at rest; they recede as you type. Purely a hint: the field is variable-length. |
| `decimals` | `number` | `0` | `0` is integer-only; `> 0` permits one decimal point, capped to this many places. |
| `unit` | `ReactNode` | n/a | Suffix rendered inside the control after the digits (e.g. `"%"`). |
| `placeholderChar` | `string` | `"░"` | Glyph used for the empty slots: a dithered shade block by default (matches the library's dither vocabulary). |
| `value` / `defaultValue` / `onValueChange` | `number \| null` | `null` | Lossy-controlled: an incomplete draft (`"1."`) stays local until `value` reports a different number. |
| `min` / `max` | `number` | n/a | Bounds; clamp on blur. A negative or absent `min` also enables typing a leading `-`. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Heights 1u / 1.5u / 2u (Input parity). |
| `elevation` | `0` to `5` | `2` | Resting depth. |
| `name` | `string` | n/a | Form participation; submits the canonical numeric string. |

Non-numeric characters are rejected; a second decimal point and extra decimal
places are dropped. Focus is shown by the frame highlighting (border → primary),
mirroring `Input`, the same input-family convention. Works inside `Field`. The
placeholder slots use `Input`'s `::placeholder` strength; block caret via
`caret-shape: block`. `prefers-reduced-motion` disables the frame transition.

```tsx
<DigitInputMicro slots={4} onValueChange={setQty} />       {/* integer */}
<DigitInputMicro slots={4} decimals={2} unit="%" />        {/* percentage */}
<DigitInputMicro slots={3} min={0} max={100} />            {/* bounded */}
```

## Drawer

`import { Drawer } from "@tarassov-ch/swiss-function/drawer"`

A panel that slides in from the left, right, or bottom edge. Wraps Base UI's
Drawer (slide, swipe-to-dismiss, focus/a11y); **non-modal by default** so the page
stays interactive.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Backdrop`, `Popup`,
`Viewport`, `Content`, `SwipeArea`, `Title`, `Description`, `Close`.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `side` | `Root` | `"left" \| "right" \| "bottom"` | `"right"` | Edge to slide from (maps to Base UI `swipeDirection`). |
| `modal` | `Root` | `boolean \| "trap-focus"` | `false` | `true` adds a backdrop + focus trap. |
| `open` / `defaultOpen` / `onOpenChange` | `Root` | n/a | n/a | Base UI open-state API. |

Render a `Drawer.SwipeArea` (a grab rail pinned to the edge) **outside the
`Portal`** for an optional persistent handle that stays visible while closed and
reopens on swipe/drag. Panel size is set on `Drawer.Popup` (default 18u wide /
16u tall); put a `<Pane>` inside `Drawer.Content` for a header + scrollable body.

## Dropzone

`import { Dropzone } from "@tarassov-ch/swiss-function/dropzone"`

Drag-and-drop file zone (with click-to-browse) that surfaces chosen files and renders them as a removable list. Presentational only: the actual upload (network, progress) is the consumer's job; feed per-file state back via `fileStatus`. Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `files` | `File[]` | n/a | Controlled list (pass with `onFilesChange`). |
| `defaultFiles` | `File[]` | `[]` | Uncontrolled initial list. |
| `onFilesChange` | `(files: File[]) => void` | n/a | Fired with the full list after drop / browse / remove. |
| `accept` | `string` | n/a | Forwarded to the native input (e.g. `"image/*,.pdf"`). |
| `multiple` | `boolean` | `true` | When `false`, a new pick replaces the list. |
| `disabled` | `boolean` | n/a | Disable the control. |
| `label` | `ReactNode` | `"Drop files here"` | Primary prompt. |
| `description` | `ReactNode` | `"or click to browse"` | Secondary line. |
| `icon` | `ReactNode` | `"⤓"` | Glyph above the label. |
| `showList` | `boolean` | `true` | Render the built-in removable file list. |
| `fileStatus` | `(file: File, index: number) => ReactNode` | n/a | Per-file trailing slot (progress/error). |

Files dedupe by name + size + lastModified. Drag-over and keyboard focus share the accent treatment.

## Explorer

`import { Explorer } from "@tarassov-ch/swiss-function/explorer"`

Virtualized tree grid (`Explorer<M>`) with drag-to-reorder, rename-in-place, and a context menu. It also carries the DataTable-style column affordances that fit a tree: **column sorting, filtering, resizing, reordering**, an empty state, and a dithered edge-fade. Fully controlled. Keyboard: arrows, Cmd/Ctrl+A, Delete, F2/Enter to edit.

Sorting reorders each folder's children in place (hierarchy preserved, like Finder); filtering keeps the path to every match and auto-expands it. Reorder drag is ignored while a sort is active.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `nodes` | `ExplorerNode<M>[]` | n/a | Root nodes; a node is a folder iff `children` is defined (even `[]`). |
| `columns` | `ExplorerColumn<M>[]` | n/a | First column becomes the tree column (chevron + indent + name). |
| `selectedIds` | `Set<string>` | `new Set()` | Controlled selection. |
| `onSelectionChange` | `(ids: Set<string>) => void` | n/a | Click / Shift-range / Ctrl-toggle / Cmd-A. |
| `expandedIds` | `Set<string>` | `new Set()` | Controlled expansion. |
| `onExpandedChange` | `(ids: Set<string>) => void` | n/a | Chevron click or Left/Right arrow. |
| `editingId` | `string \| null` | `null` | Controlled edit mode (one row at a time). |
| `onEditingChange` | `(id: string \| null) => void` | n/a | Double-click or F2/Enter. |
| `editable` | `boolean` | `false` | Enable context menu, DnD, rename, add, delete. |
| `onRename` | `(id, newName) => void` | n/a | Rename committed. |
| `onAdd` | `(parentId: string \| null, kind: "file" \| "folder") => void` | n/a | From context menu (null = root). |
| `onMove` | `(id, newParentId, beforeId?) => void` | n/a | Drag drop; `beforeId` for order, null = append. |
| `onDelete` | `(ids: string[]) => void` | n/a | Context menu or Delete/Backspace. |
| `resizableColumns` | `boolean` | `false` | Drag column borders to resize. Widths are **raw px** (unlike DataTable's `--sf-unit` multiples). |
| `columnWidths` / `defaultColumnWidths` | `Record<string, number>` | n/a | Controlled / initial px width overrides, keyed by column id. |
| `onColumnWidthsChange` | `(widths) => void` | n/a | Fires on resize; persist for sticky widths. |
| `reorderableColumns` | `boolean` | `false` | Drag metadata headers to reorder. The tree column stays pinned at index 0. |
| `columnOrder` / `defaultColumnOrder` | `string[]` | n/a | Controlled / initial order, **non-tree column ids only** (the tree id is never included). |
| `onColumnOrderChange` | `(order) => void` | n/a | Fires on reorder. |
| `sort` / `defaultSort` | `ExplorerSort \| null` | `null` | `{ columnId, dir: "asc" \| "desc" }`. Header click cycles asc → desc → off. |
| `onSortChange` | `(sort) => void` | n/a | Fires on header click. |
| `sortFoldersFirst` | `boolean` | `true` | Keep folders above files within each sibling group when sorting. |
| `filterableColumns` | `boolean` | `false` | Show per-column filter funnels (checklist or numeric range, inferred from values). |
| `columnFilters` / `defaultColumnFilters` | `ColumnFiltersState` | `[]` | Controlled / initial filters (`{ id, value }[]`). |
| `onColumnFiltersChange` | `(filters) => void` | n/a | Fires on filter change. |
| `icon` | `(node) => ReactNode` | n/a | Override the per-node glyph. |
| `showHeader` | `boolean` | `true` | Column header row. |
| `empty` | `ReactNode` | `"No data"` | Shown when there are no rows (empty `nodes` or a filter pruned everything). |
| `edgeFade` | `boolean \| { rows?, density? }` | `false` | Dithered fade at the bottom scroll edge. |
| `gridLines` | `boolean` | `false` | Spreadsheet look: every body cell draws its own right + bottom hairline (the same per-cell edge model as DataTable). |
| `cellPadding` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` | Horizontal cell padding (the cell "margins"): 6 / 8 / 12 / 18px. Header + body. |
| `cellFontSize` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` | Cell text size: 12 / 13 / 14 / 16px. Header + body. Independent of `cellPadding`. |
| `columnFill` | `boolean \| { animated?, effect?, color?, density?, speed? }` | `false` | Dither filler right of fixed-width columns; a no-op when the last column already stretches (the default). |
| `rowHeight` | `number` | `32` | Px (≈ `unit * 4/3`). |
| `height` | `number \| string` | `"100%"` | Viewport height; number = px, string = CSS. |

**`ExplorerColumn<M>`** adds per-column: `minWidth` (px, resize floor, default 48), `resizable` (default true), `sortable`, `sortType` (`"string" \| "number" \| "date"`, inferred otherwise), `sortComparator` (full override), `filterable` (default true when filtering is on), and `filter` (`{ kind, options? }` to force the filter UI instead of inferring it).

## Field

`import { Field } from "@tarassov-ch/swiss-function/field"`

Compound form field with label, description, and error. Wraps Base UI's Field.

**Elements / Parts:** `Root`, `Label` (shows `*` when `required`), `Description`
(supplementary copy below the control, full-strength `--sf-color-fg`, never grey),
`Error` (in the danger colour; Base UI renders nothing when valid).

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `orientation` | `Root` | `"vertical" \| "horizontal"` | `"vertical"` | Stack vs side-by-side. |
| `required` | `Root` | `boolean` | `false` | Visual `*` on Label; add `required` to the control for HTML validation. |
| `hotkey` | `Root` | `string` | n/a | "Jump to this field" shortcut (issue #32). Renders a `Kbd` badge in the corner (uses the `Kbd` combo syntax, e.g. `"mod+e"`, `"g u"`) and tags the field with `data-hotkey`. Field binds **no key itself**: your app's central hotkey system handles the press and calls `focusFieldHotkey(combo)` (or focuses the control via your own ref). |

`Field.Description` and `Field.Error` wire to the control via `aria-describedby`. Write the description **right after the control it explains**.

`focusFieldHotkey(combo, root = document)` (also exported from the package root) is a pure helper for the "jump" side: it finds the `[data-hotkey="combo"]` field under `root`, focuses its first focusable control, and returns whether it did. Call it from your own shortcut layer. The library owns no keyboard listener.

## FieldLayout

`import { FieldLayout } from "@tarassov-ch/swiss-function/field-layout"`

Justified form rows of rigid / flexible / filler fields. A form is Sections; a Section is a `flex-wrap` container whose wrapped lines *are* the rows: each line justifies (fills the left padding to the right padding) because the flexible fields and fillers in it grow, and because it is flex-wrap (not grid auto-flow) fields keep **strict source order** and never migrate between lines. Narrowing the container simply carries fewer fields per line, a gradual collapse with no breakpoints, driven by the container, not the viewport. Layout is pure CSS; no ResizeObserver.

**Elements / Parts:** `FieldLayout` (Root: padding + section stacking), `FieldLayout.Section` (a justified `flex-wrap` group; hierarchy comes from the 2u/1u rhythm, no headings), `FieldLayout.Field` (label + control + optional hint), `FieldLayout.Filler` (absorbs slack; optional visible dither).

Compose each intended row with at least one grower (a flexible field, a rigid field *with a hint*, or a `Filler`) so it can always justify.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `padding` | `Root` | `number` | `1` | Padding around the sections, in `--sf-unit` multiples. |
| `kind` | `Field` | `"flexible" \| "rigid" \| "prose" \| "filler"` | `"flexible"` | `rigid` holds a whole-unit width; `flexible` flexes min 10u / basis 14u / max 36u; `prose` = basis 20u, grow 3, no max; `filler` absorbs slack. |
| `label` | `Field` | `ReactNode` | n/a | Rendered above the control and wired to it via `aria-labelledby` (so composite controls like `DatePicker` take the label as their accessible name instead of a placeholder). |
| `hint` | `Field` | `ReactNode` | n/a | Text beside the control (below it when narrow). Renders as the row's inner filler: it justifies a rigid control's line and wraps beneath last. |
| `width` | `Field` | `number` | `8` | Fixed width for `rigid`, in units. |
| `preferred` / `min` / `max` / `grow` | `Field` | `number` (`max`: `number \| false`) | per-kind | Override the kind's flex-basis / min / max / grow (all in units; `max={false}` = none). |
| `dither` | `Filler` | `boolean \| EffectName` | `false` | Show a console-style dither instead of blank space; a string picks a specific effect. Reduced motion draws a single static frame. |
| `min` | `Filler` | `number` | `10` | Min inline size before it wraps away, in units. |

The **36u flexible ceiling** is deliberately above the widest row a field can end up alone in (its basis + gap + the next field's min), so a lone field still justifies instead of leaving dead space at the row's end; the genuinely-sparse case (a lone field on a wide screen) is composed with an explicit `Filler`.

A resizable control inside a `Field` (e.g. `TextEdit`, which paints at a half-unit-off height) is snapped to a whole-unit height on first paint and again after a drag settles.

## Flows

`import { Flows } from "@tarassov-ch/swiss-function/flows"`

Per-period fund-flow ribbon (issue #36): each period is a within-period waterfall: `open` → subscriptions (up) → redemptions (down) → performance (±) → fxEffect (±) → closing AUM, and the periods connect close→open into one continuous stepped AUM ribbon. The compact, candle-like read of how subscriptions, redemptions, performance and FX move a fund's AUM over time. Mixes in the shared `ChartScaffoldingProps` (frame/fullscreen/controls/zoom/annotations/labels/posture, issue #35). Extends `HTMLAttributes<HTMLDivElement>`.

`FlowPeriod = { x: number | string | Date; open: number; subscriptions?; redemptions?; performance?; fxEffect? }`. Subscriptions/redemptions are **magnitudes** (≥0) drawn up/down; performance/fxEffect are **signed**. Closing AUM is derived; omitted components draw no segment.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `periods` | `FlowPeriod[]` | n/a | One entry per period, chronological. Set each period's `open` to the previous period's closing AUM for a continuous ledger. |
| `yDomain` | `[number, number]` | auto-fit | AUM range (auto-fits across every open/close/step level). While zoomed, the value axis follows this extent. |
| `xLabel` / `yLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `colors` | `FlowColors` | success/danger/primary/warning | Per-component fill overrides (`{ subscriptions?, redemptions?, performance?, fxEffect? }`). |
| `showConnectors` | `boolean` | `true` | Dashed ribbon connectors (open marker, step links, close→open). |
| `showLegend` | `boolean` | `true` | Legend of the components present. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. |
| `zoomable` | `boolean` | `false` | Interactive **value-axis (AUM) zoom**: x is per-period, so wheel/drag/`↑`/`↓`/`+`/`-`/`0` window the AUM axis; toolbar marquee zooms to a band. |
| `zoomOutLimit` | `number` | `1` | How far zoom-out may go **past** the data, as a multiple of the AUM span; `Infinity` = arbitrary. `1` stops at the data. Reset still returns to the data. |
| `onValueDomainChange` | `(domain: [number, number] \| null) => void` | n/a | Fires on every AUM zoom/pan (`null` = full range). |
| `annotations` / `onAnnotationsChange` | `ChartAnnotation[]` / `(a) => void` | n/a | Data-anchored overlays (see Scatterplot); an `hline` is the natural reference level. `x` anchors to a fractional period index. The change handler (with `controls`) enables editing. |
| `controls` | `boolean` | `false` | On-chart toolbar (zoom + annotation tools). |
| `fullscreen` | `boolean` | `false` | Maximize-to-viewport toggle; Escape exits. |
| `frame` | `boolean` | `false` | 1px structural border + padding. |
| `renderTooltip` | `(datum: FlowTooltipDatum) => ReactNode` | default formatter | Receives the period, component, signed delta and resulting AUM level. |

For a single-total decomposition across categories (not per-period), use `BridgeChart`; for OHLC price bars, `CandlestickChart`.

## Form

`import { Form, FormField, FormError } from "@tarassov-ch/swiss-function/form"`

The layer above `Field` / `FieldLayout` (issue #49): form-level submit + validation wiring and error surfacing. Wraps Base UI's Form (consolidated per-field errors, native constraint validation) and our `Field`. **Headless about the validation library**: bring your own `resolver` (adapt Zod / Valibot / react-hook-form into the `(values) => errors` shape). Renders a `<form>`.

**Elements / Parts:** `Form` (Root: orchestration + vertical rhythm), `FormField` (binds one control to a named field; renders label + control + description + live error), `FormError` (a form-level message, a submit error not tied to any single field).

Validation runs in two tiers, and both feed the same error display:

- **Per-field**: `FormField`'s `validate` (and the browser's native constraints, e.g. `type="email"`, `required`) run per `validationMode`. Native constraint failures block submit *before* the resolver runs.
- **Whole-form**: `Form`'s `resolver` runs on submit once per-field validation passes; it's the place for cross-field checks (password confirmation, "at least one of…"). It gates `onSubmit`.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `onSubmit` | `Form` | `(values) => void \| Promise<void>` | n/a | Called with the collected values (keyed by field `name`) only when per-field validation **and** the `resolver` pass. |
| `resolver` | `Form` | `(values) => FormValidationResult \| null \| Promise<…>` | n/a | Whole-form validation. Return `{ fields?, form? }` to block the submit (`fields` keyed by `name`, `form` = a form-level message), or a falsy value to let it through. Sync or async. |
| `errors` | `Form` | `Record<string, string \| string[]>` | n/a | Per-field errors supplied from outside (e.g. a server response), keyed by `name`. Merged with resolver output; each clears when its field changes. |
| `error` | `Form` | `ReactNode` | n/a | A controlled form-level message surfaced by `FormError`; takes precedence over the resolver's `form`. |
| `validationMode` | `Form` | `"onSubmit" \| "onBlur" \| "onChange"` | `"onSubmit"` | When per-field `validate` runs (Base UI passthrough; a `FormField`'s own `validationMode` overrides). |
| `name` | `FormField` | `string` | n/a | **Required.** Identifies the field on submit and keys its error. |
| `label` / `description` | `FormField` | `ReactNode` | n/a | Label above (or beside) the control; supplementary copy below it (full-strength `--sf-color-fg`). |
| `validate` | `FormField` | `(value, formValues) => string \| string[] \| null \| Promise<…>` | n/a | Per-field validation (Base UI Field signature). |
| `orientation` | `FormField` | `"vertical" \| "horizontal"` | `"vertical"` | Stack label above, or beside (for a `Switch` / `Checkbox` row). |
| `children` | `FormField` | `ReactNode` | n/a | The control, an `Input`, `DigitInput`, `DatePicker`, `Checkbox`, … |
| `children` | `FormError` | `ReactNode` | n/a | Overrides the message; omit to show the form-level message from the enclosing `Form`. Renders nothing when there's no message; carries `role="alert"`. |

**Composes with `FieldLayout`** for justified multi-column forms: wrap each `FormField` in a `FieldLayout.Field` cell: the layout owns the sizing, the `FormField` owns the label / control / error and the form binding.

```tsx
<Form
  resolver={(v) => (v.password === v.confirm ? null : { fields: { confirm: "Passwords don't match." } })}
  onSubmit={(values) => save(values)}
>
  <FormError />
  <FormField name="email" label="Email" validate={(v) => (String(v).includes("@") ? null : "Invalid email.")}>
    <Input />
  </FormField>
  <FormField name="password" label="Password"><Input type="password" /></FormField>
  <FormField name="confirm" label="Confirm"><Input type="password" /></FormField>
  <Button type="submit">Create account</Button>
</Form>
```

For a single labelled row without form-level orchestration, drop to `Field`; for the justified whole-form layout primitive, see `FieldLayout`.

## Fullscreen

`import { Fullscreen, FullscreenToggle } from "@tarassov-ch/swiss-function/fullscreen"`

Container that toggles into a fixed CSS viewport overlay (not OS fullscreen); Escape exits. `FullscreenToggle` is a reusable corner icon button.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `expanded` | both | `boolean` | n/a | Controlled state. |
| `defaultExpanded` | `Fullscreen` | `boolean` | `false` | Uncontrolled initial state. |
| `onExpandedChange` | `Fullscreen` | `(expanded: boolean) => void` | n/a | Button click or Escape. |
| `onToggle` | `FullscreenToggle` | `() => void` | n/a | Button click. |
| `buttonPosition` / `position` | `Fullscreen` / `Toggle` | `"top-right" \| "top-left" \| "bottom-right" \| "bottom-left"` | `"top-right"` | Corner. |

## Graph

`import { Graph } from "@tarassov-ch/swiss-function/graph"`

Network graph (Sigma.js) with force/tree/radial/concentric/grid layouts and optional drag-to-connect editing.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `GraphData` | n/a | `{ nodes, edges }` with arbitrary per-item data. |
| `layout` | `LayoutKind` | n/a | Controlled layout (animated transition on change). |
| `defaultLayout` | `"force" \| "tree" \| "radial" \| "concentric" \| "grid"` | `"force"` | Uncontrolled initial layout. |
| `onLayoutChange` | `(next: LayoutKind) => void` | n/a | Layout changed (prop/toolbar/keyboard). |
| `onNodeClick` / `onEdgeClick` | `(id: string) => void` | n/a | Clicks (edges clickable when `editable` or this is set). |
| `onSelectionChange` | `(id: string \| null) => void` | n/a | Selected node id. |
| `renderNode` / `renderEdge` | `(item) => NodeVisual \| EdgeVisual \| undefined` | n/a | Override visual attrs; omitted fields use defaults. |
| `onNodeContextMenu` | `(id, event) => void` | n/a | Before right-click menu opens. |
| `contextMenuItems` | `(target: GraphMenuTarget) => GraphMenuItem[]` | n/a | Custom menu (`[]` suppresses). |
| `editable` | `boolean` | `false` | Connect-mode edge creation + deletion. |
| `onEdgeCreate` | `({ id, source, target }) => void` | n/a | Connect drag completed. |
| `onEdgeDelete` | `(id: string) => void` | n/a | Edge deleted (menu/keyboard). |
| `generateEdgeId` | `() => string` | `edge-UUID`/counter | Custom edge id. |
| `fullscreen` | `boolean` | `true` | Corner fullscreen toggle. |
| `defaultFullscreen` | `boolean` | `false` | Uncontrolled fullscreen. |
| `onFullscreenChange` | `(expanded) => void` | n/a | Maximized/restored. |
| `fill` | `boolean` | `false` | Fill parent height (parent must set height). |
| `frame` | `boolean` | `true` | Border + corner; false when nested in a frame. |

**Scale gates** (automatic, from the live graph size): node/edge labels render
only up to 300 nodes. Above 5,000 edges, edges are hidden while the camera is
moving (they reappear at rest) and arrowheads are dropped, edges render as
thickness-preserving quads when interactive (`editable` or `onEdgeClick`), else
as 1-device-pixel GL lines: thickness then ignores per-edge `size` *and* zoom,
and hover/selection emphasis degrades to color-only. Above 2,000 nodes the
`force` layout settles in a background worker, the graph is interactive at its
seed positions immediately and the layout streams in (one final snap instead
under `prefers-reduced-motion`).

**Elements / Parts:** `Graph.Controls` (zoom/fit/reset/layout/Connect toolbar),
`Graph.Minimap` (viewport overlay).

## Grid

`import { Grid } from "@tarassov-ch/swiss-function/grid"`

CSS-Grid layout wrapper with unit-scaled templates/gaps and optional draggable track resizing.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `columns` | `number \| string \| (number \| string)[]` | n/a | `number` → `repeat(N, minmax(0, 1fr))`; `string` → raw template; `array` → joined tracks. |
| `rows` | `number \| string \| (number \| string)[]` | n/a | Same shape, for rows. |
| `areas` | `string[]` | n/a | `grid-template-areas` row strings. |
| `gap` / `columnGap` / `rowGap` | `number \| string` | n/a | `number` → `--sf-unit` multiples; `string` → raw CSS. |
| `flow` | `"row" \| "column" \| "dense" \| "row dense" \| "column dense"` | n/a | `grid-auto-flow`. |
| `autoColumns` / `autoRows` | `string` | n/a | `grid-auto-columns` / `-rows`. |
| `alignItems` / `justifyItems` / `alignContent` / `justifyContent` | `CSSProperties[...]` | n/a | Alignment. |
| `inline` | `boolean` | `false` | `inline-grid` instead of `grid`. |
| `resizable` | `boolean \| "columns" \| "rows" \| "both"` | `false` | Draggable track boundaries. |
| `minTrackSize` | `number` | `48` | Min track px during resize. |
| `onTrackSizesChange` | `(axis, sizes: number[]) => void` | n/a | Resize settled (drag end / key / double-click reset). |
| `render` | `RenderProp` | `<div />` | Base UI render prop. |

**Elements / Parts:** `Grid.Item` occupies cells via `area`, `col`/`row`, or
`colSpan`/`rowSpan`.

## Heatmap

`import { Heatmap } from "@tarassov-ch/swiss-function/heatmap"`

2D heatmap of a gridded field `z = f(x,y)` (SVG filled cells) with an optional
marching-squares contour overlay. The flat, Swiss-friendly read of a 2-variable
field; reach for this before a 3D `Surface`. Shares the `GridData` shape
(`{ x: number[]; y: number[]; z: number[][] }`, `z[j][i]` at `x[i]`,`y[j]`) with
`Surface`. Mixes in the shared `ChartScaffoldingProps` (frame/fullscreen/controls/zoom/annotations/labels/posture, issue #35). Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `GridData` | n/a | The gridded values. |
| `zDomain` | `[number, number]` | data min/max | Value range for the color ramp. |
| `colorScale` | `[string, string]` | primary tint → primary | `[low, high]` ramp colors (any CSS color / token). |
| `contours` | `number \| number[]` | n/a | Iso-line overlay: a level count, or explicit levels. |
| `showValues` | `boolean` | n/a | Print each cell's value on top of its colour (crisp-outlined for legibility). For coarse, table-like grids only; a dense grid is unreadable. |
| `valueFormat` | `(z: number, d: HeatmapDatum) => string` | `formatNumber(z)` | Format a cell value when `showValues`. |
| `xLabel` / `yLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 14)` | Plot height. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"full"` | Axis posture. Defaults to `"full"` (axes always shown, unlike the line/bar charts' `"hover"`) to preserve the heatmap's always-labelled read; `"minimal"` hides the tick axes, `"hover"` fades them in. |
| `zoomable` | `boolean` | `false` | Interactive **value-axis (y/row) zoom**: the grid is categorical, so wheel/drag/`↑`/`↓`/`+`/`-`/`0` window a vertical sub-range of rows (the cell SVG's viewBox clips to the band). |
| `zoomOutLimit` | `number` | `1` | How far zoom-out may go **past** the rows, as a multiple of the row span; `Infinity` = arbitrary. `1` stops at the data. Reset still returns to the data. |
| `onValueDomainChange` | `(domain: [number, number] \| null) => void` | n/a | Fires on every row-axis zoom/pan (`null` = full range). |
| `annotations` | `ChartAnnotation[]` | n/a | Data-anchored overlays in a pixel-space layer stacked on the grid; `rect`/`text` fit a heatmap naturally. While editing, the overlay takes the pointer, so cell hover is suppressed. |
| `onAnnotationsChange` | `(annotations: ChartAnnotation[]) => void` | n/a | With `controls`, enables annotation editing. |
| `controls` | `boolean` | `false` | On-chart toolbar (zoom + annotation tools). |
| `fullscreen` | `boolean` | `false` | Maximize-to-viewport toggle; Escape exits. |
| `frame` | `boolean` | `false` | 1px structural border + padding. |
| `renderTooltip` | `(d: HeatmapDatum) => ReactNode` | x/y/z | Custom hover tooltip. |

## Icon

`import { Icon, Check, ChevronDown /* … */ } from "@tarassov-ch/swiss-function/icon"`

A consistent, tree-shakeable icon set matched to the library's aesthetic (issue #51): a `16×16`, `currentColor`, **square-capped line** glyph on the `--sf-unit` grid: the Swiss/monospace posture, no fills, no colour, no emoji or mascot art. Each bundled icon is its **own named export** (`<Check />`, `<Search />`, …), so a consumer's bundler drops the ones they don't import.

**Open question resolved toward a bundled set** (not a wrapper over an external icon library): keeps the posture aligned and the dependency footprint zero, while `Icon` still renders any custom `16×16` path you pass as `children`.

`Icon` (the primitive) and every bundled icon accept:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `number \| string` | `"1em"` | A **number** is a multiple of `--sf-unit` (on the grid); a string is any CSS length. The `1em` default makes an icon track the surrounding text: it lines up inside a `Button` or beside a label with no extra sizing. |
| `label` | `string` | n/a | Accessible name for a **standalone, meaningful** icon (`role="img"` + `<title>`). **Omit** it for a **decorative** icon next to text: it then renders `aria-hidden` (the default). |
| `strokeWidth` | `number` | `1.5` | Stroke weight in viewBox units (the library's glyph weight). |
| `children` | `ReactNode` | n/a | Path content for a **custom** icon on the `Icon` primitive; the bundled icons supply it. |

Plus any `SVGProps` (e.g. `color`, `className`) spread to the `<svg>`.

Bundled icons (`createIcon` builds more): chevrons (`ChevronUp/Down/Left/Right`, `ChevronsUpDown`), arrows (`ArrowUp/Down/Left/Right`), actions (`Check`, `X`, `Plus`, `Minus`, `Search`, `Trash`, `Pencil`, `Copy`, `Download`, `Upload`, `ExternalLink`, `Hamburger`, `MoreHorizontal`, `MoreVertical`, `Filter`, `Sliders`, `Refresh`), status (`Info`, `Warning`, `CircleCheck`, `CircleX`), files (`File`, `Folder`), visibility/security (`Eye`, `EyeOff`, `Lock`), time/people (`Calendar`, `Clock`, `User`, `Star`), theme (`Sun`, `Moon`). `createIcon(displayName, pathContent)` builds a new tree-shakeable icon in the same posture. (The hamburger glyph is `Hamburger`, not `Menu`, to avoid colliding with the `Menu` component.)

## Input

`import { Input } from "@tarassov-ch/swiss-function/input"`

Text input wrapping Base UI's Input. Extends `HTMLAttributes<HTMLInputElement>` and Base UI Input props.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `inputSize` | `"sm" \| "md" \| "lg"` | `"md"` | Visual size. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth (`--sf-elevation-N`). |

## Kbd

`import { Kbd } from "@tarassov-ch/swiss-function/kbd"`

Renders a keyboard shortcut as OS-aware keycaps, for labels, menus, tooltips. Extends `HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `combo` | `string` | n/a | `+`-separated combination, e.g. `"mod+shift+k"`, `"alt+enter"`. |
| `mac` | `boolean` | auto | Force macOS rendering. Auto-detected from the browser otherwise; pass it for SSR/tests so output is deterministic. |

`mod` is the **primary modifier**: `⌘` on macOS, `Ctrl` elsewhere (its aliases `cmd`/`command`/`meta` follow suit, so a "cmd" shortcut never shows `⌘` off-Mac). Other modifiers: `ctrl` (`⌃`/Ctrl), `alt`/`opt` (`⌥`/Alt), `shift` (`⇧`/Shift). Named keys resolve to glyphs (`enter` → `↵`, `esc` → `Esc`, `tab` → `⇥`, `arrowup` → `↑`, …); single letters uppercase. On macOS the glyphs render adjacent (`⌘⇧K`); elsewhere modifiers join with `+` (`Ctrl + Shift + K`).

```tsx
<Kbd combo="mod+k" />            // ⌘K on macOS, Ctrl+K elsewhere
<Kbd combo="mod+shift+enter" />
```

## Map

`import { Map } from "@tarassov-ch/swiss-function/map"`

Geographic map (MapLibre GL JS) with a token-tinted vector basemap and declarative
point / area / vector overlays.

Like every component, it needs the library tokens at app root:

```ts
import "@tarassov-ch/swiss-function/tokens.css";
```

MapLibre's own stylesheet (`maplibre-gl/dist/maplibre-gl.css`) is **required** for
the map to lay out; without it the GL canvas escapes its container and grows
unbounded. The `Map` module imports it itself (resolved against your installed
`maplibre-gl` peer dependency), so you don't import it separately.

All coordinates are **GeoJSON `[longitude, latitude]`**, not the spoken "lat,
lng". Tile attribution is a license requirement and stays visible.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `center` | `[lng, lat]` | `[0, 20]` | Initial camera center. |
| `zoom` | `number` | `1` | Initial zoom (0 world … ~22 building). |
| `bounds` | `[[lng,lat],[lng,lat]]` | n/a | Fit on mount (wins over center/zoom); re-fits on change. |
| `basemap` | `"minimal" \| "street" \| "terrain"` | n/a | Controlled basemap preset. |
| `defaultBasemap` | `Basemap` | `"minimal"` | Uncontrolled initial basemap. |
| `onBasemapChange` | `(next: Basemap) => void` | n/a | Basemap changed (prop/toolbar/`setBasemap`). |
| `styleUrl` | `string \| StyleSpecification` | n/a | Override basemap entirely (self-hosted/keyed tiles). |
| `points` | `MapPoint[]` | n/a | Circle markers: `{ at, radius?, color?, label?, data? }`. |
| `areas` | `MapArea[]` | n/a | Polygons: `{ polygon, strokeColor?, strokeWidth?, fillOpacity?, … }`. |
| `vectors` | `MapVector[]` | n/a | Poly-lines: `{ path, width?, arrow?, dashed?, color?, label? }`. |
| `geojson` | `FeatureCollection` | n/a | Power-user path; token-tinted defaults. |
| `height` | `number \| string` | n/a | Fixed height (number → px). Ignored when `fill`. |
| `fill` | `boolean` | `false` | Fill parent height (parent must set one). |
| `frame` | `boolean` | `true` | Border + corner; false when nested in a frame. |
| `fullscreen` | `boolean` | `true` | Corner fullscreen toggle. |
| `interactive` | `boolean` | `true` | Pan/zoom/rotate; `false` for a static map. |
| `onFeatureClick` | `(hit: MapFeatureHit) => void` | n/a | Click on a point/area/vector. |
| `renderTooltip` | `(hit: MapFeatureHit) => ReactNode` | label | Custom hover tooltip (`null` = none). |

Basemap notes: `minimal` (the default) is a restrained vector style colored from
`--sf-*` tokens and re-tinted on dark-mode switch; `street` and `terrain` are
richer, intentionally off-aesthetic opt-ins backed by free no-key providers
(OpenFreeMap, Mapterhorn DEM), best-effort, no SLA. WebGL is required; without it
the map renders a `NonIdealState` fallback.

**Elements / Parts:** `Map.Controls` (zoom/fit/reset/basemap toolbar),
`Map.Minimap` (overview inset, a second WebGL context; use deliberately).

## Markdown

`import { Markdown } from "@tarassov-ch/swiss-function/markdown"`

Rendered Markdown (react-markdown + GFM) with optional double-click edit mode and an inline variant.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | n/a | Markdown source. |
| `editable` | `boolean` | `false` | Double-click to edit. |
| `onChange` | `(next: string) => void` | n/a | Commit (blur or Cmd/Ctrl+Enter). |
| `placeholder` | `string` | `"Nothing here yet."` | Shown when empty and not editing. |
| `editRows` | `number` | `4` | Min textarea rows when editing. |
| `preprocess` | `(source: string) => string` | n/a | Transform source before parse (render mode only). |
| `components` | `ReactMarkdown["components"]` | n/a | Override renderers. |
| `urlTransform` | `ReactMarkdown["urlTransform"]` | n/a | Custom URL sanitization. |
| `inline` | `boolean` | `false` | `<span>` wrappers, flattened paragraphs; editing unsupported. |
| `measured` | `boolean` | `false` | Cap prose to `--sf-measure`. `<Prose>` sets this. |

## Menu

`import { Menu } from "@tarassov-ch/swiss-function/menu"`

Dropdown menu wrapping Base UI's Menu. Parts forward all Base UI props.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Item`,
`Separator`, `Group`, `GroupLabel`.

`Popup` adds `returnFocus` (`boolean`, default `true`): whether to move focus back
to the trigger when the menu closes. Set `false` to leave focus where it is, so a
custom hotkey layer isn't disturbed and a stray Space/Enter doesn't reopen the
trigger. Maps to Base UI `finalFocus` (pass that directly for a specific target).

## ContextMenu

`import { ContextMenu } from "@tarassov-ch/swiss-function/context-menu"`

Right-click (context) menu wrapping Base UI's ContextMenu. Reuses every `Menu`
part and its styling verbatim; only `Root`/`Trigger` differ. `ContextMenu.Trigger`
renders the region that opens the menu on right-click (rather than a button that
opens it on click). Parts forward all Base UI props.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Item`,
`Separator`, `Group`, `GroupLabel`.

## MenuBar

`import { MenuBar } from "@tarassov-ch/swiss-function/menu-bar"`

Application menu bar (`role="menubar"`, top or bottom edge) wrapping Base UI's
Menubar/Menu: menu triggers open dropdowns with shortcuts and nested submenus,
plus `Logo`/`Search` slots. It can **also** host in-place controls (`Control`).
Two opt-in responsive modes (both container-width via `ResizeObserver`, so they
work in sidebars/split panes): `collapse="all"` folds the whole bar (menus and
controls) behind one hamburger (☰) `Popover` when narrower than `collapseAt`;
`collapse="items"` folds items **progressively** into a ⋯ overflow menu from the
trailing edge, keeping as many inline as fit (only `Logo` pinned). Default is no
collapse. **Not** a Cmd-K command palette.

**Elements / Parts:** `Root` (bar container), `Menu`, `Trigger` (full-width row in
the collapsed panel), `Content` (portal + Box popup, elevation 3), `Item`,
`Separator` (a menu separator inside `Content`; a bar rule when placed directly in
the bar), `Submenu`, `SubmenuTrigger`, `SubmenuContent`, `Logo` (persistent left
slot), `Search` (right-aligned, wraps `Input` size `sm`), `Control` (generic in-place
control slot, you supply the `Button`/`Switch`/`Input`/…), `Spacer` (pushes
following row items right; no-op in the panel).

`MenuBar.Content` adds `returnFocus` (`boolean`, default `true`): whether to move
focus back to the trigger when the menu closes. Set `false` to leave focus where
it is, so a custom hotkey layer isn't disturbed and a stray Space/Enter doesn't
reopen the trigger. Maps to Base UI `finalFocus`.

`MenuBar.Root` props (extends Base UI `Menubar` props):

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `position` | `"top" \| "bottom"` | `"top"` | Edge with the hairline; flips menu open direction. |
| `bordered` | `boolean` | `true` | Draw the hairline on the `position` edge. Set `false` when the bar already sits inside a bordered surface. |
| `collapse` | `"none" \| "all" \| "items"` | `collapseAt ? "all" : "none"` | Responsive mode. `"all"` folds the whole bar behind one ☰ at `collapseAt`; `"items"` folds items progressively into a ⋯ overflow menu from the trailing edge (only `Logo` pinned; `collapseAt`/`menuAlign` ignored). |
| `collapseAt` | `number \| string` | n/a | Threshold for `collapse="all"`. `number` → `--sf-unit` multiples; `string` → any CSS length. |
| `gap` | `number \| string` | `0` | Gap between bar items; `number` → `--sf-unit` multiples. |
| `menuAlign` | `"start" \| "end"` | `"end"` | (`collapse="all"` only) Side the collapsed ☰ trigger sits on. `"start"` keeps it next to the `Logo`. |
| `menuLabel` | `string` | `"Menu"` | Accessible name for the icon-only collapsed trigger. |
| `menuIcon` | `ReactNode` | inline ☰ | Override the hamburger glyph. |

Other parts: `Item` takes `shortcut?: string` (right-aligned hint, mirrored to
`aria-keyshortcuts`); `Control` takes `label?: ReactNode` (shown beside the control
in the collapsed panel; omit for self-describing controls).

```tsx
<MenuBar.Root collapseAt={48} gap={0.5}>
  <MenuBar.Logo>Editor</MenuBar.Logo>
  <MenuBar.Menu>
    <MenuBar.Trigger>File</MenuBar.Trigger>
    <MenuBar.Content>
      <MenuBar.Item shortcut="⌘S" onClick={save}>Save</MenuBar.Item>
    </MenuBar.Content>
  </MenuBar.Menu>
  <MenuBar.Separator />
  <MenuBar.Control label="Wrap"><Switch checked={wrap} onCheckedChange={setWrap} /></MenuBar.Control>
  <MenuBar.Spacer />
  <MenuBar.Control><Button variant="danger" size="sm">Delete</Button></MenuBar.Control>
</MenuBar.Root>
```

## Minimap

`import { Minimap } from "@tarassov-ch/swiss-function/minimap"`

A scroll-overview rail beside a component-owned scroll container, in the manner
of the VS Code minimap but built from **structural markers**, not a scaled
content clone. `block` markers are thin dither rules (the density read);
`header` markers render their text as truncated, level-indented, clickable
labels with active tracking (`aria-current`). The viewport indicator is the
**honestly proportional band** of the document currently visible in the main
view: the markers inside it always correspond to the content on screen. The
minimum target size (24px) lives on an invisible grab/focus zone centered on
the band, never on the band itself.

The component owns the scroll container (like `Pane.Body`): a CSS Grid wrapper
holds its own scroll element plus the rail as a real grid column (never an
overlay). **The parent must constrain the wrapper's height**; dropped into an
unconstrained div the content never overflows and the rail never appears. The
rail hides entirely (with hysteresis, so width-dependent content cannot make it
flicker) when the content fits. The scroll element hides its own native
scrollbar (`scrollbar-width: none` on that one element, non-inheriting): the
rail is that element's scroll affordance; nested scrollables keep their own.

Gestures: drag the band (relative, preserves grab offset; grabbing wins where
the band covers a label, and the label is clickable again once the band moves
away), press empty rail to jump (centers the viewport on the pressed position)
and keep dragging, wheel over the rail forwards to the content, header label
click jumps top-aligned (smooth, instant under reduced motion). Keyboard (on the `role="scrollbar"`
zone): Down/Up arrows step, PageDown/PageUp page, Home/End to the extremes.
All programmatic gesture scrolls use `behavior: "instant"` explicitly, so a
consumer's `scroll-behavior: smooth` cannot make a drag rubber-band.

**Markers are always data.** You supply the `markers` array in content
coordinates; the component does not scan the DOM. This is what makes
virtualized bodies (Prose, DataTable, Explorer) work: they mount roughly one
viewport plus overscan, so a DOM scan would see only the current window, but a
data array covers the whole document. Under estimate-based virtualization the
offsets are themselves estimates until measured, so re-supply the array
whenever the virtualizer's measurements change, and route jumps through
`onJump`. In v1 the component always owns its scroll container; attaching to an
external host-owned scroller is a planned follow-up.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `markers` | `MinimapMarker[]` | n/a | Structural markers in content coordinates: `block` spans (dither rules) and `header` markers (clickable labels). |
| `side` | `"left" \| "right"` | `"right"` | Rail edge, by grid placement (logical, so RTL flips it). DOM order stays content-then-rail, so the tab order is stable either way. |
| `width` | `number` | n/a | Rail width in `--sf-unit` multiples; defaults to the `--sf-minimap-width` token (3u = 72px). |
| `ariaLabel` | `string` | `"Scroll position"` | Accessible name for the `role="scrollbar"` zone. |
| `onJump` | `(marker: MinimapMarker) => void` | n/a | Intercepts header-label jumps (virtualized hosts scroll their own scroller here). Without it the component scrolls its own container. |
| `minMarkerSize` | `number` | n/a | Minimum block height in `--sf-unit` multiples. When set, block spans never compress below it: once the content is dense enough that they would, the rail's inner content grows taller than the rail and **the rail itself scrolls**, auto-following the viewport band (and more labels survive). Unset keeps the fit-everything proportional overview. |
| `maxMarkerSize` | `number` | n/a | Maximum block height in `--sf-unit` multiples. Caps how tall any one block renders (a sparse document otherwise gives a few very tall blocks); the capped block leaves a gap after it. |
| `jumpAlign` | `"start" \| "center"` | `"start"` | Where a label-click jump lands the target: at the viewport top, or its middle. Also anchors which header reads active. |
| `children` | `ReactNode` | n/a | The scrollable content. |

`MinimapMarker`: `{ id?, top?, topFraction?, height?, heightFraction?, kind?, label?, level?, emphasis?, tone? }`.
`top` is a content offset in px; `topFraction` a fraction of `scrollHeight` in
[0, 1]; exactly one is required (`top` wins when both are set; a marker with
neither is dropped with a one-time dev warning). `height`/`heightFraction`
give block spans an extent (px or fraction; `height` wins when both are set).
`kind` is `"block"` (default)
or `"header"`; `label` and `level` apply to headers (`level` drives indent and
collision priority); `tone` (`primary`/`success`/`warning`/`danger`) recolors a
marker (and its header label) only where the color means something; `emphasis`
renders a header label in italics (for a grouping heading). Each level indents
the label a further quarter-unit. Colliding labels decimate
deepest-level-first, then by document order; dropped labels are not rendered at
all (nothing invisible in the tab order) while their dither rules stay.

The forwarded ref targets the **scroll element** (read the offset, scroll
programmatically, or hand it to a virtualizer's `getScrollElement`).

Tokens: `--sf-minimap-width` (rail width, default `calc(var(--sf-unit) * 3)`),
`--sf-minimap-label-size` (heading-label font size, default `0.65rem`; below the
sm..lg body ladder because the rail is a dense navigation affordance). Header
labels are a compact caption that hugs its text (an opaque `--sf-color-bg` pill
on the leading edge), so block markers stay the main density read and the
heading rides on top of the block.

Not `Graph.Minimap` / `Map.Minimap`: those are canvas overviews of a canvas
viewport (camera recentering); this maps a 1D DOM scroll offset.

```tsx
<Minimap
  markers={[
    { id: "intro", top: 0, kind: "header", label: "Introduction", level: 1 },
    { id: "data", topFraction: 0.4, kind: "header", label: "Data", level: 2 },
    { id: "risk", topFraction: 0.7, height: 1200, tone: "warning" },
  ]}
>
  {longContent}
</Minimap>
```

## NonIdealState

`import { NonIdealState } from "@tarassov-ch/swiss-function/non-ideal-state"`

Empty / no-results / error / loading state rendered as a block with a dithered WebGL fill and centered message.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"empty" \| "no-results" \| "error" \| "loading"` | `"empty"` | Picks default effect/tint/a11y. `error`→`role="alert"`; `loading`→`role="status"` + `aria-busy`. |
| `title` | `ReactNode` | n/a | Headline. |
| `description` | `ReactNode` | n/a | Secondary line. |
| `action` | `ReactNode` | n/a | Action slot (usually a `Button`). |
| `effect` | `EffectName` | per-variant | Override fill effect. The `breathe`/`twinkle`/`interleave`/`rotate`/`blocks`/`shimmer`/`sparkle`/`blink` set are subtle and evenly-covered (toggling dot patterns); `life` is Conway's Game of Life. |
| `speed` | `number` | `1` | Animation speed multiplier. |
| `density` | `number` | `0.6` | Fill coverage 0 to 1. |
| `effectOptions` | `EffectOptions` | n/a | Advanced tuning (ripple `wavelength`, `seed`). |
| `cellSize` | `number` | `7` | Dither cell px. |
| `color` | `string` | muted token | Base fill colour; `error` uses danger token. |
| `opacity` | `number` | `0.85` | Fill opacity 0 to 1. |
| `width` / `height` | `number \| string` | n/a | `number` → `--sf-unit` multiples; `string` → raw CSS. |

## Notebook

`import { Notebook, proseCellType, createSqlCellType } from "@tarassov-ch/swiss-function/notebook"`

A reactive notebook surface: cells form a dependency graph, editing a cell re-runs its dependents, and results render through sf components. Both engines are the consumer's: the data engine is injected as the SQL executor, and further languages plug in through the `CellType` contract. The library ships no execution language and no eval; its reactive scheduler is in-house (spec: `src/lib/notebook/SPEC.md`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `document` | `NotebookDocument` | n/a | Controlled document: `{version: 1, cells: [{id, type, name?, source}]}`. Plain JSON, host-persisted. |
| `onDocumentChange` | `(next: NotebookDocument) => void` | n/a | Fires on every edit/add/move/delete. |
| `cellTypes` | `readonly CellType[]` | n/a | The explicit registry; nothing is implicit. Pass `proseCellType` plus the app's engine adapters. |
| `defaultRenderResult` | `(value: unknown) => ReactNode` | Arrow → DataTable, else code | Fallback renderer when the cell type has none. |

**The `CellType` contract** (the extension point for any language or engine):

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `string` | Matches `NotebookCell.type`. |
| `label` | `string` | Add-cell affordance label. |
| `editorExtensions?` | `() => Extension[]` | CodeMirror language support (consumer-installed packages, per the CodeEditor convention). |
| `findDependencies?` | `(source, knownNames) => string[]` | Names of referenced cells. Identifier-based languages intersect with `knownNames` (unknown identifiers then fail at run time); explicit-reference languages (SQL's `${name}`) can report unknown names, which show as `unresolved` until defined. |
| `execute?` | `(ctx: CellRunContext) => unknown \| Promise<unknown>` | Omit for display-only types. `ctx` = `{source, inputs, signal}`; throw/reject → the cell's error state; the signal aborts when the run goes stale. |
| `renderResult?` | `(value: unknown) => ReactNode` | Successful values; falls back to `defaultRenderResult`. |
| `renderStatic?` | `(source: string) => ReactNode` | Display-only types render the source instead. |

**Built-ins**: `proseCellType` (markdown, display-only, edit via double-click). `createSqlCellType({executor, extensions?})` is the flagship adapter: `${name}` interpolations reference other cells (scalars, Dates, and arrays inline; table values are not interpolable), dependencies parsed string/comment-aware, results rendered as a DataTable. `executor: (sql, signal) => Promise<unknown>` is the app's engine seam; wire DuckDB-WASM (or anything) there, the library never imports an engine.

**Cell states** (visible as `data-status` on each cell): `idle`, `pending` (spinner in the status rail), `success`, `error`, `upstream-error` (an upstream cell failed; named in the message), `cycle`, `unresolved` (references a name no cell defines), `doc-error` (duplicate/invalid name or unknown type), `static` (display-only). Scheduler guarantees: same-task edits batch into one wave, diamond dependencies re-run a dependent exactly once with consistent inputs, stale runs are aborted and their results discarded.

**Keyboard**: cells are focusable; ArrowUp/Down move between cells, Enter enters the editor, Escape returns to the cell, Mod+Enter commits and runs, Alt+ArrowUp/Down moves the cell.

Also exported: `fromArrow` / `isArrowTableLike` / `ArrowTableLike` (re-exported from `@tarassov-ch/swiss-function/lib/from-arrow`): converts Arrow-shaped results (proxy rows, epoch-ms timestamps, BigInt/HUGEINT values) to plain row arrays with schema-driven `Date` coercion and a documented BigInt policy (`"string"` default, `"number"`, `"throw"`). Importable without the notebook.

## Outliner

`import { Outliner } from "@tarassov-ch/swiss-function/outliner"`

Tree outline editor with collapsible bullets, keyboard nav, wiki-links, and block-ref transclusion. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `Bullet[]` | n/a | Tree; each bullet `{ id, content, collapsed?, children[] }`. |
| `onChange` | `(next: Bullet[]) => void` | n/a | Any mutation (edit, indent, delete, collapse, reorder). |
| `readOnly` | `boolean` | `false` | Navigation/read only. |
| `generateId` | `() => string` | `crypto.randomUUID()` | New-bullet id factory. |
| `onWikiLinkClick` | `(name: string) => void` | n/a | `[[wiki link]]` clicked. |
| `resolveBlockRef` | `(id: string) => string \| null` | n/a | Resolve `((block-id))`; null → "missing" placeholder. |

## Pane

`import { Pane } from "@tarassov-ch/swiss-function/pane"`

Full-height container with a fixed header and scrollable body (CSS-grid `auto / 1fr` with cascading `min-block-size: 0`). Parts extend `HTMLAttributes<HTMLDivElement>`.

**Elements / Parts:** `Pane.Root` (grid container), `Pane.Header` (auto-sized, no
scroll), `Pane.Body` (scrollable, `min-block-size: 0`).

## Picker

`import { Picker } from "@tarassov-ch/swiss-function/picker"`

Search a list and choose exactly one: the single-selection sibling of [Selector](#selector), built on a single-select Base UI Combobox. The field shows the chosen item's label; opening the dropdown clears it to a fresh search box (the whole list is offered, not filtered to the current selection) and restores the label if dismissed without choosing. Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`). `PickerItem = string | { value, label }`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `PickerItem[]` | n/a | Choices. |
| `value` | `string` | n/a | Controlled selection; `""` = none (pass with `onChange`). |
| `defaultValue` | `string` | `""` | Uncontrolled initial selection. |
| `onChange` | `(value: string) => void` | n/a | Fired with the value (or `""` when cleared). |
| `placeholder` | `string` | `"Search…"` | Search placeholder. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Mirrors `Input`. |
| `disabled` | `boolean` | n/a | Disable the control. |
| `clearable` | `boolean` | `true` | Show a clear button once selected. |
| `emptyMessage` | `ReactNode` | `"No results"` | Dropdown empty state. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | n/a | Resting depth of the search field (`--sf-elevation-N`, same scale as Box). Omitted leaves the field flat (its default); set it to raise the control. |

**Width:** fills its container and clamps to a narrow *definite* cell (like
[Selector](#selector)). In a shrink-to-fit parent it holds a `12rem` floor
instead of collapsing to the search input's min-content; tune it with
`--sf-picker-min-inline-size`, or set an explicit `width` to pin the control.

## PointCloud

`import { PointCloud } from "@tarassov-ch/swiss-function/point-cloud"`

3D scatter / point cloud: `series` of x/y/z points (clusters, 3-component
embeddings). Canvas2D, **orthographic (axonometric)** projection, **drag-to-rotate
only** (never auto-spins; the idle view is a fixed angle, so reduced-motion is a
no-op). Multi-series consumers pass explicit `color`s (one accent by default).
Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `series` | `PointSeries[]` | n/a | `{ name; data: { x; y; z; label? }[]; color? }`. |
| `xDomain` / `yDomain` / `zDomain` | `[number, number]` | data min/max | Axis ranges. |
| `xLabel` / `yLabel` | `string` | n/a | Axis labels. |
| `pointRadius` | `number` | `3` | Dot radius (px); nearer dots a touch larger. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 16)` | Plot height. |
| `showLegend` | `boolean` | when >1 series | Series legend. |
| `renderTooltip` | `(d: PointCloudDatum) => ReactNode` | x/y/z | Custom hover tooltip. |

## Popover

`import { Popover } from "@tarassov-ch/swiss-function/popover"`

Base UI Popover wrapper with themed styling.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Positioner`, `Popup` (Box
elevation 3), `Title`, `Description`, `Arrow`, `Close`.

## Progress

`import { Progress } from "@tarassov-ch/swiss-function/progress"`

A progress bar: a determinate 0..100% value, or an indeterminate busy state
(`value={null}`). Wraps Base UI Progress (`role="progressbar"` + the aria value
attributes) and adds three fill treatments, tones, elevation, and four thickness
rungs. Renders a `<div>`; extends `HTMLAttributes<HTMLDivElement>` (minus `color`).
For a static measurement/gauge (disk usage, a score) rather than task completion,
Base UI's Meter is the right primitive; this component does not wrap it.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `number \| null` | n/a | Current value; `null` = indeterminate (busy). |
| `min` / `max` | `number` | `0` / `100` | Range. |
| `fill` | `"color" \| "dither" \| "animated"` | `"color"` | Solid colour, a static dither, or an animated WebGL dither (the same engine as NonIdealState/Skeleton; the ~6KB engine loads lazily and only for `"animated"`). |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` | Bar **thickness** (~3/6/8/12px on the unit grid). This is a geometric dimension, so it carries an `xs` rung the three-rung type scale does not. |
| `tone` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger"` | `"primary"` | Semantic fill colour (mirrors Chip). |
| `color` | `string` | n/a | Explicit fill colour (any CSS colour / `--sf-*` token); wins over `tone`. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | n/a | Track depth (`--sf-elevation-N`, same scale as Box); omitted = flat. |
| `showValue` | `boolean` | `false` | Inline percentage readout after the bar; hidden when indeterminate. |
| `formatValue` | `(value: number, max: number) => ReactNode` | `` `${pct}%` `` | Custom readout. |
| `effect` | `EffectName` | `"shimmer"` | `fill="animated"` only. Prefer the evenly-covered effects on a thin bar. |
| `speed` / `density` / `cellSize` / `effectOptions` | passthrough to `useDitheredFill` | `1` / `0.6` / `3` / n/a | `fill="animated"` only. |

Indeterminate bars sweep (colour/dither) or run their effect across the whole
track (animated); `prefers-reduced-motion` freezes all three to a static frame.

**Corners:** the track (and, through it, the fill and its elevation shadow) round
with `--sf-progress-radius`, defaulting to `--sf-radius-default`. Set
`--sf-progress-radius: 0` to square the bar to match the blocky dither family,
without overriding the shared `--sf-radius-default` for the whole subtree.

```tsx
<Progress value={62} fill="animated" tone="success" size="md" showValue />
<Progress value={null} />            {/* indeterminate */}
<Progress value={62} style={{ "--sf-progress-radius": 0 }} />  {/* squared */}
```

## Prose

`import { Prose } from "@tarassov-ch/swiss-function/prose"`

Virtualized Markdown document with an auto-generated heading outline and scroll-to-heading nav. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `source` | `string` | n/a | Markdown to parse (ignored if `blocks` given). |
| `blocks` | `ProseBlock[]` | n/a | Pre-parsed blocks; bypass the parser. |
| `measured` | `boolean` | `true` | Cap block width to `--sf-measure`. |
| `split` | `boolean` | `false` | 2-column grid (outline + body). |

**Elements / Parts:** `Prose.Root` (context provider), `Prose.Outline`
(`ariaLabel`, default "Document outline"), `Prose.Body` (`estimateBlockSize`
default 96, `overscan` default 6).

## Radio

`import { Radio, RadioGroup } from "@tarassov-ch/swiss-function/radio"`

Base UI radio + group wrappers. `RadioGroup` forwards all Base UI RadioGroup props; `Radio` forwards Base UI Radio.Root props.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `elevation` | `Radio` | `0 \| 1 \| 2 \| 3 \| 4` | `2` | Resting depth; sets `data-elevation`. |

## RadioTable

`import { RadioTable } from "@tarassov-ch/swiss-function/radio-table"`

A bordered, hairline-divided table of radio options, each a radio + label +
description: the "pick one, each with a title and detail" pattern (plan pickers,
settings). Built on `RadioGroup`/`Radio` (single selection, roving arrow-key
nav, radiogroup/radio roles). On a wide container it reads as a real table: the
rows share one grid (a CSS `subgrid`), so every label ends and every description
starts on the same line regardless of label width. The description text is
left-aligned and hyphenated (`hyphens: auto`, so it needs a `lang` on an
ancestor, as the app root sets). When the container is narrow the description
drops below its label (a container query on the row, the `VerticalForm.Field`
pattern, tighter), so the whole thing stays one coherent component. The whole row is the click target; the label is the radio's
accessible name.

**Elements / Parts:** `RadioTable` (Root; wraps Base UI RadioGroup, forwards
`value`/`defaultValue`/`onValueChange`/`disabled`), `RadioTable.Option`.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` / `defaultValue` | `Root` | `string` | n/a | Selected value (controlled / uncontrolled), forwarded to RadioGroup. |
| `onValueChange` | `Root` | `(value) => void` | n/a | Fires with the chosen value. |
| `value` | `Option` | `string` | n/a | The value selected when this option is chosen (required). |
| `label` | `Option` | `ReactNode` | n/a | The option's title; also the radio's accessible name. |
| `description` | `Option` | `ReactNode` | n/a | Detail copy (full-strength fg). Right of the label when wide, below it when narrow. |
| `disabled` | `Option` | `boolean` | `false` | Disable just this option. |

```tsx
<RadioTable value={plan} onValueChange={setPlan}>
  <RadioTable.Option value="starter" label="Starter" description="For small teams." />
  <RadioTable.Option value="pro" label="Pro" description="Adds SSO and audit logs." />
  <RadioTable.Option value="enterprise" label="Enterprise" description="Contact sales." disabled />
</RadioTable>
```

## Reflow

`import { Reflow } from "@tarassov-ch/swiss-function/reflow"`

Responsive multi-column layout. Wide: equal-width columns side by side. When its
**container** (not the viewport) is narrower than `collapseAt`, it collapses to
either a vertical accordion or a tab switcher so you move between columns. Detection
is container-width via `ResizeObserver` (the shared `useCollapse` hook), so it works
inside sidebars/split layouts, not just full width.

`Reflow.Root` props (a discriminated union on `collapseMode`; extends `HTMLAttributes<HTMLDivElement>`):

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `collapseMode` | `"accordion" \| "tabs"` | `"accordion"` | Narrow rendering. |
| `collapseAt` | `number \| string` | `32` | Collapse threshold. `number` → `--sf-unit` multiples; `string` → any CSS length. |
| `gap` | `number \| string` | `1` | Wide column gap; `number` → `--sf-unit` multiples. |
| `headingLevel` | `2 \| 3 \| 4 \| 5 \| 6` | `3` | Wide-state column heading tag. |
| `value` / `defaultValue` | `string[]` (accordion) / `string` (tabs) | first column | Open section(s) / active column. Control `value` to persist state across the breakpoint. |
| `onValueChange` | `(value: string[]) => void` (accordion) / `(value: string) => void` (tabs) | n/a | Selection callback. |
| `openMultiple` | `boolean` | `false` | Accordion only: allow several sections open. |

**Elements / Parts:** `Reflow.Column` takes `{ title: ReactNode; value?: string }` + `HTMLAttributes`.
`title` is the heading / accordion trigger / tab label. Children must be `Reflow.Column`
(fragments are flattened); pass an explicit `value` when columns are conditionally rendered.

```tsx
<Reflow.Root collapseMode="tabs" collapseAt={40}>
  <Reflow.Column title="Overview" value="overview">…</Reflow.Column>
  <Reflow.Column title="Details" value="details">…</Reflow.Column>
</Reflow.Root>
```

## Scatterplot

`import { Scatterplot } from "@tarassov-ch/swiss-function/scatterplot"`

Responsive scatter plot with optional lines, multi-series, scaffolding modes, and a hover tooltip. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `series` | `ScatterSeries[]` | n/a | `{ name, data: { x: number\|Date, y, label? }[], color?, showLine?, showPoints? }`. |
| `xDomain` | `[number, number] \| [Date, Date]` | auto-fit | Detects date vs numeric. With `zoomable`, this is the controlled visible window (pair with `onXDomainChange`). |
| `yDomain` | `[number, number]` | auto-fit | Y range. While zoomed, auto-fit follows the visible window (padded, not zero-anchored). |
| `xLabel` / `yLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `showLegend` | `boolean` | `true` when >1 series | Legend below the x-axis. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. In full mode, axes are adaptive: tick step/precision recompute from the domain and pixel density; date axes walk a calendar ladder (5 min → hour → day → month → year) with promoted (bolder) boundary ticks; tiny-span-at-large-magnitude windows factor a shared offset into a corner readout. |
| `zoomable` | `boolean` | `false` | Interactive viewport: wheel zooms at the cursor (plain wheel after a click; ctrl/⌘+wheel and pinch always), drag pans, double-click resets; ←/→ `+` `-` `0` on the focused chart; `aria-live` range announcements; Reset button while zoomed. Series past ~4 points/px decimate (min/max per pixel column, spikes survive). |
| `zoomOutLimit` | `number` | `1` | How far zoom-out may go **past** the data (into empty margin to the sides), as a multiple of the x span; `Infinity` = arbitrary. `1` stops at the data. Reset still returns to the data. |
| `onXDomainChange` | `(domain: [number, number] \| [Date, Date] \| null) => void` | n/a | Fires on every viewport change (`null` = reset). Semantic-zoom hook: load finer-grained data when the window narrows. |
| `annotations` | `ChartAnnotation[]` | n/a | Serializable, data-anchored overlay: `hline`/`vline`/`line`/`rect`/`text`/`measure` (Δx/Δy/Δ% ruler). Anchors are data values, so drawings survive zoom/pan/resize. The array is the document, so persist it as-is. |
| `onAnnotationsChange` | `(annotations: ChartAnnotation[]) => void` | n/a | With `controls`, enables annotation **editing** (see below). Fires with the complete next array. |
| `controls` | `boolean` | `false` | On-chart toolbar overlay: zoom-to-region mode (arm, then drag the band to zoom to; Escape disarms), step zoom out, Reset (when `zoomable`) + the annotation tool palette (when `onAnnotationsChange` is set). Absorbs the corner Reset button. |
| `fullscreen` | `boolean` | `false` | Maximize-to-viewport toggle in the corner; Escape exits. |
| `frame` | `boolean` | `false` | 1px structural border + padding; the chart reads as a panel. |
| `onPointActivate` | `(datum: ScatterDatum & { series: string }) => void` | n/a | Click/Enter on a point, a drill-down hook. |
| `renderTooltip` | `(datum: ScatterDatum & { series: string }) => ReactNode` | mono `(x, y)` | Custom tooltip. |

**Annotation editing** (`controls` + `onAnnotationsChange`): arm a tool in the toolbar: trend line, region and measure draw by drag (a stray click under 4px creates nothing), horizontal/vertical lines place on click, the text tool opens an inline note input (Enter commits, Escape cancels). After each draw the tool snaps back to *select* and the new annotation (with a generated `id`) is selected. In select mode, click an annotation to select it (endpoint drag handles appear; drag the body to move; drags commit once on pointerup), Delete removes, Escape cancels/disarms/deselects in that order, double-click a text note to re-edit it. While a tool is armed, drag-pan and double-click-reset are suspended (wheel zoom stays live); while editing is enabled, the wide hit strokes around annotations take hover precedence over nearby data points.

## Selector

`import { Selector } from "@tarassov-ch/swiss-function/selector"`

Opinionated, controlled multi-select built on a Base UI Combobox. Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`). `SelectorItem = string | { value, label }`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `SelectorItem[]` | n/a | Choices. |
| `value` | `string[]` | n/a | Controlled selection (pass with `onChange`). |
| `defaultValue` | `string[]` | `[]` | Uncontrolled initial selection. |
| `onChange` | `(value: string[]) => void` | n/a | Fired with the full selected set. |
| `placeholder` | `string` | `"Search…"` | Search placeholder. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Mirrors `Input`. |
| `layout` | `"panel" \| "inline" \| "compact"` | `"panel"` | See below. |
| `disabled` | `boolean` | n/a | Disable the control. |
| `emptyMessage` | `ReactNode` | `"No results"` | Dropdown empty state. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | n/a | Resting depth of the search field (`--sf-elevation-N`, same scale as Box); applies in every `layout`. Omitted leaves the field flat; set it to raise the control. |
| `bucketLabel` | `ReactNode` | `"Selected"` | Bucket heading, `panel` only. |
| `compactLabel` | `(count: number) => ReactNode` | `` `${n} item(s)` `` | Count wording, `compact` only. |

**Layouts:** `panel` (search + chip bucket below), `inline` (chips inside the
field, one row, overflow shows a trailing `⋯`), `compact` (collapses to "N items"
+ Clear for tight spaces; review/uncheck in the dropdown).

**Width:** the control fills its container (`inline-size: 100%`) and, in a
narrow *definite* cell, clamps to fill it rather than overflow. In a
shrink-to-fit parent (an inline-flex toolbar, a float, an `auto` grid track),
where `100%` is inert, `panel` and `inline` hold a `12rem` floor instead of
collapsing to the search input's min-content; set
`--sf-selector-min-inline-size` (e.g. `0`) to change it. `compact` opts out of
the floor by design: its root shrinks to content so it tucks into a toolbar, but
a `width`/`inline-size` set on the control (className or inline style) wins and
the field fills it. To pin an exact width in any layout, set `width`/`inline-size`
on the control (it wins over the fill).

```tsx
<Selector layout="compact" items={cities} value={value} onChange={setValue}
          compactLabel={(n) => `${n} cities`} />
```

## Skeleton

`import { Skeleton } from "@tarassov-ch/swiss-function/skeleton"`

Animated loading placeholder (shimmer, or a NonIdealState-style dithered effect). Extends `HTMLAttributes<HTMLElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `shape` | `"rect" \| "circle" \| "pill"` | `"rect"` | rect is sharp; circle/pill rounded. |
| `width` / `height` | `number \| string` | n/a | `number` → `--sf-unit` multiples; `string` → raw CSS. |
| `size` | `number \| string` | n/a | Shorthand for `width = height`. |
| `effect` | `EffectName` | n/a | Dithered effect instead of shimmer. |
| `speed` | `number` | n/a | Effect speed (with `effect`). |
| `density` | `number` | `0.6` | Effect coverage (with `effect`). |
| `cellSize` | `number` | n/a | Dither cell px (with `effect`). |
| `effectOptions` | `EffectOptions` | n/a | Advanced tuning (with `effect`). |
| `render` | `RenderProp` | `<div />` | Base UI render prop. |

## Spinner

`import { Spinner } from "@tarassov-ch/swiss-function/spinner"`

An animated monospace glyph spinner (CLI-style) for inline "busy" feedback
(`role="status"`). Cycles a short frame sequence; honors `prefers-reduced-motion` by
holding one static frame. Inherits `currentColor` and (by default) the surrounding
font size. Extends `HTMLAttributes<HTMLSpanElement>` (minus `children`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `SpinnerVariant` | `"braille"` | Which glyph animation (see list). |
| `speed` | `number` | `1` | Speed multiplier (2 = twice as fast). |
| `label` | `string` | `"Loading…"` | Accessible name (`aria-label`). |
| `size` | `"sm" \| "lg"` (or `"md"`) | inherit | Glyph size; omit to inherit the surrounding font size. |
| `color` | `string` | inherit | Glyph color: any CSS color/token (e.g. `var(--sf-color-primary)`). Omit to inherit `currentColor`. |

**Variants (28):** `braille`, `line`, `blocks` (density shades), `bars`, `grow`,
`bounce`, `arrow`, `quadrant`, `triangle`, `circle`, `corners`, `pipe`, `star`,
`toggle`, `dots`, `pulse`, `scanner`, `arrowDouble`, `caret`, `trigram`, `dqpb`,
`arc`, `clockface`, `balloon`, `weave`, `boxCorners`, `quadrantHeavy`, `static`.

Also exported: `useSpinnerFrame(variant?, speed?): string`, the cycling glyph as a
hook, to embed a spinner inline in any component without the wrapper.

## SplitPane

`import { SplitPane } from "@tarassov-ch/swiss-function/split-pane"`

A resizable split layout: a `SplitPane.Main` region and a collapsible `SplitPane.Panel` that **pushes** the main content aside (in document flow, not an overlay). Drag the divider to resize; closed → the panel collapses to zero and Main reclaims the space. Fills its parent, so give the parent a height.

**Parts:** `SplitPane` (root), `SplitPane.Main`, `SplitPane.Panel`. Also exports a `useSplitPane()` hook (`{ side, open, size, setOpen }`) for a close button inside the panel.

| Prop (root) | Type | Default | Notes |
| --- | --- | --- | --- |
| `side` | `"left" \| "right" \| "top" \| "bottom"` | `"right"` | Edge the panel sits on. |
| `open` / `defaultOpen` / `onOpenChange` | n/a | n/a | Panel open state (controlled or uncontrolled). |
| `resizable` | `boolean` | `true` | Drag the divider to resize; `false` removes it. |
| `defaultSize` | `number` | `320` | Panel size in px (remembered across open/close). |
| `minSize` / `maxSize` | `number` | `200` / n/a | px clamps. `maxSize` is also capped to the container minus a small main minimum. |
| `onSizeChange` | `(px: number) => void` | n/a | Fired when a resize settles, or on a keyboard step. |

The divider is `role="separator"` with `aria-orientation` + `aria-valuenow/min/max`, focusable, and resizes with the arrow keys. The collapse/expand animates `inline-size`/`block-size` (instant under `prefers-reduced-motion`; no transition while dragging).

```tsx
const [open, setOpen] = useState(true);
<div style={{ height: "100vh" }}>
  <SplitPane side="right" open={open} onOpenChange={setOpen}
    defaultSize={360} minSize={280} maxSize={640} onSizeChange={persist}>
    <SplitPane.Main><YourApp onToggle={() => setOpen(o => !o)} /></SplitPane.Main>
    <SplitPane.Panel><Inspector /></SplitPane.Panel>
  </SplitPane>
</div>
```

## StreamingTerminalText

`import { StreamingTerminalText } from "@tarassov-ch/swiss-function/streaming-terminal-text"`

Reveals text character-by-character with a shade-block tail (terminal typewriter). Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `content` | `string` | n/a | Full text received so far (grows as chunks arrive). |
| `isComplete` | `boolean` | n/a | True once no more text will arrive. |
| `mode` | `"dramatic" \| "stream"` | `"dramatic"` | Reveal cadence. `"dramatic"` reveals one character per tick (a steady shimmer, good for scripted text). `"stream"` reveals everything except the shade tail each tick, so the text tracks a live token stream as it arrives instead of lagging then bursting to catch up at the end. |
| `tailLength` | `number` | `3` | Unrevealed letters held in the tail. |
| `charIntervalMs` | `number` | `64` | Ms per tick. |
| `shadeRamp` | `string[]` | `["▒", "▓"]` | Shade glyphs, far → near. |
| `spacePlaceholder` | `string` | `" "` | Glyph filling spaces in the tail. |

## Surface

`import { Surface } from "@tarassov-ch/swiss-function/surface"`

3D surface `z = f(x,y)` for intrinsically-3D data (response/optimization surfaces,
terrain) where flattening loses meaning, otherwise prefer the flat `Heatmap`.
Canvas2D, **orthographic (axonometric)** projection (no perspective distortion, so
lengths stay comparable, like a CAD drawing), flat-shaded with a single-hue height
ramp, a measured cube frame with axis ticks, and **drag-to-rotate only** (never
auto-spins; idle = a fixed angle, so reduced-motion is a no-op). Data is the
`GridData` shape (`{ x: number[]; y: number[]; z: number[][] }`, `z[j][i]` at
`x[i]`,`y[j]`). Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `GridData` | n/a | The gridded heights. |
| `zDomain` | `[number, number]` | data min/max | Height range for the ramp. |
| `wireframe` | `boolean` | `true` | Hairline mesh over the shaded surface. |
| `colorScale` | `[string, string]` | primary tint → primary | `[low, high]` height-ramp colors. |
| `xLabel` / `yLabel` / `zLabel` | `string` | n/a | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 16)` | Plot height. |
| `renderTooltip` | `(d: SurfaceDatum) => ReactNode` | x/y/z | Custom hover tooltip. |

## Switch

`import { Switch } from "@tarassov-ch/swiss-function/switch"`

Toggle switch (Base UI Switch.Root + Thumb). Forwards Base UI Switch props (`checked`, `disabled`, `onCheckedChange`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth; sets `data-elevation`. |

## TableInput

`import { TableInput } from "@tarassov-ch/swiss-function/table-input"`

A compact, editable table used as a form control, for entering an **array of
objects** (one row per object). Each column names a property on the row and
picks a cell editor via the same `edit` config `DataTable` uses
(`text`→`TextEditInline`, `number`→`DigitInputMicro`, `boolean`→`Checkbox`,
`select`/`date`→`Picker`/`DatePicker`); the cells are always-on editors, not
click-to-edit. Rows are added with a footer button and removed with a per-row
trash button, and can be dragged to reorder (opt-in `reorderable`, which
lazy-loads dnd-kit). Controlled only: pass `value` (the rows) and `onChange`
(the next rows). Drop it inside a `Field` like any other control. The header and
every row share one grid (a CSS `subgrid`), so cells line up like a table. A
`width` is a column's **preferred** size; each column shrinks only toward its
`minWidth` floor (a per-editor default, or `minColumnWidth` for text/select/date
columns), and once every column is at its floor and they still don't fit, the
table **scrolls horizontally** instead of collapsing columns into each other.
`equalColumns` gives every column an equal share instead. Every cell control
fills its column and shrinks with it, so a right-aligned value has no dead space
on its left and a control never overflows into the next column.

**Elements / Parts:** `TableInput` (a single component; columns are data, not
JSX children).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `columns` | `TableInputColumn<T>[]` | n/a | Column defs: `key` (the row property), `header`, `edit` (the `EditConfig`), optional `width` (preferred size in `--sf-unit` multiples), `minWidth` (the column never shrinks below this; defaults to a per-editor floor capped at `width`) and `align`. |
| `value` | `T[]` | n/a | The rows (controlled). |
| `onChange` | `(rows: T[]) => void` | n/a | Called with the next rows after any edit, add, delete or reorder. |
| `newRow` | `() => T` | empty cells | Build a blank row on add; defaults to `""` / `null` / `false` per column edit type. |
| `showHeader` | `boolean` | `true` | Show the header row. |
| `minRows` | `number` | `0` | Delete is disabled at or below this count. |
| `maxRows` | `number` | `Infinity` | Add is disabled at or above this count. |
| `equalColumns` | `boolean` | `false` | Give every data column an equal share, ignoring per-column `width`. |
| `minColumnWidth` | `number` | `6` | Default minimum width (in `--sf-unit` multiples) for text/select/date columns without their own `minWidth`. The table scrolls horizontally once columns can't all fit at their minimums. |
| `reorderable` | `boolean` | `false` | Drag rows to reorder (adds a grip column; lazy-loads dnd-kit). |
| `addLabel` | `ReactNode` | `"Add row"` | Add-button label. |
| `disabled` | `boolean` | `false` | Disable the whole control (the rows become `inert`). |
| `size` | `"sm" \| "md"` | `"sm"` | Cell size, mirroring the inner controls. |

```tsx
<TableInput
  columns={[
    { key: "ticker", header: "Ticker", edit: { type: "text" } },
    { key: "shares", header: "Shares", edit: { type: "number", decimals: 0 }, width: 6, align: "end" },
    { key: "class", header: "Class", edit: { type: "select", options: CLASSES }, width: 8 },
  ]}
  value={rows}
  onChange={setRows}
  reorderable
/>
```

## Tabs

`import { Tabs } from "@tarassov-ch/swiss-function/tabs"`

Tabbed navigation exposing Base UI's Tabs compound API. Parts forward Base UI props. The active tab reads as the primary colour + **bold** caption + the underline `Indicator`; the bold width is reserved (a hidden bold copy of the label), so selecting a tab never reflows the row (issue #41). The active state is keyed off `aria-selected`.

**Elements / Parts:** `Root`, `List`, `Tab` (wraps its label in a `.label` span for the width reserve, pass plain-text labels to get it), `Indicator` (active underline), `Panel` (paired by index).

## TextEdit

`import { TextEdit } from "@tarassov-ch/swiss-function/text-edit"`

Styled `<textarea>`. Extends `TextareaHTMLAttributes<HTMLTextAreaElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `rows` | `number` | `3` | Initial textarea rows. |

## TextEditInline

`import { TextEditInline } from "@tarassov-ch/swiss-function/text-edit-inline"`

A `<textarea>` that rests as a single line and expands to a multi-line editor on hover or focus. The expanded editor is absolutely positioned, so it *overlays* the content below (lifted to `--sf-elevation-3`) instead of pushing it down; leaving (blur + pointer-out) collapses it back to one line, ellipsized (`…`) when the value overflows. While expanded it auto-grows with its content and is **vertically resizable** by the drag handle; once dragged, the manual height stands (auto-grow yields). Extends `TextareaHTMLAttributes<HTMLTextAreaElement>`. `TextEditInlineSize = "sm" | "md" | "lg"`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `TextEditInlineSize` | `"md"` | Resting single-line height, matching `Input`: `sm` 1u / `md` 1.5u / `lg` 2u. |
| `maxRows` | `number` | `8` | Lines the expanded overlay grows to before it scrolls. |

While expanded the root carries `data-expanded="true"` (hook for container styling). The collapsed preview is an `aria-hidden` decorative line; the real `<textarea>` stays focusable behind it.

## ThemeBuilder

`import { ThemeBuilder } from "@tarassov-ch/swiss-function/theme-builder"`

Live editor for the `--sf-*` tokens (issue #50): tweak the curated palette / unit / radius / typography / motion and watch a component sample **retheme instantly** (overrides are applied as inline custom properties on the preview scope), then copy the result as a **CSS theme** or **JSON**. `tokens.css` stays the canonical source. This only makes *overriding* it ergonomic (anti-scope: it does not change the default palette). Container-responsive (JS-free): controls beside the preview when wide, stacked when narrow.

Colours are edited **per theme** (a Light/Dark toggle) and export under `:root` / `[data-theme="dark"]`; dimension/typography/motion tokens are theme-agnostic and export to `:root`. Only *changed* tokens appear in the output.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `defaultTheme` | `"light" \| "dark"` | `"light"` | Which theme the colour controls edit first. |
| `tokens` | `ThemeToken[]` | curated set | Override the authorable token list. |
| `onChange` | `(overrides: ThemeOverrides) => void` | n/a | Fires with the full changed-only override map (`{ base, light, dark }`). |
| `children` | `ReactNode` | sample gallery | Preview content rendered under the live theme. |

Also exports the pure serialisers `themeToCss(overrides)` / `themeToJson(overrides)` and the `ThemeToken` / `ThemeOverrides` types.

**Token pipeline**: the same canonical `tokens.css` is emitted to other targets at build (`scripts/tokens/build.mjs`, run as the tail of `npm run build`; standalone `npm run tokens:build`):

- `@tarassov-ch/swiss-function/tokens.json`: `{ light, dark }` declared values.
- `@tarassov-ch/swiss-function/tokens.js`: `values` + `vars` (camelCased `var()` accessors, e.g. `vars.colorFg === "var(--sf-color-fg)"`) for JS/canvas-land.
- `@tarassov-ch/swiss-function/tokens.style-dictionary.json`: a Style-Dictionary-format tree, so the tokens can be fed into Style Dictionary downstream for further targets. (A lightweight in-repo pipeline is used rather than the `style-dictionary` package, which would want a JSON source as canonical.)

## Timeline

`import { Timeline } from "@tarassov-ch/swiss-function/timeline"`

Horizontal time axis with ticks, event markers, optional scrubbing/range selection, and a condensed strip mode. Extends `HTMLAttributes<HTMLDivElement>`. `TimelineSnap = "none" | "events" | "ticks"`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `start` / `end` | `Date` | n/a | Axis range (required). |
| `value` | `Date` | n/a | Playhead (controlled); renders a draggable scrubber. |
| `onChange` | `(date: Date) => void` | n/a | Scrub/click; omit for read-only. |
| `rangeValue` | `[Date, Date]` | n/a | Range selection (two handles + band); takes over from the playhead. |
| `onRangeChange` | `(range: [Date, Date]) => void` | n/a | Range drag/click. |
| `snap` | `TimelineSnap` | `"none"` | Snap scrubbing to events or ticks. |
| `height` | `number \| string` | auto | Defaults to fit the lane count. |
| `showNow` | `boolean` | `true` | Faint line at the current time. |
| `maxLanes` | `number` | `3` | Max label-stacking lanes. Labels that can't be placed collision-free within them are hidden at rest and revealed on hover/focus (markers stay visible). |
| `pxPerDay` | `number` | n/a | Minimum px per day: the track gets a min inline size of `days × pxPerDay`, so a too-wide range scrolls horizontally instead of compressing. Unset = fit-to-container. |
| `tickSpacing` | `number` | tuned (~80 to 200px) | Target min px between ticks; unit chosen so neighbours sit at least this far apart. Larger = sparser. |
| `compact` | `boolean` | `false` | Condensed strip, labels hidden at rest. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Strip height; implies the strip. `sm` value label shrinks to 75%. |
| `bordered` | `boolean` | `false` | Input-style frame. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `0` | Resting depth; pairs with `bordered`. |
| `valueLabel` | `boolean` | `false` | Floating value tag above playhead/handles. |
| `formatValue` | `(date: Date) => ReactNode` | ISO `YYYY-MM-DD` | Value-tag formatter. |
| `color` | `string` | `var(--sf-color-primary)` | Accent (playhead, now line, markers, range band, value tag). |
| `rangeOpacity` | `number` | `0.12` | Opacity (0 to 1) of the range-selection highlight band's fill (border tracks it, slightly more opaque). |

**Elements / Parts:** `Timeline.Event`: `{ date: Date; onClick?: () => void; children }`.
With `onClick` it becomes an interactive button.

```tsx
<Timeline start={start} end={end} value={value} onChange={setValue}
          valueLabel color="var(--sf-color-success)" tickSpacing={100}>
  <Timeline.Event date={beta}>Beta</Timeline.Event>
</Timeline>
```

## ToggleGroup

`import { ToggleGroup } from "@tarassov-ch/swiss-function/toggle-group"`

Toggle button group exposing Base UI's ToggleGroup with a size cascade. Forwards Base UI props (`value`, `onValueChange`, `toggleMultiple`, …).

**Elements / Parts:** `ToggleGroup.Root` (group), `ToggleGroup.Item` (`value: string`, required).

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `size` | `Root` | `"sm" \| "md" \| "lg"` | `"md"` | Cascades to all items. |

## VerticalForm

`import { VerticalForm } from "@tarassov-ch/swiss-function/vertical-form"`

A tall, one-field-per-row form that scrolls and is navigated by a `Minimap`
rail. It fills the gap between `FieldLayout` (justified, wrapping rows for
horizontal density) and `Form` (state + validation): here every field gets its
own row, a `Box` surface holding a vertical `Field` (label, control,
description, optional error), the whole stack scrolls inside a component-owned
container, and the field names (and section titles) become clickable markers on
the rail. An errored field also shows a danger tick on the rail.

**Presentational**: layout and navigation only. Form state, validation, and
submit stay with the consumer, wrap it in `Form` when you want those. It reuses
`Field`, `Box`, and `Minimap` directly; the only added machinery measures each
row's offset within the scroll content and feeds `Minimap` its `markers` array
(re-supplied on resize). **The parent must constrain the height** (like `Pane`
and `Minimap`); otherwise the content never overflows and the rail never
appears. The rail hides itself when the content fits.

**Elements / Parts:** `VerticalForm` (Root; renders the Minimap + scroll
container), `VerticalForm.Section` (a titled group; its title is a level-1 rail
label and its fields become level-2), `VerticalForm.Field` (one row).

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `elevation` | `Root` | `BoxElevation` (0..5) | `1` | Default surface elevation for every row. |
| `side` | `Root` | `"left" \| "right"` | `"right"` | Which edge the Minimap rail occupies. |
| `minimapWidth` | `Root` | `number` | n/a | Rail width in `--sf-unit` multiples (forwarded to `Minimap`'s `width`). |
| `padding` | `Root` | `number` | `1` | Content padding in `--sf-unit` multiples. |
| `nav` | `Root` | `boolean` | `false` | Show a bottom navigation bar: a searchable `Picker` of every title (sections and indented fields). Selecting one centers it in the viewport; scrolling updates the Picker to the title at the viewport centre (the first at rest, so it is never empty). |
| `navSize` | `Root` | `"sm" \| "md" \| "lg"` | `"sm"` | Size of the nav bar `Picker`. |
| `minBlock` | `Root` | `number` | `0.5` | Minimum rail block height per field in `--sf-unit` multiples; blocks never compress below this (a denser form scrolls its rail). Forwarded to `Minimap`'s `minMarkerSize`. |
| `maxBlock` | `Root` | `number` | n/a | Maximum rail block height per field in `--sf-unit` multiples (caps a sparse form's tall blocks). Forwarded to `Minimap`'s `maxMarkerSize`. |
| `bare` | `Root` | `boolean` | `false` | Render rows without the surrounding `Box` (no surface, no box padding) for a minimal look. The `elevation` props are then ignored. |
| `title` | `Section` | `ReactNode` | n/a | Section heading; a string also becomes a level-1 rail label. |
| `label` | `Field` | `ReactNode` | n/a | Field name above the control; a string also becomes a rail label. |
| `description` | `Field` | `ReactNode` | n/a | Supplementary copy below the control (full-strength fg, never grey). On a wide row it moves to the right of the control (a container query on the row); it drops back below when narrow. |
| `error` | `Field` | `ReactNode` | n/a | Error below the control; also tones the row's rail block and its rail label `danger`. |
| `required` | `Field` | `boolean` | `false` | Shows a `*` on the label (visual only). |
| `hotkey` | `Field` | `string` | n/a | "Jump to this field" shortcut badge (see `Field`'s `hotkey`). |
| `elevation` | `Field` | `BoxElevation` | Root's | Per-row surface override. |
| `children` | `Field` | `ReactNode` | n/a | The control (`Input`, `DatePicker`, `Selector`, `TextEdit`, …). |

Each row reads on the rail as a filled dither **block span** of its own height
(the density read), with its name as a caption riding on top. The forwarded ref
(on the Root) targets the Minimap **scroll element**. A field or section with a
non-string name contributes a bare block span (no label). Also exported:
`buildMarkers` (the pure entries → `MinimapMarker[]` assembly) for testing.

Tokens: sets `--vf-pad` per instance; inherits `--sf-minimap-width` from `Minimap`.

```tsx
<div style={{ height: "24rem" }}>
  <VerticalForm>
    <VerticalForm.Section title="Account">
      <VerticalForm.Field label="Email" description="We never share it." required>
        <Input type="email" />
      </VerticalForm.Field>
      <VerticalForm.Field label="Password" error="Too short.">
        <Input type="password" />
      </VerticalForm.Field>
    </VerticalForm.Section>
    <VerticalForm.Field label="Notes">
      <TextEdit />
    </VerticalForm.Field>
  </VerticalForm>
</div>
```

## WindowArray

`import { WindowArray } from "@tarassov-ch/swiss-function/window-array"`

A window-manager main area in the style of Niri's scrollable tiling: an infinitely horizontally-scrollable strip of columns, each column a vertical stack of equal-height windows with Dialog-style chrome (title bar, optional ✕ and fullscreen buttons). Declarative: the consumer owns the column/window list and re-renders it; the component reports every rearrangement through `onWindowMove` and never mutates order itself. Fills its parent, so give the parent a height.

When the container is narrower than `verticalBelow` (with the default `orientation="auto"`), the strip transposes: it scrolls top-to-bottom, each column becomes a full-width band whose height is the column's width value, and the column's windows sit side by side inside the band. Arrow keys, Shift+moves, drops, gutter resizing, snap, and paddles all follow the layout axis; the model, ids, and `WindowMove` indices are identical in both orientations.

The wheel follows the layout axis too: a plain wheel scrolls **along** the strip (sideways when horizontal, down when vertical; a vertical trackpad/mouse wheel drives the horizontal strip so no Shift is needed), and **Shift+wheel** drives the cross axis (the window body under the pointer). A plain wheel over a window body scrolls the strip, not the body; hold Shift to scroll the body. When the strip doesn't overflow, plain-wheel handling steps aside so bodies scroll natively.

**Parts:** `WindowArray` (root), `WindowArray.Column`, `WindowArray.Window`, `WindowArray.WindowButton`. Column and Window are data carriers projected by the root (like `Reflow.Column`): they must be direct children (fragments and `.map` are fine; wrapper components are invisible to collection). `WindowButton` is a plain `<button>` sharing the ✕/fullscreen chrome exactly. Use it inside a Window's `actions` so custom title-bar buttons blend in.

| Prop (root) | Type | Default | Notes |
| --- | --- | --- | --- |
| `activeId` / `defaultActiveId` / `onActiveChange` | `string \| null` | `null` | Active window (primary border, the roving Tab stop). |
| `fullscreenId` / `defaultFullscreenId` / `onFullscreenChange` | `string \| null` | `null` | At most one window covers the WindowArray container (not the browser viewport). Escape exits. |
| `onWindowMove` | `(move: WindowMove) => void` | n/a | Enables rearranging (title-bar drag and Shift+Arrow). Absent → rearranging off. |
| `gap` | `number \| string` | `0.5` | Gap between columns/windows (`number` → `u` multiples); also the resize-gutter width. |
| `columnMinWidth` | `number` | `240` | Default resize floor in px, per column overridable. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `1` | Resting shadow depth for the windows (`--sf-elevation-N`); fullscreen windows stay flat. |
| `snap` | `boolean` | `false` | Proximity scroll-snap: columns settle flush with the nearest viewport edge, gutter in view (free scrolling stays possible; suspended mid-drag/resize so gestures aren't fought). |
| `controls` | `boolean` | `false` | Floating prev/next paddles at the inline edges that switch the active window to the neighbouring column (disabled at the strip's ends; hidden while fullscreen). Each paddle fades in while the pointer is within 80px of its edge (or on keyboard focus); on hoverless devices both stay visible. Also hides the horizontal scrollbar; the strip still scrolls by wheel, keyboard, and drag. |
| `apiRef` | `Ref<WindowArrayHandle>` | n/a | Imperative handle for a consumer's central hotkey system (issue #32): `switchColumn("prev" \| "next")` and `focusActive()`. WindowArray binds **no** column-switch shortcut itself; wire your own keys (e.g. Alt+Arrow) and call the handle. Replaces the removed `hotkeys` prop. |
| `orientation` | `"auto" \| "horizontal" \| "vertical"` | `"auto"` | Layout axis. `"auto"` watches the container's width and goes vertical below `verticalBelow`; the explicit values force a mode. |
| `verticalBelow` | `number` | `480` | Container width (px) below which `"auto"` transposes to the vertical strip. |

| Prop (Column) | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | n/a | Stable identity for move targets and width callbacks. |
| `width` / `defaultWidth` / `onWidthChange` | `number` | n/a / `480` | The column's size in px along the scroll axis: its width, or its band height in the vertical orientation (one state for both). Controlled or uncontrolled; the callback fires when a resize settles (drag end, key press, double-click reset, which restores `defaultWidth`). |
| `minWidth` | `number` | root's `columnMinWidth` | |
| `resizable` | `boolean` | `true` | `false` removes the column's trailing resize gutter. |

| Prop (Window) | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | n/a | Stable identity; also keys active/fullscreen state. |
| `title` | `ReactNode` | n/a | Title-bar text and the window's accessible label. |
| `onClose` | `() => void` | n/a | Renders the ✕. Closing = removing the element from your state. |
| `maximizable` | `boolean` | `true` | Shows the fullscreen toggle. |
| `movable` | `boolean` | `true` | Per-window opt-out of drag/keyboard rearranging. |
| `actions` | `ReactNode` | n/a | Extra icon buttons before maximize/close (never start a drag). Use `WindowArray.WindowButton` for chrome-matching styling; give each an `aria-label` and a 16px line-set icon. |

`WindowMove` is `{ windowId, from: { columnId, index }, to }` where `to` is `{ type: "cell", columnId, index }` (into an existing column) or `{ type: "column", index }` (break out into a new column at that strip position: pointer drops on a gutter, or Shift+Left/Right at the strip's ends). **Index convention:** every `to` index is relative to the state after the window left its source column *and* after an emptied source column was removed. Applying a move is two splices, no off-by-one:

```tsx
const [columns, setColumns] = useState(initial);
<div style={{ height: "100vh" }}>
  <WindowArray aria-label="Workspace" defaultActiveId="editor"
    onWindowMove={(m) => setColumns((cols) => applyMove(cols, m))}>
    {columns.map((col) => (
      <WindowArray.Column key={col.id} id={col.id} defaultWidth={420}>
        {col.windows.map((w) => (
          <WindowArray.Window key={w.id} id={w.id} title={w.title}
            onClose={() => setColumns((cols) => remove(cols, w.id))}>
            {w.content}
          </WindowArray.Window>
        ))}
      </WindowArray.Column>
    ))}
  </WindowArray>
</div>
// applyMove: splice the window out of from.columnId; drop that column if now
// empty; then splice into to.columnId at to.index (or insert a new column).
```

Keyboard (on a focused title bar; each window's title is a real button and the strip has a single roving Tab stop): Arrows move focus between windows (left/right clamp the row to the neighbour column), Home/End jump to the strip's first/last column, Shift+Arrow moves the window itself, Escape exits fullscreen. In the vertical orientation arrows follow the transposed layout (up/down switch bands, left/right walk within a band; same for Shift+moves). Column *switching* from anywhere (including focused window content) is no longer a built-in shortcut. Bind your own key via the central hotkey layer and call `apiRef.switchColumn(...)` (issue #32). Focus moves auto-scroll the strip (container-scoped; minimal reveal: the column lands flush with the nearest edge, its gutter kept in view); scrolling is smooth via CSS `scroll-behavior`, instant under `prefers-reduced-motion`. Gutters are `role="separator"` with `aria-valuenow/min`: arrows resize by 8px (Shift 24px), double-click resets. Windows are `role="group"` labelled by their title. When the active window closes, focus hands off to its successor (next in column, then previous, then the nearest column).

Notes: windows render as flat, keyed siblings of one strip grid and are placed into columns purely by grid coordinates, so a move (any direction, including across columns) never remounts a window: React state and DOM state (inputs, scroll) survive; an `<iframe>` may still reload when a move reorders the DOM. The window body scrolls internally. Empty columns render as one full-height drop target; removing an emptied column is the consumer's call. The strip's background is the same muted dither as DataTable's `columnFill` (recolor via `--sf-wa-fill-color`), a stationary "desk" the windows slide over, visible in the gaps and wherever columns don't reach. Near-exact fits are forgiven: up to 8px of natural overflow is absorbed by narrowing the last column's rendered width (the width *state* is untouched), so a layout meant to fill 100% never grows a horizontal scrollbar.

---

## CSS variables set per-instance

Set via a prop or inline style and read by the component's stylesheet:

| Variable | Component | Set by |
| --- | --- | --- |
| `--sf-timeline-color` | Timeline | `color` prop |
| `--sf-timeline-range-opacity` | Timeline | `rangeOpacity` prop |
| `--sf-datatable-fade-rows` | DataTable | `edgeFade.rows` |
| `--sf-datatable-fade-density` | DataTable | `edgeFade.density` |
| `--sf-datatable-col-min` | DataTable | minimum column width (default `3u`) |
| `--sf-fill-color` | DataTable | `columnFill.color`: the fill backdrop's dither colour |
| `--sf-dialog-x` / `--sf-dialog-y` | Dialog | drag position of a `draggable` Popup |
| `--sf-wa-gap` | WindowArray | `gap` prop: column/window gap and gutter width |
| `--sf-wa-elevation` | WindowArray | `elevation` prop: resting window shadow; inherits, so set it on an individual `WindowArray.Window` (`style`) to raise just that window |
