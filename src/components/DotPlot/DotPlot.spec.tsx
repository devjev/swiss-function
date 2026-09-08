import { expect, test } from "@playwright/experimental-ct-react";
import type { ChartAnnotation } from "../../lib/chart";
import { DotPlotHarness } from "./DotPlot.harness";

const CATEGORIES = ["Alpha", "Beta", "Gamma", "Delta"];
const ONE = [{ name: "Revenue", values: [20, 80, 40, 60] }];
const TWO = [
  { name: "Before", values: [20, 80, 40, 60] },
  { name: "After", values: [35, 70, 40, 90] },
];

test("renders one dot per series per category and lists every category down the side", async ({
  mount,
}) => {
  const c = await mount(<DotPlotHarness categories={CATEGORIES} series={TWO} height={240} />);
  await expect(c.locator("circle[data-chart-mark]")).toHaveCount(8);
  const labels = c.locator('[data-orientation="y"] [data-tick]');
  await expect(labels).toHaveCount(4);
  await expect(labels.nth(0)).toHaveText("Alpha");
  await expect(labels.nth(3)).toHaveText("Delta");
});

test("hovering a dot opens a tooltip with every series value of the row", async ({ mount }) => {
  const c = await mount(<DotPlotHarness categories={CATEGORIES} series={TWO} height={240} />);
  await c.locator('circle[data-chart-mark][data-series="After"]').nth(1).hover();
  const tooltip = c.page().getByRole("tooltip");
  await expect(tooltip).toContainText("Beta");
  await expect(tooltip).toContainText("Before: 80");
  await expect(tooltip).toContainText("After: 70");
});

test("sort ranks the rows by the first series, largest first", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness categories={CATEGORIES} series={ONE} sort="desc" height={240} />,
  );
  const labels = c.locator('[data-orientation="y"] [data-tick]');
  await expect(labels.nth(0)).toHaveText("Beta");
  await expect(labels.nth(1)).toHaveText("Delta");
  await expect(labels.nth(3)).toHaveText("Alpha");
});

test("range draws a bar per row, toned by direction", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness
      categories={CATEGORIES}
      series={TWO}
      range
      rangeTone="direction"
      height={240}
    />,
  );
  const bars = c.locator("line[data-direction]");
  await expect(bars).toHaveCount(4);
  await expect(bars.nth(0)).toHaveAttribute("data-direction", "up");
  await expect(bars.nth(1)).toHaveAttribute("data-direction", "down");
  await expect(bars.nth(2)).toHaveAttribute("data-direction", "flat");
});

test("markers draw a tick per row and join the tooltip and legend", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness
      categories={CATEGORIES}
      series={TWO}
      range
      marker={[30, 75, null, 70]}
      markerLabel="Now"
      height={240}
    />,
  );
  await expect(c.locator('svg[role="img"] line[class*="marker"]')).toHaveCount(3);
  await expect(c.getByText("Now")).toBeVisible();
  await c.locator('circle[data-chart-mark][data-series="Before"]').first().hover();
  await expect(c.page().getByRole("tooltip")).toContainText("Now: 30");
});

test("a click pins a dot and a second click clears it", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness categories={CATEGORIES} series={ONE} selectable height={240} />,
  );
  const dot = c.locator("circle[data-chart-mark]").nth(1);
  await dot.click();
  await expect(c.getByTestId("selected")).toHaveText("Beta Revenue 80");
  await expect(dot).toHaveAttribute("data-selected", "true");
  await dot.click();
  await expect(c.getByTestId("selected")).toHaveText("none");
});

test("controls: keyboard zoom windows the value axis (x when horizontal)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <DotPlotHarness
      categories={CATEGORIES}
      series={ONE}
      valueDomain={[0, 100]}
      height={240}
      scaffolding="full"
      zoomable
      controls
    />,
  );
  const toolbar = c.getByRole("toolbar", { name: "Chart controls" });
  await expect(toolbar).toBeVisible();
  const reset = toolbar.getByRole("button", { name: "Reset view" });
  await expect(reset).toBeDisabled();
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await expect(reset).toBeEnabled();
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("with controls on, the rows start below the toolbar", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness categories={CATEGORIES} series={ONE} height={240} zoomable controls />,
  );
  const toolbar = await c.getByRole("toolbar", { name: "Chart controls" }).boundingBox();
  const first = await c.locator('rect[class*="rowBand"]').first().boundingBox();
  if (!toolbar || !first) throw new Error("missing boxes");
  expect(first.y + first.height / 2).toBeGreaterThan(toolbar.y + toolbar.height);
});

