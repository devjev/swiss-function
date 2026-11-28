# swiss-function

A React component library for dense, professional interfaces: form-heavy
apps, data tables, dashboards, internal tools. Behaviour and accessibility
come from [Base UI](https://base-ui.com) primitives. Styling is CSS Modules
and CSS custom property tokens, in a Swiss/Bauhaus visual language.

It is aimed at application UIs rather than marketing sites or feed-style
consumer products.

## What it is

- Components wrap Base UI primitives, so focus management, keyboard
  navigation, and ARIA semantics are handled there rather than reimplemented.
- Styling uses CSS Modules and `--sf-*` custom properties. No Tailwind, no
  CSS-in-JS. Any token can be overridden at any scope.
- Dark mode is a `data-theme="dark"` attribute on an ancestor; the color
  tokens swap with it, and no component branches on theme in JavaScript.
- The defaults favour density: sharp corners, full-strength text, typographic
  hierarchy over color, restrained motion. [AESTHETICS.md](./AESTHETICS.md)
  explains the reasoning.
- Alongside the usual controls there are data tables, charts, a graph view,
  maps, a code editor, a notebook, and a chat UI. The
  [catalogue](./AGENTS.md) lists them.
- Each component is a separate entry point with its own CSS, so bundlers can
  tree-shake what you do not use.

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
import "@tarassov-ch/swiss-function/fonts.css";  // optional: bundled IBM Plex Sans + JetBrains Mono webfonts
```

`fonts.css` loads the faces that `--sf-font-sans` and `--sf-font-mono` prefer,
via the optional `@fontsource/ibm-plex-sans` and `@fontsource/jetbrains-mono`
dependencies. Without it, text falls back to the system sans and mono stacks.

Two attributes on the root element (or any subtree) switch the tokens:
`data-theme="light" | "dark"` and `data-density="compact" | "comfortable"`.
The default density is compact, 14px text on a 20px unit; `comfortable` is
16px on 24px.

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

There are two import styles. The barrel is convenient while prototyping; the
per-component paths tree-shake better in production.

```tsx
// Barrel
import { Button, Dialog } from "@tarassov-ch/swiss-function";

// Per-component
import { Button } from "@tarassov-ch/swiss-function/button";
import { Dialog } from "@tarassov-ch/swiss-function/dialog";
```

Each component's CSS ships with its JavaScript, so you do not import it
separately.

## Theming

Every visual property is a CSS custom property under the `--sf-*` namespace,
defined in a CSS `@layer sf.tokens` so your own styles take precedence.
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

The `ThemeBuilder` component is a live token editor with CSS and JSON export.
`src/tokens/tokens.css` is the canonical list of every variable.

## Components

A sample of the form and overlay primitives:

| Form                   | Overlay      | Selection     |
|------------------------|--------------|---------------|
| `Button`               | `Dialog`     | `Picker`      |
| `Input`                | `Popover`    | `Selector`    |
| `Checkbox`             | `Menu`       | `Tabs`        |
| `Switch`               | `Drawer`     | `ToggleGroup` |
| `Radio`                | `MenuBar`    |               |

The full set also covers data tables, several chart types, graphs, maps, a
CodeMirror-based editor, a notebook, and chat. [AGENTS.md](./AGENTS.md) is the
complete catalogue, with notes on which component fits which case;
[docs/API.md](./docs/API.md) is the per-component prop reference.

Compound components (`Dialog`, `Field`, `Menu`, `Tabs`, and others) expose
Base UI's compound API as object namespaces, for example `Dialog.Root`,
`Dialog.Trigger`, `Dialog.Popup`.

## A guide for your coding agents

The package ships a guide for the coding agents that build your UI (Claude
Code, Cursor, Codex, any agent with tool use): the components and when to reach
for each, the conventions (tokens, the unit grid, touch), and the
anti-patterns. Write it into your project:

```bash
npx swiss-function guide --link
```

This writes `SWISS-FUNCTION.md` and adds a line to your `AGENTS.md` (an
`@SWISS-FUNCTION.md` import to a `CLAUDE.md` of its own) that tells the agent to
read it. Its links point at the full prop reference and the design notes inside
the installed package. Run it again after upgrading; it overwrites only a file
it wrote itself.

| Option | Effect |
| --- | --- |
| `--out <file>` | Write it elsewhere (default `SWISS-FUNCTION.md`); the links follow. |
| `--link` | Reference it from `AGENTS.md` and `CLAUDE.md` in the current directory, once. |
| `--force` | Overwrite a file the command did not write. |
| `--stdout` | Print it instead of writing it. |

Without the package installed in the project, run it as
`npx @tarassov-ch/swiss-function guide`; its links then point where the package
will be once installed.

## Documentation

- **[AGENTS.md](./AGENTS.md)**: component catalogue, conventions, and a
  "when the user asks for X, reach for Y" map. Written for coding agents,
  usable by humans.
- **[docs/API.md](./docs/API.md)**: per-component props, defaults, and tokens.
- **[AESTHETICS.md](./AESTHETICS.md)**: the reasoning behind the design.
- **[docs/research/](./docs/research/)**: the design lineage, a sourced
  heritage of precision instruments (Rams, aviation and automotive
  instruments, cameras, the Swiss grid, industrial control) with a directive
  for each, plus the table and form layout rubrics and the inspiration set.
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
build chain, and the conventions for adding a component: wrap a Base UI
primitive where one exists, use `forwardRef`, style with CSS Modules and
tokens rather than literals, and add stories.

### Releases

Every user-facing change ships with a **changeset**. Land one alongside the
code:

```sh
just changeset <patch|minor|major> "One-line release note"
```

It writes a small file under [`.changes/`](./.changes/README.md). `just release`
then aggregates the pending changesets (highest bump wins), prepends their notes
to [CHANGELOG.md](./CHANGELOG.md), bumps the version, deletes the consumed files,
and pushes the tag; CI publishes to the registry. `just changes-status` shows
what a release would ship. See [`.changes/README.md`](./.changes/README.md) for
the full flow.

## License

MIT
