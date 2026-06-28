import { expect, test } from "@playwright/experimental-ct-react";
import { MenuBarCollapseHarness, MenuBarHarness, MenuBarOverflowHarness } from "./MenuBar.harness";

test("renders the bar with all top-level triggers", async ({ mount }) => {
  const component = await mount(<MenuBarHarness />);
  await expect(component.getByRole("menuitem", { name: "File" })).toBeVisible();
  await expect(component.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(component.getByRole("menuitem", { name: "View" })).toBeVisible();
});

test("clicking a trigger opens its menu and sets data-popup-open", async ({ mount, page }) => {
  const component = await mount(<MenuBarHarness />);
  const fileTrigger = component.getByRole("menuitem", { name: "File" });
  await fileTrigger.click();
  await expect(fileTrigger).toHaveAttribute("data-popup-open", "");
  // "New" is an item inside the opened File menu.
  await expect(page.getByRole("menuitem", { name: "New" })).toBeVisible();
});

test("Escape closes the menu", async ({ mount, page }) => {
  const component = await mount(<MenuBarHarness />);
  await component.getByRole("menuitem", { name: "File" }).click();
  await expect(page.getByRole("menuitem", { name: "New" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "New" })).toHaveCount(0);
});

test("clicking an item fires onClick and closes the menu", async ({ mount, page }) => {
  let last = "";
  const component = await mount(
    <MenuBarHarness
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
  const component = await mount(<MenuBarHarness />);
  await component.getByRole("menuitem", { name: "File" }).click();
  await expect(page.getByText("⌘N")).toBeVisible();
});

test("Logo + Search slots render; Search sits right of all menu triggers", async ({ mount }) => {
  const component = await mount(<MenuBarHarness withSlots />);
  await expect(component.getByText("Brand")).toBeVisible();
  const search = component.getByPlaceholder("Find…");
  await expect(search).toBeVisible();
  // Search's left edge should be past the right edge of the last menu trigger.
  const searchX = await search.evaluate((el) => el.getBoundingClientRect().left);
  const lastTriggerRight = await component
    .getByRole("menuitem", { name: "View" })
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(searchX).toBeGreaterThan(lastTriggerRight);
});

test("position='bottom' puts the border on the top edge", async ({ mount }) => {
  // The mounted component itself is the bar div; assert via computed style.
  const component = await mount(<MenuBarHarness position="bottom" />);
  const topBorder = await component.evaluate((el) => getComputedStyle(el).borderTopWidth);
  const bottomBorder = await component.evaluate((el) => getComputedStyle(el).borderBottomWidth);
  expect(topBorder).toBe("1px");
  expect(bottomBorder).toBe("0px");
});

// --- Opt-in responsive collapse (ported from Toolbar) ------------------

test("wide: controls show in the row, no hamburger", async ({ mount }) => {
  const c = await mount(<MenuBarCollapseHarness width={1000} />);
  await expect(c.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(c.getByRole("switch")).toBeVisible();
  await expect(c.getByRole("button", { name: "Menu" })).toHaveCount(0);
});

test("narrow: menus and controls collapse behind a hamburger", async ({ mount }) => {
  const c = await mount(<MenuBarCollapseHarness width={360} />);
  await expect(c.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(c.getByRole("switch")).toHaveCount(0);
});

test("narrow: opening the panel shows the controls; they stay interactive", async ({
  mount,
  page,
}) => {
  const c = await mount(<MenuBarCollapseHarness width={360} />);
  await c.getByRole("button", { name: "Menu" }).click();
  // The panel is portaled to <body>, outside the component locator.
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  const sw = page.getByRole("switch");
  await expect(sw).toBeVisible();
  await sw.click();
  await expect(c.getByTestId("on")).toHaveText("true");
});

// --- Progressive overflow (collapse="items") ---------------------------

test("items: wide shows every item inline, no overflow trigger", async ({ mount }) => {
  const c = await mount(<MenuBarOverflowHarness width={1000} />);
  await expect(c.getByRole("menuitem", { name: "File" })).toBeVisible();
  await expect(c.getByRole("menuitem", { name: "View" })).toBeVisible();
  await expect(c.getByRole("switch")).toBeVisible();
  await expect(c.getByRole("button", { name: "More" })).toHaveCount(0);
});

test("items: narrow folds trailing items behind the ⋯ trigger", async ({ mount }) => {
  const c = await mount(<MenuBarOverflowHarness width={200} />);
  await expect(c.getByRole("button", { name: "More" })).toBeVisible();
  // The leading menu stays inline; the trailing Switch has folded away.
  await expect(c.getByRole("menuitem", { name: "File" })).toBeVisible();
  await expect(c.getByRole("switch")).toHaveCount(0);
});

test("items: opening ⋯ reveals folded items; they stay interactive", async ({ mount, page }) => {
  const c = await mount(<MenuBarOverflowHarness width={200} />);
  await c.getByRole("button", { name: "More" }).click();
  const sw = page.getByRole("switch");
  await expect(sw).toBeVisible();
  await sw.click();
  await expect(c.getByTestId("on")).toHaveText("true");
});
