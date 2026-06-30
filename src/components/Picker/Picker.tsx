import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useMemo, useState } from "react";
import { cx } from "../../lib/cx";
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
}

function normalize(item: PickerItem): PickerOption {
  return typeof item === "string" ? { value: item, label: item } : item;
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

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <Combobox.Root
        items={options}
        value={selectedOption}
        onValueChange={(next: PickerOption | null) => setSelected(next?.value ?? "")}
        disabled={disabled}
      >
        <Combobox.InputGroup data-size={size} className={styles.group}>
          <Combobox.Input placeholder={placeholder} />
          {clearable && selected && <Combobox.Clear aria-label="Clear">×</Combobox.Clear>}
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4}>
            <Combobox.Popup>
              <Combobox.Empty>
                <div className={styles.empty}>{emptyMessage}</div>
              </Combobox.Empty>
              <Combobox.List>
                {(option: PickerOption) => (
                  <Combobox.Item key={option.value} value={option}>
                    <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                    {option.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
});
