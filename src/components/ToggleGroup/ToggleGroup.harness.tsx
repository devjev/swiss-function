import { useState } from "react";
import { ToggleGroup } from "./ToggleGroup";

interface HarnessProps {
  multiple?: boolean;
  initialValue?: string[];
  disabled?: boolean;
  disabledItem?: string;
}

export function ToggleGroupHarness({
  multiple,
  initialValue = [],
  disabled,
  disabledItem,
}: HarnessProps) {
  const [value, setValue] = useState<string[]>(initialValue);
  return (
    <div>
      <ToggleGroup
        multiple={multiple}
        value={value}
        onValueChange={(v) => setValue(v as string[])}
        disabled={disabled}
      >
        <ToggleGroup.Item value="list" disabled={disabledItem === "list"}>
          List
        </ToggleGroup.Item>
        <ToggleGroup.Item value="grid" disabled={disabledItem === "grid"}>
          Grid
        </ToggleGroup.Item>
        <ToggleGroup.Item value="table" disabled={disabledItem === "table"}>
          Table
        </ToggleGroup.Item>
      </ToggleGroup>
      <div data-testid="value">{value.join(",")}</div>
    </div>
  );
}
