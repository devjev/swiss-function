import {
  type ColumnFiltersState,
  type Row,
  reSplitAlphaNumeric,
  type SortingFn,
  type SortingState,
  sortingFns,
} from "@tanstack/react-table";
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

/** DataTable's checklist filter (`includesFilter`) on a raw value: keep rows
 *  whose stringified value is in the allowed set; an empty set keeps all. */
function passesChecklist(value: unknown, filterValue: unknown): boolean {
  const allowed = filterValue as string[] | undefined;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(String(value));
}

/** DataTable's numeric range filter (`rangeFilter`) on a raw value: keep rows
 *  within [min, max]; a blank bound is open. */
function passesRange(value: unknown, filterValue: unknown): boolean {
  const [min, max] = (filterValue as [number | undefined, number | undefined]) ?? [];
  const v = Number(value);
  if (min != null && !(v >= min)) return false;
  if (max != null && !(v <= max)) return false;
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
  const activeFilters: { leaf: LeafColumnDef<T>; value: unknown }[] = [];
  for (const f of filters) {
    const leaf = byId.get(f.id);
    if (leaf) activeFilters.push({ leaf, value: f.value });
  }
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
      let keep = true;
      for (const { leaf, value } of activeFilters) {
        // Filter kind follows the edit type, exactly as toTSColumn wires it.
        const v = getCellValue(row, leaf.accessor);
        if (leaf.edit?.type === "number" ? !passesRange(v, value) : !passesChecklist(v, value)) {
          keep = false;
          break;
        }
      }
      if (keep) order[count++] = i;
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

    // Minimal Row shims — table-core's sortingFns only ever call getValue().
    const shimA = {
      index: 0,
      getValue: (id: string) => (valuesById.get(id) as unknown[])[shimA.index],
    };
    const shimB = {
      index: 0,
      getValue: (id: string) => (valuesById.get(id) as unknown[])[shimB.index],
    };
    const rowA = shimA as unknown as Row<T>;
    const rowB = shimB as unknown as Row<T>;

    const entries = activeSorting.map((s) => ({
      id: s.id,
      desc: s.desc === true,
      values: valuesById.get(s.id) as unknown[],
      fn: autoSortingFn<T>(valuesById.get(s.id) as unknown[], order),
    }));

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
        if (sortInt === 0) {
          shimA.index = a;
          shimB.index = b;
          sortInt = e.fn(rowA, rowB, e.id);
        }
        if (sortInt !== 0) return e.desc ? -sortInt : sortInt;
      }
      return a - b;
    });
  }

  return order;
}
