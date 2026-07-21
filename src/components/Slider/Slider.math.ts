import type { ReactNode } from "react";

/** One mark on a tick, or an array of them, as accepted by `Slider`'s `marks`. */
export type SliderMarks = boolean | Array<number | { value: number; label?: ReactNode }>;

/** A mark resolved to a normalized track position. */
export interface SliderMark {
  /** The underlying value. */
  value: number;
  /** Position along the track, `0` at `min` to `1` at `max`. */
  position: number;
  /** Optional label rendered under (horizontal) / beside (vertical) the mark. */
  label?: ReactNode;
}

/**
 * Above this many auto-generated ticks (`marks={true}`), render none: a rail of
 * hundreds of hairlines is noise, not a scale. An explicit `marks` array is the
 * escape hatch and is never capped.
 */
export const AUTO_MARK_CAP = 40;

/**
 * Resolve the `marks` prop into normalized tick positions.
 *
 * - `false` / `undefined` → no ticks.
 * - `true` → one tick per `step` from `min` to `max`, but only when the count is
 *   within {@link AUTO_MARK_CAP} (otherwise none, with a dev warning).
 * - an array → explicit ticks (a number, or `{ value, label }`); out-of-range
 *   entries are dropped.
 *
 * Pure: it never mutates its input.
 */
export function resolveMarks(
  marks: SliderMarks | undefined,
  min: number,
  max: number,
  step: number,
): SliderMark[] {
  const span = max - min;
  if (!marks || span <= 0) return [];

  const at = (value: number, label?: ReactNode): SliderMark => ({
    value,
    label,
    position: Math.max(0, Math.min(1, (value - min) / span)),
  });

  if (marks === true) {
    const usableStep = step > 0 ? step : 1;
    const count = Math.floor(span / usableStep) + 1;
    if (count > AUTO_MARK_CAP) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `Slider: marks={true} would render ${count} ticks (> ${AUTO_MARK_CAP}); rendering none. Pass an explicit marks array to place ticks.`,
        );
      }
      return [];
    }
    const out: SliderMark[] = [];
    for (let i = 0; i < count; i++) out.push(at(min + i * usableStep));
    return out;
  }

  return marks
    .map((m) => (typeof m === "number" ? at(m) : at(m.value, m.label)))
    .filter((m) => m.value >= min && m.value <= max);
}
