import { expect, test } from "@playwright/experimental-ct-react";
import { SurfaceHarness } from "./Surface.harness";

test("renders a sized canvas", async ({ mount }) => {
  const c = await mount(<SurfaceHarness />);
  const canvas = c.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);
});

test("dragging rotates the camera (canvas pixels change)", async ({ mount, page }) => {
  const c = await mount(<SurfaceHarness />);
  const canvas = c.locator("canvas");
  await expect(canvas).toBeVisible();
  const before = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const after = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  expect(after).not.toBe(before);
});
