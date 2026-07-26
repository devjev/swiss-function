import { expect, test } from "@playwright/experimental-ct-react";
import {
  DialogFloatersHarness,
  DialogMenuBarHarness,
  PopoverPickerHarness,
  RootPickerHarness,
} from "./stacking.harness";

/** Inline z-indexes present anywhere in the document. A floater lifted for a
 *  host overlay (issue #82) carries one; nothing at the page root does. */
function liftedZIndexes(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((el) => el.style?.zIndex !== "")
      .map((el) => Number(el.style.zIndex)),
  );
}

test("a dropdown at the page root keeps the CSS default z (no inline lift)", async ({
  mount,
  page,
}) => {
  const c = await mount(<RootPickerHarness />);
  await c.getByRole("combobox").click();
  await expect(page.getByRole("option", { name: "Banana" })).toBeVisible();

  // Byte-identical to pre-#82 behaviour: no element carries an inline z-index.
  expect(await liftedZIndexes(page)).toEqual([]);
});

test("a Picker opened inside a Dialog paints above it", async ({ mount, page }) => {
  await mount(<DialogFloatersHarness />);
  // The dialog content is portalled outside the CT mount root, so reach it via
  // `page`, not the component locator.
  const dialogZ = await page
    .getByTestId("popup")
    .evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(dialogZ).toBe(1200); // --sf-z-modal, no inline lift (dialog at root)

  await page.getByRole("combobox", { name: "Fruit" }).click();
  const option = page.getByRole("option", { name: "Banana" });
  await expect(option).toBeVisible();

  // The dropdown's positioner is lifted above the dialog.
  const lifted = await liftedZIndexes(page);
  expect(lifted).toEqual([1210]);
  expect(Math.min(...lifted)).toBeGreaterThan(dialogZ);

  // And it is genuinely the top-painted element there, not occluded by the
  // dialog: elementFromPoint at the option's centre hits the option.
  const onTop = await option.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el.contains(hit) || el === hit;
  });
  expect(onTop).toBe(true);
});

test("a DatePicker calendar opened inside a Dialog paints above it", async ({ mount, page }) => {
  await mount(<DialogFloatersHarness />);
  await page.getByLabel("Date").click();

  // The calendar grid is up, and its positioner is lifted above the dialog.
  await expect(page.getByRole("grid").or(page.getByRole("table")).first()).toBeVisible();
  const lifted = await liftedZIndexes(page);
  expect(lifted).toEqual([1210]);
  expect(Math.min(...lifted)).toBeGreaterThan(1200);
});

test("a MenuBar dropdown opened inside a Dialog paints above it", async ({ mount, page }) => {
  await mount(<DialogMenuBarHarness />);
  await page.getByRole("menuitem", { name: "File" }).click();

  await expect(page.getByRole("menuitem", { name: "New" })).toBeVisible();
  const lifted = await liftedZIndexes(page);
  expect(lifted).toEqual([1210]);
  expect(Math.min(...lifted)).toBeGreaterThan(1200);
});

test("a Picker inside a Popover clears the Popover, even at the page root", async ({
  mount,
  page,
}) => {
  await mount(<PopoverPickerHarness />);
  // The Popover seeds its 1300 band, so its own positioner is not inline-lifted
  // (it is at the root), but the Picker inside climbs to 1310.
  const popZ = await page
    .getByTestId("pop-positioner")
    .evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(popZ).toBe(1300); // --sf-z-popover

  await page.getByRole("combobox").click();
  const lifted = await liftedZIndexes(page);
  expect(lifted).toEqual([1310]);
  expect(Math.min(...lifted)).toBeGreaterThan(popZ);
});
