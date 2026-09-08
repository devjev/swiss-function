import { expect, test } from "@playwright/experimental-ct-react";
import { HorizonChart, type HorizonSeries } from "./HorizonChart";
import { ActivatableHorizon } from "./HorizonChart.harness";

const day = (i: number) => new Date(2026, 0, 1 + i);

/** Four rows of 30 daily values: a rising sine, a falling one, a flat one
 *  and a spiky one, so every sign and band is exercised. */
const ROWS: HorizonSeries[] = [
  {
    name: "Alpha",
    data: Array.from({ length: 30 }, (_, i) => ({ x: day(i), y: Math.sin(i / 4) * 3 })),
  },
  {
    name: "Beta",
    data: Array.from({ length: 30 }, (_, i) => ({ x: day(i), y: -Math.cos(i / 5) * 2 })),
  },
  { name: "Gamma", data: Array.from({ length: 30 }, (_, i) => ({ x: day(i), y: 0.5 })) },
  {
    name: "Delta",
    data: Array.from({ length: 30 }, (_, i) => ({ x: day(i), y: i % 7 === 0 ? 4 : -1 })),
  },
];

const MANY: HorizonSeries[] = Array.from({ length: 20 }, (_, r) => ({
  name: `Row ${r + 1}`,
  data: Array.from({ length: 30 }, (_, i) => ({ x: day(i), y: Math.sin((i + r) / 4) })),
}));

test("renders one focusable row per series, band paths and the label column", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} />
    </div>,
  );
  await expect(c.locator("g[data-row]")).toHaveCount(4);
  await expect(c.locator("path[data-band]").first()).toBeVisible();
  // Alpha reaches every band above the baseline; Gamma never goes negative.
  await expect(c.locator("path[data-row='0'][data-sign='1']")).toHaveCount(3);
  await expect(c.locator("path[data-row='2'][data-sign='-1']")).toHaveCount(0);
  await expect(c.locator("svg")).toHaveAttribute("height", "120");
  await expect(c.locator("[title='Alpha']")).toHaveText("Alpha");
});

test("hovering draws the crosshair and lists every row's value in the tooltip", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} valueFormat={(v) => v.toFixed(1)} />
    </div>,
  );
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");
  // The middle of the Beta row, one third across.
  await page.mouse.move(box.x + box.width / 3, box.y + 45);
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Alpha");
  await expect(tip).toContainText("Delta");
  await expect(tip.locator("[data-active]")).toHaveText(/Beta/);
  await expect(c.locator("[data-hovered='true']")).toHaveCount(1);
  await page.mouse.move(1, 1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("past 16 rows the tooltip lists only the row under the pointer", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={MANY} rowHeight={20} />
    </div>,
  );
  const box = await c.locator("svg").boundingBox();
  if (!box) throw new Error("no svg box");
  await page.mouse.move(box.x + 100, box.y + 70);
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Row 4");
  await expect(tip).not.toContainText("Row 1 ");
  await expect(tip.locator("[data-active]")).toHaveCount(1);
});

