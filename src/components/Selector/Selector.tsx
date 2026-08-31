import { useVirtualizer } from "@tanstack/react-virtual";
import type { HTMLAttributes, ReactNode, RefObject } from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { buildOptionRows, clusterOptions } from "../../lib/optionGroups";
import type { BoxElevation } from "../Box";
import { Combobox } from "../Combobox";
import styles from "./Selector.module.css";

/** A selectable item: a bare string, or an object with a separate display label.
 *  An optional `group` names the section the item renders under: items sharing
 *  a `group` cluster below one header (in order of each group's first
 *  appearance), ungrouped items list first, headerless. A group whose items
 *  are all filtered out disappears with them. */
export type SelectorItem = string | SelectorOption;
export type SelectorOption = { value: string; label: string; group?: string };

export interface SelectorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The items to search and choose from. */
  items: SelectorItem[];
  /** Selected values (controlled). Pass with `onChange`. */
  value?: string[];
  /** Initial selected values (uncontrolled). */
  defaultValue?: string[];
  /** Called with the full set of selected values whenever it changes. */
  onChange?: (value: string[]) => void;
  /** Placeholder for the search field. */
  placeholder?: string;
  /** Control size, mirroring `Input` (`sm` / `md` / `lg`). Default `md`. */
  size?: "sm" | "md" | "lg";
  /**
   * Where the chosen-items "bucket" lives.
   * - `"panel"` (default): a separate container below the search field.
   * - `"inline"`: chips sit inside the search field (tag-input style).
   * - `"compact"`: collapses to just an "N selected" count + Clear, so it fits
   *   in tight spaces; the full set is reviewed/unchecked in the dropdown.
   */
  layout?: "panel" | "inline" | "compact";
  /** Disable the whole control. */
  disabled?: boolean;
  /** Shown in the dropdown when the filter matches nothing. */
  emptyMessage?: ReactNode;
  /** Resting depth of the search field — same `--sf-elevation-N` scale as Box.
   *  Omitted leaves the field flat (its default); set it to raise the control.
   *  Applies to the field in every `layout`. */
  elevation?: BoxElevation;
  /** Heading for the bucket panel (only used by `layout="panel"`). */
  bucketLabel?: ReactNode;
  /** Wording for the count in `layout="compact"`, given the number selected.
   *  Default: `N item` / `N items`. */
  compactLabel?: (count: number) => ReactNode;
}

function normalize(item: SelectorItem): SelectorOption {
  return typeof item === "string" ? { value: item, label: item } : item;
}

/** Windowed option list: renders only the visible slice of the filtered items
 *  (same `useVirtualizer` idiom as DataTable/Explorer). Base UI keeps keyboard
 *  navigation over the full filtered list (`virtualized` on the Root); we
 *  scroll the active index into view via `scrollToIndexRef`. */
