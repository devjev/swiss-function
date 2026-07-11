/** Axis-label layout: collision thinning, ellipsizing, band-tick fitting.
 *  Pure — no React, no DOM; text width comes in via a `measure` callback. */

export interface LabelBox {
  /** Center of the label along the axis, in px. */
  center: number;
  /** Rendered extent of the label along the axis, in px. */
  size: number;
  /** 2 = endpoint (always kept), 1 = major, 0 = minor (the default). */
  priority?: 0 | 1 | 2;
  /** Stable identity used for survivor bias across frames. */
  key?: string;
}

const ELLIPSIS = "…";

interface Candidate {
  index: number;
  tier: number;
  center: number;
  start: number;
  end: number;
}

/**
 * Decide which labels to keep so that none collide. Returns keep flags
 * parallel to `boxes` — order-preserving and deterministic.
 *
 * Placement runs in tiers: endpoints (priority 2 — always kept, even when
 * they mutually collide), then majors that survived the previous frame,
 * majors, minors that survived, minors. The survivor bump is a quarter-step
 * (a tier between priorities), so a remembered minor beats an equal rival
 * but never outranks a real major. Within a tier, candidates are taken
 * sorted by center (greedy), which thins competing minors toward an even
 * visual distribution. A candidate is kept iff its gap-padded interval
 * overlaps no already-kept interval.
 */
export function thinLabels(
  boxes: readonly LabelBox[],
  opts?: { gapPx?: number; previousKeys?: ReadonlySet<string> },
): boolean[] {
  const gap = opts?.gapPx ?? 10;
  const previous = opts?.previousKeys;

  const candidates: Candidate[] = [];
  boxes.forEach((box, index) => {
    const priority = box.priority ?? 0;
    const survivor = box.key !== undefined && previous?.has(box.key) === true;
    // Tiers [2, 1+survivor, 1, 0+survivor, 0] → 0..4; lower places first.
    const tier = priority === 2 ? 0 : priority === 1 ? (survivor ? 1 : 2) : survivor ? 3 : 4;
    candidates.push({
      index,
      tier,
      center: box.center,
      start: box.center - box.size / 2 - gap / 2,
      end: box.center + box.size / 2 + gap / 2,
    });
  });
  // Explicit index tie-break so equal centers resolve deterministically.
  candidates.sort((a, b) => a.tier - b.tier || a.center - b.center || a.index - b.index);

  const keep = new Array<boolean>(boxes.length).fill(false);
  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    // Strict inequality: intervals that merely touch are exactly `gap` apart — allowed.
    const collides = kept.some((k) => candidate.start < k.end && k.start < candidate.end);
    if (candidate.tier === 0 || !collides) {
      keep[candidate.index] = true;
      kept.push(candidate);
    }
  }
  return keep;
}

/**
 * Fit `text` into `maxPx`: unchanged when it already fits, otherwise the
 * longest prefix + "…" that fits, otherwise "" when even one glyph plus the
 * ellipsis is too wide. Assumes `measure` grows with prefix length (binary
 * search).
 */
export function ellipsize(text: string, maxPx: number, measure: (t: string) => number): string {
  if (measure(text) <= maxPx) return text;
  let lo = 0;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(text.slice(0, mid) + ELLIPSIS) <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "" : text.slice(0, lo) + ELLIPSIS;
}

export interface FittedBandTick {
  /** Text to render — possibly ellipsized. */
  label: string;
  /** Full text, present only when `label` was truncated. */
  title?: string;
  /** Center of the tick as a 0..1 fraction of the axis (the input fraction). */
  position: number;
}

