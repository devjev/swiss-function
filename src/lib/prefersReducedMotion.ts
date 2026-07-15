/** True when the user asked for reduced motion (animations snap instead of
 *  easing, programmatic scrolls jump instead of gliding). Defaults to `false`
 *  outside the browser. Read at call time, not module load: the media query
 *  can change within a session. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
