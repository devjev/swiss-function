import type { Story } from "@ladle/react";
import { Checkbox } from "../Checkbox";
import { Input } from "../Input";
import { Switch } from "../Switch";
import { Field } from "./Field";

export const Stacked: Story = () => (
  <div style={{ width: "min(20rem, 100%)" }}>
    <Field>
      <Field.Label>Email</Field.Label>
      <Input type="email" placeholder="you@example.com" />
      <Field.Description>We'll only use it for important notifications.</Field.Description>
    </Field>
  </div>
);

export const Inline: Story = () => (
  <Field orientation="horizontal">
    <Checkbox />
    <Field.Label>I agree to the terms and conditions</Field.Label>
  </Field>
);

export const Required: Story = () => (
  <div style={{ width: "min(20rem, 100%)" }}>
    <Field required>
      <Field.Label>Username</Field.Label>
      <Input required placeholder="At least 3 characters" />
      <Field.Description>This will be your public handle.</Field.Description>
    </Field>
  </div>
);

export const WithError: Story = () => (
  <div style={{ width: "min(20rem, 100%)" }}>
    <Field required>
      <Field.Label>Email</Field.Label>
      <Input type="email" required placeholder="you@example.com" />
      <Field.Error>Email is required.</Field.Error>
    </Field>
    <p
      style={{
        marginTop: "calc(var(--sf-unit) / 2)",
        fontSize: "var(--sf-font-size-sm)",
        color: "var(--sf-color-fg)",
      }}
    >
      Focus the input then blur without typing to see the error appear.
    </p>
  </div>
);

export const Disabled: Story = () => (
  <div style={{ width: "min(20rem, 100%)" }}>
    <Field disabled>
      <Field.Label>Locked field</Field.Label>
      <Input placeholder="Can't touch this" />
      <Field.Description>You don't have permission to edit this.</Field.Description>
    </Field>
  </div>
);

export const MultipleControls: Story = () => (
  <div
    style={{
      width: "min(24rem, 100%)",
      display: "flex",
      flexDirection: "column",
      gap: "calc(var(--sf-unit) * 3 / 4)",
    }}
  >
    <Field required>
      <Field.Label>Display name</Field.Label>
      <Input required placeholder="Jane Doe" />
    </Field>
    <Field>
      <Field.Label>Email</Field.Label>
      <Input type="email" placeholder="jane@example.com" />
      <Field.Description>Used for sign-in and notifications.</Field.Description>
    </Field>
    <Field orientation="horizontal">
      <Switch />
      <Field.Label>Send weekly digest</Field.Label>
    </Field>
  </div>
);

/**
 * Issue #32: `hotkey` advertises a "jump to this field" shortcut with a `Kbd`
 * badge and tags the field with `data-hotkey`. The library binds no key — your
 * app's central hotkey system handles the press and calls `focusFieldHotkey(combo)`.
 */
export const JumpHotkey: Story = () => (
  <div style={{ width: "min(24rem, 100%)", display: "grid", gap: "var(--sf-unit)" }}>
    <Field hotkey="g u">
      <Field.Label>Username</Field.Label>
      <Input placeholder="jane.doe" />
    </Field>
    <Field hotkey="mod+e">
      <Field.Label>Email</Field.Label>
      <Input type="email" placeholder="you@example.com" />
    </Field>
  </div>
);
