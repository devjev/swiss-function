# @tarassov-ch/swiss-function

A design system for React, built on [Base UI](https://base-ui.com) primitives with CSS Modules and CSS custom property tokens. Shared across multiple internal apps.

## Install

```sh
npm install @tarassov-ch/swiss-function
```

Then, **once at app root**, import the tokens (required) and the reset (optional):

```ts
import "@tarassov-ch/swiss-function/tokens.css";
import "@tarassov-ch/swiss-function/reset.css"; // optional
```

If you skip the tokens import, components will render unstyled — every CSS rule references a `--sf-*` custom property.

## Usage

Two import styles are supported. Prefer the deep imports for best tree-shaking:

```tsx
// Deep import (recommended)
import { Button } from "@tarassov-ch/swiss-function/button";
import { Dialog } from "@tarassov-ch/swiss-function/dialog";

// Or barrel
import { Button, Dialog } from "@tarassov-ch/swiss-function";
```

Per-component CSS is bundled with each component's JS — you don't import it separately.

## Theming

All visual properties are CSS custom properties under the `--sf-*` namespace, defined in a CSS `@layer sf.tokens`. We call them *tokens* — design-systems shorthand for named, atomic design decisions (a color, a spacing step, a radius) that components reference instead of hard-coded values. The term is inherited from the broader ecosystem (Salesforce Lightning popularized it; the W3C now has a Design Tokens spec); in this library it's just CSS custom properties playing that role. Override at any scope:

```css
/* Override globally */
:root {
  --sf-color-primary: #ff5722;
  --sf-radius-md: 1rem;
}

/* Or scope-locally */
.brand-area {
  --sf-color-primary: #6b46c1;
}
```

Dark mode is opt-in via `[data-theme="dark"]` on any ancestor (commonly `<html>`):

```tsx
<html data-theme={prefersDark ? "dark" : "light"}>
```

## Components

| Form                   | Overlay      | Selection     |
|------------------------|--------------|---------------|
| `Button`               | `Dialog`     | `Picker`      |
| `Input`                | `Popover`    | `Tabs`        |
| `Checkbox`             | `Menu`       | `Accordion`   |
| `Switch`               | `MenuBar`    | `ToggleGroup` |
| `Radio` + `RadioGroup` |              |               |

This is a teaser; see [AGENTS.md](./AGENTS.md) for the full catalogue (charts, `DataTable`, `Graph`, `Prose`, and more).

Compound components (Dialog, Popover, Menu, Tabs, Accordion) expose Base UI's compound API as object namespaces, e.g. `Dialog.Root`, `Dialog.Trigger`, `Dialog.Popup`. The structure mirrors Base UI's; see [base-ui.com](https://base-ui.com) for full API docs.

## Development

```sh
npm install
npm run dev        # Ladle preview at http://localhost:61000
npm run check      # Biome lint + format check
npm run typecheck  # tsc --noEmit
npm run test       # Vitest
npm run test:ct    # Playwright Component Testing (requires `npx playwright install --with-deps chromium` once)
npm run build      # Type declarations + Vite library build
```

### Project layout

```
src/
├── tokens/                         # tokens.css, reset.css
├── lib/cx.ts                       # tiny clsx replacement
├── components/<Name>/
│   ├── <Name>.tsx
│   ├── <Name>.module.css
│   ├── <Name>.stories.tsx          # Ladle
│   ├── <Name>.spec.tsx             # Playwright CT
│   └── index.ts
└── index.ts                        # barrel
```

### Build output

Per-component JS + CSS + `.d.ts`, side-effect-imported by each component:

```
dist/
├── index.js  index.d.ts
├── tokens/tokens.css
└── components/<Name>/
    ├── index.js   index.d.ts
    ├── <Name>.js  <Name>.d.ts
    └── <Name>.module.css
```

## Roadmap

- Visual regression testing (Chromatic / Percy)
- Changesets-driven release automation
- Form composition primitives (`FormField`, `FormError`)
- Theme builder UI / Style Dictionary integration
- Icon system

## License

MIT
