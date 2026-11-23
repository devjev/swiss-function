/** Row tests for the two column filter kinds, shared by DataTable and Explorer.
 *  Each takes a filter value and returns the test for one cell value, so the
 *  value is resolved once per filtering pass and not once per row: a
 *  checklist of 9,999 allowed values tested with `Array.includes` cost
 *  10k × 5k comparisons per refilter (issue #106). */

/** The test an inactive filter resolves to. Both builders return this one
 *  function, so a caller can drop an inactive filter by identity. */
export const keepAll = (_value: unknown): boolean => true;

/** Keep-set test for a checklist filter, matching a cell by its string form
 *  (`1` and `"1"` both match `"1"`). An empty/undefined allow-list keeps
 *  everything (an inactive filter). */
export function checklistTest(allowed: string[] | undefined): (value: unknown) => boolean {
  if (!allowed || allowed.length === 0) return keepAll;
  const set = new Set(allowed);
  return (value) => set.has(String(value));
}

/** Numeric range test; a blank bound is open. Undefined range keeps everything. */
export function rangeTest(
  range: [number | undefined, number | undefined] | undefined,
): (value: unknown) => boolean {
  const [min, max] = range ?? [];
  if (min == null && max == null) return keepAll;
  return (value) => {
    const n = Number(value);
    if (min != null && !(n >= min)) return false;
    if (max != null && !(n <= max)) return false;
    return true;
  };
}
