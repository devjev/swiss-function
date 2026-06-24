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
- Sizes (`sm`/`md`/`lg`) map to `--sf-unit` multiples — `1` / `1.5` / `2`
  (24 / 36 / 48px at the default unit).
- "u" means one `--sf-unit`. e.g. `0.25u` = `calc(var(--sf-unit) / 4)`.
- Styling is overridden through `--sf-*` custom properties, never by branching in
  JS. Dark mode is `[data-theme="dark"]` on any ancestor.
- Required props show `—` in the Default column. Props "extend `HTMLAttributes`"
  means native attributes pass through to the root and aren't re-listed.
- Many compound components are thin wrappers over Base UI (`@base-ui/react`);
  their parts forward props to the underlying primitive — see the Base UI docs
  for the full surface.

**Components (A–Z):** Accordion · BarChart · Box · BridgeChart · Button ·
ButtonGroup · Chat · Checkbox · Combobox · CommandBar · DataTable · Dialog ·
Explorer · Field · Fullscreen · Graph · Grid · Input · Markdown · Menu ·
NonIdealState · Outliner · Pane · Popover · Prose · Radio · Scatterplot ·
Selector · Skeleton · StreamingTerminalText · Switch · Tabs · TextEdit ·
Timeline · ToggleGroup

---

## Accordion

`import { Accordion } from "@tarassov-ch/swiss-function/accordion"`

Compound, collapsible sections. Wraps Base UI's Accordion. Extends `HTMLAttributes<HTMLDivElement>`.

**Elements / Parts:** `Accordion.Root` (container), `Accordion.Item` (one section),
`Accordion.Header` (semantic heading), `Accordion.Trigger` (toggles the panel),
`Accordion.Panel` (collapsible content).

## BarChart

`import { BarChart } from "@tarassov-ch/swiss-function/bar-chart"`

Responsive bar chart with Tufte/hover/full scaffolding modes. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `categories` | `string[]` | — | x-axis category labels. |
| `series` | `BarSeries[]` | — | `{ name, values, color? }` per series. |
| `yDomain` | `[number, number]` | auto-fit | Y range (zero-anchored when all positive). |
| `xLabel` / `yLabel` | `string` | — | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `showLegend` | `boolean` | `true` when >1 series | Legend below the x-axis. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. |
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

Waterfall/bridge chart of cumulative deltas and totals. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `BridgeItem[]` | — | `{ label, value, kind: "total" \| "delta" }`. |
| `yDomain` | `[number, number]` | auto-fit | Y range. |
| `yLabel` | `string` | — | Axis label. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `showConnectors` | `boolean` | `true` | Dashed connectors between bars. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. |
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
| `size` | `"sm" \| "md" \| "lg"` | — | Cascades to child Buttons; an explicit Button `size` wins. |

## CandlestickChart

`import { CandlestickChart } from "@tarassov-ch/swiss-function/candlestick-chart"`

OHLC financial candlestick chart. Candles are spaced evenly (index-based, no
time gaps); up candles (`close >= open`) are success-coloured, down candles
danger-coloured. Extends `HTMLAttributes<HTMLDivElement>`.
`Candle = { x: number | Date; open; high; low; close }`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `candles` | `Candle[]` | — | OHLC bars, chronological. |
| `yDomain` | `[number, number]` | auto-fit | Price range; auto-fit is padded and **not** zero-anchored. |
| `yLabel` / `xLabel` | `string` | — | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis/gridline posture (same as the other charts). |
| `renderTooltip` | `(c: Candle) => ReactNode` | mono O/H/L/C | Hover tooltip body. |

## Chat

`import { Chat } from "@tarassov-ch/swiss-function/chat"`

