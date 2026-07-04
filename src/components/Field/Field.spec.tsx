import { expect, test } from "@playwright/experimental-ct-react";
import { Checkbox } from "../Checkbox";
import { Input } from "../Input";
import { Field } from "./Field";
import { FieldHelpHarness } from "./Field.harness";

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

/* --- Adaptive help (Field.Help) --- */

const HELP_TEXT = "Applied after discounts; overridable per line item.";

function helpField(width: number, extra?: React.ReactNode) {
  return (
    <div style={{ inlineSize: width }}>
      <Field>
        <Field.Label>Tax rate</Field.Label>
        <Input aria-label="Rate" />
        <Field.Help>{HELP_TEXT}</Field.Help>
        {extra}
      </Field>
    </div>
  );
}

test("help: wide fields render the text inline beside the control, wired via describedby", async ({
  mount,
}) => {
  const c = await mount(helpField(720));
  await expect(c.locator("[data-help]")).toHaveAttribute("data-help", "inline");
  const text = c.getByText(HELP_TEXT);
  await expect(text).toBeVisible();
  const describedBy = await c.getByLabel("Rate").getAttribute("aria-describedby");
  const helpId = await text.getAttribute("id");
  expect(helpId).toBeTruthy();
  expect(describedBy?.split(" ")).toContain(helpId);
  // Beside, not below: help's box starts right of the input's box.
  const inputBox = await c.getByLabel("Rate").boundingBox();
  const textBox = await text.boundingBox();
  if (!inputBox || !textBox) throw new Error("missing bounding boxes");
  expect(textBox.x).toBeGreaterThan(inputBox.x + inputBox.width - 1);
});

test("help: narrow fields collapse to a ? trigger; the text stays in the a11y tree", async ({
  mount,
}) => {
  const c = await mount(helpField(320));
  await expect(c.locator("[data-help]")).toHaveAttribute("data-help", "trigger");
  await expect(c.getByRole("button", { name: "Show help" })).toBeVisible();
  // sr-only, not removed: still attached with a degenerate box…
  const text = c.getByText(HELP_TEXT);
  await expect(text).toBeAttached();
  const box = await text.boundingBox();
  if (!box) throw new Error("missing bounding box");
  expect(box.width).toBeLessThanOrEqual(1);
  // …and still describing the control.
  const describedBy = await c.getByLabel("Rate").getAttribute("aria-describedby");
  const helpId = await text.getAttribute("id");
  expect(describedBy?.split(" ")).toContain(helpId);
});

test("help: trigger sits right after the label text, before the control row", async ({ mount }) => {
  const c = await mount(helpField(320));
  const label = c.locator("label");
  const trigger = c.getByRole("button", { name: "Show help" });
  const lb = await label.boundingBox();
  const tb = await trigger.boundingBox();
  const ib = await c.getByLabel("Rate").boundingBox();
  if (!lb || !tb || !ib) throw new Error("missing bounding boxes");
  expect(tb.x).toBeGreaterThan(lb.x + lb.width - 2); // after the text
  expect(tb.x).toBeLessThan(lb.x + lb.width + 30); // hugging, not flushed right
  expect(tb.y + tb.height).toBeLessThanOrEqual(ib.y + 2); // above the control
});

test("help: hover opens the tooltip", async ({ mount, page }) => {
  const c = await mount(helpField(320));
  await c.getByRole("button", { name: "Show help" }).hover();
  await expect(page.getByText(HELP_TEXT).nth(1)).toBeVisible({ timeout: 3000 });
});

test("help: keyboard focus opens instantly; Escape closes", async ({ mount, page }) => {
  const c = await mount(helpField(320));
  // Real keyboard focus (Base UI's focus-open is keyboard-visible-only):
  // Tab to the input, then to the trigger (DOM order: control before help).
  await page.keyboard.press("Tab");
  await expect(c.getByLabel("Rate")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(c.getByRole("button", { name: "Show help" })).toBeFocused();
  await expect(page.getByText(HELP_TEXT).nth(1)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(HELP_TEXT).nth(1)).toHaveCount(0);
});

test("help: click/tap opens (the touch path Base UI lacks natively)", async ({ mount, page }) => {
  const c = await mount(helpField(320));
  await c.getByRole("button", { name: "Show help" }).click();
  await expect(page.getByText(HELP_TEXT).nth(1)).toBeVisible();
});

test("help: label click still focuses the control with the trigger present", async ({ mount }) => {
  const c = await mount(helpField(320));
  await c.locator("label").click();
  await expect(c.getByLabel("Rate")).toBeFocused();
});

test("help: coexists with Field.Description — both ids in describedby", async ({ mount }) => {
  const c = await mount(helpField(720, <Field.Description>Permanent note.</Field.Description>));
  const describedBy = await c.getByLabel("Rate").getAttribute("aria-describedby");
  const ids = describedBy?.split(" ") ?? [];
  expect(ids.length).toBeGreaterThanOrEqual(2);
  const helpId = await c.getByText(HELP_TEXT).getAttribute("id");
  const descId = await c.getByText("Permanent note.").getAttribute("id");
  expect(ids).toContain(helpId);
  expect(ids).toContain(descId);
});

test("help: horizontal orientation — inline at the row end when wide, trigger when narrow", async ({
  mount,
}) => {
  const wide = await mount(
    <div style={{ inlineSize: 720 }}>
      <Field orientation="horizontal">
        <Field.Label>Rate</Field.Label>
        <Input aria-label="Rate" style={{ inlineSize: 120 }} />
        <Field.Help>{HELP_TEXT}</Field.Help>
      </Field>
    </div>,
  );
  await expect(wide.locator("[data-help]")).toHaveAttribute("data-help", "inline");
  await expect(wide.getByText(HELP_TEXT)).toBeVisible();
  await wide.unmount();

  const narrow = await mount(
    <div style={{ inlineSize: 300 }}>
      <Field orientation="horizontal">
        <Field.Label>Rate</Field.Label>
        <Input aria-label="Rate" style={{ inlineSize: 120 }} />
        <Field.Help>{HELP_TEXT}</Field.Help>
      </Field>
    </div>,
  );
  await expect(narrow.locator("[data-help]")).toHaveAttribute("data-help", "trigger");
  await expect(narrow.getByRole("button", { name: "Show help" })).toBeVisible();
});

test("help: resizing the container flips modes live", async ({ mount }) => {
  const c = await mount(<FieldHelpHarness />);
  const field = c.getByTestId("field");
  await expect(field).toHaveAttribute("data-help", "inline");

  // A PURE DOM resize (what a drag / window / pane resize actually is — no
  // React re-render involved). This is the case that regressed when the
  // ResizeObserver was installed from a mount-time effect while the ref was
  // still detached: the initial measure was right, but drags never fired.
  const sizer = c.getByTestId("sizer");
  await sizer.evaluate((el) => {
    (el as HTMLElement).style.inlineSize = "320px";
  });
  await expect(field).toHaveAttribute("data-help", "trigger");
  await sizer.evaluate((el) => {
    (el as HTMLElement).style.inlineSize = "720px";
  });
  await expect(field).toHaveAttribute("data-help", "inline");

  // The React re-render path still works too.
  await c.getByRole("button", { name: "Toggle width" }).click();
  await expect(field).toHaveAttribute("data-help", "trigger");
});
