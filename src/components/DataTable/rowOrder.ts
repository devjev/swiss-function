import {
  type ColumnFiltersState,
  reSplitAlphaNumeric,
  type SortingFn,
  type SortingState,
  sortingFns,
} from "@tanstack/react-table";
import { keepAll } from "../../lib/filter/predicates";
import { columnFilterTest } from "./filterFns";
import type { LeafColumnDef } from "./types";

/** Row-order math for flat (non-tree) DataTables.
 *
 * A flat table never needs TanStack Row objects for its body — materializing
 * one per data row costs ~3KB each at 100k rows (issue #11). Instead this
 * module computes the display-order → data-index permutation directly on the
 * raw data, replicating the filtered+sorted row model that
 * getFilteredRowModel/getSortedRowModel would produce. Parity with table-core
 * (auto sorting-fn selection incl. its rows-[10..] sniff, sortUndefined=1,
 * desc inversion, multi-sort, stable index tiebreak, stale state entries
 * ignored) is pinned by rowOrder.test.ts against a real table-core instance.
 */

/** Read a cell's raw value off a data row. */
export function getCellValue<T>(row: T, accessor: LeafColumnDef<T>["accessor"]): unknown {
  if (typeof accessor === "function") return accessor(row);
  return (row as Record<string, unknown>)[accessor as string];
}

/** One column filter, resolved to its row test. */
export interface ActiveColumnFilter<T> {
  leaf: LeafColumnDef<T>;
  test: (value: unknown) => boolean;
}

/** The column filters that remove rows, each resolved to its row test once
 *  per pass (issue #106). An entry for a column that is gone (a leaf swapped
 *  for its `::placeholder` by group collapse) is dropped, as table-core drops
 *  it, and so is an inactive one (an empty checklist, an open range), which
 *  keeps every row. */
export function activeColumnFilters<T>(
  byId: Map<string, LeafColumnDef<T>>,
  filters: ColumnFiltersState,
): ActiveColumnFilter<T>[] {
  const out: ActiveColumnFilter<T>[] = [];
  for (const f of filters) {
    const leaf = byId.get(f.id);
    if (!leaf) continue;
    const test = columnFilterTest(leaf, f.value);
    if (test !== keepAll) out.push({ leaf, test });
  }
  return out;
}

/** Whether a data row passes every active filter. */
export function passesFilters<T>(row: T, filters: ActiveColumnFilter<T>[]): boolean {
  for (const { leaf, test } of filters) {
    if (!test(getCellValue(row, leaf.accessor))) return false;
  }
  return true;
}

/** Table-core parity: RowSorting's `getAutoSortingFn`, sniffing the filtered
 *  rows from position 10 onward (its odd `.slice(10)`) over precomputed
 *  values. Reuses table-core's own sortingFns implementations. */
function autoSortingFn<T>(values: unknown[], filtered: Uint32Array): SortingFn<T> {
  let isString = false;
  for (let k = 10; k < filtered.length; k++) {
    const value = values[filtered[k] as number];
    if (Object.prototype.toString.call(value) === "[object Date]") {
      return sortingFns.datetime;
    }
    if (typeof value === "string") {
      isString = true;
      if (value.split(reSplitAlphaNumeric).length > 1) {
        return sortingFns.alphanumeric;
      }
    }
  }
  if (isString) return sortingFns.text;
  return sortingFns.basic;
}

