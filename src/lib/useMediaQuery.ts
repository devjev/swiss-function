import { useCallback, useSyncExternalStore } from "react";

/** Whether a media query matches, live. `false` on the server and in an
 *  environment without `matchMedia`, so a component renders its wide,
 *  mouse-driven form there and corrects itself on hydration.
 *
 *  Use it for what follows the viewport or the device (a fixed overlay, the
 *  pointer type). What follows a container's width takes `useCollapse`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches,
    () => false,
  );
}

/** The media query of a device whose primary pointer is a finger: the one the
 *  touch tokens in `tokens.css` switch on. */
export const COARSE_POINTER = "(pointer: coarse)";

/** `true` on a device whose primary pointer is a finger. For behaviour that
 *  has no CSS form (a toolbar that replaces keyboard chords, a tap that
 *  stands in for a double click); sizes belong to the touch tokens. */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER);
}
