import { holdMin, isHoldableLength } from "../../lib/columns/columnHold";
import { combineFloor } from "../../lib/columns/headerFloor";

/** Lower bound a column may be dragged to when `resizableColumns` is on (px). */
export const MIN_COL_PX = 48;
/** Preferred width for a column that declares no `width`: its width as a
 *  resizable column, and what a stretching one holds at (`columnShrink`). */
export const DEFAULT_COL_PX = 120;
/** What a stretching first column with no `width` holds at: the tree column
 *  carries the indentation, the glyphs and the name, and 120px cuts a name
 *  two levels down. */
export const TREE_HOLD_PX = 200;

/** What the template reads off a column. */
export interface TemplateColumn {
  id: string;
  width?: number | string;
  minWidth?: number;
}

/** Build the `grid-template-columns` string shared by the header and every row.
 *  Without resizing it keeps Explorer's original semantics (number→px, string
 *  as-is, undefined→`1fr`). With resizing on it mirrors DataTable: every track
 *  is `minmax(min, preferred)` and the last stretches until the columns are
 *  fixed (`fixed`: every column carries a px override, the spreadsheet state
 *  after the first resize), or in fill mode (`columnFill`), where the last
 *  track keeps a fixed preferred width too, so the dither panel has slack to
 *  paint into instead of being crushed by a stretched last column.
 *
 *  A shrinkable track's minimum is its floor, raised to its preferred width
 *  where the columns hold (`holdMin`: the product is zero where they squeeze,
 *  so the squeeze layout is unchanged). A stretching column with no width
 *  holds at the default one, the first (the tree column) at `TREE_HOLD_PX`. A width written as a flexible or keyword track
 *  size (`1fr`, `auto`) has no length to hold and keeps its floor. */
export function buildGridTemplate(
  columns: readonly TemplateColumn[],
  overrides: Record<string, number>,
  resizable: boolean,
  fill: boolean,
  fixed: boolean,
  floors: Record<string, number>,
): string {
  if (!resizable) {
    // The measured header floor (issue #102) still holds without resizing: a
    // fixed width is raised to it, and a stretching column never squeezes
    // under it, so a container squeeze scrolls instead of clipping a title.
    return columns
      .map((c, i) => {
        const floor = floors[c.id];
        const ov = overrides[c.id];
        const fixedPx = ov != null ? ov : typeof c.width === "number" ? c.width : undefined;
        if (fixedPx != null)
          return floor != null ? `${Math.max(fixedPx, floor)}px` : `${fixedPx}px`;
        if (typeof c.width === "string") return c.width;
        const hold = i === 0 ? TREE_HOLD_PX : DEFAULT_COL_PX;
        return `minmax(${holdMin([`${floor ?? 0}px`], `${hold}px`)}, 1fr)`;
      })
      .join(" ");
  }
  const lastIdx = columns.length - 1;
  return columns
    .map((c, i) => {
      const floor = `${combineFloor(c.minWidth ?? MIN_COL_PX, floors[c.id])}px`;
      const ov = overrides[c.id];
      const preferred =
        ov != null
          ? `${ov}px`
          : typeof c.width === "number"
            ? `${c.width}px`
            : (c.width ?? `${DEFAULT_COL_PX}px`);
      const min = isHoldableLength(preferred) ? holdMin([floor], preferred) : floor;
      if (i === lastIdx && !fill && !fixed) return `minmax(${min}, 1fr)`;
      return `minmax(${min}, ${preferred})`;
    })
    .join(" ");
}
