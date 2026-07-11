/**
 * Shared, implementation-agnostic test suite for the notebook scheduler
 * (issue #57). Encodes SPEC.md clause by clause; every test name cites the
 * clause it enforces. Uses ONLY the public Scheduler interface from types.ts.
 *
 * Async discipline: the spec batches on microtasks, so tests use real
 * microtask/macrotask ordering — one `tick()` (setTimeout 0) drains the
 * entire pending microtask cascade before it fires. Deferred promises force
 * runs to stay in flight or settle out of order deterministically. No fake
 * timers, no sleeps longer than 0.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NodeSpec, NodeState, Scheduler } from "./types";

/** One macrotask; all currently-reachable microtasks run before it fires. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A promise settled from the outside, to control exactly when a run ends. */
class Deferred<T = unknown> {
  readonly promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason?: unknown) => void;
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

/** Unwraps `T | undefined` (noUncheckedIndexedAccess) with a loud failure. */
function must<T>(value: T | undefined, what = "value"): T {
  if (value === undefined) throw new Error(`expected ${what} to be present`);
  return value;
}

type RunFn = NodeSpec["run"];

/**
 * Builds NodeSpecs whose runs are wrapped to record call counts, the exact
 * `inputs` seen by each call, and each call's AbortSignal. Records are keyed
 * by `key` (defaults to the node name) so two specs for the same name can be
 * told apart across redefinitions.
 */
function makeRecorder() {
  const counts = new Map<string, number>();
  const inputsLog = new Map<string, Record<string, unknown>[]>();
  const signalsLog = new Map<string, AbortSignal[]>();

  const push = <T>(map: Map<string, T[]>, key: string, item: T): void => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };

  function spec(
    name: string,
    dependencies: readonly string[],
    fn: RunFn = () => name,
    key: string = name,
  ): NodeSpec {
    return {
      name,
      dependencies,
      run: (inputs, signal) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        push(inputsLog, key, { ...inputs });
        push(signalsLog, key, signal);
        return fn(inputs, signal);
      },
    };
  }

  return {
    spec,
    count: (key: string) => counts.get(key) ?? 0,
    inputs: (key: string) => inputsLog.get(key) ?? [],
    signals: (key: string) => signalsLog.get(key) ?? [],
  };
}

/** 6.2: per node, two consecutive events must never carry identical states. */
function expectNoConsecutiveDuplicates(
  events: readonly { name: string; state: NodeState }[],
): void {
  const last = new Map<string, NodeState>();
  for (const e of events) {
    const prev = last.get(e.name);
    if (prev !== undefined) expect(e.state).not.toEqual(prev);
    last.set(e.name, e.state);
  }
}

