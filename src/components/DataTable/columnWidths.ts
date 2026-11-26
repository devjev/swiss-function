import { holdMin } from "../../lib/columns/columnHold";

/** Column-width plumbing for resizable DataTable columns.
 *
 * At rest each track is `minmax(min, preferred)`. The last column's preferred
 * is `1fr`, so when there's slack it fills the container.
 *   - `preferred` = a runtime px override, the column def's `width`, or a default.
 *   - `minWidth` = the column def's `minWidth` or the global `COLUMN_MIN_UNITS`.
 *   - `min` = `max(minWidth, preferred * hold)`, where `hold` is the private
 *     custom property the table sets from `columnShrink` (see
 *     `lib/columns/columnHold`). At 0 the minimum is `minWidth`: when the
 *     preferred widths don't fit the container the columns shrink toward their
 *     minimums, and the table scrolls only when even those don't fit. At 1 the
 *     minimum is the preferred width: the columns keep it and the table
 *     scrolls as soon as they don't fit.
 *
 * A measured header floor (`floors`, issue #102) raises a track's minimum
 * above its declared one: a column is never narrower than its header needs,
 * so a container squeeze scrolls instead of wrapping a title, and a frozen
 * (fixed) track is at least its floor.
 *
 * Resizing follows the spreadsheet model: the first resize freezes every column
 * at the width it measures on screen (a px override each, the last column
 * included, so the `1fr` filler ends), and from then on a drag moves only the
 * dragged edge. The other columns keep their widths and the row's total width
 * follows: wider than the container scrolls, narrower leaves slack to the
 * right. `allFixed` tells the template when that state holds.
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

export interface ColumnTemplateOptions {
  /** When true (default), the last column's preferred is `1fr` so it fills any
   *  slack. When false, the last column is fixed like the rest — used by the
   *  `columnFill` mode, where leftover space is taken by a dither filler instead. */
  stretchLast?: boolean;
  /** Preferred width (in `--sf-unit` multiples) for columns with no `width`.
   *  Defaults to `DEFAULT_COL_UNITS`. */
  defaultWidth?: number;
  /** Freeze the first N columns: their tracks are emitted as a fixed width (not a
   *  shrinkable `minmax`), so they never shrink and their left offsets are
   *  deterministic — see `frozenLeftOffsets`. Default `0`. */
  frozenCount?: number;
  /** Measured header floors in px by column id (issue #102). A track's minimum
   *  becomes `max(declared, floor)`; a frozen track `max(preferred, floor)`. */
  floors?: Record<string, number>;
}

/** The width a (non-stretching) column resolves to, as a CSS length expression:
 *  a runtime px override, else the def's `width` in `--sf-unit` multiples, else
 *  the default. Shared by the grid template and the frozen-offset math so the two
 *  always agree. */
function preferredExpr(
  col: TemplateLeaf,
  overrides: Record<string, number>,
  defaultWidth: number,
): string {
  const override = overrides[col.id];
  return override != null
    ? `${override}px`
    : col.width != null
      ? `calc(var(--sf-unit) * ${col.width})`
      : `calc(var(--sf-unit) * ${defaultWidth})`;
}

/** A shrinkable track's minimum as a CSS length: the declared minimum, raised
 *  to the measured floor when one is known, and to the preferred width where
 *  the columns hold (`holdMin`). `max()` so the unit token still tracks the
 *  consumer's `--sf-unit`. */
function minExpr(
  col: TemplateLeaf,
  overrides: Record<string, number>,
  defaultWidth: number,
  floors: Record<string, number> | undefined,
): string {
  const declared = `calc(var(--sf-unit) * ${col.minWidth ?? COLUMN_MIN_UNITS})`;
  const floor = floors?.[col.id];
  return holdMin(
    floor != null ? [declared, `${floor}px`] : [declared],
    preferredExpr(col, overrides, defaultWidth),
  );
}

/** A fixed (frozen) track: the preferred width, raised to the floor. Shared
 *  by the template and the frozen-offset math so the two always agree. */
