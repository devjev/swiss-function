/** Visual cell-merge plumbing for the DataTable.
 *
 * The body is CSS Grid divs + virtualization, so true `grid-row`/`grid-column`
 * spanning is impossible. Instead we merge *visually*: every cell keeps its slot,
 * the cells a span covers render blank, and the internal seams (borders) between
 * cells of one region are erased so it reads as a single merged cell.
 *
 * `computeMergeMap` turns a per-cell span callback into three lookups keyed by
 * `"row:col"` (same shape as DataTable's `cellKey`):
 *   - `covered`        — cells that render blank (everything but a region's lead),
 *   - `suppressRight`  — cells whose right edge (vertical seam) is dropped,
 *   - `suppressBottom` — cells whose bottom edge (horizontal seam) is dropped.
 *
 * Each cell suppresses its *own* outgoing seams, so the borders stay correct even
 * when a region's lead is scrolled out of the virtual window (only the lead's
 * content is hidden then). Spans are clamped to the table bounds.
 */

export interface MergeMap {
  covered: Set<string>;
  suppressRight: Set<string>;
  suppressBottom: Set<string>;
}

export const spanKey = (r: number, c: number): string => `${r}:${c}`;

export function computeMergeMap(opts: {
  rowCount: number;
  colCount: number;
  /** Span at the lead cell `(r, c)`; `1`/`undefined` means no span. */
  getSpan: (r: number, c: number) => { rowSpan?: number; colSpan?: number } | undefined;
}): MergeMap {
  const { rowCount, colCount, getSpan } = opts;
  const covered = new Set<string>();
  const suppressRight = new Set<string>();
  const suppressBottom = new Set<string>();

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      // A cell already covered by another region can't itself be a lead.
      if (covered.has(spanKey(r, c))) continue;

      const span = getSpan(r, c);
      const rowSpan = Math.max(1, Math.min(span?.rowSpan ?? 1, rowCount - r));
      const colSpan = Math.max(1, Math.min(span?.colSpan ?? 1, colCount - c));
      if (rowSpan === 1 && colSpan === 1) continue;

      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          const key = spanKey(r + dr, c + dc);
          // Every cell but the lead is blanked.
          if (dr !== 0 || dc !== 0) covered.add(key);
          // Internal seams: suppress the right edge unless this is the region's
          // right-most column, and the bottom edge unless its bottom row.
          if (dc < colSpan - 1) suppressRight.add(key);
          if (dr < rowSpan - 1) suppressBottom.add(key);
        }
      }
    }
  }

  return { covered, suppressRight, suppressBottom };
}
