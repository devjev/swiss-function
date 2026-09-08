import { expect, test } from "@playwright/experimental-ct-react";
import { Slopegraph } from "./Slopegraph";

const COLUMNS = ["2010", "2020"];
const SERIES = [
  { name: "Alpha", values: [10, 30] },
  { name: "Beta", values: [20, 20] },
  { name: "Gamma", values: [30, 10] },
  { name: "Delta", values: [40, 45] },
];

test("renders a header per column and a line per entity", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={SERIES} height={240} />
    </div>,
  );
  await expect(c.getByText("2010")).toBeVisible();
  await expect(c.getByText("2020")).toBeVisible();
  await expect(c.locator("path[data-chart-mark]")).toHaveCount(4);
  // Names and numbers on both sides.
  await expect(c.locator("text", { hasText: "Alpha" })).toHaveCount(2);
});

test("hovering a line shows the tooltip with every column's value", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={SERIES} height={240} />
    </div>,
  );
  // Gamma falls left to right: a tenth of the way along sits near its top-left.
  const box = await c.locator('path[aria-label^="Gamma"]').boundingBox();
  if (!box) throw new Error("no hit box");
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Gamma");
  await expect(tip).toContainText("2010: 30");
  await expect(tip).toContainText("2020: 10");
});

test("keyboard focus on a line shows the tooltip; Enter fires onPointActivate", async ({
  mount,
  page,
}) => {
  const seen: string[] = [];
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph
        columns={COLUMNS}
        series={SERIES}
        height={240}
        onPointActivate={(d) => seen.push(`${d.name}@${d.column}=${d.value}`)}
      />
    </div>,
  );
  await c.locator('path[aria-label^="Beta"]').focus();
  await expect(page.getByRole("tooltip")).toContainText("Beta");
  await page.keyboard.press("Enter");
  expect(seen).toEqual(["Beta@2010=20"]);
});

test("selectable: clicking a line pins a popover; the close button dismisses it", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={SERIES} height={240} selectable />
    </div>,
  );
  // Alpha rises left to right and crosses Gamma in the middle, so click a tenth
  // of the way along, near its bottom-left, where no other line intercepts.
  const box = await c.locator('path[aria-label^="Alpha"]').boundingBox();
  if (!box) throw new Error("no hit box");
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.9);
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toBeVisible();
  await expect(c.locator("g[data-selected]")).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss selection" }).click();
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toHaveCount(0);
  await expect(c.locator("g[data-selected]")).toHaveCount(0);
});

test("ties stack: equal values get labels at least a label height apart", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph
        columns={COLUMNS}
        series={[
          { name: "One", values: [50, 50] },
          { name: "Two", values: [50, 50] },
          { name: "Three", values: [50, 50] },
        ]}
        height={240}
      />
    </div>,
  );
  const ys = await c
    .locator('text[text-anchor="end"]')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("y"))).sort((a, b) => a - b));
  expect(ys).toHaveLength(3);
  expect((ys[1] as number) - (ys[0] as number)).toBeGreaterThanOrEqual(14);
  expect((ys[2] as number) - (ys[1] as number)).toBeGreaterThanOrEqual(14);
});

test("too many entities for the height: names thin, lines stay", async ({ mount }) => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    name: `Entity ${i}`,
    values: [i, 40 - i],
  }));
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={many} height={200} />
    </div>,
  );
  await expect(c.locator("path[data-chart-mark]")).toHaveCount(40);
  const labels = await c.locator('text[text-anchor="end"]').count();
  expect(labels).toBeLessThan(40);
  expect(labels).toBeGreaterThan(2);
  // Top and bottom entities keep their labels.
  await expect(c.locator('text[text-anchor="end"]', { hasText: "Entity 0" })).toHaveCount(1);
  await expect(c.locator('text[text-anchor="end"]', { hasText: "Entity 39" })).toHaveCount(1);
});

test("rank mode puts the highest value at the top of every column", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={SERIES} y="rank" height={240} />
    </div>,
  );
  const startY = await c
    .locator('text[text-anchor="end"]')
    .evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [el.textContent?.replace(/\d+$/, "").trim(), Number(el.getAttribute("y"))]),
      ),
    );
  // Column 2010: Delta 40 > Gamma 30 > Beta 20 > Alpha 10.
  expect(startY.Delta).toBeLessThan(startY.Gamma as number);
  expect(startY.Gamma).toBeLessThan(startY.Beta as number);
  expect(startY.Beta).toBeLessThan(startY.Alpha as number);
});

test("direction tone tags rising, falling and flat lines", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={SERIES} tone="direction" height={240} />
    </div>,
  );
  await expect(c.locator('g[data-dir="up"]')).toHaveCount(2);
  await expect(c.locator('g[data-dir="down"]')).toHaveCount(1);
  await expect(c.locator('g[data-dir="flat"]')).toHaveCount(1);
  await expect(c.locator("[data-tone='direction']")).toHaveCount(1);
});

test("scaffolding and frame: rules are drawn in full mode, the frame class applies", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph columns={COLUMNS} series={SERIES} height={240} scaffolding="full" frame />
    </div>,
  );
  const root = c.locator("[data-scaffolding='full']");
  await expect(root).toHaveCount(1);
  await expect(root).toHaveClass(/frame/);
  const rules = c.locator('line[class*="rule"]');
  await expect(rules).toHaveCount(2);
  const opacity = await rules.first().evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
});

test("minimal scaffolding draws no rules; a null breaks the line", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Slopegraph
        columns={["A", "B", "C"]}
        series={[{ name: "Broken", values: [1, null, 3] }]}
        scaffolding="minimal"
        height={200}
      />
    </div>,
  );
  await expect(c.locator('line[class*="rule"]')).toHaveCount(0);
  await expect(c.locator("path[data-chart-mark]")).toHaveCount(0);
  await expect(c.locator("circle[data-chart-mark]")).toHaveCount(2);
});