/**
 * Fit categorical band labels into `stepPx`-wide bands on an axis of
 * `axisLengthPx`. Ladder:
 *
 * 1. every label fits its band → keep all, full text;
 * 2. ellipsizing each to the band still shows at least `minCh` CONTENT
 *    characters before the ellipsis (a 2-character stub reads as noise)
 *    (ellipsis included; a label that fits untouched passes regardless) →
 *    keep all, `title` carries the full text on the truncated ones;
 * 3. thin to the smallest stride `k` whose widened budget (`k` bands minus
 *    the gap) shows either the whole widest label or `minCh` of it, always
 *    keeping first and last — when the last collides with the nearest stride
 *    survivor, that survivor is dropped (never the first).
 */
export function fitBandTicks(
  labels: readonly string[],
  centersFraction: readonly number[],
  stepPx: number,
  axisLengthPx: number,
  measure: (t: string) => number,
  opts?: { gapPx?: number; minCh?: number },
): FittedBandTick[] {
  const gap = opts?.gapPx ?? 8;
  const minCh = opts?.minCh ?? 3;

  const entries: { label: string; fraction: number }[] = [];
  labels.forEach((label, i) => {
    const fraction = centersFraction[i];
    if (fraction !== undefined) entries.push({ label, fraction });
  });
  const first = entries[0];
  if (first === undefined) return [];

  const budget = stepPx - gap;

  if (entries.every((e) => measure(e.label) <= budget)) {
    return entries.map((e) => ({ label: e.label, position: e.fraction }));
  }

  const shortened = entries.map((e) => ellipsize(e.label, budget, measure));
  if (shortened.every((s, i) => s === entries[i]?.label || s.length - 1 >= minCh)) {
    return entries.map((e, i) => {
      const label = shortened[i] ?? e.label;
      return label === e.label
        ? { label, position: e.fraction }
        : { label, title: e.label, position: e.fraction };
    });
  }

  let widest = first.label;
  let widestPx = measure(widest);
  for (const e of entries) {
    const px = measure(e.label);
    if (px > widestPx) {
      widest = e.label;
      widestPx = px;
    }
  }
  // Smallest width that satisfies rung 2 for the widest label: either the
  // whole label, or a minCh-character ellipsized form of it.
  const minChPx = measure(widest.slice(0, Math.max(0, minCh)) + ELLIPSIS);
  const requiredPx = Math.min(widestPx, minChPx);
  const stride =
    stepPx > 0 ? Math.max(2, Math.ceil((requiredPx + gap) / stepPx)) : Math.max(2, entries.length);

  const n = entries.length;
  const survivors: number[] = [];
  for (let i = 0; i < n; i += stride) survivors.push(i);
  const nearest = survivors[survivors.length - 1] ?? 0;
  if (nearest !== n - 1) {
    const lastEntry = entries[n - 1];
    const nearestEntry = entries[nearest];
    if (lastEntry !== undefined && nearestEntry !== undefined && nearest !== 0) {
      const distancePx = Math.abs(lastEntry.fraction - nearestEntry.fraction) * axisLengthPx;
      if (distancePx < stride * stepPx) survivors.pop();
    }
    survivors.push(n - 1);
  }

  const wideBudget = stride * stepPx - gap;
  const out: FittedBandTick[] = [];
  for (const i of survivors) {
    const e = entries[i];
    if (e === undefined) continue;
    const label = ellipsize(e.label, wideBudget, measure);
    out.push(
      label === e.label
        ? { label, position: e.fraction }
        : { label, title: e.label, position: e.fraction },
    );
  }
  return out;
}

/**
 * Widest measured label + `padPx`, rounded up to the next `quantPx` step so
 * a value-axis gutter doesn't re-layout on every small label change. Empty
 * input → 0.
 */
export function maxLabelWidth(
  labels: readonly string[],
  measure: (t: string) => number,
  opts?: { padPx?: number; quantPx?: number },
): number {
  if (labels.length === 0) return 0;
  const pad = opts?.padPx ?? 4;
  const quant = opts?.quantPx ?? 8;
  let max = 0;
  for (const label of labels) max = Math.max(max, measure(label));
  return Math.ceil((max + pad) / quant) * quant;
}
