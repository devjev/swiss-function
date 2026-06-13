import { expect, test } from "@playwright/experimental-ct-react";
import { GraphHarness } from "./Graph.harness";

test("renders the interaction surface and the controls toolbar", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-surface]")).toBeVisible();
  await expect(c.getByRole("button", { name: "Reset view" })).toBeVisible();
  for (const name of ["Force", "Tree", "Radial", "Concentric", "Grid"]) {
    await expect(c.getByRole("button", { name })).toBeVisible();
  }
});

test("renders the minimap overlay when included", async ({ mount }) => {
  const c = await mount(<GraphHarness minimap />);
  await expect(c.locator("[data-graph-minimap]")).toBeVisible();
});

test("a layout toggle fires onLayoutChange and marks itself pressed", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  await c.getByRole("button", { name: "Tree" }).click();
  await expect(c.getByTestId("last-event")).toHaveText("layout:tree");
  await expect(c.getByRole("button", { name: "Tree" })).toHaveAttribute("data-pressed", "");
});

test("clicking a node fires onNodeClick with its id", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  // Wait for the deferred layout to settle (the surface marks itself ready).
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await c.locator("[data-graph-surface]").click();
  await expect(c.getByTestId("last-event")).toHaveText("click:hub");
});

test("hovering a node opens the inspector with its label + data", async ({ mount, page }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The inspector tooltip surfaces the node's label + its `data` record.
  const tip = page.locator("[data-graph-tooltip]");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Hub");
  await expect(tip).toContainText("center");
});

test("right-clicking a node opens the context menu; Escape closes it", async ({ mount, page }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await c.locator("[data-graph-surface]").click({ button: "right" });
  const focus = page.getByRole("menuitem", { name: "Focus" });
  await expect(focus).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(focus).toHaveCount(0);
});
