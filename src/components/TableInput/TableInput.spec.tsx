import { expect, test } from "@playwright/experimental-ct-react";
import { TableInputHarness } from "./TableInput.harness";

test("add row appends a blank row", async ({ mount }) => {
  const c = await mount(<TableInputHarness />);
  await expect(c.getByRole("button", { name: "Delete row" })).toHaveCount(2);
  await c.getByRole("button", { name: "Add row" }).click();
  await expect(c.getByRole("button", { name: "Delete row" })).toHaveCount(3);
});

test("delete removes that row", async ({ mount }) => {
  const c = await mount(<TableInputHarness />);
  await c.getByRole("button", { name: "Delete row" }).first().click();
  await expect(c.getByRole("button", { name: "Delete row" })).toHaveCount(1);
  // The remaining row is the second one.
  await expect(c.getByTestId("rows")).toHaveText("Second");
});

test("editing a text cell writes back to the row", async ({ mount }) => {
  const c = await mount(<TableInputHarness />);
  const firstText = c.locator("textarea").first();
  await firstText.fill("Renamed");
  await expect(c.getByTestId("rows")).toHaveText("Renamed|Second");
});

test("minRows disables delete at the floor", async ({ mount }) => {
  const c = await mount(<TableInputHarness minRows={2} />);
  const deletes = c.getByRole("button", { name: "Delete row" });
  await expect(deletes.first()).toBeDisabled();
  await expect(deletes.nth(1)).toBeDisabled();
});

test("maxRows disables add at the ceiling", async ({ mount }) => {
  const c = await mount(<TableInputHarness maxRows={2} />);
  await expect(c.getByRole("button", { name: "Add row" })).toBeDisabled();
});

test("keyboard reorder moves a row via the drag handle", async ({ mount, page }) => {
  const c = await mount(<TableInputHarness reorderable />);
  await expect(c.getByTestId("rows")).toHaveText("First|Second");
  const handle = c.getByRole("button", { name: "Drag to reorder" }).first();
  await handle.focus();
  // dnd-kit keyboard sensor: Space picks up, ArrowDown moves, Space drops. It
  // measures between keystrokes, so pace them.
  await page.keyboard.press("Space");
  await page.waitForTimeout(80);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  await page.keyboard.press("Space");
  await expect(c.getByTestId("rows")).toHaveText("Second|First");
});
