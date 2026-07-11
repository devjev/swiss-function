/**
 * Document-to-scheduler reconciliation + React state bridge: the glue #59
 * will own for real. Cells with a name and an executing type become graph
 * nodes; display-only cells never touch the scheduler. The scheduler lives
 * inside an effect so StrictMode's mount/cleanup/remount cycle gets a fresh
 * instance instead of a disposed one.
 */
import {useEffect, useRef, useState} from "react";
import type {CellDoc, CellType, NotebookDoc} from "../contract";
import type {NodeState, Scheduler, SchedulerFactory} from "../scheduler/types";

export interface WaveStats {
  startedAt: number;
  settledAt: number;
  /** Milliseconds from the triggering define to the last settlement. */
  ms: number;
}

export function useNotebook(
  doc: NotebookDoc,
  cellTypes: Record<string, CellType>,
  createScheduler: SchedulerFactory
) {
  const [states, setStates] = useState<Record<string, NodeState>>({});
  const [lastWave, setLastWave] = useState<WaveStats | null>(null);
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const defined = useRef<Map<string, string>>(new Map()); // name -> type+source fingerprint
  const waveStart = useRef<number>(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const s = createScheduler();
    defined.current.clear();
    setStates({});
    setScheduler(s);
    const off = s.onChange((name, state) => {
      setStates((prev) => ({...prev, [name]: state}));
      // A wave is settled once nothing new has fired for a macrotask tick.
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (state.status !== "pending") {
        settleTimer.current = setTimeout(() => {
          if (waveStart.current > 0) {
            const settledAt = performance.now();
            setLastWave({startedAt: waveStart.current, settledAt, ms: settledAt - waveStart.current});
            waveStart.current = 0;
          }
        }, 0);
      }
    });
    return () => {
      off();
      s.dispose();
    };
  }, [createScheduler]);

  // Reconcile the document into the scheduler: define named executing cells,
  // remove nodes whose cells disappeared or were renamed.
  useEffect(() => {
    if (!scheduler) return;
    const wanted = new Map<string, CellDoc>();
    const knownNames = doc.cells.filter((c) => c.name).map((c) => c.name as string);
    for (const cell of doc.cells) {
      const type = cellTypes[cell.type];
      if (cell.name && type?.execute) wanted.set(cell.name, cell);
    }
    for (const name of [...defined.current.keys()]) {
      if (!wanted.has(name)) {
        scheduler.remove(name);
        defined.current.delete(name);
      }
    }
    waveStart.current = performance.now();
    for (const [name, cell] of wanted) {
      const type = cellTypes[cell.type] as CellType;
      const fingerprint = `${cell.type} ${cell.source}`;
      if (defined.current.get(name) === fingerprint) continue;
      defined.current.set(name, fingerprint);
      const deps = type.findDependencies?.(cell.source, knownNames) ?? [];
      const source = cell.source;
      scheduler.define({
        name,
        dependencies: deps,
        run: (inputs, signal) => (type.execute as NonNullable<CellType["execute"]>)({source, inputs, signal}),
      });
    }
  }, [doc, cellTypes, scheduler]);

  return {states, lastWave};
}
