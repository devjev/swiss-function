/** Shared visual-effects module: the animated WebGL "dither" fills used by
 *  NonIdealState, Skeleton, and DataTable's column-fill. The home for future
 *  reusable animations. Internal (not part of the package's public deep-import
 *  surface); `EffectName`/`EffectOptions` are re-exported publicly via
 *  NonIdealState. */
export * from "./effects";
export * from "./spinners";
export * from "./useDitheredFill";
export * from "./webglFill";
