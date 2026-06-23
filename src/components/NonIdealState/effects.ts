/** Effect contract for the dithered fill. The math lives in the WebGL shader
 *  (`webglFill.ts`); this module just names the effects and their parameters.
 *  All five+ effects are animated (the static vignette was dropped). */

export type EffectName =
  | "ripple"
  | "noise"
  | "scan"
  | "plasma"
  | "rain"
  | "wave"
  | "spiral"
  | "radar"
  | "tunnel"
  | "fire"
  | "bars"
  | "metaballs"
  | "rotozoom"
  | "twister"
  | "copper"
  | "voronoi"
  | "grid"
  | "kaleidoscope"
  | "bobs"
  | "swirl"
  | "helix"
  | "checker"
  | "droplets"
  | "glitch"
  // Subtle, evenly-covered effects — toggle different sets of dots in different
  // patterns: breathe = all together, twinkle = per-cell, interleave = checker,
  // rotate = round-robin buckets, stripes = rows, diagonal = diagonal bands,
  // blocks = coarse blocks, rings = concentric.
  | "breathe"
  | "twinkle"
  | "interleave"
  | "rotate"
  | "stripes"
  | "diagonal"
  | "blocks"
  | "rings"
  // Conway's Game of Life — a feedback cellular automaton (stateful).
  | "life";

/** Advanced, effect-specific tuning. Overall density is the top-level `density`
 *  prop; animation pace is `speed`. */
export interface EffectOptions {
  /** Ripple wave length in cells. Default 11. */
  wavelength?: number;
  /** Deterministic seed (noise / rain column offsets). Default 1. */
  seed?: number;
}
