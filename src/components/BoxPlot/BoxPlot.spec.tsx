import { expect, test } from "@playwright/experimental-ct-react";
import { type BoxDatum, BoxPlot } from "./BoxPlot";

const CATEGORIES = ["A", "B", "C"];
const VALUES = [
  [10, 12, 15, 18, 20, 22, 25, 30, 90],
  [40, 42, 45, 48, 50, 52, 55, 60],
  [5, 6, 7, 8, 9, 10, 11, 12],
];
const SERIES = [{ name: "S", values: VALUES }];

test("renders one hit target per cell and the quartile form at rest", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot categories={CATEGORIES} series={SERIES} height={240} />
    </div>,
  );
  await expect(c.locator("rect[data-chart-mark]")).toHaveCount(3);
  await expect(c.locator("[data-shape='quartile']")).toHaveCount(1);
  await expect(c.locator("rect[data-box]")).toHaveCount(0);
  // The 90 in A is a Tukey outlier: one hollow dot.
  await expect(c.locator("circle[class*='outlier']")).toHaveCount(1);
});

test("full scaffolding draws boxes; an explicit shape wins", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot categories={CATEGORIES} series={SERIES} height={240} scaffolding="full" />
    </div>,
  );
  await expect(c.locator("rect[data-box]")).toHaveCount(3);
  await c.unmount();
  const v = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot categories={CATEGORIES} series={SERIES} height={240} shape="violin" />
    </div>,
  );
  await expect(v.locator("path[data-violin]")).toHaveCount(3);
});

test("hovering a cell shows the five numbers and the sample size", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot categories={CATEGORIES} series={SERIES} height={240} />
    </div>,
  );
  await c.locator("rect[data-chart-mark]").nth(1).hover();
  const tip = page.locator("[role='tooltip']");
  await expect(tip).toContainText("B");
  await expect(tip).toContainText("median");
  await expect(tip).toContainText("49");
  await expect(tip).toContainText("n");
  await expect(tip).toContainText("8");
});

test("precomputed stats render as given", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot
        categories={["X"]}
        series={[{ name: "S", stats: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5, n: 77 }] }]}
        height={240}
        scaffolding="full"
      />
    </div>,
  );
  await c.locator("rect[data-chart-mark]").first().hover();
  await expect(page.locator("[role='tooltip']")).toContainText("77");
  await expect(c.locator("rect[data-chart-mark]").first()).toHaveAttribute(
    "aria-label",
    "X: median 3",
  );
});

test("selectable: clicking a cell pins a popover and rings it; dismiss clears", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot categories={CATEGORIES} series={SERIES} height={240} selectable />
    </div>,
  );
  await c.locator("rect[data-chart-mark]").nth(2).click();
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toBeVisible();
  await expect(c.locator("rect[data-selected]")).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss selection" }).click();
  await expect(c.locator("rect[data-selected]")).toHaveCount(0);
});

test("onPointActivate fires with the cell's datum on Enter", async ({ mount }) => {
  const seen: BoxDatum[] = [];
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot
        categories={CATEGORIES}
        series={SERIES}
        height={240}
        onPointActivate={(d) => seen.push(d)}
      />
    </div>,
  );
  const cell = c.locator("rect[data-chart-mark]").first();
  await cell.focus();
  await cell.press("Enter");
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.category).toBe("A");
  expect(seen[0]?.stats.median).toBe(20);
});

test("zoomable: the toolbar renders and keyboard zoom windows the value axis", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot
        categories={CATEGORIES}
        series={SERIES}
        valueDomain={[0, 100]}
        height={240}
        scaffolding="full"
        zoomable
        controls
      />
    </div>,
  );
  await expect(c.getByRole("toolbar", { name: "Chart controls" })).toBeVisible();
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("horizontal: values run along x and categories down the side", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot
        categories={CATEGORIES}
        series={SERIES}
        valueDomain={[0, 100]}
        height={240}
        orientation="horizontal"
        scaffolding="full"
        zoomable
      />
    </div>,
  );
  await expect(c.locator("[data-orientation='horizontal']")).toHaveCount(1);
  await expect(c.locator("[data-orientation='y'] [data-tick]")).toHaveCount(3);
  await expect
    .poll(async () => c.locator("[data-orientation='x'] [data-tick]").count())
    .toBeGreaterThan(2);
  // The boxes lie along x: wider than tall.
  const box = await c.locator("rect[data-box]").first().boundingBox();
  if (!box) throw new Error("no box");
  expect(box.width).toBeGreaterThan(box.height);
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
});

test("clipOutliers keeps the domain to the whiskers and pins far outliers at the edge", async ({
  mount,
}) => {
  const values = [
    [10, 12, 15, 18, 20, 22, 25, 30, 900, 950],
    [40, 42, 45, 48, 50, 52, 55, 60],
  ];
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot
        categories={["A", "B"]}
        series={[{ name: "S", values }]}
        height={240}
        scaffolding="full"
        clipOutliers
      />
    </div>,
  );
  const pinned = c.locator("g[data-pinned='high']");
  await expect(pinned).toHaveCount(1);
  await expect(pinned.locator("text")).toHaveText("+2");
  const svg = await c.locator("svg[role='img']").boundingBox();
  const dot = await pinned.locator("circle").boundingBox();
  if (!svg || !dot) throw new Error("missing boxes");
  expect(dot.y - svg.y).toBeLessThan(10);
  // With the whiskers setting the domain, A's box sits well inside the plot.
  const box = await c.locator("rect[data-box]").first().boundingBox();
  if (!box) throw new Error("no box");
  expect(box.height).toBeGreaterThan(20);
});

test("read-only annotations render as a data-space overlay", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <BoxPlot
        categories={CATEGORIES}
        series={SERIES}
        height={240}
        scaffolding="full"
        annotations={[{ type: "hline", y: 50, label: "target" }]}
      />
    </div>,
  );
  await expect(c.locator("g[data-annotations]")).toHaveCount(1);
  await expect(c.getByText("target")).toBeVisible();
});

test("many categories in a narrow container: labels thin or ellipsize, never overlap", async ({
  mount,
}) => {
  const categories = Array.from({ length: 24 }, (_, i) => `Endpoint number ${i + 1}`);
  const values = categories.map((_, i) => [i, i + 1, i + 2, i + 4, i + 8]);
  const c = await mount(
    <div style={{ width: 360 }}>
      <BoxPlot categories={categories} series={[{ name: "S", values }]} height={240} />
    </div>,
  );
  await expect
    .poll(async () => c.locator("[data-orientation='x'] [data-tick]").count())
    .toBeGreaterThan(1);
  const boxes = await c
    .locator("[data-orientation='x'] [data-tick]")
    .evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })),
    );
  const sorted = [...boxes].sort((a, b) => a.left - b.left);
  for (let i = 1; i < sorted.length; i++) {
    expect((sorted[i] as { left: number }).left).toBeGreaterThanOrEqual(
      (sorted[i - 1] as { right: number }).right - 1,
    );
  }
});
