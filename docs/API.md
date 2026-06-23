# API reference

Per-component prop/element reference for the components actively shaped in this
workstream: **Button, Combobox, DataTable, Selector, Timeline**.

> Scope: this is a focused reference, not the full catalogue. For "when the user
> asks for X, reach for Y" guidance, token/`cx()` conventions, and the complete
> component list, see [AGENTS.md](../AGENTS.md). For *why* the library looks the
> way it does, see [AESTHETICS.md](../AESTHETICS.md).
>
> **Maintenance:** keep this file in sync with the code. Whenever a documented
> prop, default, element, or `--sf-*` variable changes, update the matching
> section in the same change.

## Conventions

- Every component is `forwardRef`, spreads unknown props to its root element, and
  merges `className` via `src/lib/cx.ts`.
- Sizes (`sm`/`md`/`lg`) map to `--sf-unit` multiples — `1` / `1.5` / `2`
  (24 / 36 / 48px at the default unit).
- "u" in this doc means one `--sf-unit`. e.g. `0.25u` = `calc(var(--sf-unit) / 4)`.
- Styling is overridden through `--sf-*` custom properties, never by branching in
  JS. Dark mode is `[data-theme="dark"]` on any ancestor.

---

## Button

`import { Button } from "@tarassov-ch/swiss-function/button"`

A single `<button>`. Extends `ButtonHTMLAttributes<HTMLButtonElement>`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"primary"` | Colour role. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Height + font. Inherits from an enclosing `<ButtonGroup size>`; an explicit `size` wins. |
| `tight` | `boolean` | `false` | Compact horizontal padding (`3/16u`) + `0.25u` icon/text gap. Height still comes from `size`, so tight buttons line up with non-tight peers. Composes with `size` and `variant`. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `2` | Resting depth, same `--sf-elevation-N` scale as `Box`. `ghost` is always flat. |

```tsx
<Button variant="secondary" size="sm" tight>
  <span aria-hidden="true">↻</span>
  Refresh
</Button>
```

---

## Combobox

`import { Combobox } from "@tarassov-ch/swiss-function/combobox"`

A thin wrapper over Base UI's Combobox (`@base-ui/react/combobox`) with library
styling. Compound API — compose the parts. For single-select autocomplete use it
directly; for an opinionated multi-select prefer [Selector](#selector).

**Parts** (namespace on `Combobox`):

`Root`, `Input`, `InputGroup`, `Portal`, `Positioner`, `Popup`, `List`, `Item`,
`ItemIndicator`, `Empty`, `Value`, `Chips`, `Chip`, `ChipRemove`, `Clear`.

`Root` forwards Base UI props directly. Most-used:

| Prop | Type | Notes |
| --- | --- | --- |
| `items` | `T[]` | Source list rendered by `List`'s render-prop. |
| `multiple` | `boolean` | Multi-select; selected values render as `Chip`s. |
| `value` / `defaultValue` | `T[] \| T` | Controlled / uncontrolled selection. |
| `onValueChange` | `(value) => void` | Selection changed. |
| `disabled` | `boolean` | Disable the control. |

See the Base UI Combobox docs for the full prop surface (filtering, open state,
positioning, etc.). `Positioner` carries the dropdown `z-index` so the popup
paints above page chrome like a DataTable sticky header.

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

---

## Selector

`import { Selector } from "@tarassov-ch/swiss-function/selector"`

Opinionated, controlled multi-select built on Combobox. Search a list, pick
several, see the chosen set. Extends `HTMLAttributes<HTMLDivElement>` (minus
`onChange`).

```ts
type SelectorItem = string | { value: string; label: string };
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `SelectorItem[]` | — | Choices. Bare string, or `{ value, label }`. |
| `value` | `string[]` | — | Controlled selection (pass with `onChange`). |
| `defaultValue` | `string[]` | `[]` | Uncontrolled initial selection. |
| `onChange` | `(value: string[]) => void` | — | Fired with the full selected set. |
| `placeholder` | `string` | `"Search…"` | Search field placeholder. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Mirrors `Input`. |
| `layout` | `"panel" \| "inline" \| "compact"` | `"panel"` | See below. |
| `disabled` | `boolean` | — | Disable the whole control. |
| `emptyMessage` | `ReactNode` | `"No results"` | Shown in the dropdown when the filter matches nothing. |
| `bucketLabel` | `ReactNode` | `"Selected"` | Heading for the bucket — `layout="panel"` only. |
| `compactLabel` | `(count: number) => ReactNode` | `` `${n} item${n===1?"":"s"}` `` | Count wording — `layout="compact"` only. |

**Layouts**

- `panel` — search field with a separate bucket of removable chips below.
- `inline` — chips sit inside the search field (tag-input). Strictly one row; chips
  clip and a trailing `⋯` appears when they overflow.
- `compact` — collapses to an "N items" count + Clear, sized to its content for
  tight spaces / toolbars. The full set is reviewed and unchecked in the dropdown.

Chips render in the body sans (the input stays monospace) with a muted half-drop
dither fill.

```tsx
<Selector
  layout="compact"
  items={cities}
  value={value}
  onChange={setValue}
  compactLabel={(n) => `${n} cities`}
/>
```

---

## DataTable

`import { DataTable } from "@tarassov-ch/swiss-function/datatable"`

