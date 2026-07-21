import { useState } from "react";
import { Slider, type SliderValue } from "./Slider";

interface HarnessProps {
  initialValue?: SliderValue;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function SliderHarness({ initialValue = 40, ...rest }: HarnessProps) {
  const [value, setValue] = useState<SliderValue>(initialValue);
  return (
    <div>
      <Slider value={value} onValueChange={setValue} {...rest} />
      <div data-testid="value">{JSON.stringify(value)}</div>
    </div>
  );
}
