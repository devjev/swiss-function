/**
 * Scheduler adapter over @observablehq/runtime v6 — the comparison arm of
 * issue #57. Maps the Scheduler interface (types.ts, semantics in SPEC.md)
 * onto the Observable runtime:
 *
 *   define()  -> Variable.define() (one runtime Variable per name, reused on
 *                redefine so the runtime's own scope patching handles forward
 *                references, renames, and downstream re-runs)
 *   remove()  -> Variable.delete() (the runtime re-points dependents at an
 *                implicit "not defined" variable -> they become "unresolved")
 *   observer  -> NodeState transitions + onChange events (every node gets an
 *                observer, which also matches SPEC §8: everything observed —
 *                the runtime only computes observer-reachable variables)
 *   dispose() -> runtime.dispose() (exists in v6: invalidates all variables,
 *                sets versions to NaN so in-flight settlements are muted)
 *
 * Where the runtime's semantics differ from SPEC.md the adapter does a
 * best-effort mapping; every such point is documented in RUNTIME-NOTES.md.
 * The two structural tricks:
 *
 *   1. Every node's definition is a wrapper that resolves the user's `run`
 *      and returns the result inside a `Box`. This (a) prevents the runtime
 *      from iterating generator-ish return values (SPEC §8 forbids streaming
 *      values; the runtime would pull generators every animation frame), and
 *      (b) tags each settlement with its run's AbortController so settlements
 *      of aborted runs can be discarded (SPEC §4.2/§4.3). Own-run failures
 *      are re-thrown as `NodeRunError` for the same reason, which also makes
 *      "own error" vs "propagated upstream error" classification exact.
 *
 *   2. The runtime has no "upstream-error"/"cycle"/"unresolved" statuses —
 *      dependents of a failed variable simply reject with a *new*
 *      RuntimeError created by the input's rejector (variable.js,
 *      variable_rejector): message preserved, `input` = the direct input's
 *      name. Error identity is NOT preserved across variables, so the
 *      adapter classifies rejections via `RuntimeError.input` plus its own
 *      name -> state map (the runtime settles variables in dependency order,
 *      so a dependency's state is always classified before its dependent's
 *      rejection is observed).
 */

import { Runtime, RuntimeError } from "@observablehq/runtime";
import type {
  RuntimeModule,
  RuntimeObserver,
  RuntimeVariable,
} from "@observablehq/runtime";
import type { NodeSpec, NodeState, Scheduler } from "./types";

/**
 * Wraps every successful run result before handing it to the runtime, so the
 * runtime never sees the raw value (defeats generator iteration) and the
 * observer can tell which run produced the settlement.
 */
class Box {
  constructor(
    readonly value: unknown,
    readonly controller: AbortController,
  ) {}
}

/**
 * Wraps every failure thrown/rejected by a node's own `run`. Extends Error
 * with the original message so the runtime's rejector still propagates a
 * meaningful message to dependents (variable_rejector reads `.message`).
 */
class NodeRunError extends Error {
  constructor(
    readonly original: unknown,
    readonly controller: AbortController,
  ) {
    super(original instanceof Error ? original.message : String(original));
    this.name = "NodeRunError";
  }
}

interface NodeRecord {
  readonly name: string;
  readonly variable: RuntimeVariable;
  state: NodeState;
  /** The AbortController of the latest started run (null before the first). */
  controller: AbortController | null;
}