function VirtualOptions({
  scrollToIndexRef,
  onGroupToggle,
}: {
  scrollToIndexRef: RefObject<((index: number) => void) | null>;
  /** Fired with the values of a header's currently filtered items when the
   *  header is clicked. */
  onGroupToggle?: (values: string[]) => void;
}) {
  const filtered = Combobox.useFilteredItems<SelectorOption>();
  const listRef = useRef<HTMLDivElement>(null);
  // Interleave group header rows: virtual rows = headers + items, while Base UI
  // keeps navigating the flat filtered items (headers are not focusable).
  const { rows, itemRowIndex } = useMemo(() => buildOptionRows(filtered), [filtered]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (i) => (rows[i]?.kind === "header" ? 28 : 40),
    overscan: 8,
  });
  // Layout effect (not render) for render purity; child layout effects run
  // before ancestors', so the ref is set before Base UI's open-time
  // onItemHighlighted needs it. Base UI hands us item indexes; map to rows.
  useLayoutEffect(() => {
    scrollToIndexRef.current = (index) => virtualizer.scrollToIndex(itemRowIndex[index] ?? index);
    return () => {
      scrollToIndexRef.current = null;
    };
  }, [scrollToIndexRef, virtualizer, itemRowIndex]);
  return (
    <Combobox.List ref={listRef} className={styles.virtualList} data-virtualized-list="">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vrow) => {
          const row = rows[vrow.index];
          if (!row) return null;
          if (row.kind === "header") {
            // Presentational: the listbox stays flat for AT (the APG-nestable
            // role="group" can't wrap absolutely-positioned windowed rows).
            // Clicking is a pointer-only shortcut over the group's visible
            // items; keyboard selection stays per item. preventDefault on
            // pointerdown keeps focus in the input so the popup stays open.
            return (
              <div
                key={`#${row.group}`}
                ref={virtualizer.measureElement}
                data-index={vrow.index}
                aria-hidden="true"
                data-toggleable={onGroupToggle ? "" : undefined}
                className={styles.groupHeader}
                style={{ transform: `translateY(${vrow.start}px)` }}
                onPointerDown={(e) => e.preventDefault()}
                onClick={
                  onGroupToggle
                    ? () =>
                        onGroupToggle(
                          filtered.filter((o) => o.group === row.group).map((o) => o.value),
                        )
                    : undefined
                }
              >
                {row.group}
              </div>
            );
          }
          const option = row.option;
          return (
            // aria-setsize/posinset: Base UI emits neither, and without them
            // screen readers announce only the mounted window as the whole
            // list (WAI-ARIA APG requirement for partially rendered listboxes).
            // They count items only, so headers don't skew the announced size.
            <Combobox.Item
              key={option.value}
              value={option}
              index={row.index}
              ref={virtualizer.measureElement}
              data-index={vrow.index}
              data-grouped={option.group ? "" : undefined}
              aria-setsize={filtered.length}
              aria-posinset={row.index + 1}
              className={styles.virtualItem}
              style={{ transform: `translateY(${vrow.start}px)` }}
            >
              <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
              {option.label}
            </Combobox.Item>
          );
        })}
      </div>
    </Combobox.List>
  );
}

/**
 * Search a list of items, select several, and see the chosen set as a bucket
 * of removable chips. Wraps a multi-select Base UI Combobox (via our Combobox
 * parts) and adds an opinionated, controlled prop API.
 */
