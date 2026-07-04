import { useState } from "react";
import { Input } from "../Input";
import { Field } from "./Field";

/** CT harness for the adaptive Field.Help: a width-switchable container so
 *  specs can flip the field across its `helpAt` threshold live (the resize
 *  path exercises the ResizeObserver, not just initial measurement). */
export function FieldHelpHarness({
  initialWidth = 720,
  narrowWidth = 320,
  orientation,
}: {
  initialWidth?: number;
  narrowWidth?: number;
  orientation?: "vertical" | "horizontal";
}) {
  const [narrow, setNarrow] = useState(false);
  return (
    <div>
      <div data-testid="sizer" style={{ inlineSize: narrow ? narrowWidth : initialWidth }}>
        <Field orientation={orientation} data-testid="field">
          <Field.Label>Tax rate</Field.Label>
          <Input aria-label="Tax rate input" />
          <Field.Help>Applied after discounts; overridable per line item.</Field.Help>
        </Field>
      </div>
      <button type="button" onClick={() => setNarrow((n) => !n)}>
        Toggle width
      </button>
    </div>
  );
}