export function schedulerSuite(label: string, factory: () => Scheduler): void {
  describe(`scheduler spec — ${label}`, () => {
    let s: Scheduler;

    beforeEach(() => {
      s = factory();
    });
    afterEach(() => {
      try {
        s.dispose();
      } catch {
        // a test may already have disposed; double-dispose is not under test
      }
    });

    const status = (name: string) => s.getState(name)?.status;
    const value = (name: string) => s.getState(name)?.value;

    /**
     * Waits until no node is "idle" or "pending". Deterministic: either the
     * scheduler quiesces or the bounded loop fails the test. Only call this
     * when no test-held Deferred is keeping a fresh run in flight.
     */
    async function settle(maxTicks = 50): Promise<void> {
      for (let i = 0; i < maxTicks; i++) {
        await tick();
        const busy = s
          .names()
          .some((n) => status(n) === "idle" || status(n) === "pending");
        if (!busy) return;
      }
      throw new Error(`scheduler did not settle within ${maxTicks} ticks`);
    }

    /** Records every onChange event plus a getState snapshot taken inside the listener. */
    function recordEvents() {
      const events: {
        name: string;
        state: NodeState;
        snapshot: NodeState | undefined;
      }[] = [];
      const off = s.onChange((name, state) => {
        const snap = s.getState(name);
        events.push({
          name,
          state: { ...state },
          snapshot: snap ? { ...snap } : undefined,
        });
      });
      const statusesOf = (name: string) =>
        events.filter((e) => e.name === name).map((e) => e.state.status);
      return { events, off, statusesOf };
    }

    describe("1. batching", () => {
      it("1.1 no run is invoked synchronously during define", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => 1));
        s.define(r.spec("b", ["a"], (i) => (i.a as number) + 1));
        // Synchronously after define: defined, but nothing has run.
        expect(r.count("a")).toBe(0);
        expect(r.count("b")).toBe(0);
        expect(s.getState("a")).toBeDefined();
        expect(["idle", "pending"]).toContain(status("a"));
        expect(["idle", "pending"]).toContain(status("b"));
        await settle();
        expect(r.count("a")).toBe(1);
        expect(r.count("b")).toBe(1);
        expect(s.getState("a")).toMatchObject({ status: "success", value: 1 });
        expect(s.getState("b")).toMatchObject({ status: "success", value: 2 });
      });

      it("1.1 defines of the same name in one task coalesce: only the last spec runs, once", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => "v1", "a-v1"));
        s.define(r.spec("a", [], () => "v2", "a-v2"));
        await settle();
        expect(r.count("a-v1")).toBe(0); // replaced before the wave started
        expect(r.count("a-v2")).toBe(1);
        expect(value("a")).toBe("v2");
      });

      it("1.1 loading a whole document in one task is one wave: each node runs exactly once, forward refs included", async () => {
        const r = makeRecorder();
        // Dependents defined before their dependencies, all in one task.
        s.define(r.spec("c", ["b"], (i) => `${i.b}c`));
        s.define(r.spec("b", ["a"], (i) => `${i.a}b`));
        s.define(r.spec("a", [], () => "a"));
        await settle();
        expect(r.count("a")).toBe(1);
        expect(r.count("b")).toBe(1);
        expect(r.count("c")).toBe(1);
        expect(value("c")).toBe("abc");
      });

      it("1.2 a define arriving mid-wave joins the next wave and does not corrupt the current one", async () => {
        const r = makeRecorder();
        const dA = new Deferred();
        s.define(r.spec("a", [], () => dA.promise));
        s.define(r.spec("b", ["a"], (i) => `b:${i.a}`));
        await tick();
        expect(r.count("a")).toBe(1); // wave 1 in flight
        expect(status("a")).toBe("pending");

        s.define(r.spec("c", [], () => "c")); // arrives while wave 1 is in flight
        await tick();
        expect(r.count("a")).toBe(1); // a was not restarted: disjoint define

        dA.resolve("A");
        await settle();
        expect(value("a")).toBe("A"); // wave 1 completed intact
        expect(value("b")).toBe("b:A");
        expect(value("c")).toBe("c");
        expect(r.count("a")).toBe(1);
        expect(r.count("b")).toBe(1);
        expect(r.count("c")).toBe(1);
      });
    });

    describe("2. evaluation order and glitch-freedom", () => {
      it("2.1 unaffected nodes keep status, value, and run count when a disjoint subgraph changes", async () => {
        const r = makeRecorder();
        const pValue = { tag: "p" };
        s.define(r.spec("x", [], () => "x1", "x-v1"));
        s.define(r.spec("y", ["x"], (i) => `y:${i.x}`));
        s.define(r.spec("p", [], () => pValue));
        s.define(r.spec("q", ["p"], (i) => i.p));
        await settle();
        expect(r.count("p")).toBe(1);
        expect(r.count("q")).toBe(1);

        s.define(r.spec("x", [], () => "x2", "x-v2"));
        await settle();
        expect(value("y")).toBe("y:x2"); // affected subgraph re-ran
        expect(r.count("p")).toBe(1); // disjoint nodes did not
        expect(r.count("q")).toBe(1);
        expect(status("p")).toBe("success");
        expect(value("p")).toBe(pValue); // same reference: untouched
        expect(value("q")).toBe(pValue);
      });

      it("2.2 a node runs only after ALL direct dependencies settle", async () => {
        const r = makeRecorder();
        const dA = new Deferred();
        const dB = new Deferred();
        s.define(r.spec("a", [], () => dA.promise));
        s.define(r.spec("b", [], () => dB.promise));
        s.define(r.spec("d", ["a", "b"], (i) => `${i.a}+${i.b}`));
        await tick();
        expect(r.count("d")).toBe(0);
        expect(status("d")).toBe("pending");

        dA.resolve("A");
        await tick();
        expect(r.count("d")).toBe(0); // b still unsettled

        dB.resolve("B");
        await settle();
        expect(r.count("d")).toBe(1);
        expect(value("d")).toBe("A+B");
      });

      it("2.2 nodes with no unsettled dependencies run concurrently: a hung node does not block an independent one", async () => {
        const r = makeRecorder();
        const dSlow = new Deferred();
        const dFast = new Deferred();
        s.define(r.spec("slow", [], () => dSlow.promise));
        s.define(r.spec("fast", [], () => dFast.promise));
        await tick();
        expect(r.count("slow")).toBe(1);
        expect(r.count("fast")).toBe(1); // started while slow is in flight

        dFast.resolve("F");
        await tick();
        expect(s.getState("fast")).toMatchObject({
          status: "success",
          value: "F",
        }); // completed while slow is still pending
        expect(status("slow")).toBe("pending");

        dSlow.resolve("S");
        await settle();
        expect(value("slow")).toBe("S");
      });

      it("2.3 diamond: D runs exactly once per wave, only ever with same-generation B and C", async () => {
        const r = makeRecorder();
        const cRuns: Deferred[] = [];
        s.define(r.spec("a", [], () => 1, "a-v1"));
        s.define(r.spec("b", ["a"], (i) => (i.a as number) + 1));
        s.define(
          r.spec("c", ["a"], () => {
            const d = new Deferred();
            cRuns.push(d);
            return d.promise;
          }),
        );
        s.define(r.spec("d", ["b", "c"], (i) => [i.b, i.c]));
        await tick();
        expect(r.count("c")).toBe(1);
        expect(r.count("d")).toBe(0); // b settled (sync), c has not: d waits
        must(cRuns[0], "c run 1 deferred").resolve(10);
        await settle();
        expect(r.count("d")).toBe(1);
        expect(r.inputs("d")).toEqual([{ b: 2, c: 10 }]);
        expect(value("d")).toEqual([2, 10]);

        // Edit A. B settles synchronously; C stays in flight. D must NOT run
        // with { new B, stale C }.
        s.define(r.spec("a", [], () => 5, "a-v2"));
        await tick();
        expect(r.count("b")).toBe(2);
        expect(status("b")).toBe("success"); // sync result settled in-wave (7.1)
        expect(r.count("c")).toBe(2);
        expect(r.count("d")).toBe(1); // no mixed-generation run happened
        expect(status("d")).toBe("pending");

        must(cRuns[1], "c run 2 deferred").resolve(50);
        await settle();
        expect(r.count("d")).toBe(2); // exactly once for the wave
        expect(r.inputs("d")).toEqual([
          { b: 2, c: 10 },
          { b: 6, c: 50 },
        ]); // every observation is a consistent generation
        expect(value("d")).toEqual([6, 50]);
      });

      it("2.4 inputs are exactly the direct dependencies' values: settled this wave, or standing", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => 1, "a-v1"));
        s.define(r.spec("b", [], () => 2));
        await settle();

        s.define(r.spec("c", ["a", "b"], (i) => ({ ...i })));
        await settle();
        expect(r.inputs("c")).toEqual([{ a: 1, b: 2 }]); // standing values, exact key set

        s.define(r.spec("a", [], () => 10, "a-v2"));
        await settle();
        expect(r.inputs("c")).toEqual([
          { a: 1, b: 2 },
          { a: 10, b: 2 }, // new a from this wave, standing b
        ]);
        expect(r.count("b")).toBe(1); // b itself never re-ran
      });

      it("2.4 duplicate dependency names are ignored (NodeSpec contract)", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => 7));
        s.define(r.spec("b", ["a", "a"], (i) => i.a));
        await settle();
        expect(r.count("a")).toBe(1);
        expect(r.inputs("b")).toEqual([{ a: 7 }]);
        expect(value("b")).toBe(7);
      });
    });

    describe("3. statuses", () => {
      it("3.1 status is 'pending' by the time run starts", async () => {
        const r = makeRecorder();
        let statusInsideRun: string | undefined;
        s.define(
          r.spec("a", [], () => {
            statusInsideRun = status("a");
            return 1;
          }),
        );
        await settle();
        expect(statusInsideRun).toBe("pending");
      });

      it("3.1 dependents show 'pending' while upstreams compute", async () => {
        const r = makeRecorder();
        const d = new Deferred();
        s.define(r.spec("a", [], () => d.promise));
        s.define(r.spec("b", ["a"], (i) => i.a));
        await tick();
        expect(status("a")).toBe("pending");
        expect(status("b")).toBe("pending");
        expect(r.count("b")).toBe(0);
        d.resolve(1);
        await settle();
        expect(status("a")).toBe("success");
        expect(status("b")).toBe("success");
      });

      it("3.1/7.1 sync runs still pass through 'pending' before 'success' (observed via onChange)", async () => {
        const r = makeRecorder();
        const ev = recordEvents();
        s.define(r.spec("a", [], () => 42));
        await settle();
        const statuses = ev.statusesOf("a");
        const pendingAt = statuses.indexOf("pending");
        const successAt = statuses.indexOf("success");
        expect(pendingAt).toBeGreaterThanOrEqual(0);
        expect(successAt).toBeGreaterThan(pendingAt);
        expect(value("a")).toBe(42);
      });

      it("3.2 success value is retained until the next transition", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => "kept"));
        await settle();
        expect(s.getState("a")).toMatchObject({
          status: "success",
          value: "kept",
        });
        await tick();
        await tick();
        expect(s.getState("a")).toMatchObject({
          status: "success",
          value: "kept",
        });
        expect(r.count("a")).toBe(1); // nothing spuriously re-ran it
      });

      it("3.3 sync throw: node 'error' with the thrown error; closure 'upstream-error' naming the failing node, runs not called", async () => {
        const r = makeRecorder();
        const boom = new Error("boom");
        s.define(
          r.spec("e", [], () => {
            throw boom;
          }),
        );
        s.define(r.spec("f", ["e"], (i) => i.e));
        s.define(r.spec("g", ["f"], (i) => i.f)); // transitive closure member
        await settle();
        expect(status("e")).toBe("error");
        expect(s.getState("e")?.error).toBe(boom);
        expect(s.getState("f")).toMatchObject({
          status: "upstream-error",
          upstream: "e",
        });
        expect(s.getState("g")).toMatchObject({
          status: "upstream-error",
          upstream: "e",
        });
        expect(r.count("f")).toBe(0);
        expect(r.count("g")).toBe(0);
      });

      it("3.3 async rejection errors the node; recovery re-runs the closure normally", async () => {
        const r = makeRecorder();
        const boom = new Error("late boom");
        s.define(r.spec("e", [], () => Promise.reject(boom), "e-bad"));
        s.define(r.spec("f", ["e"], (i) => `f:${i.e}`));
        await settle();
        expect(status("e")).toBe("error");
        expect(s.getState("e")?.error).toBe(boom);
        expect(status("f")).toBe("upstream-error");
        expect(r.count("f")).toBe(0);

        s.define(r.spec("e", [], () => "ok", "e-good"));
        await settle();
        expect(s.getState("e")).toMatchObject({
          status: "success",
          value: "ok",
        });
        expect(s.getState("f")).toMatchObject({
          status: "success",
          value: "f:ok",
        });
        expect(r.count("f")).toBe(1);
      });

      it("3.4 two-node cycle: both members get 'cycle' and never run", async () => {
        const r = makeRecorder();
        s.define(r.spec("x", ["y"], (i) => i.y));
        s.define(r.spec("y", ["x"], (i) => i.x));
        await settle();
        expect(status("x")).toBe("cycle");
        expect(status("y")).toBe("cycle");
        expect(r.count("x")).toBe(0);
        expect(r.count("y")).toBe(0);
      });

      it("3.4 self-reference is a cycle of length 1", async () => {
        const r = makeRecorder();
        s.define(r.spec("loop", ["loop"], (i) => i.loop));
        await settle();
        expect(status("loop")).toBe("cycle");
        expect(r.count("loop")).toBe(0);
      });

      it("3.4 a dependent of a cycle member gets 'upstream-error'; breaking the cycle recovers the subgraph", async () => {
        const r = makeRecorder();
        s.define(r.spec("x", ["y"], (i) => `x:${i.y}`));
        s.define(r.spec("y", ["x"], (i) => i.x, "y-cyclic"));
        s.define(r.spec("z", ["x"], (i) => `z:${i.x}`)); // depends on the cycle, not on it
        await settle();
        expect(status("x")).toBe("cycle");
        expect(status("y")).toBe("cycle");
        expect(status("z")).toBe("upstream-error");
        expect(["x", "y"]).toContain(s.getState("z")?.upstream);
        expect(r.count("z")).toBe(0);

        s.define(r.spec("y", [], () => 5, "y-free")); // break the cycle
        await settle();
        expect(value("y")).toBe(5);
        expect(value("x")).toBe("x:5");
        expect(value("z")).toBe("z:x:5");
        expect(r.count("y-cyclic")).toBe(0);
        expect(r.count("y-free")).toBe(1);
        expect(r.count("x")).toBe(1);
        expect(r.count("z")).toBe(1);
      });

      it("3.5 forward reference: dependent defined first is 'unresolved', then auto-runs when the name appears", async () => {
        const r = makeRecorder();
        s.define(r.spec("b", ["a"], (i) => `b:${i.a}`));
        await settle();
        expect(status("b")).toBe("unresolved");
        expect(r.count("b")).toBe(0);

        s.define(r.spec("a", [], () => "A"));
        await settle();
        expect(s.getState("b")).toMatchObject({
          status: "success",
          value: "b:A",
        });
        expect(r.count("b")).toBe(1);
      });

      it("3.5 removing a node makes dependents 'unresolved' (not 'upstream-error'), without running them", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => 1));
        s.define(r.spec("b", ["a"], (i) => i.a));
        await settle();
        expect(status("b")).toBe("success");

        s.remove("a");
        await settle();
        expect(s.names()).not.toContain("a");
        expect(status("b")).toBe("unresolved");
        expect(r.count("b")).toBe(1); // not re-run by the removal
      });

      it("3.6 getState for a never-defined name returns undefined", () => {
        expect(s.getState("ghost")).toBeUndefined();
        expect(s.names()).toEqual([]);
      });

      it("names() lists each defined name exactly once, redefinitions included", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => 1, "a-v1"));
        s.define(r.spec("b", ["a"], (i) => i.a));
        s.define(r.spec("a", [], () => 2, "a-v2"));
        await settle();
        expect([...s.names()].sort()).toEqual(["a", "b"]);
      });
    });

    describe("4. cancellation and staleness", () => {
      it("4.1 redefining a node aborts its in-flight run's signal", async () => {
        const r = makeRecorder();
        const d1 = new Deferred();
        s.define(r.spec("a", [], () => d1.promise, "a-v1"));
        await tick();
        const sig1 = must(r.signals("a-v1")[0], "run 1 signal");
        expect(sig1.aborted).toBe(false);

        s.define(r.spec("a", [], () => "fresh", "a-v2"));
        await settle();
        expect(sig1.aborted).toBe(true);
        expect(s.getState("a")).toMatchObject({
          status: "success",
          value: "fresh",
        });
      });

      it("4.1 removing a node aborts its in-flight run's signal", async () => {
        const r = makeRecorder();
        const d = new Deferred();
        s.define(r.spec("a", [], () => d.promise));
        await tick();
        const sig = must(r.signals("a")[0], "run signal");
        expect(sig.aborted).toBe(false);
        s.remove("a");
        await tick();
        expect(sig.aborted).toBe(true);
        expect(s.names()).not.toContain("a");
      });

      it("4.1 an upstream re-run aborts a dependent's in-flight run; the stale settlement is ignored", async () => {
        const r = makeRecorder();
        const bRuns: Deferred[] = [];
        s.define(r.spec("a", [], () => 1, "a-v1"));
        s.define(
          r.spec("b", ["a"], () => {
            const d = new Deferred();
            bRuns.push(d);
            return d.promise;
          }),
        );
        await tick();
        expect(r.count("b")).toBe(1); // run 1 in flight
        const sig1 = must(r.signals("b")[0], "b run 1 signal");

        s.define(r.spec("a", [], () => 2, "a-v2")); // new wave includes b
        await tick();
        expect(sig1.aborted).toBe(true);
        expect(r.count("b")).toBe(2);
        expect(r.inputs("b")).toEqual([{ a: 1 }, { a: 2 }]);

        must(bRuns[1], "b run 2 deferred").resolve("fresh");
        await settle();
        expect(value("b")).toBe("fresh");

        must(bRuns[0], "b run 1 deferred").resolve("stale"); // settles late
        await tick();
        expect(s.getState("b")).toMatchObject({
          status: "success",
          value: "fresh",
        });
      });

      it("4.2 a stale slow run settling AFTER a fresh fast run is discarded: state and downstream untouched", async () => {
        const r = makeRecorder();
        const dSlow = new Deferred();
        const dFast = new Deferred();
        s.define(r.spec("a", [], () => dSlow.promise, "a-slow"));
        s.define(r.spec("b", ["a"], (i) => `b:${i.a}`));
        await tick();
        expect(r.count("a-slow")).toBe(1);

        s.define(r.spec("a", [], () => dFast.promise, "a-fast"));
        await tick();
        expect(must(r.signals("a-slow")[0], "slow signal").aborted).toBe(true);

        dFast.resolve("new"); // the newer run settles first
        await settle();
        expect(value("a")).toBe("new");
        expect(value("b")).toBe("b:new");
        expect(r.count("b")).toBe(1);

        dSlow.resolve("old"); // the stale run settles after the fresh one
        await tick();
        await tick();
        expect(value("a")).toBe("new"); // state not overwritten
        expect(value("b")).toBe("b:new"); // no downstream recomputation
        expect(r.count("b")).toBe(1);
        expect(r.inputs("b")).toEqual([{ a: "new" }]); // "old" never observed
      });

      it("4.3 an aborted run's rejection does not set 'error'; state is whatever the newer wave produced", async () => {
        const r = makeRecorder();
        const d1 = new Deferred();
        s.define(
          r.spec(
            "a",
            [],
            (_inputs, signal) => {
              // Reject on abort, like fetch() would.
              signal.addEventListener("abort", () =>
                d1.reject(new Error("aborted")),
              );
              return d1.promise;
            },
            "a-v1",
          ),
        );
        await tick();
        expect(r.count("a-v1")).toBe(1);

        s.define(r.spec("a", [], () => "fresh", "a-v2"));
        await settle();
        expect(must(r.signals("a-v1")[0], "run 1 signal").aborted).toBe(true);
        expect(s.getState("a")).toMatchObject({
          status: "success",
          value: "fresh",
        });
        await tick(); // give a buggy impl the chance to mis-apply the rejection
        expect(s.getState("a")).toMatchObject({
          status: "success",
          value: "fresh",
        });
      });
    });

    describe("5. redefinition, removal, renames", () => {
      it("5.1 redefinition with an identical spec still re-runs the node and its downstream closure (no memoization)", async () => {
        const r = makeRecorder();
        const runA = () => 1;
        s.define(r.spec("a", [], runA));
        s.define(r.spec("b", ["a"], (i) => i.a));
        await settle();
        expect(r.count("a")).toBe(1);
        expect(r.count("b")).toBe(1);

        s.define(r.spec("a", [], runA)); // byte-identical outcome
        await settle();
        expect(r.count("a")).toBe(2);
        expect(r.count("b")).toBe(2); // values always propagate
        expect(value("b")).toBe(1);
      });

      it("5.2 remove drops the node from names(); removing an absent name is a no-op", async () => {
        const r = makeRecorder();
        s.define(r.spec("a", [], () => 1));
        await settle();
        expect(s.names()).toContain("a");
        s.remove("a");
        expect(() => s.remove("ghost")).not.toThrow();
        await settle();
        expect(s.names()).not.toContain("a");
      });

      const runRenameScenario = async (defineNewFirst: boolean) => {
        const r = makeRecorder();
        s.define(r.spec("x", [], () => "val"));
        s.define(r.spec("dx", ["x"], (i) => `dx:${i.x}`));
        s.define(r.spec("dy", ["y"], (i) => `dy:${i.y}`));
        await settle();
        expect(value("dx")).toBe("dx:val");
        expect(status("dy")).toBe("unresolved");
        expect(r.count("dy")).toBe(0);

        // The rename, both calls in one task (1.1: order must not matter).
        const defineNew = () => s.define(r.spec("y", [], () => "val2"));
        const removeOld = () => s.remove("x");
        if (defineNewFirst) {
          defineNew();
          removeOld();
        } else {
          removeOld();
          defineNew();
        }
        await settle();

        expect(status("dx")).toBe("unresolved"); // dependents of the old name
        expect(r.count("dx")).toBe(1); // not re-run by the removal
        expect(s.getState("dy")).toMatchObject({
          status: "success",
          value: "dy:val2",
        }); // dependents of the new name resolve and run
        expect(r.count("dy")).toBe(1);
        expect([...s.names()].sort()).toEqual(["dx", "dy", "y"]);
      };

      it("5.3 rename in one task: remove(old) then define(new)", () =>
        runRenameScenario(false));

      it("5.3 rename in one task: define(new) then remove(old) — same outcome", () =>
        runRenameScenario(true));
    });

    describe("6. events", () => {
      it("6.1 transitions fire in order per node, and getState inside the listener matches the event's state", async () => {
        const r = makeRecorder();
        const ev = recordEvents();
        const d = new Deferred();
        s.define(r.spec("a", [], () => d.promise));
        s.define(r.spec("b", ["a"], (i) => i.a));
        await tick();
        d.resolve(9);
        await settle();

        // 6.1: listener sees consistent snapshots.
        for (const e of ev.events) {
          expect(e.snapshot).toEqual(e.state);
        }

        // Per-node order: pending strictly before success.
        for (const name of ["a", "b"]) {
          const statuses = ev.statusesOf(name);
          const pendingAt = statuses.indexOf("pending");
          const successAt = statuses.indexOf("success");
          expect(pendingAt).toBeGreaterThanOrEqual(0);
          expect(successAt).toBeGreaterThan(pendingAt);
        }

        // Cross-node order: b settles only after a (2.2 via events).
        const flat = ev.events.map((e) => `${e.name}:${e.state.status}`);
        expect(flat.indexOf("b:success")).toBeGreaterThan(
          flat.indexOf("a:success"),
        );
        ev.off();
      });

      it("6.1 unsubscribe stops delivery", async () => {
        const r = makeRecorder();
        let fired = 0;
        const off = s.onChange(() => {
          fired += 1;
        });
        s.define(r.spec("a", [], () => 1, "a-v1"));
        await settle();
        expect(fired).toBeGreaterThan(0);

        off();
        const before = fired;
        s.define(r.spec("a", [], () => 2, "a-v2"));
        await settle();
        expect(value("a")).toBe(2);
        expect(fired).toBe(before);
      });

      it("6.2 no transition, no event: consecutive states per node are never identical; stale settlements fire nothing", async () => {
        const r = makeRecorder();
        const events: { name: string; state: NodeState }[] = [];
        s.onChange((name, state) => events.push({ name, state: { ...state } }));

        s.define(r.spec("a", [], () => 1, "a-v1"));
        await settle();
        s.define(r.spec("a", [], () => 1, "a-v2")); // same value: 5.1 still re-runs
        await settle();

        const d1 = new Deferred();
        const d2 = new Deferred();
        s.define(r.spec("a", [], () => d1.promise, "a-v3"));
        await tick();
        s.define(r.spec("a", [], () => d2.promise, "a-v4")); // pending -> pending: not a transition
        await tick();
        d2.resolve(2);
        await settle();

        s.define(r.spec("u", ["ghost"], () => 0)); // unresolved path too
        await settle();

        expectNoConsecutiveDuplicates(events);

        const before = events.length;
        d1.resolve(999); // stale settlement: discarded, no state change, no event
        await tick();
        expect(events.length).toBe(before);
        expectNoConsecutiveDuplicates(events);
      });

      it("6.2 a throwing listener does not break the scheduler or starve other listeners", async () => {
        const r = makeRecorder();
        const seen: string[] = [];
        s.onChange(() => {
          throw new Error("listener boom");
        });
        s.onChange((name, state) => seen.push(`${name}:${state.status}`));

        s.define(r.spec("a", [], () => 1));
        await settle();
        expect(s.getState("a")).toMatchObject({ status: "success", value: 1 });
        expect(seen).toContain("a:success");

        // The scheduler keeps working after listener exceptions.
        s.define(r.spec("b", ["a"], (i) => (i.a as number) + 1));
        await settle();
        expect(value("b")).toBe(2);
      });
    });

    describe("7. runs and reentrancy", () => {
      it("7.2 define and remove from inside a run join the next wave without deadlock", async () => {
        const r = makeRecorder();
        s.define(r.spec("z", [], () => "Z"));
        await settle();
        expect(value("z")).toBe("Z");

        s.define(
          r.spec("a", [], () => {
            s.remove("z");
            s.define(r.spec("b", [], () => "B"));
            return "A";
          }),
        );
        await settle();
        expect(value("a")).toBe("A");
        expect(value("b")).toBe("B");
        expect(s.names()).not.toContain("z");
        expect(r.count("a")).toBe(1);
        expect(r.count("b")).toBe(1);
      });

      it("7.2 define from inside an onChange listener joins the next wave without deadlock", async () => {
        const r = makeRecorder();
        let injected = false;
        s.onChange((name, state) => {
          if (name === "a" && state.status === "success" && !injected) {
            injected = true;
            s.define(r.spec("c", ["a"], (i) => `c:${i.a}`));
          }
        });
        s.define(r.spec("a", [], () => "A"));
        await settle();
        expect(injected).toBe(true);
        expect(s.getState("c")).toMatchObject({
          status: "success",
          value: "c:A",
        });
        expect(r.count("c")).toBe(1);
      });

      it("7.3 dispose aborts in-flight runs; afterwards define/remove throw and getState is undefined", async () => {
        const r = makeRecorder();
        const d = new Deferred();
        s.define(r.spec("a", [], () => d.promise));
        await tick();
        const sig = must(r.signals("a")[0], "run signal");
        expect(sig.aborted).toBe(false);

        s.dispose();
        await tick();
        expect(sig.aborted).toBe(true);
        expect(s.getState("a")).toBeUndefined();
        expect(s.names()).toEqual([]);
        expect(() => s.define(r.spec("x", [], () => 1))).toThrow();
        expect(() => s.remove("a")).toThrow();

        // A late settlement of the aborted run resurrects nothing.
        d.resolve("zombie");
        await tick();
        expect(s.getState("a")).toBeUndefined();
        expect(s.names()).toEqual([]);
      });
    });
  });
}
