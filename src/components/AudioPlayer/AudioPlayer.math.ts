/**
 * Pure helpers behind `AudioPlayer`: time formatting, peak extraction from
 * decoded PCM, layout re-bucketing, analyser bin grouping, and the step
 * quantizer that snaps column heights onto the shade-block grid. No DOM, no
 * audio APIs; everything here is unit-tested.
 */

/**
 * Format a time in seconds as `m:ss` (or `h:mm:ss` from one hour up). The
 * optional `reference` (typically the track duration) sets the field width, so
 * `formatTime(12, 225)` → `0:12` aligns with `3:45` and an hour-long track
 * pads elapsed to `0:00:12`. A non-finite or negative `seconds` (unknown
 * duration) renders as `--:--`.
 */
export function formatTime(seconds: number, reference: number = seconds): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const ref = Number.isFinite(reference) && reference > seconds ? reference : seconds;
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (ref >= 3600) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * Reduce decoded PCM to a fixed-resolution amplitude profile: the max absolute
 * sample per bucket, across all channels. `buckets` decouples the one-off
 * decode from layout (re-bucket to the column count later); the source
 * `AudioBuffer` can be dropped as soon as this returns. Fewer samples than
 * buckets → one bucket per sample, the rest zero.
 */
export function computePeaks(channels: Float32Array[], buckets: number): Float32Array {
  const out = new Float32Array(Math.max(0, buckets));
  const length = channels.reduce((max, c) => Math.max(max, c.length), 0);
  if (length === 0 || buckets <= 0) return out;
  const perBucket = length / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * perBucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * perBucket));
    let peak = 0;
    for (const channel of channels) {
      const stop = Math.min(end, channel.length);
      for (let j = start; j < stop; j++) {
        const v = Math.abs(channel[j] ?? 0);
        if (v > peak) peak = v;
      }
    }
    out[i] = peak;
  }
  return out;
}

/**
 * Max-pool a peak profile down (or nearest-sample up) to `n` entries, one per
 * drawn column. Downsampling keeps the loudest sample per column, so short
 * transients stay visible at any width. Pure: returns a new array.
 */
export function rebucket(peaks: Float32Array, n: number): Float32Array {
  const out = new Float32Array(Math.max(0, n));
  if (peaks.length === 0 || n <= 0) return out;
  if (n === peaks.length) return peaks.slice();
  const per = peaks.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * per);
    const end = Math.max(start + 1, Math.floor((i + 1) * per));
    let peak = 0;
    for (let j = start; j < Math.min(end, peaks.length); j++) {
      const v = peaks[j] ?? 0;
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

/**
 * Group analyser frequency bins (`getByteFrequencyData`, 0..255) into
 * `barCount` log-spaced bars, normalized to 0..1. Log spacing gives each bar
 * roughly an octave's worth of perceptual weight instead of cramming all the
 * music into the leftmost bars; each bar takes the max of its bins so narrow
 * peaks still register. Every bin belongs to exactly one bar.
 */
export function barLevels(freq: Uint8Array, barCount: number): Float32Array {
  const out = new Float32Array(Math.max(0, barCount));
  if (freq.length === 0 || barCount <= 0) return out;
  const edges = barEdges(freq.length, barCount);
  for (let i = 0; i < barCount; i++) {
    let peak = 0;
    const start = edges[i] ?? 0;
    const end = edges[i + 1] ?? 0;
    for (let j = start; j < end; j++) {
      const v = freq[j] ?? 0;
      if (v > peak) peak = v;
    }
    out[i] = peak / 255;
  }
  return out;
}

/**
 * Log-spaced, gap-free bin boundaries for {@link barLevels}: `barCount + 1`
 * monotonically increasing edges with `edges[0] = 0`, `edges[barCount] =
 * binCount`, and every bar at least one bin wide (extra low bars go linear
 * until the log curve catches up).
 */
export function barEdges(binCount: number, barCount: number): number[] {
  const edges = [0];
  let prev = 0;
  for (let i = 1; i < barCount; i++) {
    const ideal = Math.round(binCount ** (i / barCount));
    // Keep at least one bin for this bar and one for each remaining bar.
    const lo = prev + 1;
    const hi = binCount - (barCount - i);
    prev = hi < lo ? Math.min(lo, binCount) : Math.min(Math.max(ideal, lo), hi);
    edges.push(prev);
  }
  edges.push(binCount);
  return edges;
}

/**
 * Snap a normalized 0..1 level onto `steps` discrete rungs, returning the
 * quantized 0..1 value. Never returns less than one rung for any level (and
 * one rung even for silence), so a quiet track still reads as a resting
 * baseline row of minimum-height blocks rather than an empty panel.
 */
export function quantizeSteps(v: number, steps: number): number {
  if (steps <= 0) return 0;
  const clamped = Math.max(0, Math.min(1, v));
  return Math.max(1, Math.round(clamped * steps)) / steps;
}