Conversational UI with message history, auto-scroll, and streaming. Auto-focuses the input when `disabled` flips to false. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `messages` | `ChatMessage[]` | — | `{ id, role: "user" \| "assistant", content?, parts?, isStreaming? }`. |
| `onSubmit` | `(text: string) => void` | — | Enter submits (Shift+Enter = newline); input clears. |
| `renderPart` | `(part, ctx) => ReactNode` | — | Render a custom (non-built-in) part by `type`. Return null to skip. |
| `onAction` | `(action: ChatAction) => void` | — | Fired when a user interacts with a choices / tree / custom block. |
| `placeholder` | `string` | `"Ask anything…"` | Input placeholder. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 20)` | Container height. |
| `disabled` | `boolean` | — | Blocks submit (e.g. while streaming). |

### Rich (non-text) responses

An assistant message can carry ordered **`parts`** instead of (or as well as) a single markdown `content` string. When `parts` is present it takes precedence; while streaming, only the trailing `text` part animates.

Built-in blocks render with a hard **terminal (TUI) aesthetic**: monospace, hairline-framed panels (`ChatBlock`), box-drawing tree guides, caret/`[x]` selection markers.

`ChatPart` is a union:

- `{ type: "text"; text }` — markdown (streams when it's the active block).
- `{ type: "choices"; prompt?; options: ChatChoice[]; multiple?; partId? }` — a terminal choice menu built on `Button` (monospace). Single-select shows a `›` caret on the hovered/focused row and submits on click; multi-select toggles `[x]`/`[ ]` and submits via Confirm. `ChatChoice` is `{ id, label, description?, value? }` — `description` renders as a dim `# comment`. Selection → `onAction({ type: "choices", value })` (`value` is the choice id, or `string[]` when `multiple`).
- `{ type: "tree"; roots: ChatTreeNode[]; partId? }` — a decision / orchestration tree rendered as a terminal directory tree (ASCII `├─ └─ │` guides). `ChatTreeNode` is `{ id, label, children? }`. Node click → `onAction({ type: "tree", value: nodeId })`.
- `{ type: string; partId?; [key]: unknown }` — any custom micro-UI; rendered by `renderPart`. Wrap it in **`ChatBlock`** (`import { ChatBlock } from "@tarassov-ch/swiss-function/chat"`; props `{ title?, children }`) to match the built-in TUI frame.

`onAction` receives `{ messageId, partId?, type, value }`. `Chat` stays headless — the app decides what an interaction does (e.g. append the picked option as the next user turn and stream a reply).

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

