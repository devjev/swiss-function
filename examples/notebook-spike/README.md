# notebook spike (issue #57)

The bake-off spike for milestone 26 (v2.0.0, notebook analysis feature). It proves the three load-bearing claims of the design: an in-house scheduler runs the reactive cell graph correctly, one cell-type contract hosts genuinely different execution engines, and nothing in the field beats that on evidence. Findings live in the issue #57 comments and the wiki ("Notebook Library Evaluation").

## Run it

```sh
npm install
npm test        # scheduler test matrix: 39 spec tests x 2 implementations
npm run dev     # the notebook app (boots DuckDB-WASM + 120k generated trades)
```

## What is in here

- `SPEC.md`: the scheduler semantics specification (batching, diamond glitch-freedom, statuses, cancellation, reentrancy). The reference document for #58/#59.
- `src/scheduler/types.ts`: the Scheduler interface both implementations satisfy.
- `src/scheduler/graph.ts`: the in-house scheduler (368 lines, zero dependencies). **39/39 spec tests.**
- `src/scheduler/suite.ts`: the adversarial test suite, written from SPEC.md alone by an agent that never saw the implementation; the two converged on the first joint run.
- `src/scheduler/runtime-graph.ts` + `RUNTIME-NOTES.md`: the comparison arm, @observablehq/runtime v6 behind the same interface. **35/39**: the four failures are the runtime's structural inability to abort in-flight runs (it chains computes per variable), plus documented deviations (macrotask waves, transient pendings).
- `src/contract.ts`: the draft cell-type contract (type, editorExtensions, findDependencies, execute, renderResult/renderStatic) that #58 formalizes.
- `src/celltypes/`: three engines behind the contract: `sql.tsx` (the `createSqlCellType(executor)` factory: `${name}` refs, interpolation, DataTable results), `jsexpr.tsx` (identifier-based references, consumer-side `new Function`), `prose.tsx` (markdown, non-executing).
- `src/engines/duckdb.ts`: the app-owned DuckDB-WASM executor (the library side never imports it) over a deterministic 120k-row trades table.
- `src/notebook/`: the spike-grade cell shell (status rail, sf CodeEditor/Markdown/DataTable/Spinner, add/move/delete, wave-latency footer).

## Measured

- Reactive cascade (edit the `threshold` JS cell, three SQL cells re-query 120k rows, cross-engine `summary` cell updates): scheduler wave settles in ~8 ms; ~157 ms end to end including editor interaction and DataTable re-render.
- Error propagation across engines: breaking the JS cell marks it `error` and all four dependents `upstream-error`; recovery re-runs the closure.
- Both themes verified (screenshots committed under `screenshots/`).

## Two React footguns worth remembering for #59

- A function stored in `useState` must be wrapped (`setExecutor(() => fn)`): a bare function argument is treated as a state updater. Bit this spike via the executor.
- The scheduler must be created inside an effect (with dispose in the cleanup), not in `useMemo`: StrictMode's mount/cleanup/remount otherwise reuses a disposed instance.
