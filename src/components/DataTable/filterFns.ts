import type { FilterFn } from "@tanstack/react-table";
import { checklistTest, rangeTest } from "../../lib/filter/predicates";
import type { LeafColumnDef } from "./types";

/** Column filters for both DataTable paths: `computeRowOrder` for flat tables,
 *  table-core's filtered row model for tree tables. Either way a filter value
 *  becomes its row test once per filtering pass (issue #106). */

type RowTest = (value: unknown) => boolean;
type Range = [number | undefined, number | undefined] | undefined;

const isRange = <T>(leaf: LeafColumnDef<T>) => leaf.edit?.type === "number";

/** The row test for one column filter. The kind follows the column's edit
 *  type: a number column filters by range, every other by a value checklist. */
export function columnFilterTest<T>(leaf: LeafColumnDef<T>, value: unknown): RowTest {
  return isRange(leaf) ? rangeTest(value as Range) : checklistTest(value as string[] | undefined);
}

// Table-core calls `resolveFilterValue` once per filter per pass and hands its
// result to the filter function for every row, so each row gets a ready test.

/** Checklist filter: keep rows whose stringified value is allowed. */
export const includesFilter: FilterFn<unknown> = (row, columnId, test) =>
  (test as RowTest)(row.getValue(columnId));
includesFilter.resolveFilterValue = (value) => checklistTest(value as string[] | undefined);

/** Numeric range filter: keep rows within [min, max]; a blank bound is open. */
export const rangeFilter: FilterFn<unknown> = (row, columnId, test) =>
  (test as RowTest)(row.getValue(columnId));
rangeFilter.resolveFilterValue = (value) => rangeTest(value as Range);

/** The TanStack filter function a column gets. Harmless on an unfiltered
 *  column: table-core only runs it for a column with a filter entry. */
export function filterFnFor<T>(leaf: LeafColumnDef<T>): FilterFn<T> {
  return (isRange(leaf) ? rangeFilter : includesFilter) as FilterFn<T>;
}
