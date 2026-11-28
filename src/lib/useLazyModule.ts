import { useEffect, useState } from "react";

type Loader<M> = () => Promise<M>;

/** Modules already loaded, by loader, so a later caller has them at once. */
const loaded = new WeakMap<Loader<unknown>, unknown>();

/**
 * Load a module the first time a component needs it, for a feature that is
 * off by default (issue #93: dnd-kit arrives with the first drag feature that
 * is on). Returns `null` while `enabled` is false and until `load()` resolves,
 * then the module. Render the feature's static form until then.
 *
 * Unlike `React.lazy` there is no Suspense boundary: the component's tree does
 * not swap to a fallback, and the module appears on the next render after it
 * resolves (React holds a Suspense reveal back for up to 300ms after its
 * fallback). A module already loaded through the same `load` (keep it a
 * module-level function) is returned on the first render. A failed load leaves
 * the feature off; the browser reports the rejected import.
 */
export function useLazyModule<M>(load: Loader<M>, enabled: boolean): M | null {
  const [module, setModule] = useState<M | null>(() => (loaded.get(load) as M | undefined) ?? null);
  const ready = module ?? (loaded.get(load) as M | undefined) ?? null;
  useEffect(() => {
    if (!enabled || ready) return;
    let live = true;
    load().then((m) => {
      loaded.set(load, m);
      if (live) setModule(m);
    });
    return () => {
      live = false;
    };
  }, [enabled, ready, load]);
  return enabled ? ready : null;
}