A composite: a `Chat` in a **resizable side panel that pushes the main content aside** (built on [SplitPane](#splitpane) — a split, not an overlay). You pass the main app as `children`; the chat lives in the panel. While the agent is **thinking**, an animated `NonIdealState` effect blooms from the centre outward (starting from zero) and fills the padding gutter around the chat, then clears when thinking ends. `thinking` and `open` are controlled by the consumer.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | The main app content (gets pushed; render your open/close toggle here). |
| `side` | `"left" \| "right" \| "top" \| "bottom"` | `"right"` | Edge the panel sits on. |
| `open` / `defaultOpen` / `onOpenChange` | — | — | Panel open state. |
| `title` | `ReactNode` | — | Caption shown at the left of the panel header. The header also carries a fullscreen toggle (pops the panel to a viewport overlay; Escape exits) and a close button (collapses the panel) on the right. |
| `resizable` | `boolean` | `true` | Drag the divider to resize; `false` = fixed panel, no divider. |
| `defaultSize` | `number` | `360` | Panel size in px (remembered across open/close). |
| `minSize` / `maxSize` | `number` | — | px clamps. |
| `onSizeChange` | `(px: number) => void` | — | Fired when a resize settles — persist it. |
| `padding` | `number \| string` | `1` | Gutter around the chat (the visible effect frame). `number` → `--sf-unit` multiples. |
| `thinking` | `boolean` | `false` | While true, the effect blooms behind the chat. |
| `onThinkingStart` / `onThinkingEnd` | `() => void` | — | Fired on the `thinking` false↔true transitions. |
| `effect` | `EffectName` | `"ripple"` | Background effect (any `NonIdealState` effect). |
| `color` | `string` | `var(--sf-color-primary)` | Effect colour (any CSS colour). |
| `speed` | `number` | `1` | Effect animation speed multiplier. |
| `wash` | `string \| false` | — | The always-on panel tint behind the chat. A CSS colour overrides it; `false` disables it. Default: a faint 7% wash of `color`. |
| `messages` / `onSubmit` / `onAction` / `renderPart` / `placeholder` | — | — | Passed through to `Chat`. |
| `disabled` | `boolean` | `thinking` | Disables the input; defaults to locking while thinking. |

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

## Combobox

`import { Combobox } from "@tarassov-ch/swiss-function/combobox"`

A thin wrapper over Base UI's Combobox with library styling. Compound API. For single-select autocomplete use it directly; for an opinionated multi-select prefer [Selector](#selector).

**Parts:** `Root`, `Input`, `InputGroup`, `Portal`, `Positioner`, `Popup`,
`List`, `Item`, `ItemIndicator`, `Empty`, `Value`, `Chips`, `Chip`, `ChipRemove`,
`Clear`.

`Root` forwards Base UI props. Most-used: `items`, `multiple`, `value` /
`defaultValue`, `onValueChange`, `disabled`. `Positioner` carries the dropdown
`z-index` so the popup paints above page chrome (e.g. a DataTable sticky header).

```tsx
<Combobox.Root items={fruits}>
  <Combobox.Input placeholder="Search fruit…" />
  <Combobox.Portal>
    <Combobox.Positioner sideOffset={4}>
      <Combobox.Popup>
        <Combobox.Empty>No results</Combobox.Empty>
        <Combobox.List>
          {(fruit: string) => (
            <Combobox.Item key={fruit} value={fruit}>
              <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
              {fruit}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Positioner>
  </Combobox.Portal>
</Combobox.Root>
```

## CommandBar

`import { CommandBar } from "@tarassov-ch/swiss-function/command-bar"`

Compound menu bar (top or bottom edge) with a search slot and nested submenus. Wraps Base UI's Menubar/Menu.

**Elements / Parts:** `Root` (bar container), `Menu`, `Trigger`, `Content`
(portal + Box popup, elevation 3), `Item`, `Separator`, `Submenu`,
`SubmenuTrigger`, `SubmenuContent`, `Logo` (left slot), `Search` (right-aligned,
wraps `Input` size `sm`).

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `position` | `Root` | `"top" \| "bottom"` | `"top"` | Edge with the hairline; flips menu open direction. |
| `shortcut` | `Item` | `string` | — | Right-aligned hint; mirrored to `aria-keyshortcuts`. |

## DataTable

`import { DataTable } from "@tarassov-ch/swiss-function/data-table"`

Virtualized, spreadsheet-style data grid (`DataTable<T>`). Extends `HTMLAttributes<HTMLElement>` (minus `children` / `onChange`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `T[]` | — | Rows. |
| `columns` | `ColumnDef<T>[]` | — | Column tree (leaves + groups). |
| `editable` | `boolean` | `false` | Click-to-edit + paste-to-update. Per-column via `edit`. |
| `onCellChange` | `(changes: CellChange[]) => void` | — | Edit/paste committed; consumer updates `data`. |
| `onSelectionChange` | `(selection: Selection) => void` | — | Active cell / range changed. |
| `paginate` | `PaginateConfig` | — | Opt into pagination instead of virtualization. |
| `rowHeight` | `number` | `36` | Px (matches `--sf-unit * 1.5`). |
| `height` | `number \| string` | `400` | Viewport cap; sizes to content when it fits. |
| `empty` | `ReactNode` | — | Empty-state slot. |
| `resizableColumns` | `boolean` | `true` | Drag/keyboard column resize; lock one via `resizable: false`. |
| `scrollSnap` | `"none" \| "rows" \| "columns" \| "both"` | `"none"` | Proximity scroll-snap. |
| `edgeFade` | `boolean \| { rows?: number; density?: number }` | `false` | Dithered bottom-edge fade. `rows` = depth in rows (2), `density` = peak dot opacity 0–1 (1). |
| `columnFill` | `boolean \| { animated?: boolean; effect?: EffectName; color?: string; density?: number; speed?: number }` | `false` | Don't stretch the last column; keep columns fixed and fill the leftover space with a dither panel. `true` = static CSS dither; object opts into the animated WebGL dither / tunes it (`speed` is the animation rate, animated only). |
| `defaultColumnWidth` | `number` | `8` | Standard preferred width (in `--sf-unit` multiples) for columns without their own `width`. |
| `reorderableColumns` | `boolean` | `false` | Drag a leaf header to reorder columns (a leaf only moves within its own group). Click still sorts; the edge still resizes. |
| `filterableColumns` | `boolean` | `false` | Show a per-column header filter (funnel). Control type follows the column's `edit.type` (text/select/boolean → value checklist; number → min/max range). Exclude a column with `filterable: false`. Applies live. |
| `columnFilters` | `ColumnFiltersState` | — | Controlled filters (TanStack), with `onColumnFiltersChange`. |
| `defaultColumnFilters` | `ColumnFiltersState` | — | Uncontrolled initial filters. |
| `onColumnFiltersChange` | `(filters: ColumnFiltersState) => void` | — | Fired on each filter change — persist to save it. |
| `columnOrder` | `string[]` | — | Controlled column order (leaf ids), with `onColumnOrderChange`. |
| `defaultColumnOrder` | `string[]` | — | Uncontrolled initial order (e.g. restored from storage). |
| `onColumnOrderChange` | `(order: string[]) => void` | — | Fired with the full order on each reorder — persist to save it. |
| `columnWidths` | `Record<string, number>` | — | Controlled px width overrides by column id (with `onColumnWidthsChange`). |
| `defaultColumnWidths` | `Record<string, number>` | — | Uncontrolled initial px overrides (e.g. restored from storage). |
| `onColumnWidthsChange` | `(widths: Record<string, number>) => void` | — | Fired on resize/auto-fit — persist it to "save" the user's widths. |
| `getCellSpan` | `CellSpanFn<T>` | — | Visually merge cells (return `{ rowSpan, colSpan }` at the lead cell). |
| `getSubRows` | `(row: T) => T[] \| undefined` | — | Tree rows. |
| `treeColumn` | `string` | first leaf | Column owning the tree chevron + indent. |
| `defaultExpanded` | `ExpandedState` | — | Initial expansion (`true` = all). |
| `expanded` / `onExpandedChange` | `Record<string, boolean>` / fn | — | Controlled expansion. |
| `columnGroupsCollapsed` / `onColumnGroupsCollapsedChange` | `Record<string, boolean>` / fn | — | Controlled column-group collapse. |

**ColumnDef** — `LeafColumnDef<T> | GroupColumnDef<T>`:
- Leaf: `id`, `header`, `accessor` (`keyof T | (row) => unknown`), `cell?`,
  `width?` (u), `minWidth?` (u, default 3), `resizable?`, `align?`
  (`start|center|end`), `edit?` (`EditConfig`), `sortable?`, `filterable?`.
- Group: `id`, `header`, `columns`, `defaultCollapsed?`, `collapsedCell?`.
- `EditConfig`: `{ type: "text" | "number" | "boolean" }` or
  `{ type: "select"; options: { value; label }[] }`.

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

## Dialog

`import { Dialog } from "@tarassov-ch/swiss-function/dialog"`

Compound modal dialog with optional dragging and resizing. Wraps Base UI's Dialog.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Backdrop`, `Popup`, `Handle`
(drag grip, active only in a draggable Popup), `Title`, `Description`, `Close`.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `draggable` | `Popup` | `boolean` | — | Drag by `Handle`; sets `--sf-dialog-x` / `--sf-dialog-y`. |
| `resizable` | `Popup` | `boolean` | — | Resize from right/bottom/SE edges; arrow keys adjust, Escape exits. |

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
| `open` / `defaultOpen` / `onOpenChange` | `Root` | — | — | Base UI open-state API. |

Render a `Drawer.SwipeArea` (a grab rail pinned to the edge) **outside the
`Portal`** for an optional persistent handle that stays visible while closed and
reopens on swipe/drag. Panel size is set on `Drawer.Popup` (default 18u wide /
16u tall); put a `<Pane>` inside `Drawer.Content` for a header + scrollable body.

## Explorer

`import { Explorer } from "@tarassov-ch/swiss-function/explorer"`

Virtualized tree grid (`Explorer<M>`) with drag-to-reorder, rename-in-place, and a context menu. Fully controlled. Keyboard: arrows, Cmd/Ctrl+A, Delete, F2/Enter to edit.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `nodes` | `ExplorerNode<M>[]` | — | Root nodes; a node is a folder iff `children` is defined (even `[]`). |
| `columns` | `ExplorerColumn<M>[]` | — | First column becomes the tree column (chevron + indent + name). |
| `selectedIds` | `Set<string>` | `new Set()` | Controlled selection. |
| `onSelectionChange` | `(ids: Set<string>) => void` | — | Click / Shift-range / Ctrl-toggle / Cmd-A. |
| `expandedIds` | `Set<string>` | `new Set()` | Controlled expansion. |
| `onExpandedChange` | `(ids: Set<string>) => void` | — | Chevron click or Left/Right arrow. |
| `editingId` | `string \| null` | `null` | Controlled edit mode (one row at a time). |
| `onEditingChange` | `(id: string \| null) => void` | — | Double-click or F2/Enter. |
| `editable` | `boolean` | `false` | Enable context menu, DnD, rename, add, delete. |
| `onRename` | `(id, newName) => void` | — | Rename committed. |
| `onAdd` | `(parentId: string \| null, kind: "file" \| "folder") => void` | — | From context menu (null = root). |
| `onMove` | `(id, newParentId, beforeId?) => void` | — | Drag drop; `beforeId` for order, null = append. |
| `onDelete` | `(ids: string[]) => void` | — | Context menu or Delete/Backspace. |
| `icon` | `(node) => ReactNode` | — | Override the per-node glyph. |
| `showHeader` | `boolean` | `true` | Column header row. |
| `rowHeight` | `number` | `32` | Px (≈ `unit * 4/3`). |
| `height` | `number \| string` | `"100%"` | Viewport height; number = px, string = CSS. |

## Field

`import { Field } from "@tarassov-ch/swiss-function/field"`

Compound form field with label, description, and error. Wraps Base UI's Field.

**Elements / Parts:** `Root`, `Label` (shows `*` when `required`), `Description`,
`Error`.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `orientation` | `Root` | `"vertical" \| "horizontal"` | `"vertical"` | Stack vs side-by-side. |
| `required` | `Root` | `boolean` | `false` | Visual `*` on Label; add `required` to the control for HTML validation. |

## Fullscreen

`import { Fullscreen, FullscreenToggle } from "@tarassov-ch/swiss-function/fullscreen"`

Container that toggles into a fixed CSS viewport overlay (not OS fullscreen); Escape exits. `FullscreenToggle` is a reusable corner icon button.

| Prop | On | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `expanded` | both | `boolean` | — | Controlled state. |
| `defaultExpanded` | `Fullscreen` | `boolean` | `false` | Uncontrolled initial state. |
| `onExpandedChange` | `Fullscreen` | `(expanded: boolean) => void` | — | Button click or Escape. |
| `onToggle` | `FullscreenToggle` | `() => void` | — | Button click. |
| `buttonPosition` / `position` | `Fullscreen` / `Toggle` | `"top-right" \| "top-left" \| "bottom-right" \| "bottom-left"` | `"top-right"` | Corner. |

## Graph

`import { Graph } from "@tarassov-ch/swiss-function/graph"`

Network graph (Sigma.js) with force/tree/radial/concentric/grid layouts and optional drag-to-connect editing.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `GraphData` | — | `{ nodes, edges }` with arbitrary per-item data. |
| `layout` | `LayoutKind` | — | Controlled layout (animated transition on change). |
| `defaultLayout` | `"force" \| "tree" \| "radial" \| "concentric" \| "grid"` | `"force"` | Uncontrolled initial layout. |
| `onLayoutChange` | `(next: LayoutKind) => void` | — | Layout changed (prop/toolbar/keyboard). |
| `onNodeClick` / `onEdgeClick` | `(id: string) => void` | — | Clicks (edges clickable when `editable` or this is set). |
| `onSelectionChange` | `(id: string \| null) => void` | — | Selected node id. |
| `renderNode` / `renderEdge` | `(item) => NodeVisual \| EdgeVisual \| undefined` | — | Override visual attrs; omitted fields use defaults. |
| `onNodeContextMenu` | `(id, event) => void` | — | Before right-click menu opens. |
| `contextMenuItems` | `(target: GraphMenuTarget) => GraphMenuItem[]` | — | Custom menu (`[]` suppresses). |
| `editable` | `boolean` | `false` | Connect-mode edge creation + deletion. |
| `onEdgeCreate` | `({ id, source, target }) => void` | — | Connect drag completed. |
| `onEdgeDelete` | `(id: string) => void` | — | Edge deleted (menu/keyboard). |
| `generateEdgeId` | `() => string` | `edge-UUID`/counter | Custom edge id. |
| `fullscreen` | `boolean` | `true` | Corner fullscreen toggle. |
| `defaultFullscreen` | `boolean` | `false` | Uncontrolled fullscreen. |
| `onFullscreenChange` | `(expanded) => void` | — | Maximized/restored. |
| `fill` | `boolean` | `false` | Fill parent height (parent must set height). |
| `frame` | `boolean` | `true` | Border + corner; false when nested in a frame. |

**Elements / Parts:** `Graph.Controls` (zoom/fit/reset/layout/Connect toolbar),
`Graph.Minimap` (viewport overlay).

## Grid

`import { Grid } from "@tarassov-ch/swiss-function/grid"`

CSS-Grid layout wrapper with unit-scaled templates/gaps and optional draggable track resizing.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `columns` | `number \| string \| (number \| string)[]` | — | `number` → `repeat(N, minmax(0, 1fr))`; `string` → raw template; `array` → joined tracks. |
| `rows` | `number \| string \| (number \| string)[]` | — | Same shape, for rows. |
| `areas` | `string[]` | — | `grid-template-areas` row strings. |
| `gap` / `columnGap` / `rowGap` | `number \| string` | — | `number` → `--sf-unit` multiples; `string` → raw CSS. |
| `flow` | `"row" \| "column" \| "dense" \| "row dense" \| "column dense"` | — | `grid-auto-flow`. |
| `autoColumns` / `autoRows` | `string` | — | `grid-auto-columns` / `-rows`. |
| `alignItems` / `justifyItems` / `alignContent` / `justifyContent` | `CSSProperties[...]` | — | Alignment. |
| `inline` | `boolean` | `false` | `inline-grid` instead of `grid`. |
| `resizable` | `boolean \| "columns" \| "rows" \| "both"` | `false` | Draggable track boundaries. |
| `minTrackSize` | `number` | `48` | Min track px during resize. |
| `onTrackSizesChange` | `(axis, sizes: number[]) => void` | — | Resize settled (drag end / key / double-click reset). |
| `render` | `RenderProp` | `<div />` | Base UI render prop. |

**Elements / Parts:** `Grid.Item` — occupies cells via `area`, `col`/`row`, or
`colSpan`/`rowSpan`.

## Input

`import { Input } from "@tarassov-ch/swiss-function/input"`

Text input wrapping Base UI's Input. Extends `HTMLAttributes<HTMLInputElement>` and Base UI Input props.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `inputSize` | `"sm" \| "md" \| "lg"` | `"md"` | Visual size. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth (`--sf-elevation-N`). |

## Kbd

`import { Kbd } from "@tarassov-ch/swiss-function/kbd"`

Renders a keyboard shortcut as OS-aware keycaps — for labels, menus, tooltips. Extends `HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `combo` | `string` | — | `+`-separated combination, e.g. `"mod+shift+k"`, `"alt+enter"`. |
| `mac` | `boolean` | auto | Force macOS rendering. Auto-detected from the browser otherwise; pass it for SSR/tests so output is deterministic. |

`mod` is the **primary modifier** — `⌘` on macOS, `Ctrl` elsewhere (its aliases `cmd`/`command`/`meta` follow suit, so a "cmd" shortcut never shows `⌘` off-Mac). Other modifiers: `ctrl` (`⌃`/Ctrl), `alt`/`opt` (`⌥`/Alt), `shift` (`⇧`/Shift). Named keys resolve to glyphs (`enter` → `↵`, `esc` → `Esc`, `tab` → `⇥`, `arrowup` → `↑`, …); single letters uppercase. On macOS the glyphs render adjacent (`⌘⇧K`); elsewhere modifiers join with `+` (`Ctrl + Shift + K`).

```tsx
<Kbd combo="mod+k" />            // ⌘K on macOS, Ctrl+K elsewhere
<Kbd combo="mod+shift+enter" />
```

## Markdown

`import { Markdown } from "@tarassov-ch/swiss-function/markdown"`

Rendered Markdown (react-markdown + GFM) with optional double-click edit mode and an inline variant.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | — | Markdown source. |
| `editable` | `boolean` | `false` | Double-click to edit. |
| `onChange` | `(next: string) => void` | — | Commit (blur or Cmd/Ctrl+Enter). |
| `placeholder` | `string` | `"Nothing here yet."` | Shown when empty and not editing. |
| `editRows` | `number` | `4` | Min textarea rows when editing. |
| `preprocess` | `(source: string) => string` | — | Transform source before parse (render mode only). |
| `components` | `ReactMarkdown["components"]` | — | Override renderers. |
| `urlTransform` | `ReactMarkdown["urlTransform"]` | — | Custom URL sanitization. |
| `inline` | `boolean` | `false` | `<span>` wrappers, flattened paragraphs; editing unsupported. |
| `measured` | `boolean` | `false` | Cap prose to `--sf-measure`. `<Prose>` sets this. |

## Menu

`import { Menu } from "@tarassov-ch/swiss-function/menu"`

Dropdown menu wrapping Base UI's Menu. Parts forward all Base UI props.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Item`,
`Separator`, `Group`, `GroupLabel`.

## NonIdealState

`import { NonIdealState } from "@tarassov-ch/swiss-function/non-ideal-state"`

Empty / no-results / error / loading state rendered as a block with a dithered WebGL fill and centered message.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"empty" \| "no-results" \| "error" \| "loading"` | `"empty"` | Picks default effect/tint/a11y. `error`→`role="alert"`; `loading`→`role="status"` + `aria-busy`. |
| `title` | `ReactNode` | — | Headline. |
| `description` | `ReactNode` | — | Secondary line. |
| `action` | `ReactNode` | — | Action slot (usually a `Button`). |
| `effect` | `EffectName` | per-variant | Override fill effect. The `breathe`/`twinkle`/`interleave`/`rotate`/`stripes`/`diagonal`/`blocks`/`rings` set are subtle and evenly-covered (toggling dot patterns); `life` is Conway's Game of Life. |
| `speed` | `number` | `1` | Animation speed multiplier. |
| `density` | `number` | `0.6` | Fill coverage 0–1. |
| `effectOptions` | `EffectOptions` | — | Advanced tuning (ripple `wavelength`, `seed`). |
| `cellSize` | `number` | `7` | Dither cell px. |
| `color` | `string` | muted token | Base fill colour; `error` uses danger token. |
| `opacity` | `number` | `0.85` | Fill opacity 0–1. |
| `width` / `height` | `number \| string` | — | `number` → `--sf-unit` multiples; `string` → raw CSS. |

## Outliner

`import { Outliner } from "@tarassov-ch/swiss-function/outliner"`

Tree outline editor with collapsible bullets, keyboard nav, wiki-links, and block-ref transclusion. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `Bullet[]` | — | Tree; each bullet `{ id, content, collapsed?, children[] }`. |
| `onChange` | `(next: Bullet[]) => void` | — | Any mutation (edit, indent, delete, collapse, reorder). |
| `readOnly` | `boolean` | `false` | Navigation/read only. |
| `generateId` | `() => string` | `crypto.randomUUID()` | New-bullet id factory. |
| `onWikiLinkClick` | `(name: string) => void` | — | `[[wiki link]]` clicked. |
| `resolveBlockRef` | `(id: string) => string \| null` | — | Resolve `((block-id))`; null → "missing" placeholder. |

## Pane

`import { Pane } from "@tarassov-ch/swiss-function/pane"`

Full-height container with a fixed header and scrollable body (CSS-grid `auto / 1fr` with cascading `min-block-size: 0`). Parts extend `HTMLAttributes<HTMLDivElement>`.

**Elements / Parts:** `Pane.Root` (grid container), `Pane.Header` (auto-sized, no
scroll), `Pane.Body` (scrollable, `min-block-size: 0`).

## Popover

`import { Popover } from "@tarassov-ch/swiss-function/popover"`

Base UI Popover wrapper with themed styling.

**Elements / Parts:** `Root`, `Trigger`, `Portal`, `Positioner`, `Popup` (Box
elevation 3), `Title`, `Description`, `Arrow`, `Close`.

## Prose

`import { Prose } from "@tarassov-ch/swiss-function/prose"`

Virtualized Markdown document with an auto-generated heading outline and scroll-to-heading nav. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `source` | `string` | — | Markdown to parse (ignored if `blocks` given). |
| `blocks` | `ProseBlock[]` | — | Pre-parsed blocks; bypass the parser. |
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

## Scatterplot

`import { Scatterplot } from "@tarassov-ch/swiss-function/scatterplot"`

Responsive scatter plot with optional lines, multi-series, scaffolding modes, and a hover tooltip. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `series` | `ScatterSeries[]` | — | `{ name, data: { x: number\|Date, y, label? }[], color?, showLine?, showPoints? }`. |
| `xDomain` | `[number, number] \| [Date, Date]` | auto-fit | Detects date vs numeric. |
| `yDomain` | `[number, number]` | auto-fit | Y range. |
| `xLabel` / `yLabel` | `string` | — | Axis labels. |
| `height` | `number \| string` | `calc(var(--sf-unit) * 12)` | px or CSS value. |
| `showLegend` | `boolean` | `true` when >1 series | Legend below the x-axis. |
| `scaffolding` | `"minimal" \| "hover" \| "full"` | `"hover"` | Axis posture. |
| `renderTooltip` | `(datum: ScatterDatum & { series: string }) => ReactNode` | mono `(x, y)` | Custom tooltip. |

## Selector

`import { Selector } from "@tarassov-ch/swiss-function/selector"`

Opinionated, controlled multi-select built on Combobox. Extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`). `SelectorItem = string | { value, label }`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `SelectorItem[]` | — | Choices. |
| `value` | `string[]` | — | Controlled selection (pass with `onChange`). |
| `defaultValue` | `string[]` | `[]` | Uncontrolled initial selection. |
| `onChange` | `(value: string[]) => void` | — | Fired with the full selected set. |
| `placeholder` | `string` | `"Search…"` | Search placeholder. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Mirrors `Input`. |
| `layout` | `"panel" \| "inline" \| "compact"` | `"panel"` | See below. |
| `disabled` | `boolean` | — | Disable the control. |
| `emptyMessage` | `ReactNode` | `"No results"` | Dropdown empty state. |
| `bucketLabel` | `ReactNode` | `"Selected"` | Bucket heading — `panel` only. |
| `compactLabel` | `(count: number) => ReactNode` | `` `${n} item(s)` `` | Count wording — `compact` only. |

**Layouts:** `panel` (search + chip bucket below), `inline` (chips inside the
field, one row, overflow shows a trailing `⋯`), `compact` (collapses to "N items"
+ Clear for tight spaces; review/uncheck in the dropdown).

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
| `width` / `height` | `number \| string` | — | `number` → `--sf-unit` multiples; `string` → raw CSS. |
| `size` | `number \| string` | — | Shorthand for `width = height`. |
| `effect` | `EffectName` | — | Dithered effect instead of shimmer. |
| `speed` | `number` | — | Effect speed (with `effect`). |
| `density` | `number` | `0.6` | Effect coverage (with `effect`). |
| `cellSize` | `number` | — | Dither cell px (with `effect`). |
| `effectOptions` | `EffectOptions` | — | Advanced tuning (with `effect`). |
| `render` | `RenderProp` | `<div />` | Base UI render prop. |

## SplitPane

`import { SplitPane } from "@tarassov-ch/swiss-function/split-pane"`

A resizable split layout: a `SplitPane.Main` region and a collapsible `SplitPane.Panel` that **pushes** the main content aside (in document flow — not an overlay). Drag the divider to resize; closed → the panel collapses to zero and Main reclaims the space. Fills its parent, so give the parent a height.

**Parts:** `SplitPane` (root), `SplitPane.Main`, `SplitPane.Panel`. Also exports a `useSplitPane()` hook (`{ side, open, size, setOpen }`) for a close button inside the panel.

| Prop (root) | Type | Default | Notes |
| --- | --- | --- | --- |
| `side` | `"left" \| "right" \| "top" \| "bottom"` | `"right"` | Edge the panel sits on. |
| `open` / `defaultOpen` / `onOpenChange` | — | — | Panel open state (controlled or uncontrolled). |
| `resizable` | `boolean` | `true` | Drag the divider to resize; `false` removes it. |
| `defaultSize` | `number` | `320` | Panel size in px (remembered across open/close). |
| `minSize` / `maxSize` | `number` | `200` / — | px clamps. `maxSize` is also capped to the container minus a small main minimum. |
| `onSizeChange` | `(px: number) => void` | — | Fired when a resize settles, or on a keyboard step. |

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
| `content` | `string` | — | Full text received so far (grows as chunks arrive). |
| `isComplete` | `boolean` | — | True once no more text will arrive. |
| `tailLength` | `number` | `3` | Unrevealed letters held in the tail. |
| `charIntervalMs` | `number` | `64` | Ms per tick. |
| `shadeRamp` | `string[]` | `["▒", "▓"]` | Shade glyphs, far → near. |
| `spacePlaceholder` | `string` | `" "` | Glyph filling spaces in the tail. |

## Switch

`import { Switch } from "@tarassov-ch/swiss-function/switch"`

Toggle switch (Base UI Switch.Root + Thumb). Forwards Base UI Switch props (`checked`, `disabled`, `onCheckedChange`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth; sets `data-elevation`. |

## Tabs

`import { Tabs } from "@tarassov-ch/swiss-function/tabs"`

Tabbed navigation exposing Base UI's Tabs compound API. Parts forward Base UI props.

**Elements / Parts:** `Root`, `List`, `Tab`, `Indicator` (active underline),
`Panel` (paired by index).

## TextEdit

`import { TextEdit } from "@tarassov-ch/swiss-function/text-edit"`

Styled `<textarea>`. Extends `TextareaHTMLAttributes<HTMLTextAreaElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `rows` | `number` | `3` | Initial textarea rows. |

## Timeline

`import { Timeline } from "@tarassov-ch/swiss-function/timeline"`

Horizontal time axis with ticks, event markers, optional scrubbing/range selection, and a condensed strip mode. Extends `HTMLAttributes<HTMLDivElement>`. `TimelineSnap = "none" | "events" | "ticks"`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `start` / `end` | `Date` | — | Axis range (required). |
| `value` | `Date` | — | Playhead (controlled); renders a draggable scrubber. |
| `onChange` | `(date: Date) => void` | — | Scrub/click; omit for read-only. |
| `rangeValue` | `[Date, Date]` | — | Range selection (two handles + band); takes over from the playhead. |
| `onRangeChange` | `(range: [Date, Date]) => void` | — | Range drag/click. |
| `snap` | `TimelineSnap` | `"none"` | Snap scrubbing to events or ticks. |
| `height` | `number \| string` | auto | Defaults to fit the lane count. |
| `showNow` | `boolean` | `true` | Faint line at the current time. |
| `maxLanes` | `number` | `3` | Max label-stacking lanes. |
| `tickSpacing` | `number` | tuned (~80–200px) | Target min px between ticks; unit chosen so neighbours sit at least this far apart. Larger = sparser. |
| `compact` | `boolean` | `false` | Condensed strip — labels hidden at rest. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Strip height; implies the strip. `sm` value label shrinks to 75%. |
| `bordered` | `boolean` | `false` | Input-style frame. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `0` | Resting depth; pairs with `bordered`. |
| `valueLabel` | `boolean` | `false` | Floating value tag above playhead/handles. |
| `formatValue` | `(date: Date) => ReactNode` | ISO `YYYY-MM-DD` | Value-tag formatter. |
| `color` | `string` | `var(--sf-color-primary)` | Accent (playhead, now line, markers, range band, value tag). |
| `rangeOpacity` | `number` | `0.12` | Opacity (0–1) of the range-selection highlight band's fill (border tracks it, slightly more opaque). |

**Elements / Parts:** `Timeline.Event` — `{ date: Date; onClick?: () => void; children }`.
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
| `--sf-columns-width` | DataTable | columns' total width — placement of the `columnFill` dither panel |
| `--sf-dialog-x` / `--sf-dialog-y` | Dialog | drag position of a `draggable` Popup |
