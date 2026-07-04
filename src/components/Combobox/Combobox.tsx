import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Combobox.module.css";

const Root = BaseCombobox.Root;
const Portal = BaseCombobox.Portal;
const Empty = BaseCombobox.Empty;
const List = BaseCombobox.List;
// Renders no element of its own — pass-through.
const Value = BaseCombobox.Value;
// Hook: the internally filtered items (for externally virtualized lists).
const useFilteredItems = BaseCombobox.useFilteredItems;

const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof BaseCombobox.Input>>(
  function ComboboxInput({ className, ...rest }, ref) {
    return (
      <BaseCombobox.Input {...rest} ref={ref} className={mergeClassName(styles.input, className)} />
    );
  },
);

// The positioner establishes the popup's stacking context (Base UI applies a
// `transform`), so its own z-index — not the popup's — is what stacks against
// page content like a DataTable's sticky header. Carry the dropdown z-index
// here so the popup reliably paints above such content (fixes issue #2).
const Positioner = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseCombobox.Positioner>
>(function ComboboxPositioner({ className, ...rest }, ref) {
  return (
    <BaseCombobox.Positioner
      {...rest}
      ref={ref}
      className={mergeClassName(styles.positioner, className)}
    />
  );
});

// Wrapper for the input plus its chips/controls. In multi-select, the chips
// live inside this group (inline/tag-input layout) and the border moves here.
const InputGroup = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseCombobox.InputGroup>
>(function ComboboxInputGroup({ className, ...rest }, ref) {
  return (
    <BaseCombobox.InputGroup
      {...rest}
      ref={ref}
      className={mergeClassName(styles.inputGroup, className)}
    />
  );
});

// Container for the selected-value chips. Map the selected values into a
// `Chip` each — `ChipRemove` removes by the chip's position in the value array.
const Chips = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseCombobox.Chips>>(
  function ComboboxChips({ className, ...rest }, ref) {
    return (
      <BaseCombobox.Chips {...rest} ref={ref} className={mergeClassName(styles.chips, className)} />
    );
  },
);

const Chip = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseCombobox.Chip>>(
  function ComboboxChip({ className, ...rest }, ref) {
    return (
      <BaseCombobox.Chip {...rest} ref={ref} className={mergeClassName(styles.chip, className)} />
    );
  },
);

const ChipRemove = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof BaseCombobox.ChipRemove>
>(function ComboboxChipRemove({ className, ...rest }, ref) {
  return (
    <BaseCombobox.ChipRemove
      {...rest}
      ref={ref}
      className={mergeClassName(styles.chipRemove, className)}
    />
  );
});

// Clears all selected values when clicked.
const Clear = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof BaseCombobox.Clear>>(
  function ComboboxClear({ className, ...rest }, ref) {
    return (
      <BaseCombobox.Clear {...rest} ref={ref} className={mergeClassName(styles.clear, className)} />
    );
  },
);

// Checkmark shown on the selected items inside the dropdown list.
const ItemIndicator = forwardRef<
  HTMLSpanElement,
  ComponentPropsWithoutRef<typeof BaseCombobox.ItemIndicator>
>(function ComboboxItemIndicator({ className, ...rest }, ref) {
  return (
    <BaseCombobox.ItemIndicator
      {...rest}
      ref={ref}
      className={mergeClassName(styles.itemIndicator, className)}
    />
  );
});

const Popup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseCombobox.Popup>>(
  function ComboboxPopup({ className, ...rest }, ref) {
    return (
      <BaseCombobox.Popup {...rest} ref={ref} className={mergeClassName(styles.popup, className)} />
    );
  },
);

const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseCombobox.Item>>(
  function ComboboxItem({ className, ...rest }, ref) {
    return (
      <BaseCombobox.Item {...rest} ref={ref} className={mergeClassName(styles.item, className)} />
    );
  },
);

export const Combobox = {
  Root,
  Input,
  InputGroup,
  Portal,
  Positioner,
  Popup,
  List,
  Item,
  ItemIndicator,
  Empty,
  Value,
  Chips,
  Chip,
  ChipRemove,
  Clear,
  useFilteredItems,
};
