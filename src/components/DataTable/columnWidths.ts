// `resizeBoundary` now lives in the shared column lib (Explorer reuses it too);
// re-exported here so DataTable's imports and tests keep their local path.
export { resizeBoundary } from "../../lib/columns/resizeBoundary";

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

/** Build the `grid-template-columns` string shared by the header and every body
 *  row. Every track is `minmax(min, preferred)`; by default the last column's
 *  preferred is `1fr` so it fills any slack (see `stretchLast`). The first
 *  `frozenCount` tracks are emitted as fixed widths so they don't shrink. */
export function buildColumnTemplate(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
  options?: ColumnTemplateOptions,
): string {
  const stretchLast = options?.stretchLast ?? true;
  const defaultWidth = options?.defaultWidth ?? DEFAULT_COL_UNITS;
  const frozenCount = options?.frozenCount ?? 0;
  const lastIdx = leaves.length - 1;
  return leaves
    .map((col, i) => {
      // Frozen tracks are fixed (never shrink) so their offsets are predictable.
      if (i < frozenCount) return preferredExpr(col, overrides, defaultWidth);
      const min = `calc(var(--sf-unit) * ${col.minWidth ?? COLUMN_MIN_UNITS})`;
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
  options?: Pick<ColumnTemplateOptions, "defaultWidth">,
): string[] {
  const defaultWidth = options?.defaultWidth ?? DEFAULT_COL_UNITS;
  const n = Math.max(0, Math.min(frozenCount, leaves.length));
  const exprs = leaves.slice(0, n).map((c) => preferredExpr(c, overrides, defaultWidth));
  return exprs.map((_, i) => (i === 0 ? "0px" : `calc(${exprs.slice(0, i).join(" + ")})`));
}

/** Total CSS width of the first `frozenCount` columns (the frozen region), e.g.
 *  for `scroll-padding-inline-start`. `"0px"` when nothing is frozen. */
export function frozenTotalWidth(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
  frozenCount: number,
  options?: Pick<ColumnTemplateOptions, "defaultWidth">,
): string {
  const defaultWidth = options?.defaultWidth ?? DEFAULT_COL_UNITS;
  const n = Math.max(0, Math.min(frozenCount, leaves.length));
  if (n === 0) return "0px";
  const exprs = leaves.slice(0, n).map((c) => preferredExpr(c, overrides, defaultWidth));
  return `calc(${exprs.join(" + ")})`;
}
