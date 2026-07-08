import { useState } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Form, FormError, FormField } from "./Form";

/** Playwright CT runs callback *props* in Node, so a `resolver`/`validate`
 *  passed as a prop never returns its value back into the browser. These
 *  harnesses keep all validation logic in-browser and surface the outcome to
 *  the DOM, so the spec exercises the real submit + error flow end to end. */

/** Cross-field resolver drives per-field errors and gates onSubmit. */
export function FormResolverHarness() {
  const [submitted, setSubmitted] = useState("none");
  return (
    <Form
      resolver={(values) => {
        const fields: Record<string, string> = {};
        if (!values.email) {
          fields.email = "Email is required.";
        } else if (!String(values.email).includes("@")) {
          fields.email = "Enter a valid email.";
        }
        return Object.keys(fields).length ? { fields } : null;
      }}
      onSubmit={(values) => setSubmitted(JSON.stringify(values))}
    >
      {/* Plain text input: the resolver (not the browser's native email
          constraint) owns format validation, so both resolver branches are
          reachable. */}
      <FormField name="email" label="Email">
        <Input />
      </FormField>
      <Button type="submit">Go</Button>
      <span data-testid="submitted">{submitted}</span>
    </Form>
  );
}

/** Per-field validate on blur — the message renders straight from the field. */
export function FormPerFieldHarness() {
  return (
    <Form validationMode="onBlur" onSubmit={() => {}}>
      <FormField
        name="username"
        label="Username"
        validate={(value) => (String(value ?? "").length < 3 ? "Too short." : null)}
      >
        <Input />
      </FormField>
      <Button type="submit">Go</Button>
    </Form>
  );
}

/** Resolver reports a form-level message; FormError surfaces it. */
export function FormLevelErrorHarness() {
  const [ok, setOk] = useState("no");
  return (
    <Form
      resolver={(values) => (values.user === "admin" ? null : { form: "Invalid credentials." })}
      onSubmit={() => setOk("yes")}
    >
      <FormError />
      <FormField name="user" label="User">
        <Input />
      </FormField>
      <Button type="submit">Sign in</Button>
      <span data-testid="ok">{ok}</span>
    </Form>
  );
}
