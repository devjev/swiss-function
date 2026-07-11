# swiss-function x Observable Framework

Testbed for milestone 24 (v2.0.0, Observable integration), created for the spike in issue #52. Each page exercises one integration concern:

- [Plain content](/plain): unmodified Framework content, the canvas for the `observable.css` theme work (#53).
- [Components](/components): swiss-function React components inside JSX blocks (#55).
- [SQL to DataTable](/sql-datatable): DuckDB-WASM query results flowing into a virtualized DataTable (#55).
- [Remote data](/remote): remote Parquet and remote DuckDB ATTACH over HTTP range requests.

The library is installed from the Forgejo registry (see `.npmrc`); the swiss-function tokens are pulled into the page through `src/custom-style.css`.

```js
const tokensProbe = getComputedStyle(document.documentElement).getPropertyValue("--sf-color-primary").trim();
```

Token probe: `--sf-color-primary` resolves to **${tokensProbe || "NOT LOADED"}** on this page.
