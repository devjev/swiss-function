import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Combobox } from "../Combobox";
import styles from "./Selector.module.css";

/** A selectable item: a bare string, or an object with a separate display label. */
export type SelectorItem = string | SelectorOption;
export type SelectorOption = { value: string; label: string };

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
   */
  layout?: "panel" | "inline";
  /** Disable the whole control. */
  disabled?: boolean;
  /** Shown in the dropdown when the filter matches nothing. */
  emptyMessage?: ReactNode;
  /** Heading for the bucket panel (only used by `layout="panel"`). */
  bucketLabel?: ReactNode;
}

function normalize(item: SelectorItem): SelectorOption {
  return typeof item === "string" ? { value: item, label: item } : item;
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
    bucketLabel = "Selected",
    className,
    ...rest
  },
  ref,
) {
  const options = useMemo(() => items.map(normalize), [items]);
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

  const dropdown = (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup>
          <Combobox.Empty>
            <div className={styles.empty}>{emptyMessage}</div>
          </Combobox.Empty>
          <Combobox.List>
            {(option: SelectorOption) => (
              <Combobox.Item key={option.value} value={option}>
                <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                {option.label}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <Combobox.Root
        multiple
        items={options}
        value={selectedOptions}
        onValueChange={(next: SelectorOption[]) => setSelected(next.map((o) => o.value))}
        disabled={disabled}
      >
        {layout === "inline" ? (
          <>
            <Combobox.InputGroup data-size={size} className={styles.inlineGroup}>
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
        ) : (
          <>
            <Combobox.Input placeholder={placeholder} data-size={size} />
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
