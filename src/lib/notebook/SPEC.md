# Scheduler semantics specification (issue #57)

The reference spec for the notebook's reactive core. The interface lives in
`src/lib/notebook/types.ts`; the implementation is `graph.ts`. The test suite
(`suite.ts`) encodes this document; where the spec and the suite disagree, the
spec wins and the suite is a bug.

Terminology: a node's **downstream closure** is every node that transitively
depends on it. A **wave** is one batch of recomputation triggered by one or
more `define`/`remove` calls.

## 1. Batching

1.1. `define`/`remove` calls made synchronously in the same task coalesce into
one wave: no `run` is invoked synchronously during `define`. Evaluation starts
on a following microtask. Loading a whole document is therefore one wave.

1.2. A `define` arriving while a wave is in flight starts/joins the next wave;
it never corrupts the current one (see cancellation, 4).

## 2. Evaluation order and glitch-freedom

2.1. Within a wave, only the affected subgraph runs: the (re)defined nodes and
their downstream closure. Unaffected nodes keep status and value untouched.

2.2. A node runs only after all of its direct dependencies are settled
("success") in the current wave. Nodes with no unsettled dependencies may run
concurrently.

2.3. **Diamond rule.** If D depends on B and C, and both depend on A, an edit
of A runs D exactly once in the wave, after the new B and the new C. D never
observes a mix of new-B and stale-C (or vice versa).

2.4. A node's `inputs` are exactly the values its dependencies settled to in
this wave (or their standing values if not part of the wave).

## 3. Statuses

3.1. When a wave schedules a node, its status becomes "pending" before its
`run` starts (dependents show pending while upstreams compute).

3.2. On completion: "success" with the value; the value is retained until the
next transition.

3.3. On throw/reject: "error" with the thrown error. The downstream closure
becomes "upstream-error" (with `upstream` = the failing node's name) without
their `run` being called. Recovery: when a later wave makes the failing node
succeed, the closure re-runs normally.

3.4. Cycles: every node on a dependency cycle gets status "cycle" and is not
run. Self-reference is a cycle of length 1. Nodes that depend on a cycle
member (but are not on the cycle) get "upstream-error". Breaking the cycle by
redefinition re-runs the affected subgraph.

3.5. Unresolved: a node with a direct dependency name that no node currently
provides gets "unresolved" and is not run. Defining the missing name later
re-runs it (forward references across document load order work). Removing a
node makes its dependents "unresolved" (not "upstream-error").

3.6. `getState` for a never-defined name returns `undefined`, not a state.

## 4. Cancellation and staleness

4.1. Each `run` receives an `AbortSignal`. The signal aborts when the run
becomes stale: its node was redefined or removed, an upstream re-run
invalidated its inputs (a new wave includes the node), or `dispose` was
called.

4.2. A stale run's settlement (resolve or reject) is discarded: it must not
overwrite state produced by a newer run, and it must not trigger downstream
recomputation. This holds under arbitrary async completion order (a stale
slow run finishing after a fresh fast run must be ignored).

4.3. Aborted runs do not set "error" (an abort is not a failure); the node's
state is whatever the newer wave produces.

## 5. Redefinition, removal, renames

5.1. `define` on an existing name replaces the spec and re-runs the node and
its downstream closure (even if the source text is identical; no memoization
in v1: values always propagate).

5.2. `remove` drops the node and aborts its in-flight run; dependents become
"unresolved" per 3.5.

5.3. A rename is `remove(old)` + `define(new)` by the caller; dependents of
the old name go "unresolved"; dependents referencing the new name resolve and
run (order of the two calls within one task must not matter, per 1.1).

## 6. Events

6.1. Every status transition of every node fires `onChange(name, state)`
after the node's state is readable via `getState` (listener sees consistent
snapshots).

6.2. No transition, no event (idempotent settlements do not re-fire).
Listener exceptions do not break the scheduler.

## 7. Runs and reentrancy

7.1. `run` may be sync or async; sync results still settle in the same wave
(and still first pass through "pending" per 3.1).

7.2. Calling `define`/`remove` from inside a `run` or an `onChange` listener
is allowed; it joins the next wave (1.2) and does not deadlock.

7.3. `dispose` aborts everything; afterwards `define`/`remove` throw and
`getState` returns undefined for all names.

## 8. Non-goals (v1, recorded)

No memoization/equality skipping (5.1). No generator/streaming values (the
Observable-runtime guardrail from the milestone). No lazy evaluation: every
defined node is considered observed (a notebook shows all cells). No
priorities or debouncing (callers debounce keystrokes).

## 9. Resolved ambiguities (from the #57 spike, now normative)

9.1. A dependent of an "unresolved" node (one that does not itself reference
a missing name) is "upstream-error", with `upstream` set to the unresolved
node's name. ("Unresolved" applies only to the node whose own direct
dependency is missing; the failure cascades downstream as upstream-error,
per 3.3's offender propagation.)

9.2. `getState` for a removed (previously defined) name returns `undefined`,
exactly as for a never-defined name, and `names()` drops it. Removal leaves
no tombstone.

9.3. Statically-doomed nodes never flash "pending": cycle members, unresolved
nodes, and nodes that are blocked at wave start by an already-failed
dependency go straight to their terminal status for the wave. Only nodes
whose upstream fails *at runtime* (during the wave) show "pending" first and
then transition to "upstream-error".

9.4. Node creation emits no "idle" `onChange` event: the first event a
listener sees for a new node is its first wave classification ("pending",
"cycle", "unresolved", or "upstream-error"). `getState` called between
`define` and the first wave does return `{ status: "idle" }`.
