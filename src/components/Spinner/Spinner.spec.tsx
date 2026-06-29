import { expect, test } from "@playwright/experimental-ct-react";
import { SpinnerHarness } from "./Spinner.harness";

// The Spinner's root element *is* the role="status" span, so assert on the
// mounted component locator directly (not a descendant getByRole).

test("renders a status role with an accessible label", async ({ mount }) => {
  const c = await mount(<SpinnerHarness />);
  await expect(c).toBeVisible();
  await expect(c).toHaveAttribute("role", "status");
  await expect(c).toHaveAttribute("aria-label", "Loading");
  expect((await c.textContent())?.length ?? 0).toBeGreaterThan(0);
});

test("cycles glyphs over time", async ({ mount, page }) => {
  const c = await mount(<SpinnerHarness variant="braille" />);
  const first = await c.textContent();
  let changed = false;
  for (let i = 0; i < 12 && !changed; i++) {
    await page.waitForTimeout(40);
    if ((await c.textContent()) !== first) changed = true;
  }
  expect(changed).toBe(true);
});

test("holds a static frame under prefers-reduced-motion", async ({ mount, page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const c = await mount(<SpinnerHarness variant="braille" />);
  const first = await c.textContent();
  await page.waitForTimeout(250);
  expect(await c.textContent()).toBe(first);
});
