/** The geometry of a pie: cleaning and ordering the parts, the angle each one
 *  spans, the path of its arc, and where its label can sit without colliding.
 *  Pure functions in px and radians, shared by the component and its tests.
 *
 *  Angles run clockwise from 12 o'clock, which is how a pie is read, so a
 *  slice's mid-angle maps to the screen as `(sin a, -cos a)`. */

/** One part of the whole, as the consumer supplies it. */
export interface PieSlice {
  name: string;
  /** Must be positive; zero, negative and non-finite parts are dropped. */
  value: number;
  /** CSS colour. Default: a step of the neutral ink ramp (or of the dither
   *  densities under `fill="dither"`). */
  color?: string;
}

/** A part after cleaning, ordering and any grouping of the tail. */
export interface PreparedSlice {
  name: string;
  value: number;
  /** Fraction of the total (0..1). */
  share: number;
  color?: string;
  /** Position in the drawn order. */
  index: number;
  /** The part stands for several grouped parts (the `maxSlices` remainder). */
  aggregated: boolean;
  /** How many supplied parts it stands for. `1` for an ordinary slice. */
  count: number;
}

/** A slice's angular extent, clockwise from 12 o'clock, in radians. */
export interface SliceAngles {
  start: number;
  end: number;
  /** Halfway between the two, where the label and the tooltip anchor sit. */
  mid: number;
}

export type PieSort = "value" | "none";

const TAU = Math.PI * 2;
/** A sweep this close to a full turn is drawn as a circle: a 360° arc has the
 *  same start and end point, which draws nothing at all. */
const FULL_TURN_EPSILON = 1e-6;

