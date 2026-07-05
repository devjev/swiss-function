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
  await c
    .locator("svg")
    .first()
    .hover({ position: { x: 40, y: 40 } });
  await expect(page.getByRole("tooltip")).toBeVisible();
});

// --- Issue #35: shared scaffolding on the grid -------------------------------

test("controls + value-axis (row) zoom: the toolbar windows the y range", async ({
  mount,
  page,
}) => {
  const c = await mount(<HeatmapHarness n={8} height={280} zoomable controls />);
  await expect(c.getByRole("toolbar", { name: "Chart controls" })).toBeVisible();
  const reset = c.getByRole("button", { name: "Reset view" });
  await expect(reset).toBeDisabled();

  // The grid y runs 0..7; a step-zoom about the centre windows the rows.
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing");
  await expect(reset).toBeEnabled();
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("annotations render in a pixel-space overlay stacked on the grid", async ({ mount }) => {
  const c = await mount(
    <HeatmapHarness n={6} height={280} annotations={[{ type: "hline", y: 3, label: "mid" }]} />,
  );
  await expect(c.locator("g[data-annotations]")).toHaveCount(1);
  await expect(c.getByText("mid")).toBeVisible();
});

test("fullscreen toggles the maximized data attribute", async ({ mount }) => {
  const c = await mount(<HeatmapHarness n={6} height={280} fullscreen />);
  const root = c.locator("[data-scaffolding]").first();
  await expect(root).not.toHaveAttribute("data-expanded", "");
  await c.getByRole("button", { name: /fullscreen/i }).click();
  await expect(root).toHaveAttribute("data-expanded", "");
});
