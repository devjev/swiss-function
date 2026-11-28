import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import {
  DialogFloatersHarness,
  DialogMenuBarHarness,
  HostOverlayHarness,
  NestedDialogsHarness,
  PopoverDialogHarness,
  PopoverPickerHarness,
  RootPickerHarness,
  ScrolledPickerHarness,
} from "./stacking.harness";

// Overlays stack in the browser's top layer, in the order they opened (issue
// #83). Each test checks what a person sees: the element on top at a point.

/** Whether `el` is the element painted on top at its own centre. */
const onTop = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });

/** Whether the element on top at the centre of `at` is in `selector`. */
async function topIs(at: Locator, selector: string) {
  return at.evaluate((el, sel) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit?.closest(sel);
  }, selector);
}

const inTopLayer = (l: Locator) => l.evaluate((el) => !!el.closest(":popover-open"));

test("a dropdown at the page root enters the top layer and opens under its field", async ({
  mount,
  page,
}) => {
  const c = await mount(<RootPickerHarness />);
  const field = c.getByRole("combobox");
  await field.click();
  const option = page.getByRole("option", { name: "Banana" });
  await expect(option).toBeVisible();
  expect(await inTopLayer(option)).toBe(true);
  expect(await topIs(option, "[role='option']")).toBe(true);

  // The portal is a container only: it draws nothing of its own.
  const portal = await option.evaluate((el) => {
    const p = el.closest(":popover-open") as HTMLElement;
    const s = getComputedStyle(p);
    return [p.offsetWidth, p.offsetHeight, s.borderTopWidth, s.paddingTop, s.backgroundColor];
  });
  expect(portal).toEqual([0, 0, "0px", "0px", "rgba(0, 0, 0, 0)"]);

  const f = (await field.boundingBox()) as { x: number; y: number; height: number };
  const list = (await page.getByRole("listbox").boundingBox()) as { x: number; y: number };
  expect(list.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
  expect(list.y - (f.y + f.height)).toBeLessThan(16);
});

test("on a scrolled page the dropdown still opens under its field", async ({ mount, page }) => {
  const c = await mount(<ScrolledPickerHarness />);
  const field = c.getByRole("combobox");
  await field.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await field.click();
  await expect(page.getByRole("option", { name: "Banana" })).toBeVisible();
  const f = (await field.boundingBox()) as { x: number; y: number; height: number };
  const list = (await page.getByRole("listbox").boundingBox()) as { x: number; y: number };
  expect(list.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
  expect(list.y - (f.y + f.height)).toBeLessThan(16);
});

test("a Picker opened inside a Dialog is on top of it", async ({ mount, page }) => {
  await mount(<DialogFloatersHarness />);
  await page.getByRole("combobox", { name: "Fruit" }).click();
  const option = page.getByRole("option", { name: "Banana" });
  await expect(option).toBeVisible();
  expect(await topIs(option, "[role='option']")).toBe(true);
});

test("a DatePicker calendar opened inside a Dialog is on top of it", async ({ mount, page }) => {
  await mount(<DialogFloatersHarness />);
  await page.getByLabel("Date").click();
  const grid = page.getByRole("grid").or(page.getByRole("table")).first();
  await expect(grid).toBeVisible();
  expect(await topIs(grid, "[role='grid'], table")).toBe(true);
});

test("a MenuBar dropdown opened inside a Dialog is on top of it", async ({ mount, page }) => {
  await mount(<DialogMenuBarHarness />);
  await page.getByRole("menuitem", { name: "File" }).click();
  const item = page.getByRole("menuitem", { name: "New" });
  await expect(item).toBeVisible();
  expect(await topIs(item, "[role='menuitem']")).toBe(true);
});

test("a Picker inside a Popover is on top of the Popover", async ({ mount, page }) => {
  await mount(<PopoverPickerHarness />);
  await page.getByRole("combobox").click();
  const option = page.getByRole("option", { name: "Banana" });
  await expect(option).toBeVisible();
  expect(await topIs(option, "[role='option']")).toBe(true);
});

test("a Dialog opened from an open Popover covers the Popover", async ({ mount, page }) => {
  await mount(<PopoverDialogHarness />);
  const popover = page.getByTestId("pop-popup");
  await expect(popover).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("popup")).toBeVisible();
  await expect(popover).toBeVisible();
  // At the popover's text, the dialog's backdrop is on top.
  expect(await topIs(page.getByText("Popover content"), "[data-testid='backdrop']")).toBe(true);
});

test("a Dialog is above a host element at the highest z-index", async ({ mount, page }) => {
  await mount(<HostOverlayHarness />);
  const title = page.getByRole("heading", { name: "Above the host" });
  await expect(title).toBeVisible();
  expect(await topIs(title, "[data-testid='popup']")).toBe(true);
});

test("a second Dialog opened inside the first covers it", async ({ mount, page }) => {
  await mount(<NestedDialogsHarness />);
  await page.getByRole("button", { name: "Open second" }).click();
  await expect(page.getByTestId("second")).toBeVisible();
  const text = page.getByText("The first dialog's text");
  expect(await topIs(text, "[data-testid='second-backdrop'], [data-testid='second']")).toBe(true);
  expect(await onTop(page.getByTestId("second"))).toBe(true);
});

test.describe("without the Popover API", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      delete proto.showPopover;
      delete proto.hidePopover;
    });
  });

  test("a Picker opened inside a Dialog is still on top of it", async ({ mount, page }) => {
    await mount(<DialogFloatersHarness />);
    await page.getByRole("combobox", { name: "Fruit" }).click();
    const option = page.getByRole("option", { name: "Banana" });
    await expect(option).toBeVisible();
    expect(await inTopLayer(option)).toBe(false);
    expect(await topIs(option, "[role='option']")).toBe(true);
  });

  test("a Dialog opened from an open Popover still covers it", async ({ mount, page }) => {
    await mount(<PopoverDialogHarness />);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByTestId("popup")).toBeVisible();
    expect(await topIs(page.getByText("Popover content"), "[data-testid='backdrop']")).toBe(true);
  });

  test("a dropdown on a scrolled page opens under its field", async ({ mount, page }) => {
    const c = await mount(<ScrolledPickerHarness />);
    const field = c.getByRole("combobox");
    await field.scrollIntoViewIfNeeded();
    await field.click();
    await expect(page.getByRole("option", { name: "Banana" })).toBeVisible();
    const f = (await field.boundingBox()) as { y: number; height: number };
    const list = (await page.getByRole("listbox").boundingBox()) as { y: number };
    expect(list.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
    expect(list.y - (f.y + f.height)).toBeLessThan(16);
  });
});
