import { expect, test } from "@playwright/experimental-ct-react";
import { BulletChart, type BulletItem } from "./BulletChart";
import { BulletChartHarness } from "./BulletChart.harness";

const KPIS: BulletItem[] = [
  {
    label: "Revenue",
    sublabel: "CHF",
    value: 1284500,
    target: 1400000,
    ranges: [900000, 1200000, 1600000],
  },
  {
    label: "Margin",
    sublabel: "%",
    value: 42.5,
    target: 45,
    ranges: [30, 40, 55],
    domain: [0, 60],
  },
  {
    label: "Churn",
    sublabel: "%",
    value: 2.3,
    target: 2,
    ranges: [1.5, 3, 5],
    domain: [0, 6],
    goodDirection: "down",
  },
];

const QUOTA: BulletItem[] = [
  { label: "North", value: 92, target: 100, ranges: [50, 100, 120] },
  { label: "South", value: 118, target: 100, ranges: [50, 100, 120] },
  { label: "West", value: 64, target: 100, ranges: [50, 100, 120] },
];

test("renders one row per item with Swiss-formatted values and target ticks", async ({ mount }) => {
  const c = await mount(<BulletChartHarness items={KPIS} />);
  await expect(c.locator("rect[data-row-hit]")).toHaveCount(3);
  await expect(c.locator("rect[data-target]")).toHaveCount(3);
  await expect(c.locator('[class*="value"]').getByText("1'284'500", { exact: true })).toBeVisible();
  await expect(c.locator('[class*="labelText"]').getByText("Revenue")).toBeVisible();
  // Three tiers per row, ranked: the churn row (down is good) reverses the ranks.
  await expect(c.locator('[data-row="0"] rect[data-rank]')).toHaveCount(4);
  await expect(c.locator('[data-row="0"] rect[data-rank]').first()).toHaveAttribute(
    "data-rank",
    "0",
  );
  await expect(c.locator('[data-row="2"] rect[data-rank]').first()).toHaveAttribute(
    "data-rank",
    "3",
  );
});

test("hover shows the tooltip with the label, value and target delta", async ({ mount }) => {
  const c = await mount(<BulletChartHarness items={KPIS} />);
  await c.locator("rect[data-row-hit]").nth(1).hover();
  const tip = c.page().getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Margin");
  await expect(tip).toContainText("42.5 / 45");
  await expect(tip).toContainText("-5.6% vs target");
});

test("selectable: clicking a row pins a popover and rings the measure; dismiss clears it", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BulletChart items={KPIS} selectable />
    </div>,
  );
  await c.locator("rect[data-row-hit]").nth(0).click();
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toBeVisible();
  await expect(c.locator("rect[data-selected]")).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss selection" }).click();
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toHaveCount(0);
  await expect(c.locator("rect[data-selected]")).toHaveCount(0);
});

test("a shared domain gives the panel one axis, and keyboard zoom windows it", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <BulletChartHarness items={QUOTA} domain={[0, 100]} scaffolding="full" zoomable controls />,
  );
  await expect(c.locator('[data-orientation="x"] [data-tick]').first()).toBeVisible();
  const toolbar = c.getByRole("toolbar", { name: "Chart controls" });
  await expect(toolbar).toBeVisible();
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("per-row scales: no zoom, no panel axis, and the hovered row shows its own scale", async ({
  mount,
}) => {
  const c = await mount(<BulletChartHarness items={KPIS} zoomable />);
  await expect(c.locator("[data-zoomable]")).toHaveCount(0);
  await expect(c.locator('[data-orientation="x"]')).toHaveCount(0);
  await expect(c.locator("[data-row-scale]")).toHaveCount(0);
  await c.locator("rect[data-row-hit]").nth(1).hover();
  await expect(c.locator("[data-row-scale]")).toHaveCount(1);
});

test("full scaffolding draws every row's scale", async ({ mount }) => {
  const c = await mount(<BulletChartHarness items={KPIS} scaffolding="full" />);
  await expect(c.locator("[data-row-scale]")).toHaveCount(3);
});

