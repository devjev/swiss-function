/** The angular model of a rotary control. Angles are degrees, `0` at 12 o'clock,
 *  clockwise positive, so a knob's travel runs from `-sweep / 2` (7 o'clock at
 *  the default 270° sweep) to `+sweep / 2` (5 o'clock). Pure functions, shared
 *  by the component and its tests. */

/** The default travel in degrees: the classic 270°, leaving a 90° dead zone at
 *  the bottom where the stops are. */
export const DEFAULT_SWEEP = 270;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Decimal places a number is written with, to round float noise away. */
function decimalsOf(n: number): number {
  const s = String(n);
  const e = s.indexOf("e-");
  if (e >= 0) return Number(s.slice(e + 2)) + decimalsOf(Number(s.slice(0, e)));
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/** Snap `value` to the step grid anchored at `min` and clamp it to `[min, max]`.
 *  A step of `0` or less disables snapping. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clamp(value, min, max);
  const steps = Math.round((value - min) / step);
  const decimals = Math.min(12, Math.max(decimalsOf(step), decimalsOf(min)));
  return clamp(Number((min + steps * step).toFixed(decimals)), min, max);
}

/** The pointer angle for a value: linear over the sweep, `-sweep / 2` at `min`. */
export function valueToAngle(value: number, min: number, max: number, sweep: number): number {
  const span = max - min;
  if (!(span > 0)) return -sweep / 2;
  const t = clamp((value - min) / span, 0, 1);
  return -sweep / 2 + t * sweep;
}

/** Fold an angle in `[-180, 180]` into the sweep: inside it passes through,
 *  inside the dead zone it snaps to the nearer stop (the split is at the
 *  bottom, 180°), so a drag past a stop holds at that stop instead of jumping
 *  to the other end. */
export function clampToSweep(angle: number, sweep: number): number {
  const half = sweep / 2;
  if (Math.abs(angle) <= half) return angle;
  return angle > 0 ? half : -half;
}

/** The value for a pointer angle: folded into the sweep, then snapped. */
export function angleToValue(
  angle: number,
  min: number,
  max: number,
  sweep: number,
  step: number,
): number {
  const a = clampToSweep(angle, sweep);
  const t = sweep > 0 ? (a + sweep / 2) / sweep : 0;
  return snapToStep(min + t * (max - min), min, max, step);
}

/** The angle of a pointer offset from the dial centre (`dx` right, `dy` down):
 *  `0` straight up, `90` right, `±180` down, `-90` left. */
export function pointerAngle(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/** A point on the circle of radius `r` around `(cx, cy)` at `angle`. */
export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** An SVG path for the arc from `from` to `to` (degrees, clockwise) on the
 *  circle of radius `r`. Empty when the arc has no length; a full turn is drawn
 *  as two half arcs (a single arc of 360° collapses to nothing). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const delta = to - from;
  if (!(delta > 0) || !(r > 0)) return "";
  if (delta >= 360) {
    const top = polar(cx, cy, r, from);
    const bottom = polar(cx, cy, r, from + 180);
    return `M ${fmt(top.x)} ${fmt(top.y)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(bottom.x)} ${fmt(bottom.y)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(top.x)} ${fmt(top.y)}`;
  }
  const p0 = polar(cx, cy, r, from);
  const p1 = polar(cx, cy, r, to);
  const large = delta > 180 ? 1 : 0;
  return `M ${fmt(p0.x)} ${fmt(p0.y)} A ${fmt(r)} ${fmt(r)} 0 ${large} 1 ${fmt(p1.x)} ${fmt(p1.y)}`;
}
