import { expect, test } from "@playwright/experimental-ct-react";
import { Input } from "./Input";

// Pins the recessed-slot contract (issue #29): text-entry rests one shade
// below the page (--sf-color-input-bg) and lifts to --sf-color-bg on focus.

test("rests on the input fill and lifts to the page colour on focus", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 320, padding: 16 }}>
      <Input aria-label="probe" />
    </div>,
  );
  const input = c.getByRole("textbox");
  const pageBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--sf-color-bg").trim(),
  );
  expect(pageBg).toBe("#ffffff");

  // Resting = the dedicated input fill (--sf-color-input-bg), not the page.
  await expect(input).toHaveCSS("background-color", "rgb(243, 244, 246)");
  // Focus lifts to the page colour. toHaveCSS retries through the 120ms
  // background transition.
  await input.focus();
  await expect(input).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await input.blur();
  await expect(input).toHaveCSS("background-color", "rgb(243, 244, 246)");
});
