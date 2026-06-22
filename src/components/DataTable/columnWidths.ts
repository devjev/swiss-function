/** Column-width plumbing for resizable DataTable columns.
 *
 * The table always spans its container at full width and never changes total
 * width when columns are resized:
 *   - Every column except the last has a definite width (a runtime px override,
 *     the column def's `width` in `--sf-unit` multiples, or a default).
 *   - The last column is a `1fr` filler that soaks up the remaining width, so
 *     the columns always add up to the container exactly (no gap, no scroll).
 *   - Dragging a column's trailing edge grows/shrinks it and cascades the
 *     opposite change through the columns to its right (see `resizeBoundary`),
 *     keeping the total constant.
 */

/** Minimum a column may be dragged to, as a `--sf-unit` multiple. Mirrors the
 *  `--sf-datatable-col-min` CSS fallback so JS clamping and CSS agree. */
export const COLUMN_MIN_UNITS = 3;

/** Width for columns that don't declare one, in `--sf-unit` multiples. */
const DEFAULT_COL_UNITS = 8;

export interface TemplateLeaf {
  id: string;
  /** Static width in `--sf-unit` multiples, from the column def. */
  width?: number;
}

/** Build the `grid-template-columns` string shared by the header and every
 *  body row. The last track is `1fr` so the table fills its container; all
 *  others take their override / declared / default width. */
export function buildColumnTemplate(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
): string {
  const lastIdx = leaves.length - 1;
  return leaves
    .map((col, i) => {
      if (i === lastIdx) {
        return `minmax(calc(var(--sf-unit) * ${COLUMN_MIN_UNITS}), 1fr)`;
      }
      const override = overrides[col.id];
      if (override != null) return `${override}px`;
      if (col.width != null) return `calc(var(--sf-unit) * ${col.width})`;
      return `calc(var(--sf-unit) * ${DEFAULT_COL_UNITS})`;
    })
    .join(" ");
}

/**
 * Move the trailing edge of column `idx` by `dx` px while keeping the total
 * width constant, and return the new width of every column.
 *
 * Growing `idx` shrinks the columns to its right, nearest first; when one
 * reaches `min` (or is locked) the change cascades to the next; when none can
 * give more, `idx` stops growing. Shrinking `idx` (down to its own `min`) hands
 * the freed space to the nearest resizable column on its right. The last column
 * is the flexible filler and always participates.
 *
 * Pure and total-preserving (the returned widths sum to the input widths), so
 * the caller can apply every non-last result as a px override and leave the
 * last column as its `1fr` filler.
 */
export function resizeBoundary(
  widths: number[],
  resizable: boolean[],
  idx: number,
  dx: number,
  min: number,
): number[] {
  const out = widths.slice();
  const lastIdx = out.length - 1;
  if (idx < 0 || idx >= lastIdx) return out; // last column has no trailing handle

  if (dx > 0) {
    // Grow idx; cascade the shrink rightward, nearest first.
    let remaining = dx;
    for (let k = idx + 1; k <= lastIdx && remaining > 0; k++) {
      const canShrink = k === lastIdx || resizable[k] === true;
      if (!canShrink) continue;
      const take = Math.min(remaining, (out[k] as number) - min);
      out[k] = (out[k] as number) - take;
      remaining -= take;
    }
    out[idx] = (out[idx] as number) + (dx - remaining); // grew only by what the right absorbed
  } else if (dx < 0) {
    // Shrink idx down to its min; hand the space to the nearest resizable
    // column on the right (or the last filler).
    const give = Math.min(-dx, (out[idx] as number) - min);
    out[idx] = (out[idx] as number) - give;
    let k = idx + 1;
    while (k < lastIdx && resizable[k] !== true) k++;
    out[k] = (out[k] as number) + give;
  }
  return out;
}
