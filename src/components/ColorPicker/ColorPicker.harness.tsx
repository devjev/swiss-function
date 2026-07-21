import { useState } from "react";
import { ColorPicker, type ColorPickerProps } from "./ColorPicker";

interface HarnessProps {
  initialValue?: string;
  pickerProps?: Partial<ColorPickerProps>;
}

export function ColorPickerHarness({ initialValue = "#3b82f6", pickerProps }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <div>
      <ColorPicker value={value} onChange={setValue} {...pickerProps} />
      <div data-testid="value">{value}</div>
    </div>
  );
}