export function createRuntimeGraph(): Scheduler {
  // Custom `global` resolver: the runtime's default resolves unknown names
  // from globalThis (window_global in runtime.js), which would silently turn
  // "unresolved" dependencies into global values. Always returning undefined
  // forces every unknown name into an implicit "<name> is not defined"
  // variable, which is what SPEC §3.5 needs.
  const runtime = new Runtime(null, () => undefined);
  const module: RuntimeModule = runtime.module();

  const nodes = new Map<string, NodeRecord>();
  const listeners = new Set<(name: string, state: NodeState) => void>();
  let disposed = false;

  function emit(name: string, state: NodeState): void {
    // Snapshot the listener set so listeners subscribing/unsubscribing from
    // inside a callback don't affect this notification pass.
    for (const listener of [...listeners]) {
      try {
        listener(name, { ...state });
      } catch {
        // SPEC §6.2: listener exceptions must not break the scheduler.
      }
    }
  }

  /** Applies a state change; no-op (and no event) if nothing changed (§6.2). */
  function transition(record: NodeRecord, next: NodeState): void {
    const prev = record.state;
    if (
      prev.status === next.status &&
      Object.is(prev.value, next.value) &&
      Object.is(prev.error, next.error) &&
      prev.upstream === next.upstream
    ) {
      return;
    }
    record.state = next;
    emit(record.name, next);
  }

  /**
   * Classifies a rejection delivered to a node's observer. Exactly three
   * shapes reach an observer (see variable.js / runtime.js):
   *
   *   - NodeRunError: the node's own `run` threw/rejected (our wrapper).
   *   - RuntimeError with `input` set: a *direct* input's promise rejected
   *     and the input's rejector re-wrapped it (message kept, input = the
   *     direct dependency's name). Covers upstream errors, upstream cycle
   *     members, and missing names ("x is not defined").
   *   - RuntimeError("circular definition") with no `input`: this node is on
   *     a dependency cycle (runtime_computeNow's variable_circular check).
   */
  function classify(error: unknown): NodeState {
    if (error instanceof NodeRunError) {
      return { status: "error", error: error.original };
    }
    if (error instanceof RuntimeError) {
      if (typeof error.input === "string") {
        const dep = nodes.get(error.input);
        if (!dep) {
          // Direct dependency name provided by no node -> SPEC §3.5.
          return { status: "unresolved" };
        }
        if (dep.state.status === "upstream-error") {
          // Propagate the original offender's name transitively (§3.3).
          return {
            status: "upstream-error",
            upstream: dep.state.upstream ?? error.input,
          };
        }
        // dep is "error" (§3.3), "cycle" (§3.4), or "unresolved" (SPEC is
        // silent on dependents-of-unresolved; see RUNTIME-NOTES.md).
        return { status: "upstream-error", upstream: error.input };
      }
      if (error.message === "circular definition") {
        return { status: "cycle" };
      }
    }
    // Not reachable via the runtime's own paths, but be safe.
    return { status: "error", error };
  }

  /**
   * Builds the definition function the runtime invokes for one (re)definition
   * of a node. Invocations are serialized per variable by the runtime
   * (variable._promise chaining) and stale computes never invoke the
   * definition (version check in variable_compute's define()), so by the time
   * this runs, `record.controller` can only belong to an already-settled or
   * already-aborted run.
   */
  function makeDefinition(
    record: NodeRecord,
    spec: NodeSpec,
    deps: readonly string[],
  ) {
    return async (...args: unknown[]): Promise<Box> => {
      const controller = new AbortController();
      record.controller?.abort();
      record.controller = controller;
      const inputs: Record<string, unknown> = {};
      deps.forEach((dep, i) => {
        const arg = args[i];
        inputs[dep] = arg instanceof Box ? arg.value : arg;
      });
      try {
        const result = await spec.run(inputs, controller.signal);
        return new Box(result, controller);
      } catch (original) {
        throw new NodeRunError(original, controller);
      }
    };
  }

  function define(spec: NodeSpec): void {
    if (disposed) {
      throw new Error("Scheduler disposed: define() is not allowed (SPEC 7.3)");
    }
    // Duplicates in `dependencies` are allowed and ignored (types.ts).
    const deps = [...new Set(spec.dependencies)];

    const existing = nodes.get(spec.name);
    if (existing) {
      // SPEC §4.1/§5.1: redefinition makes the in-flight run stale — abort
      // its signal synchronously. State stays as-is until the wave's
      // observer.pending fires (§1.1: nothing runs synchronously).
      existing.controller?.abort();
      existing.controller = null;
      existing.variable.define(
        spec.name,
        deps,
        makeDefinition(existing, spec, deps),
      );
      return;
    }

    const name = spec.name;
    // Two-step init: the observer closes over `record`, which is assigned
    // below, before the runtime can invoke any callback (callbacks only fire
    // during a wave, asynchronously after variable.define()).
    let record: NodeRecord;
    const observer: RuntimeObserver = {
      pending: () => {
        // Identity check: after remove()+define() of the same name a *new*
        // record/variable exists; the runtime still recomputes the deleted
        // variable once (delete() is a redefinition to noop), and its
        // observer must not touch the new record.
        if (nodes.get(name) !== record) return;
        // The node was scheduled into a new wave: whatever run is in flight
        // is now stale (§4.1 "an upstream re-run invalidated its inputs").
        record.controller?.abort();
        transition(record, { status: "pending" });
      },
      fulfilled: (value) => {
        if (nodes.get(name) !== record) return;
        if (value instanceof Box) {
          // §4.2/§4.3: a settlement of an aborted (stale) run is discarded.
          if (value.controller.signal.aborted) return;
          transition(record, { status: "success", value: value.value });
        } else {
          // Only reachable if the runtime fulfills with a non-wrapper value
          // (it shouldn't for our definitions); keep the raw value.
          transition(record, { status: "success", value });
        }
      },
      rejected: (error) => {
        if (nodes.get(name) !== record) return;
        // §4.3: an abort is not a failure — discard rejections of stale runs.
        if (error instanceof NodeRunError && error.controller.signal.aborted) {
          return;
        }
        transition(record, classify(error));
      },
    };
    const variable = module.variable(observer);
    record = { name, variable, state: { status: "idle" }, controller: null };
    nodes.set(name, record);
    emit(name, record.state);
    variable.define(name, deps, makeDefinition(record, spec, deps));
  }

  function remove(name: string): void {
    if (disposed) {
      throw new Error("Scheduler disposed: remove() is not allowed (SPEC 7.3)");
    }
    const record = nodes.get(name);
    if (!record) return; // no-op if absent (types.ts)
    nodes.delete(name);
    record.controller?.abort(); // §5.2: abort the in-flight run
    record.controller = null;
    // delete() re-points dependents at a fresh implicit variable whose
    // definition throws "<name> is not defined" and schedules them — they
    // classify as "unresolved" (§3.5) in the next wave.
    record.variable.delete();
  }

  return {
    define,
    remove,
    getState(name: string): NodeState | undefined {
      const record = nodes.get(name);
      return record ? { ...record.state } : undefined;
    },
    names(): string[] {
      return [...nodes.keys()];
    },
    onChange(listener: (name: string, state: NodeState) => void): () => void {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const record of nodes.values()) {
        record.controller?.abort();
      }
      nodes.clear();
      listeners.clear();
      // v6 has a real dispose (runtime.js runtime_dispose): invalidates every
      // variable and NaNs versions, so in-flight settlements never reach the
      // observers again.
      runtime.dispose();
    },
  };
}
