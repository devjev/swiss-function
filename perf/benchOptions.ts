/** Shared settings for every `*.bench.ts` file, so numbers are comparable
 *  across the suite: fixed warmup, then 500ms of sampling per case — long
 *  enough for stable medians, short enough that the whole suite stays fast.
 *  Lives outside `src/` so it never ships (tsconfig.build includes src only). */
export const BENCH = {
  warmupIterations: 10,
  warmupTime: 100,
  time: 500,
} as const;

/** Deterministic PRNG (mulberry32). Bench data must be reproducible across
 *  runs and machines — never use `Math.random()` in a bench file. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
