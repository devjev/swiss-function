import { expect, test } from "@playwright/experimental-ct-react";
import { ToolbarHarness } from "./Toolbar.harness";

test("wide: controls show in the row, no hamburger", async ({ mount }) => {
  const c = await mount(<ToolbarHarness width={1000} />);
  await expect(c.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(c.getByRole("switch")).toBeVisible();
  await expect(c.getByRole("button", { name: "Menu" })).toHaveCount(0);
});

test("narrow: controls collapse behind a hamburger", async ({ mount }) => {
  const c = await mount(<ToolbarHarness width={360} />);
  await expect(c.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(c.getByRole("switch")).toHaveCount(0);
});

test("narrow: opening the panel shows the controls; they stay interactive", async ({
  mount,
  page,
}) => {
  const c = await mount(<ToolbarHarness width={360} />);
  await c.getByRole("button", { name: "Menu" }).click();
  // The panel is portaled to <body>, outside the component locator.
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  const sw = page.getByRole("switch");
  await expect(sw).toBeVisible();
  await sw.click();
  await expect(c.getByTestId("on")).toHaveText("true");
});
