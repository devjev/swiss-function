import { useState } from "react";
import { Selector, type SelectorItem, type SelectorProps } from "./Selector";

const defaultItems = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

/**
 * Stateful wrapper for CT specs: drives `Selector` as a controlled component
 * and forwards every value change to `onChange` so tests can assert on it.
 */
export function SelectorHarness({
  items = defaultItems,
  initial = [],
  onChange,
  ...rest
}: Partial<Omit<SelectorProps, "value" | "defaultValue" | "items" | "onChange">> & {
  items?: SelectorItem[];
  initial?: string[];
  onChange?: (value: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <Selector
      {...rest}
      items={items}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}
