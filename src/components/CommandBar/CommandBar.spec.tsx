import { expect, test } from "@playwright/experimental-ct-react";
import { CommandBarHarness } from "./CommandBar.harness";

test("renders the bar with all top-level triggers", async ({ mount }) => {
  const component = await mount(<CommandBarHarness />);
  await expect(component.getByRole("menuitem", { name: "File" })).toBeVisible();
  await expect(component.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(component.getByRole("menuitem", { name: "View" })).toBeVisible();
});

test("clicking a trigger opens its menu and sets data-popup-open", async ({ mount, page }) => {
  const component = await mount(<CommandBarHarness />);
  const fileTrigger = component.getByRole("menuitem", { name: "File" });
  await fileTrigger.click();
  await expect(fileTrigger).toHaveAttribute("data-popup-open", "");
  // "New" is an item inside the opened File menu.
  await expect(page.getByRole("menuitem", { name: "New" })).toBeVisible();
});

test("Escape closes the menu", async ({ mount, page }) => {
  const component = await mount(<CommandBarHarness />);
  await component.getByRole("menuitem", { name: "File" }).click();
  await expect(page.getByRole("menuitem", { name: "New" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "New" })).toHaveCount(0);
});

test("clicking an item fires onClick and closes the menu", async ({ mount, page }) => {
  let last = "";
  const component = await mount(
    <CommandBarHarness
      onClickItem={(id) => {
        last = id;
      }}
    />,
  );
  await component.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "New" }).click();
  expect(last).toBe("new");
  await expect(page.getByRole("menuitem", { name: "New" })).toHaveCount(0);
});

test("shortcut text renders right-aligned", async ({ mount, page }) => {
  const component = await mount(<CommandBarHarness />);
  await component.getByRole("menuitem", { name: "File" }).click();
  await expect(page.getByText("⌘N")).toBeVisible();
});

test("position='bottom' puts the border on the top edge", async ({ mount }) => {
  // The mounted component itself is the bar div; assert via computed style.
  const component = await mount(<CommandBarHarness position="bottom" />);
  const topBorder = await component.evaluate((el) => getComputedStyle(el).borderTopWidth);
  const bottomBorder = await component.evaluate((el) => getComputedStyle(el).borderBottomWidth);
  expect(topBorder).toBe("1px");
  expect(bottomBorder).toBe("0px");
});
