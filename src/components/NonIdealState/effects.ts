/** Effect contract for the dithered fill. The math lives in the WebGL shader
 *  (`webglFill.ts`); this module just names the effects and their parameters.
 *  All five+ effects are animated (the static vignette was dropped). */

export type EffectName = "ripple" | "noise" | "scan" | "plasma" | "rain" | "pulse";

/** Advanced, effect-specific tuning. Overall density is the top-level `density`
 *  prop; animation pace is `speed`. */
export interface EffectOptions {
  /** Ripple wave length in cells. Default 11. */
  wavelength?: number;
  /** Deterministic seed (noise / rain column offsets). Default 1. */
  seed?: number;
}
