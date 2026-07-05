import { expect, test } from "@playwright/experimental-ct-react";
import type { ChartAnnotation } from "../../lib/chart";
import { BarChartScaffoldHarness } from "./BarChart.harness";

// Issue #35: the shared chart scaffolding wired into BarChart — a controls
// toolbar, value-axis (y) zoom, data-anchored annotations and fullscreen. The
// x axis is categorical, so it is the continuous *value* axis that windows.

const CATEGORIES = ["A", "B", "C", "D"];
const SERIES = [{ name: "S", values: [20, 80, 40, 60] }];

test("controls: the toolbar renders and value-axis keyboard zoom windows y", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BarChartScaffoldHarness
        categories={CATEGORIES}
        series={SERIES}
        yDomain={[0, 100]}
        height={240}
        scaffolding="full"
        zoomable
        controls
      />
    </div>,
  );
  const toolbar = c.getByRole("toolbar", { name: "Chart controls" });
  await expect(toolbar).toBeVisible();
  const reset = toolbar.getByRole("button", { name: "Reset view" });
  await expect(reset).toBeDisabled();

  // Focus the chart and step-zoom about the value-axis center: [0,100] → [25,75].
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await expect(reset).toBeEnabled();

  // ArrowUp pans toward higher values; 0 resets to the full range.
  await page.keyboard.press("ArrowUp");
  await expect(c.locator("[aria-live]")).not.toContainText("Showing 25 to 75");
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
  await expect(reset).toBeDisabled();
});

test("hline tool places a reference level at a data-space y; tool snaps back", async ({
  mount,
  page,
}) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(
    <BarChartScaffoldHarness
      categories={CATEGORIES}
      series={SERIES}
      yDomain={[0, 100]}
      height={240}
      scaffolding="full"
      controls
      editable
      onChange={(next) => changes.push(next)}
    />,
  );
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");

  await c.getByRole("button", { name: "Horizontal line" }).click();
  // Click 75% down the plot → value ≈ 25 (top = 100, bottom = 0).
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);

  await expect.poll(() => changes.length).toBe(1);
  const drawn = changes[0]?.[0];
  if (!drawn || drawn.type !== "hline") throw new Error(`expected an hline, got ${drawn?.type}`);
  expect(drawn.y).toBeGreaterThan(15);
  expect(drawn.y).toBeLessThan(35);
  expect(drawn.id).toBeTruthy();
  // Snaps back to select after the draw.
  await expect(c.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
});

test("read-only annotations render as a data-space overlay", async ({ mount }) => {
  const c = await mount(
    <BarChartScaffoldHarness
      categories={CATEGORIES}
      series={SERIES}
      yDomain={[0, 100]}
      height={240}
      scaffolding="full"
      annotations={[{ type: "hline", y: 50, label: "target" }]}
    />,
  );
  await expect(c.locator("g[data-annotations]")).toHaveCount(1);
  await expect(c.getByText("target")).toBeVisible();
});

test("fullscreen toggles the maximized data attribute", async ({ mount }) => {
  const c = await mount(
    <BarChartScaffoldHarness
      categories={CATEGORIES}
      series={SERIES}
      height={240}
      scaffolding="full"
      fullscreen
    />,
  );
  const root = c.locator("[data-scaffolding]").first();
  await expect(root).not.toHaveAttribute("data-expanded", "");
  await c.getByRole("button", { name: /fullscreen|maximize|expand/i }).click();
  await expect(root).toHaveAttribute("data-expanded", "");
});

// Arbitrary zoom-out past the data extent (zoomOutLimit).
test("zoomOutLimit lets the value axis zoom out past the data", async ({ mount, page }) => {
  const c = await mount(
    <BarChartScaffoldHarness
      categories={CATEGORIES}
      series={SERIES}
      yDomain={[0, 100]}
      height={240}
      scaffolding="full"
      zoomable
      controls
      zoomOutLimit={Number.POSITIVE_INFINITY}
    />,
  );
  await c.locator("[data-zoomable]").focus();
  // From the full extent, "-" zooms out into empty margin: [0,100] → [-50,150].
  await page.keyboard.press("-");
  await expect(c.locator("[aria-live]")).toContainText("150");
  await expect(c.getByRole("button", { name: "Reset view" })).toBeEnabled();
});

test("without zoomOutLimit, zoom-out stops at the data extent", async ({ mount, page }) => {
  const c = await mount(
    <BarChartScaffoldHarness
      categories={CATEGORIES}
      series={SERIES}
      yDomain={[0, 100]}
      height={240}
      scaffolding="full"
      zoomable
      controls
    />,
  );
  await c.locator("[data-zoomable]").focus();
  // "-" from the full extent is clamped back to the data — reported as a reset.
  await page.keyboard.press("-");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});