test("read-only annotations render as a data-space overlay on a shared scale", async ({
  mount,
}) => {
  const c = await mount(
    <BulletChartHarness
      items={QUOTA}
      domain={[0, 150]}
      scaffolding="full"
      annotations={[{ type: "vline", x: 100, label: "quota" }]}
    />,
  );
  await expect(c.locator("g[data-annotations]")).toHaveCount(1);
  await expect(c.getByText("quota")).toBeVisible();
});

test("fullscreen toggles the maximized data attribute", async ({ mount }) => {
  const c = await mount(<BulletChartHarness items={KPIS} fullscreen />);
  const root = c.locator("[data-scaffolding]").first();
  await expect(root).not.toHaveAttribute("data-expanded", "");
  await c.getByRole("button", { name: /fullscreen|maximize|expand/i }).click();
  await expect(root).toHaveAttribute("data-expanded", "");
});

test("vertical orientation lays the rows out as columns with the value axis beside them", async ({
  mount,
}) => {
  const c = await mount(
    <BulletChartHarness
      items={QUOTA}
      domain={[0, 150]}
      orientation="vertical"
      scaffolding="full"
      height={240}
    />,
  );
  await expect(c.locator('[data-orientation="y"] [data-tick]').first()).toBeVisible();
  await expect(c.locator("rect[data-row-hit]")).toHaveCount(3);
  // Columns: the three hit rects sit side by side, not stacked.
  const boxes = await c
    .locator("rect[data-row-hit]")
    .evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })),
    );
  expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(3);
});

test("long labels ellipsize with the full text in a title", async ({ mount }) => {
  const c = await mount(
    <BulletChartHarness
      width={300}
      items={[
        {
          label: "Average handling time per resolved support conversation",
          value: 6.2,
          target: 5,
          domain: [0, 10],
        },
        { label: "NPS", value: 38, target: 50, domain: [0, 100] },
      ]}
    />,
  );
  const first = c.locator('[class*="labelText"]').first();
  await expect(first).toHaveAttribute("title", /handling time/);
  const clipped = await first.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(clipped).toBe(true);
});

test("Enter on a focused row fires onPointActivate with the row's datum", async ({ mount }) => {
  const seen: string[] = [];
  const c = await mount(
    <div style={{ width: 480 }}>
      <BulletChart
        items={KPIS}
        onPointActivate={(d) => seen.push(`${d.index}:${d.label}:${d.tier}`)}
      />
    </div>,
  );
  const hit = c.locator("rect[data-row-hit]").nth(2);
  await hit.focus();
  await hit.press("Enter");
  await expect.poll(() => seen).toEqual(["2:Churn:1"]);
});

test("with controls the rows start below the toolbar; without them they start at the top", async ({
  mount,
}) => {
  // Editing adds the annotation tools, so the toolbar wraps to two lines at
  // this width: the inset must clear the wrapped toolbar too.
  const c = await mount(
    <BulletChartHarness items={QUOTA} domain={[0, 150]} zoomable controls editable />,
  );
  const toolbar = await c.getByRole("toolbar", { name: "Chart controls" }).boundingBox();
  const firstRow = await c.locator("rect[data-row-hit]").first().boundingBox();
  if (!toolbar || !firstRow) throw new Error("missing boxes");
  expect(firstRow.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
  // The label column follows the same inset, so its first row stays level with the bar.
  const firstLabel = await c.locator('[class*="labelText"]').first().boundingBox();
  if (!firstLabel) throw new Error("missing label box");
  const rowCentre = firstRow.y + firstRow.height / 2;
  expect(Math.abs(firstLabel.y + firstLabel.height / 2 - rowCentre)).toBeLessThanOrEqual(2);
});

test("without controls the rows start at the plot's top edge", async ({ mount }) => {
  const plain = await mount(<BulletChartHarness items={QUOTA} domain={[0, 150]} zoomable />);
  const plainRow = await plain.locator("rect[data-row-hit]").first().boundingBox();
  const plainPlot = await plain.locator("svg[role='img']").boundingBox();
  if (!plainRow || !plainPlot) throw new Error("missing boxes");
  expect(Math.abs(plainRow.y - plainPlot.y)).toBeLessThanOrEqual(1);
});
