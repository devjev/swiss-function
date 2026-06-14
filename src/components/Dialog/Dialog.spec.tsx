import { expect, test } from "@playwright/experimental-ct-react";
import { DialogWindowHarness } from "./Dialog.harness";

test("dragging the header moves the popup", async ({ mount, page }) => {
  await mount(<DialogWindowHarness draggable />);
  const popup = page.getByTestId("popup");
  const handle = page.getByTestId("handle");
  const before = await popup.boundingBox();
  const hb = await handle.boundingBox();
  if (!before || !hb) throw new Error("missing bounding boxes");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 100, hb.y + hb.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  const after = await popup.boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(after.x - before.x).toBeGreaterThan(70);
  expect(after.y - before.y).toBeGreaterThan(30);
});

test("a non-draggable popup does not move when its header is dragged", async ({ mount, page }) => {
  await mount(<DialogWindowHarness />);
  const popup = page.getByTestId("popup");
  const handle = page.getByTestId("handle");
  const before = await popup.boundingBox();
  const hb = await handle.boundingBox();
  if (!before || !hb) throw new Error("missing bounding boxes");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 100, hb.y + hb.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  const after = await popup.boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});
