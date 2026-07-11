/**
 * The reactive scheduler behind the Notebook component (issue #59).
 * Implements ./SPEC.md against the Scheduler contract in ./types.
 *
 * Model: each define/remove marks its name dirty and queues one microtask
 * flush (a "wave", SPEC 1.1). A wave computes the affected downstream
 * closure, invalidates in-flight runs of every included node (SPEC 4.1),
 * statically classifies the closure (cycle / unresolved / upstream-error /
 * pending), then runs pending nodes as their dependencies settle. Per-node
 * epoch counters make stale settlements detectable and discardable under
 * arbitrary async completion order (SPEC 4.2/4.3).
 */

import type { NodeSpec, NodeState, Scheduler } from "./types";

interface Rec {
  spec: NodeSpec;
  /** Deduplicated dependency names (SPEC: duplicates ignored). */
  deps: readonly string[];
  state: NodeState;
  /** Bumped on every invalidation; a run's settlement is discarded if it changed. */
  epoch: number;
  /** Non-null exactly while a run is in flight for the current epoch. */
  controller: AbortController | null;
}

function isThenable(v: unknown): v is PromiseLike<unknown> {
  return (
    (typeof v === "object" || typeof v === "function") &&
    v !== null &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

const FAILED: ReadonlySet<string> = new Set(["error", "cycle", "unresolved", "upstream-error"]);

export function createGraph(): Scheduler {
  const nodes = new Map<string, Rec>();
  const listeners = new Set<(name: string, state: NodeState) => void>();
  /** Names touched by define/remove since the last wave started. */
  const dirty = new Set<string>();
  /** Work queue of node names whose readiness should be (re)checked. */
  const queue: string[] = [];
  let draining = false;
  let flushQueued = false;
  let disposed = false;

  function schedule(): void {
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(() => {
      // Reset before flushing so defines made from listeners/runs during
      // this wave queue the next wave (SPEC 1.2, 7.2).
      flushQueued = false;
      flush();
    });
  }

  function setState(rec: Rec, next: NodeState): void {
    const prev = rec.state;
    if (
      prev.status === next.status &&
      Object.is(prev.value, next.value) &&
      Object.is(prev.error, next.error) &&
      prev.upstream === next.upstream
    ) {
      return; // SPEC 6.2: no transition, no event
    }
    rec.state = next;
    const name = rec.spec.name;
    // Snapshot so listeners may (un)subscribe during emit; copy the state so
    // listener mutation cannot corrupt internals (SPEC 6.1).
    for (const listener of [...listeners]) {
      try {
        listener(name, { ...next });
      } catch {
        // SPEC 6.2: listener exceptions do not break the scheduler.
      }
    }
  }

  function invalidate(rec: Rec): void {
    rec.epoch += 1;
    const controller = rec.controller;
    if (controller) {
      rec.controller = null;
      controller.abort(); // SPEC 4.1; may run user abort handlers synchronously
    }
  }

  /** True if `name` participates in a dependency cycle (self-reference included). */
  function isOnCycle(name: string): boolean {
    const rec = nodes.get(name);
    if (!rec) return false;
    const stack = [...rec.deps];
    const seen = new Set<string>();
    for (;;) {
      const d = stack.pop();
      if (d === undefined) return false;
      if (d === name) return true;
      if (seen.has(d)) continue;
      seen.add(d);
      const dep = nodes.get(d);
      if (dep) stack.push(...dep.deps);
    }
  }

  /** The roots plus every existing node that transitively depends on them. */
  function closureOf(roots: readonly string[]): string[] {
    // Seeded with names (removed roots included) so dependents of a removed
    // node are still swept into the wave; filtered to existing nodes at the end.
    const affected = new Set(roots);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [n, rec] of nodes) {
        if (affected.has(n)) continue;
        for (const d of rec.deps) {
          if (affected.has(d)) {
            affected.add(n);
            grew = true;
            break;
          }
        }
      }
    }
    return [...affected].filter((n) => nodes.has(n));
  }

  /** The wave outcome for one node, given already-classified affected deps. */
  function classifyOne(rec: Rec, result: ReadonlyMap<string, NodeState>): NodeState {
    let offender: string | null = null;
    for (const d of rec.deps) {
      const dep = nodes.get(d);
      // SPEC 3.5: a missing direct dependency name wins over everything else.
      if (!dep) return { status: "unresolved" };
      const s = result.get(d) ?? dep.state; // wave-classified, else standing
      if (FAILED.has(s.status) && offender === null) {
        // Propagate the root offender through upstream-error chains (SPEC 3.3).
        offender = s.status === "upstream-error" && typeof s.upstream === "string" ? s.upstream : d;
      }
    }
    if (offender !== null) {
      return { status: "upstream-error", error: offender, upstream: offender };
    }
    return { status: "pending" };
  }

  /**
   * Statically classify the affected closure: cycle members (SPEC 3.4), then
   * the remainder in dependency order so a node sees its affected deps' wave
   * outcome — nodes that provably cannot run never flash "pending".
   */
  function classifyWave(affected: readonly string[]): Map<string, NodeState> {
    const result = new Map<string, NodeState>();
    const memberSet = new Set(affected);
    for (const n of affected) {
      if (isOnCycle(n)) result.set(n, { status: "cycle" });
    }
    // Non-cycle members form a DAG (any cycle intersecting the closure lies
    // fully inside it and was classified above), so this worklist terminates.
    let remaining = affected.filter((n) => !result.has(n));
    while (remaining.length > 0) {
      const deferred: string[] = [];
      for (const n of remaining) {
        const rec = nodes.get(n);
        if (!rec) continue; // removed by an abort handler mid-wave
        const blocked = rec.deps.some((d) => memberSet.has(d) && nodes.has(d) && !result.has(d));
        if (blocked) deferred.push(n);
        else result.set(n, classifyOne(rec, result));
      }
      if (deferred.length === remaining.length) {
        // Unreachable by construction; fail conservatively rather than spin.
        for (const n of deferred) result.set(n, { status: "cycle" });
        break;
      }
      remaining = deferred;
    }
    return result;
  }

  function flush(): void {
    if (disposed || dirty.size === 0) return;
    const roots = [...dirty];
    dirty.clear();
    const affected = closureOf(roots);
    // SPEC 4.1: inclusion in a new wave makes any in-flight run stale.
    for (const n of affected) {
      const rec = nodes.get(n);
      if (rec) invalidate(rec);
      if (disposed) return; // an abort handler may have disposed us
    }
    const classified = classifyWave(affected);
    // Apply wave statuses; every runnable node reads "pending" before any
    // run starts (SPEC 3.1, glitch-freedom 2.3 depends on this ordering).
    for (const [n, state] of classified) {
      if (disposed) return;
      const rec = nodes.get(n);
      // Removed or re-dirtied by a listener mid-wave: the next wave owns it (SPEC 1.2).
      if (!rec || dirty.has(n)) continue;
      setState(rec, state);
    }
    for (const [n, state] of classified) {
      if (state.status === "pending") queue.push(n);
    }
    drain();
  }

  function drain(): void {
    if (draining) return; // re-entrant settles just extend the queue
    draining = true;
    try {
      for (;;) {
        const name = queue.shift();
        if (name === undefined) break;
        if (disposed) {
          queue.length = 0;
          break;
        }
        evaluate(name);
      }
    } finally {
      draining = false;
    }
  }

  function scheduleDependents(name: string): void {
    for (const [n, rec] of nodes) {
      if (rec.deps.includes(name) && rec.state.status === "pending" && rec.controller === null) {
        queue.push(n);
      }
    }
  }

  /** Re-check a pending node: run it, fail it, or keep waiting (SPEC 2.2). */
  function evaluate(name: string): void {
    if (disposed) return;
    const rec = nodes.get(name);
    if (!rec || rec.state.status !== "pending" || rec.controller !== null) return;
    if (dirty.has(name)) return; // redefined mid-wave; joins the next wave (SPEC 1.2)
    let offender: string | null = null;
    let waiting = false;
    for (const d of rec.deps) {
      const dep = nodes.get(d);
      if (!dep) {
        // A dependency was removed while we waited (SPEC 3.5).
        setState(rec, { status: "unresolved" });
        scheduleDependents(name);
        return;
      }
      const s = dep.state;
      if (s.status === "success") continue;
      if (s.status === "pending" || s.status === "idle") {
        waiting = true;
        continue;
      }
      if (offender === null) {
        offender = s.status === "upstream-error" && typeof s.upstream === "string" ? s.upstream : d;
      }
    }
    if (offender !== null) {
      // SPEC 3.3/3.4: not run; the failure cascades without waiting.
      setState(rec, { status: "upstream-error", error: offender, upstream: offender });
      scheduleDependents(name);
      return;
    }
    if (waiting) return;
    startRun(rec);
  }

  function startRun(rec: Rec): void {
    const name = rec.spec.name;
    const controller = new AbortController();
    rec.controller = controller;
    const epoch = rec.epoch;
    // SPEC 2.4: inputs are the deps' current settled values (all "success" here).
    const inputs: Record<string, unknown> = {};
    for (const d of rec.deps) inputs[d] = nodes.get(d)?.state.value;
    const settle = (state: NodeState): void => {
      // SPEC 4.2/4.3: a stale settlement (node redefined, removed, superseded
      // by a newer wave, or scheduler disposed) is discarded outright — it
      // neither overwrites newer state nor triggers downstream recomputation.
      if (disposed || nodes.get(name) !== rec || rec.epoch !== epoch) return;
      rec.controller = null;
      setState(rec, state);
      scheduleDependents(name);
      drain();
    };
    let out: unknown;
    try {
      out = rec.spec.run(inputs, controller.signal);
    } catch (error) {
      settle({ status: "error", error });
      return;
    }
    if (isThenable(out)) {
      Promise.resolve(out).then(
        (value) => settle({ status: "success", value }),
        (error) => settle({ status: "error", error }),
      );
    } else {
      settle({ status: "success", value: out }); // sync result settles in the same wave (SPEC 7.1)
    }
  }

  function define(spec: NodeSpec): void {
    if (disposed) throw new Error("Scheduler is disposed");
    const deps = [...new Set(spec.dependencies)];
    const existing = nodes.get(spec.name);
    if (existing) {
      invalidate(existing); // SPEC 4.1: redefinition makes the in-flight run stale
      existing.spec = spec;
      existing.deps = deps;
      // Status stays as-is until the wave: "idle" means never run yet.
    } else {
      nodes.set(spec.name, {
        spec,
        deps,
        state: { status: "idle" },
        epoch: 0,
        controller: null,
      });
    }
    dirty.add(spec.name);
    schedule(); // SPEC 1.1: never runs synchronously
  }

  function remove(name: string): void {
    if (disposed) throw new Error("Scheduler is disposed");
    const rec = nodes.get(name);
    if (!rec) return;
    invalidate(rec); // SPEC 5.2: abort the in-flight run
    nodes.delete(name);
    dirty.add(name); // sweeps dependents into the wave; they classify "unresolved"
    schedule();
  }

  function getState(name: string): NodeState | undefined {
    const rec = nodes.get(name);
    return rec ? { ...rec.state } : undefined;
  }

  function names(): string[] {
    return [...nodes.keys()];
  }

  function onChange(listener: (name: string, state: NodeState) => void): () => void {
    if (disposed) return () => {};
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const rec of nodes.values()) invalidate(rec); // aborts everything (SPEC 7.3)
    nodes.clear();
    dirty.clear();
    queue.length = 0;
    listeners.clear();
  }

  return { define, remove, getState, names, onChange, dispose };
}

export default createGraph;
