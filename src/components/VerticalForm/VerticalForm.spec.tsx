import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import { Basic, NavForm, Sections } from "./VerticalForm.harness";

/** The scroll element is the target of the rail scrollbar's aria-controls. */
async function scrollTopOf(c: { locator(selector: string): Locator; page(): Page }) {
  const id = await c.locator('[role="scrollbar"]').getAttribute("aria-controls");
  return c.page().evaluate((sel) => {
    const el = sel ? document.getElementById(sel) : null;
    return el ? el.scrollTop : Number.NaN;
  }, id);
}

test("the rail lists field names as clickable labels", async ({ mount }) => {
  const c = await mount(<Basic />);
  await expect(c.getByRole("button", { name: "Field 1", exact: true })).toBeVisible();
  await expect(c.getByRole("button", { name: "Field 10", exact: true })).toBeVisible();
});

test("an errored field marks its rail block and label danger", async ({ mount }) => {
  const c = await mount(<Basic />);
  // Field 4 (index 3) carries an error; both its block marker and its label
  // take the danger tone.
  await expect(c.locator('[class*="marker"][data-tone="danger"]')).toHaveCount(1);
  await expect(c.locator('[class*="label"][data-tone="danger"]')).toHaveCount(1);
});

test("clicking a field label scrolls it toward the top", async ({ mount }) => {
  const c = await mount(<Basic />);
  expect(await scrollTopOf(c)).toBe(0);
  await c.getByRole("button", { name: "Field 8" }).click();
  await expect.poll(() => scrollTopOf(c)).toBeGreaterThan(100);
});

test("section titles appear on the rail above their fields", async ({ mount }) => {
  const c = await mount(<Sections />);
  await expect(c.getByRole("button", { name: "Account" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Profile" })).toBeVisible();
});

test("nav: selecting a title in the bottom picker scrolls to it", async ({ mount, page }) => {
  const c = await mount(<NavForm />);
  expect(await scrollTopOf(c)).toBe(0);
  const field = c.getByPlaceholder("Jump to a field…");
  await field.click();
  // The option list is virtualized; filter to the target before clicking it. The
  // popup portals to the body, so query the option through `page`, not `c`.
  await field.fill("Juliet");
  await page.getByRole("option", { name: "Juliet" }).click();
  await expect.poll(() => scrollTopOf(c)).toBeGreaterThan(100);
});

test("nav: scrolling updates the picker to the title at the top", async ({ mount, page }) => {
  const c = await mount(<NavForm />);
  const field = c.getByPlaceholder("Jump to a field…");
  // Scroll the form so a Profile field is at the top.
  const id = await c.locator('[role="scrollbar"]').getAttribute("aria-controls");
  await page.evaluate((sel) => {
    const el = sel ? document.getElementById(sel) : null;
    if (el) el.scrollTop = el.scrollHeight;
  }, id);
  // At the bottom the last title (Juliet) is active; the picker reflects it.
  await expect(field).toHaveValue(/Juliet/);
});
