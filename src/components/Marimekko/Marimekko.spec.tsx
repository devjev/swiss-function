import { expect, test } from "@playwright/experimental-ct-react";
import { MarimekkoHarness } from "./Marimekko.harness";

const CATEGORIES = ["North", "East", "South", "West"];
const SERIES = [
  { name: "A", values: [50, 20, 10, 5] },
  { name: "B", values: [30, 20, 10, 5] },
  { name: "C", values: [20, 10, 10, 10] },
];

test("renders one segment per series per column, widths by column total", async ({ mount }) => {
  const c = await mount(
    <MarimekkoHarness categories={CATEGORIES} series={SERIES} height={240} gap={0} />,
  );
  const marks = c.locator("rect[data-chart-mark]");
  await expect(marks).toHaveCount(12);
  // Column totals 100 : 50 : 30 : 20, so the first column is twice the second.
  const first = await marks.nth(0).boundingBox();
  const second = await marks.nth(3).boundingBox();
  if (!first || !second) throw new Error("missing boxes");
  expect(first.width / second.width).toBeGreaterThan(1.9);
  expect(first.width / second.width).toBeLessThan(2.1);
});

test("normalized columns stack to the full plot height", async ({ mount }) => {
  const c = await mount(<MarimekkoHarness categories={CATEGORIES} series={SERIES} height={240} />);
  const svg = await c.locator("svg[role='img']").boundingBox();
  const marks = c.locator("rect[data-chart-mark]");
  if (!svg) throw new Error("no svg");
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const b = await marks.nth(i).boundingBox();
    if (!b) throw new Error("missing box");
    sum += b.height;
  }
  // Each rect's box includes its 1px hairline stroke.
  expect(Math.abs(sum - svg.height)).toBeLessThanOrEqual(4);
  // The 50 / 30 / 20 split of the first column.
  const top = await marks.nth(0).boundingBox();
  if (!top) throw new Error("missing box");
  expect(top.height / svg.height).toBeGreaterThan(0.47);
  expect(top.height / svg.height).toBeLessThan(0.53);
});

test("hover shows the tooltip with the share of column and of total", async ({ mount }) => {
  const c = await mount(<MarimekkoHarness categories={CATEGORIES} series={SERIES} height={240} />);
  await c.locator("rect[data-chart-mark]").first().hover();
  const tip = c.page().getByRole("tooltip");
  await expect(tip).toContainText("North");
  await expect(tip).toContainText("A: 50");
  await expect(tip).toContainText("50% of column");
  await expect(tip).toContainText("25% of total");
});

test("segment labels print only where they fit", async ({ mount }) => {
  const c = await mount(
    <MarimekkoHarness
      categories={["Wide", "Narrow"]}
      series={[
        { name: "Big", values: [96, 4] },
        { name: "Small", values: [4, 1] },
      ]}
      height={240}
    />,
  );
  const labels = c.locator("svg text");
  // The 96% segment of the wide column carries its label; the 4% slivers do not.
  await expect(labels).toHaveCount(1);
  await expect(labels.first()).toHaveText("96%");
});

test("activate fires with the datum on click and Enter", async ({ mount }) => {
  const c = await mount(
    <MarimekkoHarness categories={CATEGORIES} series={SERIES} height={240} logActivate />,
  );
  const mark = c.locator("rect[data-chart-mark]").nth(1);
  await mark.click();
  await expect(c.getByTestId("activated")).toContainText('"category":"North"');
  await expect(c.getByTestId("activated")).toContainText('"series":"B"');
  await expect(c.getByTestId("activated")).toContainText('"share":0.3');
  await c.locator("rect[data-chart-mark]").nth(4).focus();
  await c.page().keyboard.press("Enter");
  await expect(c.getByTestId("activated")).toContainText('"category":"East"');
});

