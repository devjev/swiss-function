/** Stacking one category's bars. Pure functions in data space, shared by the
 *  component and its tests. */

/** One series' band inside a category's stack, in value space. */
export interface BarSegment {
  /** Lower edge of the band. */
  start: number;
  /** Upper edge. Equal to `start` for a part that carries nothing. */
  end: number;
  /** The value as supplied, which is what the tooltip and the label print
   *  even when the geometry is a share. */
  value: number;
  /** The part's share of its category (0..1), of the positive total. */
  share: number;
}

function clean(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Stack one category's values.
 *
 * In value units, parts stack away from zero in both directions: positives
 * pile up from the baseline and negatives hang down from it, which is the only
 * honest way to draw a stack that contains both (piling them in one run would
 * make a bar shorter than one of its own parts).
 *
 * Normalized, the stack runs 0..1 and each part takes its share. A share of a
 * total is undefined once a part is negative, so a negative counts as nothing
 * there; its value still travels with the segment, for the tooltip to print.
 */
export function stackCategory(
  values: readonly (number | undefined)[],
  normalize: boolean,
): BarSegment[] {
  const cleaned = values.map(clean);
  let positive = 0;
  for (const v of cleaned) if (v > 0) positive += v;

  if (normalize) {
    let cursor = 0;
    return cleaned.map((v) => {
      const share = positive > 0 && v > 0 ? v / positive : 0;
      const segment = { start: cursor, end: cursor + share, value: v, share };
      cursor += share;
      return segment;
    });
  }

  let up = 0;
  let down = 0;
  return cleaned.map((v) => {
    const share = positive > 0 && v > 0 ? v / positive : 0;
    if (v >= 0) {
      const segment = { start: up, end: up + v, value: v, share };
      up += v;
      return segment;
    }
    const segment = { start: down + v, end: down, value: v, share };
    down += v;
    return segment;
  });
}

/** Every category's stack, parallel to `categories`. */
export function stackAll(
  series: readonly { values: readonly (number | undefined)[] }[],
  categoryCount: number,
  normalize: boolean,
): BarSegment[][] {
  const out: BarSegment[][] = [];
  for (let ci = 0; ci < categoryCount; ci++) {
    out.push(
      stackCategory(
        series.map((s) => s.values[ci]),
        normalize,
      ),
    );
  }
  return out;
}

/** The value range the stacks span: the lowest bottom and the highest top,
 *  always including zero so the baseline stays on the chart. */
export function stackExtent(stacks: readonly BarSegment[][]): [number, number] {
  let min = 0;
  let max = 0;
  for (const stack of stacks) {
    for (const segment of stack) {
      if (segment.start < min) min = segment.start;
      if (segment.end > max) max = segment.end;
    }
  }
  return [min, max];
}

/** A category's total in value units: the sum of its parts, negatives
 *  included, which is the figure printed above the bar. */
export function stackTotal(stack: readonly BarSegment[]): number {
  let total = 0;
  for (const segment of stack) total += segment.value;
  return total;
}
