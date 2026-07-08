import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Form, FormError, FormField } from "./Form";
import { FormLevelErrorHarness, FormPerFieldHarness, FormResolverHarness } from "./Form.harness";

test("submits collected values by field name when valid", async ({ mount }) => {
  let received: Record<string, unknown> | null = null;
  const form = await mount(
    <Form
      onSubmit={(values) => {
        received = values;
      }}
    >
      <FormField name="email" label="Email">
        <Input type="email" />
      </FormField>
      <Button type="submit">Go</Button>
    </Form>,
  );
  await form.getByLabel("Email").fill("jane@example.com");
  await form.getByRole("button", { name: "Go" }).click();
  await expect.poll(() => received).toEqual({ email: "jane@example.com" });
});

test("a resolver blocks submit and surfaces a field error, then lets a valid submit through", async ({
  mount,
}) => {
  const el = await mount(<FormResolverHarness />);
  // Empty → blocked with the required message.
  await el.getByRole("button", { name: "Go" }).click();
  await expect(el.getByText("Email is required.")).toBeVisible();
  await expect(el.getByTestId("submitted")).toHaveText("none");

  // Present but malformed → a different message, still blocked.
  await el.getByLabel("Email").fill("nope");
  await el.getByRole("button", { name: "Go" }).click();
  await expect(el.getByText("Enter a valid email.")).toBeVisible();
  await expect(el.getByTestId("submitted")).toHaveText("none");

  // Valid → submits with the collected values.
  await el.getByLabel("Email").fill("jane@example.com");
  await el.getByRole("button", { name: "Go" }).click();
  await expect(el.getByTestId("submitted")).toHaveText('{"email":"jane@example.com"}');
});

test("FormError surfaces the resolver's form-level message until the form is valid", async ({
  mount,
}) => {
  const el = await mount(<FormLevelErrorHarness />);
  await expect(el.getByRole("alert")).toHaveCount(0);

  await el.getByRole("button", { name: "Sign in" }).click();
  await expect(el.getByRole("alert")).toHaveText("Invalid credentials.");
  await expect(el.getByTestId("ok")).toHaveText("no");

  await el.getByLabel("User").fill("admin");
  await el.getByRole("button", { name: "Sign in" }).click();
  await expect(el.getByRole("alert")).toHaveCount(0);
  await expect(el.getByTestId("ok")).toHaveText("yes");
});

test("per-field validate reports an error on blur and clears when fixed", async ({ mount }) => {
  const el = await mount(<FormPerFieldHarness />);
  const input = el.getByLabel("Username");
  await input.fill("ab");
  await input.blur();
  await expect(el.getByText("Too short.")).toBeVisible();
  await input.fill("abcd");
  await input.blur();
  await expect(el.getByText("Too short.")).toHaveCount(0);
});

test("consolidated server errors render in the bound field", async ({ mount }) => {
  const form = await mount(
    <Form errors={{ email: "That address is taken." }} onSubmit={() => {}}>
      <FormField name="email" label="Email">
        <Input type="email" />
      </FormField>
    </Form>,
  );
  await expect(form.getByText("That address is taken.")).toBeVisible();
});

test("FormError with explicit children shows regardless of form state", async ({ mount }) => {
  const form = await mount(
    <Form onSubmit={() => {}}>
      <FormError>Something went wrong.</FormError>
      <FormField name="x" label="X">
        <Input />
      </FormField>
    </Form>,
  );
  await expect(form.getByRole("alert")).toHaveText("Something went wrong.");
});
