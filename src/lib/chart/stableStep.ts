/**
 * Hysteresis (Schmitt trigger) for width-driven chart quantities. Pure — no
 * React, no DOM.
 *
 * Quantities derived from `width / targetSpacing` — the numeric tick step
 * (`adaptiveTicks`), the time-axis rung (`pickTimeUnit`), Candlestick's LOD
 * `maxBars` — flip between adjacent values whenever a resize or zoom hovers
 * near a threshold, making axis labels flicker. `stableValue` wraps any such
 * computation with a hysteresis band: the previously chosen value is kept
 * while it still yields acceptable pixel spacing, and the fresh candidate is
 * adopted only when the kept value drifts clearly out of band.
 *
 * Usage for ticks: keep a `StepSession` in a ref. Each render, compute the
 * candidate step as usual, plus the pixel spacing the *previously kept* step
 * yields at the current width (`widthPx / (span / keptStep)`), and call
 * `stableValue(session, candidateStep, keptSpacingPxNow, 80, domainKeyOf(domain))`.
 * The previous step survives while its labels still sit 0.7×–1.6× of the
 * 80px target; a domain change (zoom, new data) resets immediately.
 *
 * Usage for Candlestick LOD: same session, with `maxBars` as the value — the
 * candidate is `width / minBarPx`, and `keptSpacingPxNow` is
 * `widthPx / keptMaxBars` (the per-bar width the kept LOD produces now), so
 * the bar count only re-buckets when bars get markedly too thin or too fat.
 */

/** Mutable hysteresis state — lives in a caller-owned ref, one per axis. */
export interface StepSession<T> {
  /** The value currently held across recomputes. */
  value?: T;
  /** Pixel spacing the held value produced at the last `stableValue` call
   *  that kept it (undefined right after adoption — not yet observed). */
  spacingPx?: number;
  /** Domain identity the held value was chosen for (see `domainKeyOf`). */
  domainKey?: string;
}

export interface StableValueOptions {
  /** Lower band edge as a fraction of the target spacing (default 0.7). */
  low?: number;
  /** Upper band edge as a multiple of the target spacing (default 1.6). */
  high?: number;
}

/**
 * Keep `session.value` while `keptSpacingPxNow` stays inside the band
 * `[low × targetSpacingPx, high × targetSpacingPx]` — both edges inclusive:
 * spacing exactly at `low × target` or `high × target` still keeps. Adopt
 * `candidate` on the first call, when `domainKey` differs from the session's
 * (zoom / data change), when `keptSpacingPxNow` is undefined, or when it
 * falls outside the band. Mutates `session` to record the outcome.
 */
export function stableValue<T>(
  session: StepSession<T>,
  candidate: T,
  keptSpacingPxNow: number | undefined,
  targetSpacingPx: number,
  domainKey: string,
  opts?: StableValueOptions,
): T {
  const low = opts?.low ?? 0.7;
  const high = opts?.high ?? 1.6;
  if (
    session.domainKey === domainKey &&
    session.value !== undefined &&
    keptSpacingPxNow !== undefined &&
    keptSpacingPxNow >= low * targetSpacingPx &&
    keptSpacingPxNow <= high * targetSpacingPx
  ) {
    session.spacingPx = keptSpacingPxNow;
    return session.value;
  }
  session.value = candidate;
  // The candidate's own spacing is unknown here (the caller measured the
  // *kept* value); it becomes keptSpacingPxNow on the next call.
  session.spacingPx = undefined;
  session.domainKey = domainKey;
  return candidate;
}

/** Fixed-precision domain identity ("lo:hi" at 6 significant digits) so the
 *  float jitter of pan/zoom math does not read as a domain change and defeat
 *  the hysteresis, while any real domain move still produces a new key. */
export function domainKeyOf(domain: readonly [number, number]): string {
  return `${domain[0].toPrecision(6)}:${domain[1].toPrecision(6)}`;
}
