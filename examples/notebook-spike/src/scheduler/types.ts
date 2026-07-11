/**
 * The scheduler contract for the notebook's reactive core (issue #57).
 * Two implementations exist behind this interface:
 *   - graph.ts: the in-house scheduler (the candidate for #59)
 *   - runtime-graph.ts: an adapter over @observablehq/runtime v6 (comparison arm)
 * Semantics are specified in ../../SPEC.md; the shared test suite in
 * suite.ts encodes that spec and runs against both implementations.
 */

export type NodeStatus =
  /** Defined, never run yet (transient; a run is scheduled). */
  | "idle"
  /** A run is scheduled or in flight for the current wave. */
  | "pending"
  /** Last run completed; `value` is current. */
  | "success"
  /** Last run threw/rejected; `error` is set. */
  | "error"
  /** Not run: some transitive dependency is in `error` (or was removed mid-flight). */
  | "upstream-error"
  /** Not run: the node participates in a dependency cycle (self-reference included). */
  | "cycle"
  /** Not run: at least one direct dependency name is not defined (yet). */
  | "unresolved";

export interface NodeState {
  status: NodeStatus;
  /** Present when status is "success". */
  value?: unknown;
  /** Present when status is "error"; for "upstream-error" the offending upstream's name. */
  error?: unknown;
  upstream?: string;
}

export interface NodeSpec {
  /** Unique reference token. Other nodes list it in `dependencies`. */
  name: string;
  /** Names this node reads. Order irrelevant. Duplicates allowed (ignored). */
  dependencies: readonly string[];
  /**
   * Compute the value. `inputs` holds each dependency's current value keyed
   * by name. `signal` aborts when the run becomes stale (see SPEC.md).
   * May be sync or async.
   */
  run: (inputs: Record<string, unknown>, signal: AbortSignal) => unknown | Promise<unknown>;
}

export interface Scheduler {
  /** Define a node, or redefine it if the name exists (replaces spec, re-runs downstream closure). */
  define(spec: NodeSpec): void;
  /** Remove a node. Dependents become "unresolved". No-op if absent. */
  remove(name: string): void;
  /** Snapshot of a node's state; undefined if the name was never defined. */
  getState(name: string): NodeState | undefined;
  /** All currently defined names. */
  names(): string[];
  /**
   * Subscribe to state transitions. Fires for every transition of every node
   * with the node's name and its new state. Returns an unsubscribe function.
   */
  onChange(listener: (name: string, state: NodeState) => void): () => void;
  /** Abort all in-flight runs and drop all nodes. The instance is dead afterwards. */
  dispose(): void;
}

export type SchedulerFactory = () => Scheduler;
