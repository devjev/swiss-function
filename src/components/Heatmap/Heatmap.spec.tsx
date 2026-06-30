import { expect, test } from "@playwright/experimental-ct-react";
import { HeatmapHarness } from "./Heatmap.harness";

test("renders one cell per grid value", async ({ mount }) => {
  const c = await mount(<HeatmapHarness n={8} />);
  await expect(c.locator("svg rect")).toHaveCount(64);
});

test("draws iso-lines when contours are requested", async ({ mount }) => {
  const c = await mount(<HeatmapHarness n={8} contours={3} />);
  const lines = await c.locator("svg line").count();
  expect(lines).toBeGreaterThan(0);
});

test("hovering a cell shows a tooltip", async ({ mount, page }) => {
  const c = await mount(<HeatmapHarness n={8} />);
  await c.locator("svg").hover({ position: { x: 40, y: 40 } });
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("showValues prints one value label per cell, leaving hover intact", async ({
  mount,
  page,
}) => {
  const c = await mount(<HeatmapHarness n={5} showValues />);
  // One label per grid value (5×5); harness grid z = i+j, so the top-right
  // corner value (8) is present. (Scope to the spans inside the .values overlay.)
  await expect(c.locator('[class*="values"] span')).toHaveCount(25);
  await expect(c.getByText("8", { exact: true })).toBeVisible();
  // The overlay is non-interactive — the SVG underneath still drives the tooltip.
  await c.locator("svg").hover({ position: { x: 40, y: 40 } });
  await expect(page.getByRole("tooltip")).toBeVisible();
});
