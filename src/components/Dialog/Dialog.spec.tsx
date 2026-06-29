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

test("dragging the SE corner resizes the popup", async ({ mount, page }) => {
  await mount(<DialogWindowHarness resizable />);
  const popup = page.getByTestId("popup");
  const before = await popup.boundingBox();
  if (!before) throw new Error("missing bounding box");
  // The SE handle sits at the popup's bottom-right corner.
  const sx = before.x + before.width - 3;
  const sy = before.y + before.height - 3;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 80, sy + 60, { steps: 8 });
  await page.mouse.up();
  const after = await popup.boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(after.width).toBeGreaterThan(before.width + 50);
  expect(after.height).toBeGreaterThan(before.height + 30);
});

test("dragging the W edge grows the popup while anchoring the right edge", async ({
  mount,
  page,
}) => {
  await mount(<DialogWindowHarness resizable />);
  const popup = page.getByTestId("popup");
  const before = await popup.boundingBox();
  if (!before) throw new Error("missing bounding box");
  const rightBefore = before.x + before.width;
  // The W handle runs down the popup's left edge.
  await page.mouse.move(before.x + 3, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x - 120, before.y + before.height / 2, { steps: 8 });
  await page.mouse.up();
  const after = await popup.boundingBox();
  if (!after) throw new Error("missing bounding box");
  // Width grew, the left edge moved left, and the right edge stayed put.
  expect(after.width).toBeGreaterThan(before.width + 80);
  expect(after.x).toBeLessThan(before.x - 80);
  expect(after.x + after.width).toBeCloseTo(rightBefore, 0);
});

test("a resizable popup clamps to its minimum size", async ({ mount, page }) => {
  await mount(<DialogWindowHarness resizable />);
  const popup = page.getByTestId("popup");
  const before = await popup.boundingBox();
  if (!before) throw new Error("missing bounding box");
  const sx = before.x + before.width - 3;
  const sy = before.y + before.height - 3;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 2000, sy - 2000, { steps: 10 });
  await page.mouse.up();
  const after = await popup.boundingBox();
  if (!after) throw new Error("missing bounding box");
  // Clamped at MIN_W=240 / MIN_H=120.
  expect(after.width).toBeGreaterThanOrEqual(238);
  expect(after.width).toBeLessThan(260);
  expect(after.height).toBeGreaterThanOrEqual(118);
  expect(after.height).toBeLessThan(140);
});

test("a moved popup re-centers when closed and reopened", async ({ mount, page }) => {
  await mount(<DialogWindowHarness draggable />);
  const popup = page.getByTestId("popup");
  const handle = page.getByTestId("handle");
  const before = await popup.boundingBox();
  const hb = await handle.boundingBox();
  if (!before || !hb) throw new Error("missing bounding boxes");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 120, hb.y + hb.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const moved = await popup.boundingBox();
  if (!moved) throw new Error("missing bounding box");
  expect(moved.x - before.x).toBeGreaterThan(90);

  await page.getByTestId("close").click();
  await expect(popup).toHaveCount(0);
  await page.getByTestId("trigger").click();
  const reopened = await popup.boundingBox();
  if (!reopened) throw new Error("missing bounding box");
  // Geometry resets — back to the original centered position.
  expect(Math.abs(reopened.x - before.x)).toBeLessThan(2);
  expect(Math.abs(reopened.y - before.y)).toBeLessThan(2);
});

test("arrow keys on the focused SE handle resize the popup", async ({ mount, page }) => {
  await mount(<DialogWindowHarness resizable />);
  const popup = page.getByTestId("popup");
  const before = await popup.boundingBox();
  if (!before) throw new Error("missing bounding box");
  await page.locator('[data-edge="se"]').focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowDown");
  const after = await popup.boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(after.width).toBeGreaterThan(before.width + 80);
  expect(after.height).toBeGreaterThan(before.height + 80);
});
