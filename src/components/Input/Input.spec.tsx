import { expect, test } from "@playwright/experimental-ct-react";
import { Input } from "./Input";

// Pins the field contract: a text field is a ruled box. It rests on
// --sf-color-input-bg (the page colour by default) inside the control edge,
// and focus turns the edge primary and doubles it with a 1px outline.

test("rests on the input fill inside the control edge; focus doubles the edge in primary", async ({
  mount,
  page,
}) => {
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

  // Resting = the input fill token, which a theme can move off the page colour.
  const inputBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--sf-color-input-bg").trim(),
  );
  expect(inputBg).toBe("#ffffff");
  await expect(input).toHaveCSS("background-color", "rgb(255, 255, 255)");
  // The resting edge is the control border (ink), with no outline.
  await expect(input).toHaveCSS("border-top-color", "rgb(10, 10, 10)");
  await expect(input).toHaveCSS("outline-style", "none");
  // Focus: the edge turns primary and a 1px outline doubles it. toHaveCSS
  // retries through the 120ms border transition.
  await input.focus();
  await expect(input).toHaveCSS("border-top-color", "rgb(20, 50, 200)");
  await expect(input).toHaveCSS("outline-style", "solid");
  await expect(input).toHaveCSS("outline-width", "1px");
  await expect(input).toHaveCSS("outline-color", "rgb(20, 50, 200)");
  await input.blur();
  await expect(input).toHaveCSS("border-top-color", "rgb(10, 10, 10)");
});
