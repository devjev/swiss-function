/** Orthographic (axonometric) 3D→2D projection. Pure — no React, no DOM.
 *
 * Why orthographic and not perspective: lengths stay comparable along each axis
 * (an engineering/CAD drawing), so the chart measures rather than performs depth.
 * Data is normalized into a unit cube centered at the origin, rotated by the
 * camera, then the depth axis is dropped (kept only for painter's-order sorting).
 *
 * Axes: data x → world X (horizontal), data y → world depth, data z → world up.
 * Camera: `azimuth` spins around the up axis; `elevation` tilts above the horizon
 * (0 = side view, π/2 = top-down). */

import type { Domain } from "./types";

export interface Camera {
  /** Radians around the vertical (up) axis. */
  azimuth: number;
  /** Radians above the horizon: 0 = side-on, π/2 = top-down. */
  elevation: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Inner padding in px so the projected cube never touches the edges. */
  padding: number;
}

/** A point projected to canvas pixels, with depth toward the viewer (larger =
 *  nearer) for painter's-algorithm sorting. */
export interface Projected {
  x: number;
  y: number;
  depth: number;
}

/** Maps the rotated, fitted cube into canvas pixels. */
export interface Fit {
  scale: number;
  ox: number;
  oy: number;
}

/** The 8 corners of the centered unit cube, used to fit the view at any angle. */
export const CUBE_CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [-0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5],
];

/** Normalize a value within its domain to the centered unit range [-0.5, 0.5]. */
export function normalize(value: number, [min, max]: Domain): number {
  if (max === min) return 0;
  return (value - min) / (max - min) - 0.5;
}

/** Rotate a normalized point by the camera into pre-fit screen space (x right,
 *  y up, depth toward viewer). */
function rotate(nx: number, ny: number, nz: number, cam: Camera): Projected {
  const ca = Math.cos(cam.azimuth);
  const sa = Math.sin(cam.azimuth);
  const ce = Math.cos(cam.elevation);
  const se = Math.sin(cam.elevation);
  // Spin around the up (z) axis.
  const x1 = nx * ca - ny * sa;
  const y1 = nx * sa + ny * ca;
  const z1 = nz;
  // Tilt: screen-up mixes height (z1) and depth (y1); the dropped component is depth.
  return { x: x1, y: z1 * ce - y1 * se, depth: y1 * ce + z1 * se };
}

/** Compute the scale + offset that fits the rotated unit cube into the viewport
 *  (so the frame stays fully visible at every camera angle). */
export function computeFit(cam: Camera, vp: Viewport): Fit {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [cx, cy, cz] of CUBE_CORNERS) {
    const p = rotate(cx, cy, cz, cam);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const usableW = Math.max(0, vp.width - 2 * vp.padding);
  const usableH = Math.max(0, vp.height - 2 * vp.padding);
  const scale = Math.min(usableW / spanX, usableH / spanY);
  // Center the cube's projected bounds in the viewport (canvas y grows downward,
  // so the up axis is negated when placing).
  const ox = vp.width / 2 - ((minX + maxX) / 2) * scale;
  const oy = vp.height / 2 + ((minY + maxY) / 2) * scale;
  return { scale, ox, oy };
}

/** Project a normalized point ([-0.5, 0.5] per axis) to canvas pixels. */
export function project(nx: number, ny: number, nz: number, cam: Camera, fit: Fit): Projected {
  const p = rotate(nx, ny, nz, cam);
  return { x: fit.ox + p.x * fit.scale, y: fit.oy - p.y * fit.scale, depth: p.depth };
}