test("clicking a row activates its datum and pins a selection; a second click unpins", async ({
  mount,
  page,
}) => {
  const c = await mount(<ActivatableHorizon series={ROWS} rowHeight={30} selectable />);
  const box = await c.locator("svg").boundingBox();
  if (!box) throw new Error("no svg box");
  await page.mouse.move(box.x + box.width / 2, box.y + 75);
  await page.mouse.click(box.x + box.width / 2, box.y + 75);
  await expect(c.getByTestId("activated")).toHaveText(/^Gamma:0\.5$/);
  await expect(c.getByTestId("selection")).toHaveText(/^Gamma:0\.5$/);
  await expect(c.locator("circle")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toContainText("Gamma");
  await page.mouse.click(box.x + box.width / 2, box.y + 75);
  await expect(c.getByTestId("selection")).toHaveText("");
});

test("Enter on a focused row activates its last visible value", async ({ mount }) => {
  const c = await mount(<ActivatableHorizon series={ROWS} rowHeight={30} />);
  const row = c.locator("g[data-row='2']");
  await expect(row).toHaveAttribute("role", "button");
  await row.focus();
  await row.press("Enter");
  await expect(c.getByTestId("activated")).toHaveText("Gamma:0.5");
});

test("zoomable: wheel after a click narrows the window and double-click resets", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} zoomable scaffolding="full" />
    </div>,
  );
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -300);
  await expect(c.locator("[aria-live]")).toHaveText("");
  await page.mouse.click(cx, cy);
  await page.mouse.wheel(0, -300);
  await expect(c.locator("[aria-live]")).toContainText("Showing");
  await expect(c.locator("button", { hasText: "Reset" })).toBeVisible();
  await page.mouse.dblclick(cx, cy);
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("keyboard: + zooms and 0 resets on the focused chart", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} zoomable />
    </div>,
  );
  const root = c.locator("[data-zoomable]");
  await root.focus();
  await root.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing");
  await root.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("labels overlay prints the names in the svg, none prints nothing, values column shows the last value", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} labels="overlay" showValues />
      <HorizonChart series={ROWS} rowHeight={30} labels="none" />
    </div>,
  );
  const overlay = c.locator("[data-labels='overlay']");
  await expect(overlay.locator("svg text")).toHaveCount(4);
  await expect(overlay.locator("[title='Alpha']")).toHaveCount(0);
  // Gamma is a constant 0.5.
  await expect(
    overlay
      .locator("div")
      .filter({ hasText: /^0\.5$/ })
      .first(),
  ).toBeVisible();
  const none = c.locator("[data-labels='none']");
  await expect(none.locator("svg text")).toHaveCount(0);
  await expect(none.locator("[title='Alpha']")).toHaveCount(0);
});

test("offset mode hangs negative bands from the row's top edge", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} mode="offset" />
    </div>,
  );
  // Beta is row 1: its top edge is y = 30. Mirror mode would start at y = 60.
  const d = await c.locator("path[data-row='1'][data-sign='-1'][data-band='0']").getAttribute("d");
  expect(d?.startsWith("M0 30")).toBe(true);
  const positive = await c
    .locator("path[data-row='1'][data-sign='1'][data-band='0']")
    .getAttribute("d");
  expect(positive?.startsWith("M0 60")).toBe(true);
});

test("frame and full scaffolding: gridlines at the tick positions, a framed root", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} frame scaffolding="full" />
    </div>,
  );
  const root = c.locator("[data-scaffolding='full']");
  await expect(root).toHaveCount(1);
  const gridline = c.locator("line[class*='gridline']").first();
  await expect(gridline).toHaveCSS("opacity", "0.5");
  await expect(c.locator("[data-tick]").first()).toBeVisible();
});

test("a given height scrolls the rows while the axis stays", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={MANY} rowHeight={24} height={200} />
    </div>,
  );
  const scroller = c.locator("[class*='scroller']");
  const overflow = await scroller.evaluate(
    (el) => `${el.scrollHeight > el.clientHeight}:${getComputedStyle(el).overflowY}`,
  );
  expect(overflow).toBe("true:auto");
  await expect(c.locator("[data-orientation='x']")).toBeVisible();
});

test("with controls on, the first row starts below the toolbar", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <HorizonChart series={ROWS} rowHeight={30} zoomable controls />
      <HorizonChart series={ROWS} rowHeight={30} />
    </div>,
  );
  const withControls = c.locator("[data-zoomable]");
  const toolbar = await withControls.getByRole("toolbar").boundingBox();
  const firstRow = await withControls.locator("g[data-row='0'] rect").boundingBox();
  const label = await withControls.locator("[title='Alpha']").boundingBox();
  if (!toolbar || !firstRow || !label) throw new Error("missing boxes");
  expect(firstRow.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
  // The label column moves with the rows.
  expect(
    Math.abs(label.y + label.height / 2 - (firstRow.y + firstRow.height / 2)),
  ).toBeLessThanOrEqual(1);
  // Without controls the rows start at the top: the svg is exactly the rows' height.
  await expect(c.locator("svg[role='img']").nth(1)).toHaveAttribute("height", "120");
  await expect(withControls.locator("svg[role='img']")).toHaveAttribute("height", "168");
});
