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
| `Field`         | Compound for any form row: `Field.Root` + `Field.Label` + control + `Field.Description` + `Field.Error`. Don't roll your own. |
| `Input`         | Single-line text input. Monospace by design.              |
| `TextEdit`      | Multi-line / auto-growing text input.                     |
| `Checkbox`      | Binary independent toggles in lists.                      |
| `Radio`         | Single-choice within a group.                             |
| `Switch`        | Binary on/off for a setting, with an immediate effect.    |
| `ToggleGroup`   | Mutually-exclusive segmented control.                     |
| `Combobox`      | Input + filterable dropdown. For "type to find" choices.  |

### Surfaces & layout

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Box`           | A surface with `elevation={0..5}`. The atom of grouping. |
| `Grid`          | The layout primitive. CSS Grid wrapper with token-sized gaps. |
| `Pane`          | Full-height region split into Header (auto) + Body (scrollable). Compound: `Pane`, `Pane.Header`, `Pane.Body`. Nests cleanly. Use whenever a region needs to fill its parent and scroll its overflow internally. |

### Overlays

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Dialog`        | Modal interruption. Confirmations, forms, destructive actions. |
| `Popover`       | Anchored, click-triggered floating content.              |
| `Menu`          | Right-click or dropdown menus.                           |
| `CommandBar`    | Cmd-K command palette.                                   |

### Disclosure

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Accordion`     | Vertically stacked collapsible sections.                 |
| `Tabs`          | Horizontally peer-level views in the same surface.       |

### Data display

| Component                | Use for                                            |
| ------------------------ | -------------------------------------------------- |
| `DataTable`              | Tabular data — sorting, selection, virtualization. The serious one. |
| `Markdown`               | Rendering markdown content (uses remark-gfm).      |
| `Skeleton`               | Loading placeholder with shimmer (respects reduced-motion). |
| `StreamingTerminalText`  | Terminal/log output that arrives incrementally.    |

### Navigation

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Explorer`      | File-tree-style hierarchical navigation.                 |
| `Outliner`      | Outline editor with drag-reordering (dnd-kit underneath). |

### Charts

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Scatterplot`   | Points and/or lines on numeric or time axes. Series-based. |
| `BarChart`      | Categorical bars, single or grouped series.              |
| `BridgeChart`   | Waterfall / financier's bridge — totals + signed deltas. |
| `Timeline`      | Horizontal time strip with stacked event labels and a scrubbable playhead. |

All four charts default to `scaffolding="hover"` (Tufte-minimal idle, full
scale fades in on hover). Use `scaffolding="full"` for dense data,
`"minimal"` when you don't want any reveal.

### Graphs & networks

| Component | Use for                                                        |
| --------- | -------------------------------------------------------------- |
| `Graph`   | Node-link networks — dependency graphs, mind maps, concept trees — up to ~10k nodes interactively. Force / tree / radial / concentric / grid layouts (switchable at runtime), pan/zoom/fit + keyboard nav, minimap, right-click menu, and a hover inspector for each node/edge's `data`. Compound: `Graph`, `Graph.Controls`, `Graph.Minimap`. Distinct from the charts above — those plot values on axes; this draws relationships. |

### Communication

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `Chat`          | Message-stream UI for chat-style interfaces.             |

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
  `var(--sf-measure)`.
- **Motion**: `var(--sf-duration-fast)` / `-base` / `-slow` with
  `--sf-ease-out` or `--sf-ease-in-out`.
- **Elevation**: `var(--sf-elevation-N)` for surface depth, including
  inside SVG (use `filter: drop-shadow(...)` with equivalent values).

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
| "a tooltip" / "hover info"                         | `Popover` (or chart components' built-in tooltip) |
| "a dropdown" / "right-click menu"                  | `Menu`                                           |
| "a Cmd-K palette" / "quick switcher"               | `CommandBar`                                     |
| "fill the rest of the page" / "header + scrollable body" | `Pane` with `Pane.Header` + `Pane.Body`     |
| "a table"                                          | `DataTable` (almost always — it handles a lot)   |
| "tabs"                                             | `Tabs`                                           |
| "collapsible sections"                             | `Accordion`                                      |
| "a sidebar file tree"                              | `Explorer`                                       |
| "an outline / nested list editor"                  | `Outliner`                                       |
| "a timeline with events"                           | `Timeline`                                       |
| "a chart" / "graph this"                           | `BarChart` / `Scatterplot` / `BridgeChart` based on shape |
| "a network / dependency graph / mind map"          | `Graph`                                          |
| "loading state"                                    | `Skeleton`                                       |
| "streaming logs" / "terminal output"               | `StreamingTerminalText`                          |
| "markdown rendering"                               | `Markdown`                                       |
| "chat UI"                                          | `Chat`                                           |

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