function fixedExpr(
  col: TemplateLeaf,
  overrides: Record<string, number>,
  defaultWidth: number,
  floors: Record<string, number> | undefined,
): string {
  const preferred = preferredExpr(col, overrides, defaultWidth);
  const floor = floors?.[col.id];
  return floor != null ? `max(${preferred}, ${floor}px)` : preferred;
}

/** Whether every leaf carries a px override: the spreadsheet state after the
 *  first resize (or a consumer's full set of persisted widths), in which the
 *  last column is fixed like the rest instead of stretching. */
export function allFixed(
  leaves: readonly { id: string }[],
  overrides: Record<string, number>,
): boolean {
  return leaves.length > 0 && leaves.every((c) => overrides[c.id] != null);
}

/** Build the `grid-template-columns` string shared by the header and every body
 *  row. Every track is `minmax(min, preferred)`; by default the last column's
 *  preferred is `1fr` so it fills any slack (see `stretchLast`), and where the
 *  columns hold its minimum is the width it would have as any other column.
 *  The first `frozenCount` tracks are emitted as fixed widths so they don't
 *  shrink. */
export function buildColumnTemplate(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
  options?: ColumnTemplateOptions,
): string {
  const stretchLast = options?.stretchLast ?? true;
  const defaultWidth = options?.defaultWidth ?? DEFAULT_COL_UNITS;
  const frozenCount = options?.frozenCount ?? 0;
  const floors = options?.floors;
  const lastIdx = leaves.length - 1;
  return leaves
    .map((col, i) => {
      // Frozen tracks are fixed (never shrink) so their offsets are predictable.
      if (i < frozenCount) return fixedExpr(col, overrides, defaultWidth, floors);
      const min = minExpr(col, overrides, defaultWidth, floors);
      if (i === lastIdx && stretchLast) return `minmax(${min}, 1fr)`;
      return `minmax(${min}, ${preferredExpr(col, overrides, defaultWidth)})`;
    })
    .join(" ");
}

/** CSS `left` offset for each of the first `frozenCount` columns: a cumulative
 *  sum of the preceding frozen widths (column 0 is `0px`). Used to pin frozen
 *  cells via `position: sticky; left: …`. Expressed as `calc(…)` so it tracks the
 *  consumer's `--sf-unit` without resolving px in JS. */
export function frozenLeftOffsets(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
  frozenCount: number,
  options?: Pick<ColumnTemplateOptions, "defaultWidth" | "floors">,
): string[] {
  const defaultWidth = options?.defaultWidth ?? DEFAULT_COL_UNITS;
  const n = Math.max(0, Math.min(frozenCount, leaves.length));
  const exprs = leaves
    .slice(0, n)
    .map((c) => fixedExpr(c, overrides, defaultWidth, options?.floors));
  return exprs.map((_, i) => (i === 0 ? "0px" : `calc(${exprs.slice(0, i).join(" + ")})`));
}

/** Total CSS width of the first `frozenCount` columns (the frozen region), e.g.
 *  for `scroll-padding-inline-start`. `"0px"` when nothing is frozen. */
export function frozenTotalWidth(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
  frozenCount: number,
  options?: Pick<ColumnTemplateOptions, "defaultWidth" | "floors">,
): string {
  const defaultWidth = options?.defaultWidth ?? DEFAULT_COL_UNITS;
  const n = Math.max(0, Math.min(frozenCount, leaves.length));
  if (n === 0) return "0px";
  const exprs = leaves
    .slice(0, n)
    .map((c) => fixedExpr(c, overrides, defaultWidth, options?.floors));
  return `calc(${exprs.join(" + ")})`;
}

/** Whether frozen columns stay pinned. They release (scroll with the rest)
 *  while their total width is more than half the scroll viewport: pinned, they
 *  would leave the scrolling columns less than half of a narrow table. Both
 *  arguments are px; the frozen width counts the data columns, without the
 *  row-number gutter. A viewport with no measured width keeps them pinned. */
export function frozenPinned(frozenWidth: number, viewportWidth: number): boolean {
  if (!(viewportWidth > 0)) return true;
  return frozenWidth <= viewportWidth / 2;
}
