import { expect, test } from "@playwright/experimental-ct-react";
import { Checkbox } from "../Checkbox";
import { Input } from "../Input";
import { Field } from "./Field";
import { FieldHotkeyHarness } from "./Field.harness";

test("Label is associated with the control via htmlFor", async ({ mount }) => {
  const c = await mount(
    <Field>
      <Field.Label>Email</Field.Label>
      <Input />
    </Field>,
  );
  const labelFor = await c.locator("label").getAttribute("for");
  const inputId = await c.locator("input").getAttribute("id");
  expect(labelFor).toBeTruthy();
  expect(labelFor).toBe(inputId);
});

test("Description is wired via aria-describedby on the control", async ({ mount }) => {
  const c = await mount(
    <Field>
      <Field.Label>Email</Field.Label>
      <Input />
      <Field.Description>Helper text.</Field.Description>
    </Field>,
  );
  const describedBy = await c.locator("input").getAttribute("aria-describedby");
  const descId = await c.getByText("Helper text.").getAttribute("id");
  expect(describedBy).toBeTruthy();
  expect(describedBy).toBe(descId);
});

test("clicking the label focuses the control", async ({ mount }) => {
  const c = await mount(
    <Field>
      <Field.Label>Click me</Field.Label>
      <Input />
    </Field>,
  );
  await c.locator("label").click();
  await expect(c.locator("input")).toBeFocused();
});

test("required adds * to the label", async ({ mount, page }) => {
  await mount(
    <Field required>
      <Field.Label>Name</Field.Label>
      <Input required />
    </Field>,
  );
  // The * is rendered via ::after on the label; assert via computed style.
  const content = await page.locator("label").evaluate((el) => {
    return getComputedStyle(el, "::after").getPropertyValue("content");
  });
  expect(content).toContain("*");
});

test("disabled cascades data-disabled to root and disables the control", async ({ mount }) => {
  const c = await mount(
    <Field disabled>
      <Field.Label>Locked</Field.Label>
      <Input />
    </Field>,
  );
  // The mounted locator IS the FieldRoot element.
  await expect(c).toHaveAttribute("data-disabled", "");
  await expect(c.locator("input")).toBeDisabled();
});

test('orientation="horizontal" lays out as a row', async ({ mount }) => {
  const c = await mount(
    <Field orientation="horizontal">
      <Checkbox />
      <Field.Label>Inline</Field.Label>
    </Field>,
  );
  await expect(c).toHaveAttribute("data-orientation", "horizontal");
  const direction = await c.evaluate((el) => getComputedStyle(el).flexDirection);
  expect(direction).toBe("row");
});

// --- Issue #32: jump-to-field hotkey ----------------------------------------

test("hotkey shows a Kbd badge and tags the field with data-hotkey", async ({ mount }) => {
  const c = await mount(
    <Field hotkey="mod+u">
      <Field.Label>Username</Field.Label>
      <Input />
    </Field>,
  );
  await expect(c).toHaveAttribute("data-hotkey", "mod+u");
  // The Kbd badge renders the chord as keycaps (mod + u).
  await expect(c.locator("kbd")).toHaveCount(2);
});

test("focusFieldHotkey jumps focus into the matching field's control", async ({ mount }) => {
  // The button plays the consumer's central hotkey handler: it calls the
  // library helper, which runs in the browser against the live document. The
  // result is surfaced to the DOM so we assert both the return value and focus.
  const c = await mount(<FieldHotkeyHarness />);
  await c.getByRole("button", { name: "jump" }).click();
  await expect(c.getByTestId("result")).toHaveText("true");
  await expect(c.getByLabel("Password")).toBeFocused();
});
