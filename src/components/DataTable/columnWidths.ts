/** Column-width plumbing for resizable DataTable columns.
 *
 * Each track is `minmax(minWidth, preferred)`, so when the columns' preferred
 * widths don't fit the container they shrink toward their minimums (no scroll);
 * only when even the minimums don't fit does the table scroll horizontally. The
 * last column's preferred is `1fr`, so when there's slack it fills the container.
 *   - `preferred` = a runtime px override, the column def's `width`, or a default.
 *   - `minWidth` = the column def's `minWidth` or the global `COLUMN_MIN_UNITS`.
 *   - Dragging a trailing edge sets preferred widths via `resizeBoundary`
 *     (cascading through the columns to the right, keeping the total constant);
 *     the minmax shrink is what handles a container narrower than those widths.
 */

/** Minimum a column may be dragged to, as a `--sf-unit` multiple. Mirrors the
 *  `--sf-datatable-col-min` CSS fallback so JS clamping and CSS agree. */
export const COLUMN_MIN_UNITS = 3;

/** Width for columns that don't declare one, in `--sf-unit` multiples. */
const DEFAULT_COL_UNITS = 8;

export interface TemplateLeaf {
  id: string;
  /** Preferred width in `--sf-unit` multiples, from the column def. */
  width?: number;
  /** Lower bound in `--sf-unit` multiples; defaults to `COLUMN_MIN_UNITS`. */
  minWidth?: number;
}

/** Build the `grid-template-columns` string shared by the header and every body
 *  row. Every track is `minmax(min, preferred)`; the last column's preferred is
 *  `1fr` so it fills any slack. */
export function buildColumnTemplate(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
): string {
  const lastIdx = leaves.length - 1;
  return leaves
    .map((col, i) => {
      const min = `calc(var(--sf-unit) * ${col.minWidth ?? COLUMN_MIN_UNITS})`;
      if (i === lastIdx) return `minmax(${min}, 1fr)`;
      const override = overrides[col.id];
      const preferred =
        override != null
          ? `${override}px`
          : col.width != null
            ? `calc(var(--sf-unit) * ${col.width})`
            : `calc(var(--sf-unit) * ${DEFAULT_COL_UNITS})`;
      return `minmax(${min}, ${preferred})`;
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
