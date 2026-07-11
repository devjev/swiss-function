# RUNTIME-NOTES — mapping @observablehq/runtime v6 onto the SPEC.md scheduler

The comparison-arm evidence for issue #57. `runtime-graph.ts` puts the
Observable runtime (v6.0.0, installed in `node_modules/@observablehq/runtime`)
behind the `Scheduler` interface from `types.ts`. This file records, clause by
clause, whether the runtime satisfies SPEC.md natively, whether the adapter
had to emulate it, or whether it cannot be satisfied. Source references are to
the installed package's `src/{runtime,module,variable,errors}.js`.

Verdicts:

- **native** — the runtime already behaves this way; the adapter only translates.
- **emulated** — the adapter synthesizes the behavior on top of the runtime.
- **deviation** — best-effort mapping; observable behavior differs from SPEC.md.
- **cannot** — not satisfiable over this runtime.

## Clause table

| SPEC clause | Verdict | How / why (with source) |
| --- | --- | --- |
| 1.1 sync calls coalesce into one wave; nothing runs synchronously | native, with a **deviation** in timing | Every `define`/`delete` calls `runtime._compute()`, which schedules at most one evaluation (`runtime.js` `runtime_compute` guards on `_computing`). But the wave starts on a **macrotask** — `requestAnimationFrame`/`setImmediate`/`setTimeout` (`runtime.js` line 7, `frame`) — not "a following microtask" as 1.1 says. Batching per task holds; the start latency is one frame/immediate, not one microtask. |
| 1.2 define during a wave joins the next wave | native | `runtime_computeNow` nulls `_computing` and snapshots the update set before evaluating; a mid-wave `define` schedules a fresh wave. Per-variable `_version` counters keep the waves from corrupting each other. |
| 2.1 only the affected subgraph runs | native | `runtime_computeNow` computes the transitive closure of `_updates`/`_dirty` only; untouched variables keep value and status. |
| 2.2 a node runs after its direct deps settle; independent nodes run concurrently | native | Topological scheduling (indegree queue in `runtime_computeNow`) plus `init()` = `Promise.all(inputs.map(variable_value))` in `variable_compute`. |
| 2.3 diamond rule (D runs once, after new B and new C) | native | Each variable is computed at most once per wave (members of the `variables` set are popped once), in topological order. |
| 2.4 inputs are exactly the wave's settled values | native + adapter re-keying | The runtime passes input values positionally; the adapter's wrapper re-keys them into the `Record<string, unknown>` the spec wants (deps deduplicated first — duplicates allowed/ignored per `types.ts`). Values are transported inside a `Box` wrapper (see §8 row) and unboxed before the user's `run` sees them. |
| 3.1 "pending" before the run starts; dependents pending while upstreams compute | native | `variable_compute` calls `variable._pending()` synchronously for **every** scheduled variable at wave start (the topo loop in `runtime_computeNow` is synchronous; only settlement is async). Note the flip side in the 3.4/3.5 rows: nodes that end up `cycle`/`unresolved`/`upstream-error` also pass through a transient `pending`. |
| 3.2 "success" + value retained until next transition | native | `observer.fulfilled(value)` → adapter stores `{status:"success", value}` and leaves it until the next observer callback. |
| 3.3 "error" + downstream closure "upstream-error" with the offender's name; recovery re-runs | **emulated** | The runtime has **no upstream-error status**: a dependent simply computes and rejects. Crucially, **error identity is not preserved** — `variable_rejector` (`variable.js`) creates a *new* `RuntimeError(error.message, inputName)` per hop, so the adapter cannot detect propagation by identity. Instead: own failures are wrapped by the adapter's definition in a private `NodeRunError` (→ status `"error"` with the original error); anything arriving as a `RuntimeError` with `.input` set is a propagated failure of the named **direct** input. The original offender's name is recovered transitively from the adapter's own state map (`classify()` in `runtime-graph.ts`); this is sound because the runtime settles variables in dependency order, so the input's state is always classified before the dependent's rejection is observed. Recovery is native (the fixed node's downstream closure recomputes). Known misclassification: a user `run` that itself throws a genuine `RuntimeError` instance would be caught by the adapter's wrapper first and still classify as `"error"` — fine — but the runtime rejecting for reasons outside the three known shapes would fall back to `"error"` too. |
| 3.4 cycle members get "cycle" and are not run; dependents get "upstream-error"; breaking the cycle recovers | **emulated**, with a transient-status **deviation** | No cycle status either: `runtime_computeNow` detects leftovers via `variable_circular` and rejects them with `RuntimeError("circular definition")` **with no `.input`** (`variable_error`) — that exact shape maps to `"cycle"`. A dependent-of-a-cycle-member computes, pulls the member's rejected promise, and gets a re-wrapped `RuntimeError("circular definition", input=member)` — `.input` set → `"upstream-error"` per the 3.3 machinery. Self-reference works: the runtime patches a first-define self-input to the variable itself (`variable_defineImpl` TYPE_IMPLICIT branch), so `variable_circular` sees it. Deviations: (a) the member's `run` is never invoked (good — "not run") but its status passes through `pending` first (`variable_error` calls `_pending()`); (b) cycle detection happens at wave time, not define time — same observable order, later timing. Breaking the cycle by redefinition recomputes the closure natively. |
| 3.5 "unresolved" for a missing direct dep; forward references; removal makes dependents unresolved | **emulated**, two **deviations** | A missing name becomes an implicit variable whose definition throws (`module_resolve` → `variable_undefined`), and the dependent rejects with `RuntimeError("<name> is not defined", input=name)` (`variable_rejector`). Adapter rule: `.input` names no defined node → `"unresolved"`. Forward references are native (`variable_defineImpl` patches the implicit variable's outputs onto the new definition). Removal is native via `variable.delete()`. Deviations: (a) **globals/builtins leak**: the runtime's default resolver reads missing names off `globalThis` (`window_global` in `runtime.js`) — the adapter disables this by constructing `new Runtime(null, () => undefined)`, but the module-level builtin names **`invalidation`, `visibility`, `@variable`** (`module.js`, `Module._builtins`) still resolve to runtime magic instead of "unresolved"; those three dependency names are effectively reserved and cannot be made unresolved. (b) transient `pending` precedes `"unresolved"` (the node is scheduled, `_pending` fires, then its input pull rejects — the user's `run` is never invoked). |
| 3.5 (corollary) dependents of an *unresolved* node | **interpretation** | SPEC.md only defines `"unresolved"` for a missing **direct** dependency and `"upstream-error"` for a transitive dep in `"error"`; it is silent on nodes downstream of an unresolved node. The adapter maps them to `"upstream-error"` with `upstream` = the unresolved node's name (the runtime rejects them with the re-wrapped "is not defined" error, `.input` = the direct dep, which *is* defined). If the in-house scheduler chose differently, this row is the discrepancy to look at first. |
| 3.6 `getState` undefined for never-defined names | native (adapter map) | Plus an interpretation: after `remove(name)`, `getState(name)` is also `undefined` and `names()` drops the name ("all currently defined names"). |
| 4.1 every run gets an AbortSignal that aborts on staleness | **emulated** (synthesized) | The runtime has **no cancellation concept at all**. The adapter creates one `AbortController` per run (inside the definition wrapper), aborts it synchronously on `define`/`remove`/`dispose`, and aborts the in-flight run when the node is rescheduled into a wave (the `observer.pending` hook — `_pending` fires exactly when a new compute supersedes the old one). The signal is advisory: the runtime itself never observes it. |
| 4.1/4.2 limits: a run that ignores its signal | **cannot** | The runtime serializes computes per variable: a new compute chains on the old promise (`variable_compute`: `variable._promise.then(init, init)`). A stale run that ignores its abort signal and **never settles** therefore blocks the replacement run from ever starting — the node wedges. The in-house scheduler can abandon a stale promise; this runtime cannot. (A stale run that eventually settles is fine — see next row.) |
| 4.2 stale settlements discarded, under arbitrary completion order | native + adapter belt | Natively: redefinition bumps `variable._version` synchronously (`variable_defineImpl`), and the compute chain checks the version before invoking the definition and after it resolves (`variable_compute`'s `define()`/`generate()` throw the `variable_stale` sentinel, whose rejection is swallowed). Note "arbitrary completion order" is satisfied by *forcing* an order (per-variable serialization), not by tolerating races. Residual gap: the runtime's fulfilled-notification handler does not re-check the version in its final `.then`, so a same-microtask-batch redefine could let one stale `fulfilled` through; the adapter closes it by tagging every settlement with its run's controller (`Box`/`NodeRunError`) and discarding settlements whose controller was aborted. |
| 4.3 aborted runs do not set "error" | **emulated** | An aborted run's rejection arrives as the adapter's `NodeRunError` with an aborted controller → discarded in `observer.rejected`; the node's state is whatever the newer wave produces. |
| 5.1 redefine replaces the spec and re-runs the closure; no memoization | native | `variable.define()` on the **same** Variable (the adapter keeps one Variable per name) adds it to `_updates`, recomputing it and its downstream closure. v6 does no value-equality skipping for plain values, so values always propagate. The runtime's own "previous value as `this`" convention (`definition.apply(value0, inputs)`) is hidden by the adapter's arrow-function wrapper. |
| 5.2 remove aborts the run; dependents become "unresolved" | native + adapter abort | `variable.delete()` (= redefine to `noop` with no name, `variable_delete`) moves the name's dependents onto a fresh implicit variable and schedules them; they reject "is not defined" → `"unresolved"`. The adapter aborts the removed node's controller synchronously. Quirk handled: the runtime *recomputes the deleted variable once* (as a noop → `fulfilled(undefined)`); the adapter's observers check record identity against the map and ignore callbacks for removed/replaced records. |
| 5.3 rename = remove(old)+define(new) in one task, order-independent | native | Both calls land in the same wave (1.1); the runtime's scope patching (`variable_defineImpl`) handles either order — dependents of `old` re-point to an implicit undefined variable, dependents of `new` re-point from the implicit to the definition. |
| 6.1 onChange fires after getState is consistent | **emulated** (adapter) | The adapter stores the new state on the record before notifying, and hands listeners (and `getState` callers) shallow copies. Interpretation: the initial `undefined → "idle"` assignment at first `define` is treated as a transition and fires an event. |
| 6.2 no event without transition; listener exceptions contained | **emulated** (adapter) | `transition()` compares `{status, value, error, upstream}` (`Object.is`) and suppresses no-ops (e.g. a repeated `pending` when a still-pending node joins a second wave). Listener calls are individually wrapped in try/catch and iterate a snapshot of the listener set. |
| 7.1 sync runs still pass through pending and settle in the same wave | native | `_pending` is synchronous at wave start; settlement always happens on microtasks (the compute is a promise chain) — the spec doesn't require synchronous settlement, only same-wave, which holds. |
| 7.2 define/remove from inside run/onChange joins the next wave | native | Exactly the runtime's design center (Observable cells redefine each other from event handlers); a mid-wave `define` schedules a fresh compute (see 1.2). No deadlock: the adapter's observer callbacks do no awaiting. |
| 7.3 dispose aborts everything; define/remove throw; getState undefined | native + adapter | `runtime.dispose()` exists in v6 (`runtime_dispose`): invalidates every variable and sets `_version = NaN`, so any in-flight settlement fails the version check and never reaches an observer. The adapter additionally aborts all controllers, clears its map (→ `getState` undefined, `names()` empty), and makes `define`/`remove` throw. |
| 8 no generators/streaming | **emulated** | The runtime *does* iterate generator-ish return values (anything with `next`+`return`, `generatorish.js`), pulling a value per animation frame (`variable_generate`) — precisely the guardrail SPEC §8 bans. The adapter defeats it structurally: every run result is awaited and returned inside a `Box` instance, which is never generator-ish, so a generator returned by a user `run` is just an inert value. (Promises returned by `run` are awaited by the wrapper before boxing, so async results behave per spec.) |
| 8 no lazy evaluation ("everything observed") | native (by construction) | The runtime is lazy — only variables with an observer-reachable transitive output compute (`variable_reachable`, `runtime.js`). The adapter attaches an observer to **every** node, which makes everything reachable and matches the spec's "every defined node is considered observed". |

## Deviations summary (what a diffing test run should expect)

1. **Transient `pending` before `unresolved` / `cycle` / `upstream-error`.**
   The runtime schedules every affected variable and fires `pending` before it
   discovers the input pull will reject. The user's `run` is never invoked for
   these nodes (so "not run" holds), but the observable event sequence is
   `idle → pending → unresolved` etc., where the in-house scheduler may go
   straight to the terminal status.
2. **Wave start is a macrotask** (rAF / setImmediate / setTimeout), not a
   microtask (SPEC 1.1). Tests must await a real tick, not just microtasks.
3. **Reserved dependency names**: `invalidation`, `visibility`, `@variable`
   resolve to runtime builtins (`module.js`) and can never be "unresolved".
   Global leakage of all other names is disabled via the custom resolver
   `new Runtime(null, () => undefined)`.
4. **A stale run that ignores its AbortSignal and never settles wedges its
   node** — the runtime serializes computes per variable, so the replacement
   run waits for the stale promise forever. Cooperative `run` functions (that
   reject or resolve after abort) are fine.
5. **Dependents of an unresolved node** are mapped to `"upstream-error"`
   (upstream = the unresolved node) — an interpretation; SPEC.md is silent.
6. **`getState` after `remove`** returns `undefined` (SPEC 3.6 literally says
   "never defined"; the adapter treats removal as un-defining).
7. **Cycle/unresolved detection happens at wave time**, not at `define` time —
   statuses appear one frame after the defining task, together with the rest
   of the wave.

## Verdict flavor for the issue

The runtime natively nails the hard scheduling core (batching, topological
glitch-free waves, diamond rule, forward references, scope patching on
rename/remove, staleness-by-versioning, reentrancy). Everything *around* the
core — the status vocabulary (`upstream-error`/`cycle`/`unresolved`),
cancellation (AbortSignal), event discipline (no-duplicate transitions,
listener safety), and the anti-generator guardrail — had to be synthesized in
the adapter, mostly by re-deriving graph knowledge the runtime has but does
not expose (it communicates failure topology only through re-wrapped error
*messages* and the `.input` name of the direct dependency). The two genuinely
unfixable gaps are preemption (a hung stale run blocks its variable forever)
and the macrotask wave latency.
