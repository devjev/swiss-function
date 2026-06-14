/** Column-width plumbing for resizable DataTable columns.
 *
 * Widths resolve with this precedence per leaf column:
 *   1. a runtime override (px) — set by dragging the resize handle,
 *   2. the column def's `width` (in `--sf-unit` multiples),
 *   3. otherwise a fluid `minmax(...)` track that fills remaining space.
 */

/** Minimum a column may be dragged to, as a `--sf-unit` multiple. Mirrors the
 *  `--sf-datatable-col-min` CSS fallback so JS clamping and CSS agree. */
export const COLUMN_MIN_UNITS = 3;

/** Default fluid lower bound for auto-sized columns, in `--sf-unit` multiples. */
const FLUID_MIN_UNITS = 5;

export interface TemplateLeaf {
  id: string;
  /** Static width in `--sf-unit` multiples, from the column def. */
  width?: number;
}

/** Build the `grid-template-columns` string shared by the header and every
 *  body row, applying runtime px overrides on top of the static defs. */
export function buildColumnTemplate(
  leaves: TemplateLeaf[],
  overrides: Record<string, number>,
): string {
  return leaves
    .map((col) => {
      const override = overrides[col.id];
      if (override != null) return `${override}px`;
      if (col.width != null) return `calc(var(--sf-unit) * ${col.width})`;
      return `minmax(calc(var(--sf-unit) * ${FLUID_MIN_UNITS}), 1fr)`;
    })
    .join(" ");
}
