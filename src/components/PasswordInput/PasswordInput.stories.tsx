import type { Story } from "@ladle/react";
import { Field } from "../Field";
import { PasswordInput } from "./PasswordInput";

export const Playground: Story = () => (
  <div style={{ maxWidth: "20rem" }}>
    <PasswordInput defaultValue="hunter2" />
  </div>
);

/** Dropped into a Field like any other control; the show/hide toggle is built in. */
export const InAField: Story = () => (
  <div style={{ maxWidth: "20rem" }}>
    <Field orientation="vertical">
      <Field.Label>Password</Field.Label>
      <PasswordInput />
      <Field.Description>At least 12 characters.</Field.Description>
    </Field>
  </div>
);

/** `defaultRevealed` starts in the shown state. */
export const StartRevealed: Story = () => (
  <div style={{ maxWidth: "20rem" }}>
    <PasswordInput defaultValue="visible" defaultRevealed />
  </div>
);
