/** The pure geometry of a bullet graph (Stephen Few's design specification):
 *  a measure bar over qualitative tiers, a target tick, optional comparative
 *  ticks, on one linear scale per row or one shared by the panel. */

import { niceDomain } from "../../lib/chart";

export type BulletTone = "neutral" | "primary" | "success" | "warning" | "danger";

export interface BulletItem {
  /** The row's name, printed beside it in full-strength fg. */
  label: string;
  /** A unit or period printed after the label (`"CHF k"`, `"Q3"`). */
  sublabel?: string;
  /** The featured measure, the bar. */
  value: number;
  /** The target, a short perpendicular tick. */
  target?: number;
  /** Ascending upper bounds of the qualitative tiers, 2 to 5 of them. The first
   *  tier runs from the scale's start to `ranges[0]`; a last bound below the
   *  scale's end leaves a final tier up to it. */
  ranges?: number[];
  /** Extra comparison ticks (last period, plan), thinner than the target. */
  comparative?: number[];
  /** The row's own scale; ignored under a shared `domain`. Auto-fit from the
   *  row's numbers (zero-anchored) when omitted. */
  domain?: [number, number];
  /** The measure bar's colour for this row; wins over the chart `tone`. */
  tone?: BulletTone;
  /** Which way is good. `"up"` (default): the low tiers are the poor ones and
   *  carry the most ink. `"down"` (churn, latency): the shading reverses. */
  goodDirection?: "up" | "down";
}

export const MAX_TIERS = 5;

/** A qualitative tier as a segment of the row's scale. `rank` is 0 for the
 *  poorest tier (the most ink) regardless of which end it sits at. */
export interface Tier {
  index: number;
  rank: number;
  from: number;
  to: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The numbers a row's auto scale must contain. */
function rowValues(item: BulletItem): number[] {
  return [
    item.value,
    ...(item.target != null ? [item.target] : []),
    ...(item.ranges ?? []),
    ...(item.comparative ?? []),
  ].filter((v) => Number.isFinite(v));
}

/** The scale a row is drawn on: the shared domain when the panel has one, else
 *  the row's own, else a nice zero-anchored fit of its numbers. */
export function resolveDomain(item: BulletItem, shared?: [number, number]): [number, number] {
  if (shared) return shared;
  if (item.domain) return item.domain;
  const values = rowValues(item);
  if (values.length === 0) return [0, 1];
  const [d0, d1] = niceDomain(values);
  return d1 > d0 ? [d0, d1] : [d0, d0 + 1];
}

/** A nice domain over every row's numbers, for a shared axis. */
export function unionDomain(items: readonly BulletItem[]): [number, number] {
  const values = items.flatMap(rowValues);
  if (values.length === 0) return [0, 1];
  const [d0, d1] = niceDomain(values);
  return d1 > d0 ? [d0, d1] : [d0, d0 + 1];
}

/** Cut the row's scale into tiers at the range bounds (clamped into the
 *  domain, ascending, at most MAX_TIERS). Empty bounds give no tiers. */
export function tierSegments(
  ranges: readonly number[] | undefined,
  domain: [number, number],
  goodDirection: "up" | "down" = "up",
): Tier[] {
  const [d0, d1] = domain;
  if (!ranges || ranges.length === 0 || !(d1 > d0)) return [];
  const bounds = ranges
    .filter((r) => Number.isFinite(r))
    .slice(0, MAX_TIERS)
    .map((r) => clamp(r, d0, d1))
    .sort((a, b) => a - b);
  const out: Tier[] = [];
  let from = d0;
  for (const b of bounds) {
    if (b > from) out.push({ index: out.length, rank: 0, from, to: b });
    from = Math.max(from, b);
  }
  if (from < d1) out.push({ index: out.length, rank: 0, from, to: d1 });
  const n = out.length;
  for (const t of out) t.rank = goodDirection === "up" ? t.index : n - 1 - t.index;
  return out;
}

/** Which tier a value falls in: 0 for the first, up to the count of tiers. */
export function tierIndexOf(value: number, tiers: readonly Tier[]): number | null {
  if (tiers.length === 0) return null;
  for (const t of tiers) if (value <= t.to) return t.index;
  return tiers[tiers.length - 1]?.index ?? null;
}

/** Ink density of a tier by rank: the poorest tier is the densest. Five steps
 *  cover MAX_TIERS; the lightest is plain. */
export const TIER_DENSITY = [0.5, 0.25, 0.125, 0.0625, 0] as const;

export function tierDensity(rank: number): number {
  return TIER_DENSITY[clamp(rank, 0, TIER_DENSITY.length - 1)] ?? 0;
}

/** The measure bar's extent: from the baseline (zero when the scale crosses
 *  it, else the scale's start) to the value, ordered and clamped. */
export function measureExtent(value: number, domain: [number, number]): [number, number] {
  const [d0, d1] = domain;
  const base = d0 <= 0 && d1 >= 0 ? 0 : d0;
  const v = clamp(value, d0, d1);
  return v >= base ? [base, v] : [v, base];
}

/** Linear position of `value` along a scale of `length` px. Not clamped, so a
 *  caller can tell an off-scale value apart; clamp for drawing. */
export function scalePosition(value: number, domain: [number, number], length: number): number {
  const [d0, d1] = domain;
  if (!(d1 > d0) || !(length > 0)) return 0;
  return ((value - d0) / (d1 - d0)) * length;
}

/** The difference of the value to its target, absolute and as a percentage of
 *  the target (null when the target is zero or missing). */
export function targetDelta(
  value: number,
  target: number | undefined,
): { abs: number; pct: number | null } | null {
  if (target == null || !Number.isFinite(target)) return null;
  const abs = value - target;
  return { abs, pct: target !== 0 ? (abs / Math.abs(target)) * 100 : null };
}

/** Row geometry along the cross axis: each row is `step` tall, the tier band
 *  half of it, the measure a third of the band (Few's proportions). */
export function rowGeometry(
  length: number,
  count: number,
): {
  step: number;
  band: number;
  measure: number;
} {
  const step = count > 0 ? length / count : length;
  const band = Math.max(4, step / 2);
  const measure = Math.max(2, band / 3);
  return { step, band, measure };
}
