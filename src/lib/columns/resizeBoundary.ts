/** Keyboard resize step for a focused column-resize handle, in px. Shared by
 *  DataTable and Explorer so the same gesture means the same thing in both:
 *  plain arrows nudge by the base step, Shift is the coarser step, and the
 *  Page keys jump by a whole run of units. */
export const KEY_RESIZE_STEP_PX = 8;
export const KEY_RESIZE_STEP_COARSE_PX = 24;
export const KEY_RESIZE_STEP_PAGE_PX = 96;

/** What a resize handle announces as `aria-valuemax`. A column has no upper
 *  bound, but the separator role defaults the maximum to 100 when it is
 *  absent, which would read a px `valuenow` against a percent scale, so a
 *  generous cap stands in (issue #102). */
export const COLUMN_MAX_PX = 4096;

/** How long the width readout stays after a keyboard step, and how long its
 *  fade takes, in ms. */
export const READOUT_HOLD_MS = 1200;
export const READOUT_FADE_MS = 400;

/** The width readout's text: the width in `--sf-unit` multiples (up to two
 *  decimals, trailing zeros dropped) and in px, and "min" at the floor. Falls
 *  back to px alone until the unit is measured. */
export function formatColumnWidth(
  px: number,
  unitPx: number | null,
  atFloor: boolean,
  atCap = false,
): string {
  const rounded = Math.round(px);
  const parts: string[] = [];
  if (unitPx != null && unitPx > 0) {
    const units = (rounded / unitPx).toFixed(2).replace(/\.?0+$/, "");
    parts.push(`${units}u`);
  }
  parts.push(`${rounded}px`);
  if (atFloor) parts.push("min");
  else if (atCap) parts.push("max");
  return parts.join(" · ");
}

/** The handle's `aria-valuetext`: the width in px, "minimum" at the floor. */
export function describeColumnWidth(px: number, atFloor: boolean): string {
  return atFloor ? `${Math.round(px)} px, minimum` : `${Math.round(px)} px`;
}
