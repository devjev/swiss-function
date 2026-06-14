import { expect, test } from "@playwright/experimental-ct-react";
import { Fullscreen } from "./Fullscreen";

test("renders children and a fullscreen toggle", async ({ mount }) => {
  const c = await mount(
    <Fullscreen>
      <p>content</p>
    </Fullscreen>,
  );
  await expect(c.getByText("content")).toBeVisible();
  await expect(c.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
});

test("clicking the toggle expands to the viewport", async ({ mount }) => {
  const c = await mount(
    <Fullscreen>
      <p>content</p>
    </Fullscreen>,
  );
  await expect(c).not.toHaveAttribute("data-expanded", "true");
  await c.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(c).toHaveAttribute("data-expanded", "true");
  // Fixed overlay → it covers (roughly) the whole viewport.
  const box = await c.boundingBox();
  const vp = c.page().viewportSize();
  if (!box || !vp) throw new Error("missing box/viewport");
  expect(box.width).toBeGreaterThan(vp.width - 2);
  expect(box.height).toBeGreaterThan(vp.height - 2);
  await expect(c.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
});

test("Escape exits fullscreen", async ({ mount, page }) => {
  const c = await mount(
    <Fullscreen>
      <p>content</p>
    </Fullscreen>,
  );
  await c.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(c).toHaveAttribute("data-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(c).not.toHaveAttribute("data-expanded", "true");
});
