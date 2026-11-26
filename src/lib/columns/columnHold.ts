/** Columns that hold their width (DataTable and Explorer).
 *
 *  A resting track is `minmax(min, preferred)`. Its minimum decides what
 *  happens when the columns do not fit the container: at the floor the
 *  columns squeeze toward it before the table scrolls, at the preferred
 *  width they keep their width and the table scrolls at once.
 *
 *  The choice is made in CSS, so the template string is the same for a mouse
 *  and a finger: the minimum is `max(floor, preferred * hold)`, where `hold`
 *  is a private custom property the component's root sets to 0 (squeeze) or
 *  1 (hold). With 0 the product is a zero length and the minimum computes to
 *  the floor, the squeeze layout exactly. The root takes the value from the
 *  `columnShrink` prop, and under `"auto"` from the `--sf-table-column-hold`
 *  token, which `tokens.css` sets to 1 on a coarse pointer. */

/** What columns do when they do not fit their container. */
export type ColumnShrink = "auto" | "squeeze" | "hold";

/** The private custom property a table root sets from `columnShrink`. */
export const COLUMN_HOLD_VAR = "--sf-column-hold";

/** The `data-column-shrink` value for a root: absent under `"auto"`, where
 *  the stylesheet reads the token. */
export function columnShrinkAttr(shrink: ColumnShrink): "squeeze" | "hold" | undefined {
  return shrink === "auto" ? undefined : shrink;
}

/** A track's minimum as a CSS length: the largest of its floors, and of its
 *  preferred width where the columns hold. `floors` are CSS lengths (the
 *  declared minimum, a measured header need); `preferred` must be a length
 *  or a percentage, since it is multiplied inside `calc()`. */
export function holdMin(floors: readonly string[], preferred: string): string {
  return `max(${[...floors, `calc(${preferred} * var(${COLUMN_HOLD_VAR}))`].join(", ")})`;
}

/** Whether a consumer-written track size can be multiplied in `calc()`: a
 *  plain length or percentage (`12rem`, `30%`) or a `calc()` of them. A
 *  flexible or keyword size (`1fr`, `auto`, `minmax(...)`) has no preferred
 *  width to hold. */
export function isHoldableLength(size: string): boolean {
  const value = size.trim();
  if (/^calc\(.*\)$/i.test(value)) return true;
  return /^\d*\.?\d+(?:[a-z]+|%)$/i.test(value) && !/fr$/i.test(value);
}
