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

/** Field.Help adapts to the field's own width: beside the control when there's
 *  room, a "?" tooltip after the label when tight (threshold = `helpAt`,
 *  default 24 units). The text is written once and stays screen-reader-
 *  associated with the control in both modes. */
export const WithHelp: Story = () => (
  <div style={{ display: "flex", gap: "calc(var(--sf-unit) * 2)", alignItems: "start" }}>
    <div style={{ inlineSize: 640 }}>
      <Field>
        <Field.Label>Tax rate</Field.Label>
        <Input placeholder="21.0" />
        <Field.Help>Applied after discounts; overridable per line item.</Field.Help>
      </Field>
    </div>
    <div style={{ inlineSize: 260 }}>
      <Field>
        <Field.Label>Tax rate</Field.Label>
        <Input placeholder="21.0" />
        <Field.Help>Applied after discounts; overridable per line item.</Field.Help>
      </Field>
    </div>
  </div>
);

/** Drag the container's corner across ~576px to watch the help flip between
 *  the side column and the "?" trigger. */
export const HelpResizable: Story = () => (
  <div
    style={{
      inlineSize: 640,
      minInlineSize: 220,
      maxInlineSize: 880,
      resize: "horizontal",
      overflow: "auto",
      paddingBlockEnd: "var(--sf-space-4)",
    }}
  >
    <Field>
      <Field.Label>Tax rate</Field.Label>
      <Input placeholder="21.0" />
      <Field.Help>Applied after discounts; overridable per line item.</Field.Help>
    </Field>
  </div>
);

/** Help in a horizontal field: end of the row when wide, trigger when tight. */
export const HorizontalWithHelp: Story = () => (
  <Field orientation="horizontal" style={{ maxInlineSize: 640 }}>
    <Field.Label>Weekly digest</Field.Label>
    <Switch />
    <Field.Help>Sent Mondays at 9:00 in your local timezone.</Field.Help>
  </Field>
);
