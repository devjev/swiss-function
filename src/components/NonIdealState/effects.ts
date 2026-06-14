/** Effect contract for the dithered fill. The math lives in the WebGL shader
 *  (`webglFill.ts`); this module just names the effects and their parameters.
 *  All five+ effects are animated (the static vignette was dropped). */

export type EffectName = "ripple" | "noise" | "scan" | "plasma" | "rain" | "pulse";

export interface RippleParams {
  /** Animation speed (radians/second of phase advance). Default 3. */
  speed?: number;
  /** Ripple wave length in cells. Default 11. */
  wavelength?: number;
  /** Peak intensity 0..1. Default 0.95. */
  amplitude?: number;
}

export interface NoiseParams {
  /** Per-cell re-roll rate in changes/second (noise). Default 12. */
  rate?: number;
  /** Mean density 0..1 (noise). Default 0.55. */
  density?: number;
  /** Deterministic seed (noise / rain column offsets). Default 1. */
  seed?: number;
}

/** All effect parameters; every effect reads the subset it needs. */
export type EffectOptions = RippleParams & NoiseParams;
