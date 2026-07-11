# swiss-function notebook demo

The reference consumer of the `Notebook` component (milestone 26, issue #61): a React app that wires **its own** DuckDB-WASM instance into `createSqlCellType`, adds a JS-expression cell type through the public `CellType` contract, and gets a reactive analysis notebook over 120k generated trades.

```sh
npm install
npm run dev
```

The wiring recipe (the whole integration):

1. `src/duckdb.ts`: boot `@duckdb/duckdb-wasm`, load data, return `(sql, signal) => conn.query(sql)`. The engine belongs to this app; the library never imports it.
2. `createSqlCellType({executor, extensions: () => [sql()]})`: SQL cells with `${name}` references to other cells; `@codemirror/lang-sql` is this app's install, per the CodeEditor convention.
3. `jsCellType` in `src/App.tsx`: the worked example of the `CellType` contract (`findDependencies` intersects identifiers with known cell names; `execute` uses `new Function`, which is this app's own security decision, never the library's).
4. `<Notebook document onDocumentChange cellTypes />`: a controlled component; persist the JSON document wherever the app wants.

Notes: DuckDB-WASM cannot abort a running query; the notebook's scheduler discards stale results safely, so this is a latency concern, not a correctness one. DuckDB aggregate results arrive as HUGEINT/BigInt and timestamps as epoch numbers; the default result renderer runs them through `fromArrow` (also importable alone from `@tarassov-ch/swiss-function/lib/from-arrow`).