Virtualized, spreadsheet-style data grid (`DataTable<T>`). Extends
`HTMLAttributes<HTMLElement>` (minus `children` / `onChange`).

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
| `edgeFade` | `boolean \| { rows?: number; density?: number }` | `false` | Dithered bottom-edge fade. `rows` = fade depth in rows (2), `density` = peak dot opacity 0–1 (1). |
| `getCellSpan` | `CellSpanFn<T>` | — | Visually merge cells (return `{ rowSpan, colSpan }` at the lead cell). |
| `getSubRows` | `(row: T) => T[] \| undefined` | — | Tree rows. |
| `treeColumn` | `string` | first leaf | Column owning the tree chevron + indent. |
| `defaultExpanded` | `ExpandedState` | — | Initial expansion (`true` = all). |
| `expanded` / `onExpandedChange` | `Record<string, boolean>` / fn | — | Controlled expansion. |
| `columnGroupsCollapsed` / `onColumnGroupsCollapsedChange` | `Record<string, boolean>` / fn | — | Controlled column-group collapse. |

**ColumnDef** — `LeafColumnDef<T> | GroupColumnDef<T>`:

Leaf: `id`, `header`, `accessor` (`keyof T | (row) => unknown`), `cell?`, `width?`
(u), `minWidth?` (u, default 3), `resizable?`, `align?` (`start|center|end`),
`edit?` (`EditConfig`), `sortable?`.

Group: `id`, `header`, `columns` (children), `defaultCollapsed?`, `collapsedCell?`.

`EditConfig`: `{ type: "text" | "number" | "boolean" }` or
`{ type: "select"; options: { value; label }[] }`.

**Keyboard / selection behaviour**

- With a selected cell, arrows move the active cell one cell and scroll it into
  view. Tab/Enter navigate Excel-style; Cmd/Ctrl+C/V copy/paste; Cmd/Ctrl+A
  selects all.
- With **no** cell selected, arrows scroll the viewport exactly one row / one
  column, snapped to the row-height grid and leaf-column boundaries.
- The range-selection tint is a translucent overlay painted *on top* of cell
  content, so a consumer-set cell background never hides the highlight.

```tsx
<DataTable
  data={rows}
  columns={columns}
  scrollSnap="rows"
  edgeFade={{ rows: 4, density: 0.6 }}
/>
```

---

## Timeline

`import { Timeline } from "@tarassov-ch/swiss-function/timeline"`

A horizontal time axis with ticks, event markers, optional scrubbing/range
selection, and a condensed control-strip mode. Extends
`HTMLAttributes<HTMLDivElement>`.

```ts
type TimelineSnap = "none" | "events" | "ticks";
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `start` / `end` | `Date` | — | Axis range (required). |
| `value` | `Date` | — | Playhead position (controlled); renders a draggable scrubber. |
| `onChange` | `(date: Date) => void` | — | Scrub/click; omit for read-only. |
| `rangeValue` | `[Date, Date]` | — | Range selection (two handles + band). Takes over from the single playhead. |
| `onRangeChange` | `(range: [Date, Date]) => void` | — | Range drag/click. |
| `snap` | `TimelineSnap` | `"none"` | Snap scrubbing to events or ticks. |
| `height` | `number \| string` | auto | Defaults to fit the lane count. |
| `showNow` | `boolean` | `true` | Faint vertical line at the current time. |
| `maxLanes` | `number` | `3` | Max stacking lanes for label collision avoidance. |
| `tickSpacing` | `number` | tuned (~80–200px) | Target **minimum px between ticks**; the unit (year/month/week/day/hour) is chosen so neighbours sit at least this far apart. Larger = sparser. |
| `compact` | `boolean` | `false` | Condensed control strip — labels hidden at rest. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Strip height; implies the control strip. The `sm` value label shrinks to 75%. |
| `bordered` | `boolean` | `false` | Input-style frame. |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` | `0` | Resting depth; pairs with `bordered`. |
| `valueLabel` | `boolean` | `false` | Floating value tag above playhead/handles. |
| `formatValue` | `(date: Date) => ReactNode` | ISO `YYYY-MM-DD` | Value-tag formatter. |
| `color` | `string` | `var(--sf-color-primary)` | Accent for playhead, now line, markers, range band, value tag. Any CSS colour or token reference. |

**Elements**

- `Timeline.Event` — `{ date: Date; onClick?: () => void; children }`. A marker on
  the axis; with `onClick` it becomes an interactive button.

```tsx
<Timeline start={start} end={end} value={value} onChange={setValue}
          valueLabel color="var(--sf-color-success)" tickSpacing={100}>
  <Timeline.Event date={beta}>Beta</Timeline.Event>
  <Timeline.Event date={ga}>v1.0</Timeline.Event>
</Timeline>
```

---

## CSS variables introduced by these components

These are set per-instance (via a prop or inline style) and read by the
component's stylesheet:

| Variable | Component | Set by |
| --- | --- | --- |
| `--sf-timeline-color` | Timeline | `color` prop |
| `--sf-datatable-fade-rows` | DataTable | `edgeFade.rows` |
| `--sf-datatable-fade-density` | DataTable | `edgeFade.density` |
| `--sf-datatable-col-min` | DataTable | minimum column width (default `3u`) |
