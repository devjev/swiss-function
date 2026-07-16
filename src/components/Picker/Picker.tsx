import { useVirtualizer } from "@tanstack/react-virtual";
import type { HTMLAttributes, ReactNode, RefObject } from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import { Combobox } from "../Combobox";
import styles from "./Picker.module.css";

/** A choosable item: a bare string, or an object with a separate display label. */
export type PickerItem = string | PickerOption;
export type PickerOption = { value: string; label: string };

export interface PickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The items to search and choose from. */
  items: PickerItem[];
  /** Selected value (controlled). Pass with `onChange`. `""` means none. */
  value?: string;
  /** Initial selected value (uncontrolled). */
  defaultValue?: string;
  /** Called with the selected value (or `""` when cleared). */
  onChange?: (value: string) => void;
  /** Placeholder for the search field. */
  placeholder?: string;
  /** Control size, mirroring `Input` (`sm` / `md` / `lg`). Default `md`. */
  size?: "sm" | "md" | "lg";
  /** Disable the control. */
  disabled?: boolean;
  /** Show a clear button once something is selected. Default `true`. */
  clearable?: boolean;
  /** Shown in the dropdown when the filter matches nothing. */
  emptyMessage?: ReactNode;
  /** Resting depth of the search field — same `--sf-elevation-N` scale as Box.
   *  Omitted leaves the field flat (its default); set it to raise the control. */
  elevation?: BoxElevation;
}

function normalize(item: PickerItem): PickerOption {
  return typeof item === "string" ? { value: item, label: item } : item;
}

/** Windowed option list: renders only the visible slice of the filtered items
 *  (same `useVirtualizer` idiom as Selector/DataTable/Explorer — issue #15).
 *  Base UI keeps keyboard navigation over the full filtered list
 *  (`virtualized` on the Root); we scroll the active index into view via
 *  `scrollToIndexRef`. */
function VirtualOptions({
  scrollToIndexRef,
}: {
  scrollToIndexRef: RefObject<((index: number) => void) | null>;
}) {
  const filtered = Combobox.useFilteredItems<PickerOption>();
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });
  // Layout effect (not render) for render purity; child layout effects run
  // before ancestors', so the ref is set before Base UI's open-time
  // onItemHighlighted needs it.
  useLayoutEffect(() => {
    scrollToIndexRef.current = (index) => virtualizer.scrollToIndex(index);
    return () => {
      scrollToIndexRef.current = null;
    };
  }, [scrollToIndexRef, virtualizer]);
  return (
    <Combobox.List ref={listRef} className={styles.virtualList}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const option = filtered[row.index] as PickerOption;
          return (
            // aria-setsize/posinset: Base UI emits neither, and without them
            // screen readers announce only the mounted window as the whole
            // list (WAI-ARIA APG requirement for partially rendered listboxes).
            <Combobox.Item
              key={option.value}
              value={option}
              index={row.index}
              ref={virtualizer.measureElement}
              data-index={row.index}
              aria-setsize={filtered.length}
              aria-posinset={row.index + 1}
              className={styles.virtualItem}
              style={{ transform: `translateY(${row.start}px)` }}
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
 * Search a list of items and choose exactly one. The single-selection sibling of
 * {@link Selector} — same item shape and controlled API, but `value` is one
 * string. Wraps a single-select Base UI Combobox (via our Combobox parts): the
 * field shows the chosen item's label and doubles as the filter.
 */
export const Picker = forwardRef<HTMLDivElement, PickerProps>(function Picker(
  {
    items,
    value,
    defaultValue,
    onChange,
    placeholder = "Search…",
    size = "md",
    disabled,
    clearable = true,
    emptyMessage = "No results",
    elevation,
    className,
    ...rest
  },
  ref,
) {
  const options = useMemo(() => items.map(normalize), [items]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  // Controlled/uncontrolled: track internally so the field reflects the choice
  // even when the parent doesn't pass `value`.
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const isControlled = value !== undefined;
  const selected = isControlled ? value : internal;

  const setSelected = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  // Mirror the selected value to the option object Base UI compares by reference,
  // so the field shows the right label and the list highlights the right row.
  const selectedOption = selected ? (byValue.get(selected) ?? null) : null;
  const selectedLabel = selectedOption?.label ?? "";

  // The input text is the search query while the popup is open, and the selected
  // item's label while it is closed. Opening clears the query, so the field
  // shows the whole list (not filtered to the current selection) and the user
  // types a fresh search instead of appending to the selected label.
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const scrollToIndexRef = useRef<((index: number) => void) | null>(null);

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <Combobox.Root
        items={options}
        value={selectedOption}
        onValueChange={(next: PickerOption | null) => setSelected(next?.value ?? "")}
        open={open}
        onOpenChange={(nextOpen: boolean) => {
          setOpen(nextOpen);
          if (nextOpen) setQuery("");
        }}
        inputValue={open ? query : selectedLabel}
        onInputValueChange={(next: string) => setQuery(next)}
        disabled={disabled}
        virtualized
        onItemHighlighted={(_item, details) => {
          if (details.index >= 0) scrollToIndexRef.current?.(details.index);
        }}
      >
        <Combobox.InputGroup data-size={size} data-elevation={elevation} className={styles.group}>
          <Combobox.Input placeholder={placeholder} />
          {clearable && selected && <Combobox.Clear aria-label="Clear">×</Combobox.Clear>}
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4}>
            <Combobox.Popup>
              <Combobox.Empty>
                <div className={styles.empty}>{emptyMessage}</div>
              </Combobox.Empty>
              <VirtualOptions scrollToIndexRef={scrollToIndexRef} />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
});
