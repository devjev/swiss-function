# swiss-function x Observable Framework testbed

The spike testbed for issue #52 (milestone 24, v2.0.0 Observable integration). It exercises the integration paths that issues #53 to #56 build on. Findings live in the issue comments and in the project wiki ("Consuming swiss-function from Observable Framework").

## Run it

```sh
npm install
node scripts/patch-for-spike.mjs   # simulates the packaging #55 will ship for real
node scripts/bundle-sf.mjs         # prebundles components into src/lib/sf-bundle.js
npm run dev                        # or: npm run build
```

The two scripts must be re-run after every `npm install`. They exist because the published package (1.15.2) cannot yet be consumed by Framework as-is:

- `patch-for-spike.mjs` adds a `default` condition to the package's `exports` entries (Framework resolves node imports with CommonJS `require` semantics, which never match `import`-only entries) and strips the side-effect CSS imports from the dist JS (Framework's node bundler has no CSS handling), regenerating `src/sf-components.css` as the aggregate stylesheet instead.
- `bundle-sf.mjs` flattens the needed components into one ESM file with dynamic imports inlined (Framework's node bundler drops secondary chunks), with everything bundled in except `react`/`react-dom` (deps left external go through Framework's CommonJS react shim, which has no default export and breaks deps that default-import react).

Issue #55 turns all of the above into a real `@tarassov-ch/swiss-function/observable` entry, at which point the scripts disappear.

## Pages

- `/plain`: unmodified Framework content, the canvas for the `observable.css` theme (#53).
- `/components`: the single-React "island" pattern (`src/lib/sf-island.jsx`, note the `@jsxImportSource react` pragma) rendering Button/Field/Input/DatePicker next to an inline JSX block on Framework's ambient npm:react.
- `/sql-datatable`: the analysis chain. A data loader emits ~120k trades, DuckDB-WASM filters them in the browser, the Arrow result is materialized (rows to plain objects, timestamps to Date) and rendered by a virtualized DataTable, reactively re-querying when the Inputs filter changes.
- `/remote`: remote Parquet reads and remote `.duckdb` ATTACH over HTTP range requests.

## Verification

`scripts/verify-components.mjs` drives the built site with Playwright (serve `dist/` first, e.g. `python3 -m http.server 8123 --directory dist`).