/** table-core's private `toString`, which its text sorting fns apply. */
function sortString(value: unknown): string {
  if (typeof value === "number") {
    if (
      Number.isNaN(value) ||
      value === Number.POSITIVE_INFINITY ||
      value === Number.NEGATIVE_INFINITY
    ) {
      return "";
    }
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

function compareBasic(a: unknown, b: unknown): number {
  return a === b ? 0 : (a as number) > (b as number) ? 1 : -1;
}

/** table-core's `compareAlphanumeric` over pre-split runs: `parts` are the
 *  digit and non-digit runs, `nums` their `parseInt` (NaN for text). Its
 *  `[an, bn].sort()` sorts as strings, where digits come before "NaN", so the
 *  first element is NaN only when both runs are text and the second when
 *  either is; the branches below are those two tests. */
function compareRuns(a: string[], an: number[], b: string[], bn: number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = an[i] as number;
    const y = bn[i] as number;
    const xText = Number.isNaN(x);
    const yText = Number.isNaN(y);
    if (xText && yText) {
      const aa = a[i] as string;
      const bb = b[i] as string;
      if (aa > bb) return 1;
      if (bb > aa) return -1;
      continue;
    }
    if (xText || yText) return xText ? -1 : 1;
    if (x > y) return 1;
    if (y > x) return -1;
  }
  return a.length - b.length;
}

const TEXT_RUN = "\u0001";
const NUMBER_RUN = "\u0002";
/** Digit runs up to this many significant digits parse exactly. */
const EXACT_DIGITS = 15;

/** An order-preserving key for compareRuns: the plain string order of two
 *  keys is compareRuns's order of their values. Each run is a tag (text
 *  before number, as compareRuns orders a text run against a number run)
 *  and its payload: text as is, a number as its digit count and digits with
 *  the leading zeros dropped, so more digits sort higher and 007 equals 7.
 *  A value that ends sooner is a prefix, and sorts first, as compareRuns's
 *  length tiebreak does. Null when the value cannot be encoded: text holding
 *  a tag character (it would sort against the tags), or a digit run past 15
 *  significant digits, where parseInt loses precision and table-core calls
 *  different digits equal. */
function runKey(value: string): string | null {
  let key = "";
  for (const run of value.split(reSplitAlphaNumeric)) {
    if (run === "") continue;
    const first = run.charCodeAt(0);
    if (first >= 48 && first <= 57) {
      let start = 0;
      while (start < run.length - 1 && run.charCodeAt(start) === 48) start++;
      const digits = start === 0 ? run : run.slice(start);
      if (digits.length > EXACT_DIGITS) return null;
      key += NUMBER_RUN + String.fromCharCode(0x20 + digits.length) + digits;
    } else {
      for (let j = 0; j < run.length; j++) if (run.charCodeAt(j) <= 2) return null;
      key += TEXT_RUN + run;
    }
  }
  return key;
}

/** A comparator over data indices that gives exactly what `fn` (one of
 *  table-core's sortingFns, as `autoSortingFn` picks them) gives over rows,
 *  with each value's sort key computed once. table-core recomputes the key
 *  in every comparison: `alphanumeric` lowercases and splits both strings
 *  each time, about 1.7 million times for 100k rows (400ms). */
function indexComparator<T>(
  fn: SortingFn<T>,
  values: unknown[],
  order: Uint32Array,
): (a: number, b: number) => number {
  if (fn === sortingFns.alphanumeric) {
    // One string per value whose plain order is compareRuns's order (see
    // runKey); values runKey cannot encode send the column to the runs.
    const keys = new Array<string>(values.length);
    let encoded = true;
    for (let k = 0; k < order.length; k++) {
      const i = order[k] as number;
      const key = runKey(sortString(values[i]).toLowerCase());
      if (key === null) {
        encoded = false;
        break;
      }
      keys[i] = key;
    }
    if (encoded) {
      return (a, b) => {
        const x = keys[a] as string;
        const y = keys[b] as string;
        return x < y ? -1 : x > y ? 1 : 0;
      };
    }
    const parts = new Array<string[]>(values.length);
    const nums = new Array<number[]>(values.length);
    for (let k = 0; k < order.length; k++) {
      const i = order[k] as number;
      const runs = sortString(values[i]).toLowerCase().split(reSplitAlphaNumeric).filter(Boolean);
      parts[i] = runs;
      nums[i] = runs.map((run) => Number.parseInt(run, 10));
    }
    return (a, b) =>
      compareRuns(
        parts[a] as string[],
        nums[a] as number[],
        parts[b] as string[],
        nums[b] as number[],
      );
  }
  if (fn === sortingFns.text) {
    const lower = new Array<string>(values.length);
    for (let k = 0; k < order.length; k++) {
      const i = order[k] as number;
      lower[i] = sortString(values[i]).toLowerCase();
    }
    return (a, b) => compareBasic(lower[a], lower[b]);
  }
  if (fn === sortingFns.datetime) {
    return (a, b) => {
      const x = values[a] as number;
      const y = values[b] as number;
      return x > y ? 1 : x < y ? -1 : 0;
    };
  }
  return (a, b) => compareBasic(values[a], values[b]);
}

// Cached so the no-sort/no-filter case is O(1) after the first call — the
// order memo depends on `visibleLeaves`, whose identity changes on group
// collapse / column reorder, which would otherwise pay an O(n) rebuild at
// 100k rows for unrelated column-structure changes.
let identityCache = new Uint32Array(0);

function identityOrder(length: number): Uint32Array {
  if (identityCache.length !== length) {
    const next = new Uint32Array(length);
    for (let i = 0; i < length; i++) next[i] = i;
    identityCache = next;
  }
  return identityCache;
}

/** Display-order → original-data-index permutation for a flat table. Callers
 *  must treat the result as immutable (the identity case is a shared cache). */
export function computeRowOrder<T>(
  data: T[],
  leaves: LeafColumnDef<T>[],
  sorting: SortingState,
  filters: ColumnFiltersState,
): Uint32Array {
  const byId = new Map(leaves.map((l) => [l.id, l]));
  // TanStack silently drops state entries for columns that no longer exist
  // (e.g. a leaf swapped for its `::placeholder` by group collapse) and sort
  // entries for non-sortable columns — mirror that.
  const activeFilters = activeColumnFilters(byId, filters);
  const activeSorting = sorting.filter((s) => byId.get(s.id)?.sortable === true);

  if (activeFilters.length === 0 && activeSorting.length === 0) {
    return identityOrder(data.length);
  }

  let order = new Uint32Array(data.length);
  if (activeFilters.length === 0) {
    for (let i = 0; i < data.length; i++) order[i] = i;
  } else {
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as T;
      if (passesFilters(row, activeFilters)) order[count++] = i;
    }
    if (count !== data.length) order = order.slice(0, count);
  }

  if (activeSorting.length > 0) {
    // Per-column raw values keyed by data index, so the comparator (and the
    // Row shims below) never touch accessors during the sort.
    const valuesById = new Map<string, unknown[]>();
    for (const s of activeSorting) {
      if (valuesById.has(s.id)) continue;
      const leaf = byId.get(s.id) as LeafColumnDef<T>;
      const values = new Array<unknown>(data.length);
      for (let k = 0; k < order.length; k++) {
        const i = order[k] as number;
        values[i] = getCellValue(data[i] as T, leaf.accessor);
      }
      valuesById.set(s.id, values);
    }

    const entries = activeSorting.map((s) => {
      const values = valuesById.get(s.id) as unknown[];
      return {
        desc: s.desc === true,
        values,
        compare: indexComparator(autoSortingFn<T>(values, order), values, order),
      };
    });

    // Replicates getSortedRowModel's comparator: sortUndefined (default 1)
    // first, then the sorting fn, desc inversion last; ties fall through to
    // the next entry and finally the original index (stable tiebreak).
    order.sort((a, b) => {
      for (const e of entries) {
        let sortInt = 0;
        const aUndefined = e.values[a] === undefined;
        const bUndefined = e.values[b] === undefined;
        if (aUndefined || bUndefined) {
          sortInt = aUndefined && bUndefined ? 0 : aUndefined ? 1 : -1;
        }
        if (sortInt === 0) sortInt = e.compare(a, b);
        if (sortInt !== 0) return e.desc ? -sortInt : sortInt;
      }
      return a - b;
    });
  }

  return order;
}
