/** Flat shading + a sequential color ramp for the 3D charts.
 *
 * Colors come from `--sf-*` tokens that may be hex / rgb / oklch / named, which
 * canvas can't interpolate. We resolve any CSS color to `[r,g,b]` once per render
 * via computed style (the browser always serializes `color` to rgb), then lerp /
 * darken in plain RGB. One accent + neutral ramp keeps it on-brand. */

export type Rgb = [number, number, number];

/** Resolve any CSS color string to `[r,g,b]` using a throwaway probe inside the
 *  chart's subtree (so `var(--sf-*)` and `data-theme` resolve correctly). */
export function resolveRgb(color: string, host: Element, fallback: Rgb = [37, 99, 235]): Rgb {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.cssText = `color:${color};position:absolute;visibility:hidden;pointer-events:none`;
  host.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  host.removeChild(probe);
  const m = computed.match(/-?\d+(?:\.\d+)?/g);
  if (!m || m.length < 3) return fallback;
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Linear interpolate two RGB colors. */
export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Darken an RGB by a Lambert term (face normal · light), keeping an ambient
 *  floor so shadowed faces stay legible. Returns a canvas-ready `rgb(...)`. */
export function shade(rgb: Rgb, lambert: number, ambient = 0.4): string {
  const k = ambient + (1 - ambient) * clamp01(lambert);
  return `rgb(${Math.round(rgb[0] * k)}, ${Math.round(rgb[1] * k)}, ${Math.round(rgb[2] * k)})`;
}

/** Fixed world-space light (upper-front-right), normalized. Lighting is attached
 *  to the data, not the camera, so faces keep their shade as you orbit. */
const LIGHT: Rgb = (() => {
  const v: Rgb = [0.4, 0.5, 0.85];
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

/** Lambert term for a triangle given three points in normalized data space
 *  (x, y, z). Returns `|n · light|` so either winding lights up. */
export function faceLambert(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  // n = e1 × e2
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  return Math.abs(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
}
