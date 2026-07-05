import { useState } from "react";
import { focusFieldHotkey } from "../../lib/focusFieldHotkey";
import { Input } from "../Input";
import { Field } from "./Field";

/** Playwright CT only mounts imported components, so the jump-to-field spec
 *  drives the `focusFieldHotkey` helper through this stateful harness. The
 *  button plays a consumer's central hotkey handler; the result is surfaced to
 *  the DOM so the spec asserts both the return value and the moved focus. */
export function FieldHotkeyHarness() {
  const [result, setResult] = useState("idle");
  return (
    <div>
      <button type="button" onClick={() => setResult(String(focusFieldHotkey("g p")))}>
        jump
      </button>
      <span data-testid="result">{result}</span>
      <Field hotkey="g u">
        <Field.Label>Username</Field.Label>
        <Input aria-label="Username" />
      </Field>
      <Field hotkey="g p">
        <Field.Label>Password</Field.Label>
        <Input aria-label="Password" />
      </Field>
    </div>
  );
}
