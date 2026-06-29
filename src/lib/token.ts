/**
 * Resolve a CSS custom property (a `--sf-*` token) to its current computed value
 * so canvas/WebGL renderers — which can't use CSS — stay theme-aware. Reads from
 * `el` (the component's own subtree) so it honors whatever `data-theme` an
 * ancestor sets, falling back to `document.documentElement`, then a literal
 * before first paint / outside the browser.
 */
export function token(name: string, fallback: string, el?: Element | null): string {
  if (typeof document === "undefined") return fallback;
  const source = el ?? document.documentElement;
  const value = getComputedStyle(source).getPropertyValue(name).trim();
  return value || fallback;
}
