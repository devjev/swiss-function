# swiss-function

A React component library for dense, professional interfaces: form-heavy
apps, data tables, dashboards, internal tools. It is headless where it
matters (accessibility and behaviour come from [Base UI](https://base-ui.com))
and opinionated where it counts (a Swiss/Bauhaus visual language, styled with
CSS Modules and CSS custom property tokens).

If you are building a marketing site or a feed-style consumer product, this is
the wrong library. If you are building an instrument, read on.

## Why it might be for you

- **Behaviour is solved.** Focus traps, keyboard navigation, ARIA roles, and
  screen-reader semantics come from Base UI primitives. The library wraps them;
  it does not reinvent them.
- **Styling is tokens, not utilities.** No Tailwind, no CSS-in-JS, no utility
  classes. Every visual decision is a `--sf-*` custom property you can override
  at any scope. Retheme a subtree by setting a variable on an ancestor.
- **Dark mode for free.** Flip `data-theme="dark"` on any ancestor and every
  color token swaps. Components never branch on theme in JavaScript.
- **Built for density.** Sharp corners, full-strength text, typographic
  hierarchy, functional motion. It reads like a CAD tool or a financial
  terminal, not a 2020s SaaS dashboard. See [AESTHETICS.md](./AESTHETICS.md)
  for the reasoning.
- **More than the basics.** Beyond buttons and dialogs there are data tables,
  charts, a graph/network view, maps, a code editor, a reactive notebook, and
  a chat UI. See the [full catalogue](./AGENTS.md).
- **Tree-shakeable.** Per-component entry points and side-effect CSS keep your
  bundle honest.

## Install

```sh
npm install @tarassov-ch/swiss-function
```

Peer dependencies are `react` and `react-dom` (18 or 19).

Import the tokens once at your app root. Without them, components render
unstyled, because every rule references a `--sf-*` variable.

```ts
import "@tarassov-ch/swiss-function/tokens.css"; // required
import "@tarassov-ch/swiss-function/reset.css";  // recommended: box-model + base-font reset
import "@tarassov-ch/swiss-function/fonts.css";  // optional: bundled JetBrains Mono webfont
```

`fonts.css` loads the monospace face that `--sf-font-mono` prefers, via the
optional `@fontsource/jetbrains-mono` dependency. Skip it and monospace text
falls back to the system mono stack; nothing breaks.

## Quick start

```tsx
import { Field, Input, Button } from "@tarassov-ch/swiss-function";

function LoginRow() {
  return (
    <Field orientation="vertical" required>
      <Field.Label>Email</Field.Label>
      <Input type="email" placeholder="you@example.com" />
      <Field.Description>We never share your address.</Field.Description>
      <Button variant="primary">Continue</Button>
    </Field>
  );
}
```

Two import styles are supported. The barrel is convenient for prototyping;
prefer the per-component deep imports in production for the best tree-shaking.

```tsx
// Barrel
import { Button, Dialog } from "@tarassov-ch/swiss-function";

// Per-component (recommended in production)
import { Button } from "@tarassov-ch/swiss-function/button";
import { Dialog } from "@tarassov-ch/swiss-function/dialog";
```

Per-component CSS ships with each component's JavaScript; you never import it
separately.

## Theming

Every visual property is a CSS custom property under the `--sf-*` namespace,
defined in a CSS `@layer sf.tokens` so your own styles override predictably.
Override at any scope:

```css
:root {
  --sf-color-primary: #ff5722;
  --sf-radius-default: 4px;
}

/* Or scope it locally */
.brand-area {
  --sf-color-primary: #6b46c1;
}
```

Dark mode is opt-in via `[data-theme="dark"]` on any ancestor, commonly
`<html>`:

```tsx
<html data-theme={prefersDark ? "dark" : "light"}>
```

For a live token editor (and CSS/JSON export), reach for the `ThemeBuilder`
component. `src/tokens/tokens.css` is the canonical list of every variable.

## Components

A teaser of the form and overlay primitives:

| Form                   | Overlay      | Selection     |
|------------------------|--------------|---------------|
| `Button`               | `Dialog`     | `Picker`      |
| `Input`                | `Popover`    | `Selector`    |
| `Checkbox`             | `Menu`       | `Tabs`        |
| `Switch`               | `Drawer`     | `ToggleGroup` |
| `Radio`                | `MenuBar`    |               |

That is a fraction of it. The full set spans data tables, a dozen chart types,
graphs, maps, a CodeMirror-based editor, a reactive notebook, and chat.
[AGENTS.md](./AGENTS.md) is the complete catalogue with guidance on which
component to reach for; [docs/API.md](./docs/API.md) is the per-component prop
reference.

Compound components (`Dialog`, `Field`, `Menu`, `Tabs`, and others) expose
Base UI's compound API as object namespaces, for example `Dialog.Root`,
`Dialog.Trigger`, `Dialog.Popup`.

## Documentation

- **[AGENTS.md](./AGENTS.md)**: full component catalogue, conventions, and a
  "when the user asks for X, reach for Y" map. Written for coding agents, and
  just as useful for humans.
- **[docs/API.md](./docs/API.md)**: per-component props, defaults, and tokens.
- **[AESTHETICS.md](./AESTHETICS.md)**: the design philosophy behind the
  library.
- **Live demos**: run `npm run dev` to browse the Ladle stories.

## Contributing

```sh
npm install
npm run dev        # Ladle preview at http://localhost:61000
npm run check      # Biome lint + format
npm run typecheck  # tsc --noEmit
npm run test       # Vitest unit tests
npm run test:ct    # Playwright Component Testing
npm run build      # Type declarations + Vite library build
```

The contributor sections of [AGENTS.md](./AGENTS.md) cover the file layout,
build chain, and the conventions for adding a component. In short: wrap a Base
UI primitive when one exists, use `forwardRef`, style with CSS Modules and
tokens (never literals), and add stories.

## License

MIT