test("vline tool places a value-level line at a data-space x", async ({ mount, page }) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(
    <DotPlotHarness
      categories={CATEGORIES}
      series={ONE}
      valueDomain={[0, 100]}
      height={240}
      scaffolding="full"
      controls
      editable
      onChange={(next) => changes.push(next)}
    />,
  );
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");
  await c.getByRole("button", { name: "Vertical line" }).click();
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await expect.poll(() => changes.length).toBe(1);
  const drawn = changes[0]?.[0];
  if (!drawn || drawn.type !== "vline") throw new Error(`expected a vline, got ${drawn?.type}`);
  expect(Number(drawn.x)).toBeGreaterThan(65);
  expect(Number(drawn.x)).toBeLessThan(85);
});

test("many rows: the plot grows so no row drops under one unit", async ({ mount }) => {
  const categories = Array.from({ length: 40 }, (_, i) => `Row ${i + 1}`);
  const series = [{ name: "V", values: categories.map((_, i) => (i * 7) % 100) }];
  const c = await mount(<DotPlotHarness categories={categories} series={series} height={240} />);
  const svg = await c.locator("svg[role='img']").boundingBox();
  if (!svg) throw new Error("no svg box");
  expect(svg.height).toBeGreaterThanOrEqual(40 * 24 - 1);
  await expect(c.locator('[data-orientation="y"] [data-tick]')).toHaveCount(40);
});

test("rows spread over the plot by default; rowHeight fixes the pitch instead", async ({
  mount,
}) => {
  const spread = await mount(<DotPlotHarness categories={CATEGORIES} series={ONE} height={240} />);
  const svg = await spread.locator("svg[role='img']").boundingBox();
  const bands = spread.locator('rect[class*="rowBand"]');
  const first = await bands.nth(0).boundingBox();
  if (!svg || !first) throw new Error("missing boxes");
  // Four rows share the whole plot: each band is a quarter of the svg.
  expect(Math.abs(first.height - svg.height / 4)).toBeLessThanOrEqual(1);
  await spread.unmount();

  const compact = await mount(
    <DotPlotHarness categories={CATEGORIES} series={ONE} height={240} rowHeight={18} />,
  );
  const compactSvg = await compact.locator("svg[role='img']").boundingBox();
  const compactBand = await compact.locator('rect[class*="rowBand"]').nth(0).boundingBox();
  if (!compactSvg || !compactBand) throw new Error("missing boxes");
  expect(Math.abs(compactSvg.height - 4 * 18)).toBeLessThanOrEqual(1);
  expect(Math.abs(compactBand.height - 18)).toBeLessThanOrEqual(1);
});

test("vertical orientation puts the categories along the bottom", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness categories={CATEGORIES} series={ONE} orientation="vertical" height={240} />,
  );
  const bottom = c.locator('[data-orientation="x"] [data-tick]');
  await expect(bottom).toHaveCount(4);
  await expect(bottom.nth(0)).toHaveText("Alpha");
  await expect(c.locator("circle[data-chart-mark]")).toHaveCount(4);
});

test("lollipop draws a stem per dot and pulls zero into the extent", async ({ mount }) => {
  const c = await mount(
    <DotPlotHarness
      categories={CATEGORIES}
      series={[{ name: "V", values: [82, 91, 97, 88] }]}
      lollipop
      scaffolding="full"
      height={240}
    />,
  );
  await expect(c.locator('line[class*="stem"]')).toHaveCount(4);
  await expect(c.locator('[data-orientation="x"] [data-tick]').first()).toHaveText("0");
});

test("frame and full scaffolding render the framed panel with its axis lines", async ({
  mount,
}) => {
  const c = await mount(
    <DotPlotHarness categories={CATEGORIES} series={ONE} frame scaffolding="full" height={240} />,
  );
  const root = c.locator("[data-scaffolding]").first();
  await expect(root).toHaveAttribute("data-scaffolding", "full");
  await expect(root).toHaveClass(/frame/);
  await expect(c.locator('[data-orientation="x"] [data-tick]').first()).toBeVisible();
});