export const Selector = forwardRef<HTMLDivElement, SelectorProps>(function Selector(
  {
    items,
    value,
    defaultValue,
    onChange,
    placeholder = "Search…",
    size = "md",
    layout = "panel",
    disabled,
    emptyMessage = "No results",
    elevation,
    bucketLabel = "Selected",
    compactLabel = (count) => `${count} item${count === 1 ? "" : "s"}`,
    className,
    ...rest
  },
  ref,
) {
  const options = useMemo(() => clusterOptions(items.map(normalize)), [items]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  // Controlled/uncontrolled: we always track the selection internally so the
  // chips can render even when the parent doesn't pass `value`.
  const [internal, setInternal] = useState<string[]>(defaultValue ?? []);
  const isControlled = value !== undefined;
  const selected = isControlled ? value : internal;

  const setSelected = (next: string[]) => {
    if (!isControlled) {
      setInternal(next);
    }
    onChange?.(next);
  };

  // Mirror the selected values into the option objects Base UI compares by
  // reference. Order matches `selected`, so chip removal (which is by index)
  // stays aligned.
  const selectedOptions = useMemo(
    () => selected.map((v) => byValue.get(v)).filter((o): o is SelectorOption => o != null),
    [selected, byValue],
  );

  // Inline layout stays exactly one row — chips never wrap; overflow is clipped
  // horizontally and flagged with a trailing ellipsis. The full selection is
  // reviewed and unchecked in the dropdown, so the control never grows vertically.
  const chipsRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (layout !== "inline") return;
    const el = chipsRef.current;
    if (!el) return;
    // A 1px slack keeps sub-pixel rounding from reporting a phantom overflow.
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, selected, size]);

  const renderChips = () =>
    selected.map((v) => {
      const label = byValue.get(v)?.label ?? v;
      return (
        <Combobox.Chip key={v} className={styles.chip}>
          {label}
          <Combobox.ChipRemove aria-label={`Remove ${label}`}>×</Combobox.ChipRemove>
        </Combobox.Chip>
      );
    });

  const scrollToIndexRef = useRef<((index: number) => void) | null>(null);

  // Clicking a group header toggles its visible items as one: select the
  // missing ones, or deselect them all when every one is already selected.
  const toggleGroup = (values: string[]) => {
    if (values.length === 0) return;
    const set = new Set(selected);
    if (values.every((v) => set.has(v))) {
      const drop = new Set(values);
      setSelected(selected.filter((v) => !drop.has(v)));
    } else {
      setSelected([...selected, ...values.filter((v) => !set.has(v))]);
    }
  };

  const dropdown = (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup>
          <Combobox.Empty>
            <div className={styles.empty}>{emptyMessage}</div>
          </Combobox.Empty>
          <VirtualOptions scrollToIndexRef={scrollToIndexRef} onGroupToggle={toggleGroup} />
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );

  return (
    <div
      {...rest}
      ref={ref}
      data-layout={layout}
      className={cx(styles.root, layout === "compact" && styles.compactRoot, className)}
    >
      <Combobox.Root
        multiple
        items={options}
        value={selectedOptions}
        onValueChange={(next: SelectorOption[]) => setSelected(next.map((o) => o.value))}
        disabled={disabled}
        virtualized
        onItemHighlighted={(_item, details) => {
          if (details.index >= 0) scrollToIndexRef.current?.(details.index);
        }}
      >
        {layout === "inline" ? (
          <>
            <Combobox.InputGroup
              data-size={size}
              data-elevation={elevation}
              className={styles.inlineGroup}
            >
              <Combobox.Chips ref={chipsRef} className={styles.inlineChips}>
                {renderChips()}
              </Combobox.Chips>
              {overflowing && (
                <span className={styles.overflowEllipsis} aria-hidden="true">
                  ⋯
                </span>
              )}
              <Combobox.Input placeholder={selected.length ? "" : placeholder} />
              {selected.length > 0 && <Combobox.Clear aria-label="Clear all">Clear</Combobox.Clear>}
            </Combobox.InputGroup>
            {dropdown}
          </>
        ) : layout === "compact" ? (
          <>
            <Combobox.InputGroup
              data-size={size}
              data-elevation={elevation}
              className={styles.compactGroup}
            >
              {selected.length > 0 && (
                <span className={styles.compactCount}>{compactLabel(selected.length)}</span>
              )}
              <Combobox.Input
                className={styles.compactInput}
                placeholder={selected.length ? "" : placeholder}
              />
              {selected.length > 0 && <Combobox.Clear aria-label="Clear all">Clear</Combobox.Clear>}
            </Combobox.InputGroup>
            {dropdown}
          </>
        ) : (
          <>
            <Combobox.Input placeholder={placeholder} data-size={size} data-elevation={elevation} />
            {dropdown}
            <div className={styles.bucket}>
              <div className={styles.bucketHeader}>
                <span>
                  {bucketLabel}
                  <span className={styles.count}> ({selected.length})</span>
                </span>
                {selected.length > 0 && (
                  <Combobox.Clear aria-label="Clear all">Clear</Combobox.Clear>
                )}
              </div>
              <div className={styles.bucketBody}>
                {selected.length > 0 ? (
                  <Combobox.Chips>{renderChips()}</Combobox.Chips>
                ) : (
                  <span className={styles.bucketEmpty}>No items selected</span>
                )}
              </div>
            </div>
          </>
        )}
      </Combobox.Root>
    </div>
  );
});
