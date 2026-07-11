# Components

Experiments 3 and 5 (issue #52): swiss-function components rendered by a local island module (`src/lib/sf-island.jsx`) whose React, JSX runtime, and components all resolve from node_modules, so the island has exactly one React instance. Framework's inline JSX blocks use npm:react (jsDelivr) instead; the two must not be mixed in one tree.

```js
import {mountPlayground} from "./lib/sf-island.js";

const host = display(document.createElement("div"));
const cleanup = mountPlayground(host);
invalidation.then(cleanup);
```

For contrast, an inline JSX block on Framework's ambient npm:react (no swiss-function components):

```jsx
display(<p data-testid="ambient-react">Ambient React version: {React.version}</p>);
```
