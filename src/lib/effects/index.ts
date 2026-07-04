/** Shared visual-effects module: the animated WebGL "dither" fills used by
 *  NonIdealState, Skeleton, and DataTable's column-fill. The home for future
 *  reusable animations. Internal (not part of the package's public deep-import
 *  surface); `EffectName`/`EffectOptions` are re-exported publicly via
 *  NonIdealState. */
export * from "./effects";
export * from "./spinners";
export * from "./useDitheredFill";
// Type-only: a runtime re-export would put the ~6KB gz engine back into the
// static import graph of every consumer; useDitheredFill loads it lazily.
export type { FillFrame, WebglFill } from "./webglFill";
