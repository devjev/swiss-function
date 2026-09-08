import { useState } from "react";
import { Field } from "../Field";
import { Knob, type KnobProps } from "./Knob";

interface HarnessProps extends Omit<KnobProps, "value" | "defaultValue" | "onValueChange"> {
  initialValue?: number;
  /** Wrap the knob in a labelled `Field`. */
  label?: string;
}

export function KnobHarness({ initialValue = 40, label, ...rest }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  const [commits, setCommits] = useState(0);
  const knob = (
    <Knob
      value={value}
      onValueChange={setValue}
      onValueCommitted={() => setCommits((n) => n + 1)}
      {...rest}
    />
  );
  return (
    <div style={{ padding: 40 }}>
      {label ? (
        <Field orientation="vertical">
          <Field.Label>{label}</Field.Label>
          {knob}
        </Field>
      ) : (
        knob
      )}
      <div data-testid="value">{value}</div>
      <div data-testid="commits">{commits}</div>
    </div>
  );
}