test("selectable: a click pins a popover and rings the segment; the close button clears it", async ({
  mount,
}) => {
  const c = await mount(
    <MarimekkoHarness categories={CATEGORIES} series={SERIES} height={240} selectable />,
  );
  const mark = c.locator("rect[data-chart-mark]").first();
  await mark.click();
  await expect(mark).toHaveAttribute("data-selected", "true");
  const dismiss = c.page().getByRole("button", { name: "Dismiss selection" });
  await expect(dismiss).toBeVisible();
  await expect(c.page().getByText("50% of column").last()).toBeVisible();
  await dismiss.click();
  await expect(mark).not.toHaveAttribute("data-selected", "true");
});

test("absolute stacks zoom the value axis from the keyboard; normalized ones ignore zoomable", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <MarimekkoHarness
      categories={CATEGORIES}
      series={SERIES}
      normalize={false}
      valueDomain={[0, 100]}
      zoomable
      controls
      scaffolding="full"
      height={240}
    />,
  );
  await expect(c.getByRole("toolbar", { name: "Chart controls" })).toBeVisible();
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("normalized stacks ignore zoomable: there is nothing to window", async ({ mount }) => {
  const c = await mount(
    <MarimekkoHarness categories={CATEGORIES} series={SERIES} zoomable height={240} />,
  );
  await expect(c.locator("rect[data-chart-mark]")).toHaveCount(12);
  await expect(c.locator("[data-zoomable]")).toHaveCount(0);
});

test("full scaffolding shows the percent axis and gridlines; the frame class applies", async ({
  mount,
}) => {
  const c = await mount(
    <MarimekkoHarness
      categories={CATEGORIES}
      series={SERIES}
      scaffolding="full"
      frame
      height={240}
    />,
  );
  await expect(c.locator("[data-scaffolding='full']")).toHaveCount(1);
  await expect(c.getByText("100%", { exact: true })).toBeVisible();
  await expect(c.getByText("50%", { exact: true }).first()).toBeVisible();
  const root = c.locator("[data-scaffolding]").first();
  await expect(root).toHaveClass(/frame/);
});

test("horizontal: rows stack left to right and the row labels sit on the y axis", async ({
  mount,
}) => {
  const c = await mount(
    <MarimekkoHarness
      categories={CATEGORIES}
      series={SERIES}
      orientation="horizontal"
      height={240}
    />,
  );
  const marks = c.locator("rect[data-chart-mark]");
  const attr = async (i: number, name: string) => Number(await marks.nth(i).getAttribute(name));
  // The first row's segments share its y and run left to right.
  expect(await attr(0, "y")).toBe(await attr(1, "y"));
  expect(await attr(1, "x")).toBe((await attr(0, "x")) + (await attr(0, "width")));
  expect(await attr(0, "height")).toBeGreaterThan(await attr(3, "height"));
  await expect(c.locator("[data-orientation='y']").getByText("North")).toBeVisible();
});

test("many narrow columns: labels ellipsize with the full text in a title and never overlap", async ({
  mount,
}) => {
  const categories = Array.from({ length: 12 }, (_, i) => `Product line ${i + 1}`);
  const series = [{ name: "A", values: categories.map(() => 10) }];
  const c = await mount(
    <MarimekkoHarness categories={categories} series={series} height={240} width={720} />,
  );
  const labels = c.locator("[data-orientation='x'] [title]");
  expect(await labels.count()).toBeGreaterThan(0);
  const boxes: { x: number; width: number }[] = [];
  const all = c.locator("[data-orientation='x'] [data-tick] span:not([aria-hidden])");
  const count = await all.count();
  for (let i = 0; i < count; i++) {
    const b = await all.nth(i).boundingBox();
    if (b && b.width > 0) boxes.push({ x: b.x, width: b.width });
  }
  boxes.sort((p, q) => p.x - q.x);
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const cur = boxes[i];
    if (!prev || !cur) continue;
    expect(cur.x).toBeGreaterThanOrEqual(prev.x + prev.width - 1);
  }
});
