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
 *
 * Unit-agnostic (operates on measured px), so it's shared by DataTable (whose
 * declared widths are `--sf-unit` multiples) and Explorer (raw px) alike.
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
