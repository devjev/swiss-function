import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import { FieldLayout } from "../FieldLayout";
import { Input } from "../Input";
import { Form, FormError, FormField } from "./Form";

const frame = (children: React.ReactNode) => (
  <div style={{ width: "min(24rem, 100%)" }}>{children}</div>
);

/** The common case: stacked `FormField`s, a `resolver` for cross-field checks,
 *  and `onSubmit` receiving typed values only once everything validates. */
export const Basic: Story = () => {
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);
  return frame(
    <Form
      resolver={(values) => {
        const fields: Record<string, string> = {};
        if (!values.email) fields.email = "Email is required.";
        else if (!String(values.email).includes("@")) fields.email = "Enter a valid email.";
        if (!values.name) fields.name = "We need your name.";
        return { fields };
      }}
      onSubmit={(values) => setSubmitted(values)}
    >
      <FormField name="name" label="Full name">
        <Input placeholder="Jane Doe" />
      </FormField>
      <FormField name="email" label="Email" description="Used for sign-in and receipts.">
        <Input type="email" placeholder="jane@example.com" />
      </FormField>
      <Button type="submit">Create account</Button>
      {submitted ? (
        <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-fg)" }}>
          Submitted: {JSON.stringify(submitted)}
        </p>
      ) : null}
    </Form>,
  );
};

/** Per-field `validate` runs on blur (and re-runs on change after a submit). No
 *  resolver needed for single-field rules. */
export const PerFieldValidate: Story = () =>
  frame(
    <Form validationMode="onBlur" onSubmit={() => {}}>
      <FormField
        name="username"
        label="Username"
        validate={(value) => (String(value ?? "").length < 3 ? "At least 3 characters." : null)}
      >
        <Input placeholder="jane.doe" />
      </FormField>
      <FormField
        name="password"
        label="Password"
        validate={(value) => (String(value ?? "").length < 8 ? "Use at least 8 characters." : null)}
      >
        <Input type="password" placeholder="••••••••" />
      </FormField>
      <Button type="submit">Continue</Button>
    </Form>,
  );

/** A form-level message — a submit error that belongs to no single field.
 *  `FormError` reads it from the enclosing `Form` (here via the resolver's
 *  `form` output). Try `admin` / anything to pass. */
export const FormLevelError: Story = () =>
  frame(
    <Form
      resolver={(values) =>
        values.user === "admin" && values.pass === "letmein"
          ? null
          : { form: "Invalid credentials. Check your username and password." }
      }
      onSubmit={() => {}}
    >
      <FormError />
      <FormField name="user" label="Username">
        <Input placeholder="admin" />
      </FormField>
      <FormField name="pass" label="Password">
        <Input type="password" placeholder="letmein" />
      </FormField>
      <Button type="submit">Sign in</Button>
    </Form>,
  );

/** Composes with `FieldLayout` for justified multi-column rows: each cell holds
 *  a bound `FormField`, so binding + validation still flow through the form. */
export const WithFieldLayout: Story = () => (
  <div style={{ width: "min(40rem, 100%)" }}>
    <Form
      resolver={(values) => {
        const fields: Record<string, string> = {};
        if (!values.first) fields.first = "Required.";
        if (!values.last) fields.last = "Required.";
        return { fields };
      }}
      onSubmit={() => {}}
    >
      <FieldLayout padding={0}>
        <FieldLayout.Section>
          <FieldLayout.Field kind="flexible">
            <FormField name="first" label="First name">
              <Input placeholder="Jane" />
            </FormField>
          </FieldLayout.Field>
          <FieldLayout.Field kind="flexible">
            <FormField name="last" label="Last name">
              <Input placeholder="Doe" />
            </FormField>
          </FieldLayout.Field>
        </FieldLayout.Section>
        <FieldLayout.Section>
          <FieldLayout.Field kind="prose">
            <FormField name="email" label="Email">
              <Input type="email" placeholder="jane@example.com" />
            </FormField>
          </FieldLayout.Field>
        </FieldLayout.Section>
      </FieldLayout>
      <FormField name="terms" orientation="horizontal" label="I accept the terms">
        <Checkbox />
      </FormField>
      <Button type="submit">Submit</Button>
    </Form>
  </div>
);
