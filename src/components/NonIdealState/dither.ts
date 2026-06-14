/** Continuous dithered fills, drawn from the console shade ramp. A field is a
 *  grid of cells whose character is chosen from the ramp by an intensity in
 *  [0,1], ordered-dithered against a Bayer matrix so the gradient reads as
 *  crisp old-console dither rather than smooth banding. Decorative only. */

export type NonIdealStateVariant = "empty" | "no-results" | "error" | "loading";

/** Density ramp: space → light → medium → dark → full. */
export const RAMP = [" ", "░", "▒", "▓", "█"] as const;

/** 4×4 Bayer ordered-dither thresholds, normalized to (0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Pick a ramp character for an intensity, dithered by cell position. */
function rampChar(intensity: number, x: number, y: number): string {
  const i = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  const scaled = i * (RAMP.length - 1);
  const base = Math.floor(scaled);
  const frac = scaled - base;
  // biome-ignore lint/style/noNonNullAssertion: BAYER index is masked to 0..15
  const threshold = BAYER[(y & 3) * 4 + (x & 3)]!;
  const idx = Math.min(RAMP.length - 1, base + (frac > threshold ? 1 : 0));
  // biome-ignore lint/style/noNonNullAssertion: idx is clamped into range
  return RAMP[idx]!;
}

/** Per-variant fill weight — how dense the field reads overall. */
export const GAIN: Record<NonIdealStateVariant, number> = {
  empty: 0.85,
  "no-results": 1,
  error: 1.15,
  loading: 1,
};

/** Radial vignette: dense at the edges, clearing toward the center so the
 *  message panel sits in naturally open space. */
function vignetteIntensity(x: number, y: number, cols: number, rows: number): number {
  const nx = cols <= 1 ? 0 : (x / (cols - 1)) * 2 - 1;
  const ny = rows <= 1 ? 0 : (y / (rows - 1)) * 2 - 1;
  const d = Math.min(1, Math.hypot(nx, ny) / Math.SQRT2);
  // Hold the center clear, then ramp up toward the corners.
  return Math.max(0, (d - 0.28) / 0.72);
}

function build(cols: number, rows: number, intensityAt: (x: number, y: number) => number): string {
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) line += rampChar(intensityAt(x, y), x, y);
    lines.push(line);
  }
  return lines.join("\n");
}

/** Static vignette field for a variant. */
export function buildVignette(cols: number, rows: number, gain: number): string {
  return build(cols, rows, (x, y) => vignetteIntensity(x, y, cols, rows) * gain);
}

/** Concentric ripple emanating from the center; `t` advances the phase. Cells
 *  are ~1.7× taller than wide, so y is scaled to keep the waves circular. */
export function buildRipple(cols: number, rows: number, t: number): string {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  return build(cols, rows, (x, y) => {
    const dist = Math.hypot(x - cx, (y - cy) * 1.7);
    return (0.5 + 0.5 * Math.sin(dist * 0.55 - t)) * 0.95;
  });
}
