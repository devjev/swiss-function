import type { Ref } from "react";

/**
 * Combine several refs (callback or object) into one callback ref. Used when a
 * component needs its own internal ref (e.g. for measurement) alongside the
 * consumer's forwarded ref. Mirrors the local `setRefs` pattern in Grid.tsx.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}