/** A part that is not a finite positive number carries no share of a whole. */
function cleanValue(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Clean, order and (when `maxSlices` is given) group the parts.
 *
 * Ordering is by value descending by default, which is how a pie is meant to be
 * read: the eye compares each slice with the one before it, starting from the
 * biggest at 12 o'clock. `sort: "none"` keeps the supplied order for data that
 * carries its own (a funnel's stages, a fixed set of categories).
 *
 * `maxSlices` keeps the first `maxSlices - 1` parts of that order and groups
 * everything after them into one part named `otherLabel`, which reports how
 * many it stands for. This is the lever against an unreadable twenty-slice pie.
 */
export function preparePie(
  data: readonly PieSlice[],
  opts: { sort?: PieSort; maxSlices?: number; otherLabel?: string } = {},
): { slices: PreparedSlice[]; total: number } {
  const { sort = "value", maxSlices, otherLabel = "Other" } = opts;

  const cleaned = data
    .map((d, i) => ({ ...d, value: cleanValue(d.value), sourceIndex: i }))
    .filter((d) => d.value > 0);
  if (sort === "value") {
    // Stable on ties: equal parts keep the order they were supplied in.
    cleaned.sort((a, b) => b.value - a.value || a.sourceIndex - b.sourceIndex);
  }

  let total = 0;
  for (const d of cleaned) total += d.value;
  if (total <= 0) return { slices: [], total: 0 };

  const cap = maxSlices != null && maxSlices >= 1 ? Math.floor(maxSlices) : null;
  const grouping = cap != null && cleaned.length > cap;
  const head = grouping ? cleaned.slice(0, cap - 1) : cleaned;
  const tail = grouping ? cleaned.slice(cap - 1) : [];

  const slices: PreparedSlice[] = head.map((d, index) => ({
    name: d.name,
    value: d.value,
    share: d.value / total,
    ...(d.color != null ? { color: d.color } : {}),
    index,
    aggregated: false,
    count: 1,
  }));

  if (tail.length > 0) {
    let value = 0;
    for (const d of tail) value += d.value;
    slices.push({
      name: otherLabel,
      value,
      share: value / total,
      index: slices.length,
      aggregated: true,
      count: tail.length,
    });
  }

  return { slices, total };
}

/** Each slice's angular extent, laid end to end from `startAngle` (degrees
 *  clockwise from 12 o'clock). The last slice closes on the first, so rounding
 *  can never leave a wedge of background showing. */
export function sliceAngles(
  slices: readonly { share: number }[],
  startAngleDeg = 0,
): SliceAngles[] {
  const start0 = (startAngleDeg * Math.PI) / 180;
  const out: SliceAngles[] = [];
  let cursor = start0;
  slices.forEach((s, i) => {
    const last = i === slices.length - 1;
    const end = last ? start0 + TAU : cursor + s.share * TAU;
    out.push({ start: cursor, end, mid: (cursor + end) / 2 });
    cursor = end;
  });
  return out;
}

/** A point on the circle of radius `r` about (`cx`, `cy`) at angle `a`,
 *  clockwise from 12 o'clock. */
export function polar(cx: number, cy: number, r: number, a: number): { x: number; y: number } {
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

/** Two decimals keeps a path short and byte-stable between renders, which is
 *  what lets a re-render reconcile the attribute instead of repainting. */
function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/**
 * The `d` of one slice: a wedge when `rInner` is zero, a ring segment when it
 * is not. A slice that spans the whole turn is drawn as a pair of half arcs
 * (and, for a ring, an inner circle wound the other way, so the non-zero fill
 * rule leaves the hole open).
 */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number,
): string {
  const ro = Math.max(0, rOuter);
  const ri = Math.max(0, Math.min(rInner, ro));
  if (ro <= 0) return "";

  const sweep = a1 - a0;
  if (sweep >= TAU - FULL_TURN_EPSILON) {
    const top = polar(cx, cy, ro, a0);
    const bottom = polar(cx, cy, ro, a0 + Math.PI);
    const outer =
      `M ${n(top.x)} ${n(top.y)}` +
      ` A ${n(ro)} ${n(ro)} 0 1 1 ${n(bottom.x)} ${n(bottom.y)}` +
      ` A ${n(ro)} ${n(ro)} 0 1 1 ${n(top.x)} ${n(top.y)} Z`;
    if (ri <= 0) return outer;
    const iTop = polar(cx, cy, ri, a0);
    const iBottom = polar(cx, cy, ri, a0 + Math.PI);
    return (
      `${outer} M ${n(iTop.x)} ${n(iTop.y)}` +
      ` A ${n(ri)} ${n(ri)} 0 1 0 ${n(iBottom.x)} ${n(iBottom.y)}` +
      ` A ${n(ri)} ${n(ri)} 0 1 0 ${n(iTop.x)} ${n(iTop.y)} Z`
    );
  }

  const largeArc = sweep > Math.PI ? 1 : 0;
  const o0 = polar(cx, cy, ro, a0);
  const o1 = polar(cx, cy, ro, a1);
  if (ri <= 0) {
    return (
      `M ${n(cx)} ${n(cy)} L ${n(o0.x)} ${n(o0.y)}` +
      ` A ${n(ro)} ${n(ro)} 0 ${largeArc} 1 ${n(o1.x)} ${n(o1.y)} Z`
    );
  }
  const i0 = polar(cx, cy, ri, a0);
  const i1 = polar(cx, cy, ri, a1);
  return (
    `M ${n(o0.x)} ${n(o0.y)}` +
    ` A ${n(ro)} ${n(ro)} 0 ${largeArc} 1 ${n(o1.x)} ${n(o1.y)}` +
    ` L ${n(i1.x)} ${n(i1.y)}` +
    ` A ${n(ri)} ${n(ri)} 0 ${largeArc} 0 ${n(i0.x)} ${n(i0.y)} Z`
  );
}

/** Where a slice's tooltip, pinned popover and printed figure anchor: the
 *  middle of its band of ink, on its mid-angle. */
export function sliceCentroid(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  mid: number,
): { x: number; y: number } {
  return polar(cx, cy, (Math.max(0, rInner) + rOuter) / 2, mid);
}

/** One slice's label, placed outside the ring. */
export interface PlacedLabel {
  /** Index into the prepared slices. */
  index: number;
  /** Where the text sits. */
  x: number;
  y: number;
  anchor: "start" | "end";
  /** The name, ellipsized to the room it has. */
  name: string;
  /** Full name, present only when `name` was truncated. */
  title?: string;
  /** The figure printed after the name, empty when none was asked for. */
  value: string;
  /** The hairline from the arc out to the text. */
  leader: { x1: number; y1: number; x2: number; y2: number };
}

export interface PlaceLabelsOptions {
  cx: number;
  cy: number;
  /** Outer radius of the ring the labels sit outside of. */
  radius: number;
  /** Plot box the labels must stay inside. */
  width: number;
  height: number;
  /** Length of the radial hairline out of the arc. */
  leaderPx: number;
  /** Gap between the hairline and the text. */
  gapPx: number;
  /** A text line's height, the vertical room one label claims. */
  lineHeight: number;
  /** Width of the name, in the sans face. */
  measureName: (text: string) => number;
  /** Width of the figure, in the mono face. */
  measureValue: (text: string) => number;
  ellipsize: (text: string, maxPx: number, measure: (t: string) => number) => string;
  /** The figure to print after each name, parallel to the slices. Empty
   *  strings print nothing. */
  values?: readonly string[];
}

/**
 * Place the labels outside the ring, on each slice's mid-angle.
 *
 * Big slices are placed first, so when two labels would overlap it is the
 * smaller slice that loses its label (the reader can still reach it by hover,
 * and the tooltip carries the full name). A label is ellipsized to the room
 * between its leader and the edge of the plot, and dropped when even an
 * ellipsis will not fit or when the line would fall outside the plot: fewer
 * legible labels beat many mangled ones.
 *
 * Returned in slice order, so the rendered DOM order is stable.
 */
export function placeSliceLabels(
  slices: readonly PreparedSlice[],
  angles: readonly SliceAngles[],
  opts: PlaceLabelsOptions,
): PlacedLabel[] {
  const { cx, cy, radius, width, height, leaderPx, gapPx, lineHeight } = opts;
  const { measureName, measureValue, ellipsize, values } = opts;
  if (radius <= 0 || width <= 0 || height <= 0) return [];

  const order = slices
    .map((s, i) => ({ slice: s, i }))
    .sort((a, b) => b.slice.value - a.slice.value || a.i - b.i);

  // Taken vertical bands, per side: a label may not overlap one already placed
  // on its own side. The two sides are independent — they never share an x.
  const taken: { start: number; end: number }[][] = [[], []];
  const out: PlacedLabel[] = [];

  for (const { slice, i } of order) {
    const a = angles[i];
    if (!a) continue;
    const onRight = Math.sin(a.mid) >= 0;
    const side = onRight ? 0 : 1;

    const arc = polar(cx, cy, radius, a.mid);
    const tip = polar(cx, cy, radius + leaderPx, a.mid);
    const x = tip.x + (onRight ? gapPx : -gapPx);
    const y = tip.y;

    const top = y - lineHeight / 2;
    const bottom = y + lineHeight / 2;
    if (top < 0 || bottom > height) continue;
    if (taken[side]?.some((t) => top < t.end && t.start < bottom)) continue;

    const room = (onRight ? width - x : x) - 1;
    const value = values?.[i] ?? "";
    const valueWidth = value ? measureValue(value) + gapPx : 0;
    const nameRoom = room - valueWidth;
    if (nameRoom <= 0) continue;
    const name = ellipsize(slice.name, nameRoom, measureName);
    if (!name) continue;

    taken[side]?.push({ start: top, end: bottom });
    out.push({
      index: i,
      x,
      y,
      anchor: onRight ? "start" : "end",
      name,
      ...(name !== slice.name ? { title: slice.name } : {}),
      value,
      leader: { x1: arc.x, y1: arc.y, x2: tip.x, y2: tip.y },
    });
  }

  out.sort((a, b) => a.index - b.index);
  return out;
}

/**
 * The radius the pie can take in a `width` x `height` box once the labels have
 * their column. `reserveX` is the measured label width on each side and
 * `reserveY` the room one line of label needs above and below; both drop to
 * zero when nothing is printed.
 */
export function pieRadius(
  width: number,
  height: number,
  reserveX: number,
  reserveY: number,
): number {
  const usableWidth = width - 2 * Math.max(0, reserveX);
  const usableHeight = height - 2 * Math.max(0, reserveY);
  return Math.max(0, Math.min(usableWidth, usableHeight) / 2);
}

/** The percent ring's ticks: one every `stepPercent`, longer at each quarter,
 *  measured from the pie's own start angle so a tick means the same share of
 *  the whole wherever the pie begins. */
export function ringTicks(startAngleDeg = 0, stepPercent = 5): { angle: number; major: boolean }[] {
  const step = Math.max(1, stepPercent);
  const start = (startAngleDeg * Math.PI) / 180;
  const out: { angle: number; major: boolean }[] = [];
  for (let pct = 0; pct < 100; pct += step) {
    out.push({ angle: start + (pct / 100) * TAU, major: pct % 25 === 0 });
  }
  return out;
}
