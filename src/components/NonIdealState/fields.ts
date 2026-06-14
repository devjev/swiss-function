/** Renderer-agnostic dithered-fill math. A *field* returns an intensity in
 *  [0,1] for a cell (x,y) in a cols×rows grid at time `t` (seconds). A renderer
 *  maps the ordered-dithered `quantize`d level to a character or an alpha, so
 *  the same fields drive the DOM, canvas, and WebGL prototypes identically. */

export const RAMP = [" ", "░", "▒", "▓", "█"] as const;
/** Highest ramp index (█). Levels run 0..MAX_LEVEL. */
export const MAX_LEVEL = RAMP.length - 1;

/** 4×4 Bayer ordered-dither thresholds, normalized to (0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Ordered-dither an intensity [0,1] to a ramp level 0..MAX_LEVEL for cell (x,y).
 *  The Bayer threshold makes the gradient read as crisp dither, not banding. */
export function quantize(intensity: number, x: number, y: number): number {
  const i = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  const scaled = i * MAX_LEVEL;
  const base = Math.floor(scaled);
  const frac = scaled - base;
  // biome-ignore lint/style/noNonNullAssertion: index masked to 0..15
  const threshold = BAYER[(y & 3) * 4 + (x & 3)]!;
  return Math.min(MAX_LEVEL, base + (frac > threshold ? 1 : 0));
}

export type EffectName = "vignette" | "ripple" | "noise";

export interface RippleParams {
  /** Phase advance in radians/second (animation speed). Default 3. */
  speed?: number;
  /** Wave length in cells. Default 11. */
  wavelength?: number;
  /** Peak intensity 0..1. Default 0.95. */
  amplitude?: number;
  /** Wave origin. Default "center". */
  origin?: "center" | "top-left" | "top";
}

export interface NoiseParams {
  /** Per-cell re-roll rate in changes/second. Default 12. */
  rate?: number;
  /** Overall density 0..1 (mean intensity). Default 0.55. */
  density?: number;
  /** Deterministic seed. Default 1. */
  seed?: number;
}

/** Cell aspect: cells are ~1.7× taller than wide, so y is scaled to keep
 *  distance-based fields (ripple) visually circular. */
const Y_ASPECT = 1.7;

/** Radial vignette: dense at the edges, clearing toward the center so the
 *  message panel sits in open space. Static (ignores t). */
export function vignette(x: number, y: number, cols: number, rows: number): number {
  const nx = cols <= 1 ? 0 : (x / (cols - 1)) * 2 - 1;
  const ny = rows <= 1 ? 0 : (y / (rows - 1)) * 2 - 1;
  const d = Math.min(1, Math.hypot(nx, ny) / Math.SQRT2);
  return Math.max(0, (d - 0.28) / 0.72);
}

/** Concentric ripple emanating from the origin. */
export function ripple(
  x: number,
  y: number,
  cols: number,
  rows: number,
  t: number,
  p: RippleParams = {},
): number {
  const { speed = 3, wavelength = 11, amplitude = 0.95, origin = "center" } = p;
  const ox = origin === "center" ? (cols - 1) / 2 : 0;
  const oy = origin === "top" ? 0 : origin === "center" ? (rows - 1) / 2 : 0;
  const dist = Math.hypot(x - ox, (y - oy) * Y_ASPECT);
  const k = (2 * Math.PI) / Math.max(1, wavelength);
  return (0.5 + 0.5 * Math.sin(dist * k - t * speed)) * amplitude;
}

/** Integer hash → [0,1). Deterministic; no Math.random (SSR-safe, seedable). */
function hash(x: number, y: number, z: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695040)) >>> 0;
  n = (Math.imul(n ^ (n >>> 13), 1274126177) >>> 0) ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

/** Random per-cell density that re-rolls `rate` times per second. */
export function noise(
  x: number,
  y: number,
  _cols: number,
  _rows: number,
  t: number,
  p: NoiseParams = {},
): number {
  const { rate = 12, density = 0.55, seed = 1 } = p;
  const frame = Math.floor(t * rate);
  const h = hash(x, y, frame + seed);
  // Center the noise around `density` with full-range jitter.
  return density + (h - 0.5);
}
