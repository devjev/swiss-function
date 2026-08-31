/** Grouping helpers shared by Selector and Picker: cluster a flat option list
 *  by its optional `group` field and interleave header rows for the windowed
 *  dropdown. Pure logic, no DOM. */

export interface GroupableOption {
  value: string;
  label: string;
  /** Section this option belongs to. Options sharing a `group` render under
   *  one header; options without one render first, headerless. */
  group?: string;
}

export type OptionRow<T extends GroupableOption> =
  | { kind: "header"; group: string }
  | {
      kind: "item";
      option: T;
      /** The option's index in the flat filtered list (what Base UI's keyboard
       *  navigation and highlight callbacks count). */
      index: number;
    };

export interface OptionRowModel<T extends GroupableOption> {
  rows: OptionRow<T>[];
  /** Maps a flat item index to its row index, for scroll-into-view. */
  itemRowIndex: number[];
}

/**
 * Cluster options so items of the same `group` sit together: ungrouped options
 * first (keeping their relative order), then each group in order of its first
 * appearance. Returns the input array unchanged (same reference) when nothing
 * is grouped, so ungrouped lists keep memo identity.
 */
export function clusterOptions<T extends GroupableOption>(options: T[]): T[] {
  if (!options.some((o) => o.group)) return options;
  const ungrouped: T[] = [];
  const groups = new Map<string, T[]>();
  for (const option of options) {
    if (!option.group) {
      ungrouped.push(option);
      continue;
    }
    const bucket = groups.get(option.group);
    if (bucket) bucket.push(option);
    else groups.set(option.group, [option]);
  }
  return ungrouped.concat(...groups.values());
}

/**
 * Interleave header rows into a (clustered, filtered) option list: a header is
 * emitted whenever an option's `group` differs from the previous option's.
 * Filtering keeps clustered input clustered, so groups whose options were all
 * filtered out simply emit no header.
 */
export function buildOptionRows<T extends GroupableOption>(filtered: T[]): OptionRowModel<T> {
  const rows: OptionRow<T>[] = [];
  const itemRowIndex: number[] = [];
  let currentGroup: string | undefined;
  filtered.forEach((option, index) => {
    if (option.group && option.group !== currentGroup) {
      rows.push({ kind: "header", group: option.group });
    }
    currentGroup = option.group;
    itemRowIndex.push(rows.length);
    rows.push({ kind: "item", option, index });
  });
  return { rows, itemRowIndex };
}
