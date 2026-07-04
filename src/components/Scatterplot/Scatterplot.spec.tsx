import { expect, test } from "@playwright/experimental-ct-react";
import { Scatterplot } from "./Scatterplot";

// Pins the delegated-hover contract of the memo'd point layer (issue #14):
// per-point a11y attributes and <title> children stay, and hover/focus resolve
// through one handler pair on the series <g> via closest("[data-idx]").

const DATA = [
  { x: 1, y: 12 },
  { x: 2, y: 18 },
  { x: 3, y: 14 },
  { x: 4, y: 22 },
];

const SERIES = [{ name: "S", data: DATA }];

test("renders one focusable point per datum with a11y attrs and a <title>", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot series={SERIES} height={240} showLegend={false} />
    </div>,
  );
  await expect(c.locator("circle[data-idx]")).toHaveCount(4);
  const point = c.locator("circle[data-idx='1']");
  await expect(point).toHaveAttribute("role", "button");
  await expect(point).toHaveAttribute("aria-label", "S: 18");
  await expect(point.locator("title")).toHaveText("S: 18");
});

test("hovering a point shows the tooltip and marks the chart hovered", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot series={SERIES} height={240} showLegend={false} />
    </div>,
  );
  await c.locator("circle[data-idx='2']").hover();
  await expect(page.getByRole("tooltip")).toContainText("S");
  await expect(c.locator("[data-hovered='true']")).toHaveCount(1);
  await page.mouse.move(1, 1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(c.locator("[data-hovered='true']")).toHaveCount(0);
});

test("keyboard focus on a point shows the tooltip; blur hides it", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot series={SERIES} height={240} showLegend={false} />
    </div>,
  );
  const point = c.locator("circle[data-idx='0']");
  await point.focus();
  await expect(page.getByRole("tooltip")).toContainText("1, 12");
  await point.blur();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

// --- Interactive viewport (issue #27) --------------------------------------

// A 0..100 numeric line so announcement values are easy to reason about.
const ZOOM_SERIES = [
  {
    name: "Z",
    data: Array.from({ length: 101 }, (_, i) => ({ x: i, y: 50 + 40 * Math.sin(i / 7) })),
    showLine: true,
    showPoints: false,
  },
];

const ZOOMABLE_CHART = (
  <div style={{ width: 480 }}>
    <Scatterplot series={ZOOM_SERIES} height={240} showLegend={false} scaffolding="full" zoomable />
  </div>
);

test("wheel zoom is gated behind a click, then anchors at the cursor", async ({ mount, page }) => {
  const c = await mount(ZOOMABLE_CHART);
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");

  // Not armed yet: a plain wheel must not zoom (no Reset affordance).
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -240);
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);

  // Arm with a click, zoom in at 75% across the plot.
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -240);
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();

  // The live region reports the window; anchored at 75%, more range is cut on
  // the left than on the right.
  const announced = await c.locator("[aria-live]").textContent();
  const nums = (announced ?? "").match(/[\d.]+/g)?.map(Number) ?? [];
  const [from, to] = nums;
  if (from == null || to == null) throw new Error(`unparsable announcement: ${announced}`);
  expect(from).toBeGreaterThan(0);
  expect(to).toBeLessThan(100);
  expect(from).toBeGreaterThan(100 - to);
});

test("drag pans the zoomed window; double-click resets", async ({ mount, page }) => {
  const c = await mount(ZOOMABLE_CHART);
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;

  await page.mouse.click(cx, cy);
  await page.mouse.wheel(0, -480);
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();
  const before = await c.locator("[aria-live]").textContent();

  // Drag right = pan left (earlier values).
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 5 });
  await page.mouse.up();
  const after = await c.locator("[aria-live]").textContent();
  expect(after).not.toBe(before);
  const firstBefore = Number((before ?? "").match(/[\d.]+/)?.[0]);
  const firstAfter = Number((after ?? "").match(/[\d.]+/)?.[0]);
  expect(firstAfter).toBeLessThan(firstBefore);

  await page.mouse.dblclick(cx, cy);
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("keyboard: +/- zoom, arrows pan, 0 resets on the focused chart", async ({ mount, page }) => {
  const c = await mount(ZOOMABLE_CHART);
  const root = c.locator("[data-zoomable]");
  await root.focus();
  await page.keyboard.press("+");
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();
  const zoomed = await c.locator("[aria-live]").textContent();
  await page.keyboard.press("ArrowRight");
  const panned = await c.locator("[aria-live]").textContent();
  expect(panned).not.toBe(zoomed);
  await page.keyboard.press("0");
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);
});

test("annotations render as a non-interactive data-space overlay", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot
        series={SERIES}
        height={240}
        showLegend={false}
        scaffolding="full"
        annotations={[
          { type: "hline", y: 15, label: "Limit" },
          { type: "vline", x: 2, label: "Event" },
          { type: "rect", x1: 1, x2: 2, label: "Band" },
          { type: "measure", x1: 1, y1: 12, x2: 4, y2: 22 },
        ]}
      />
    </div>,
  );
  const overlay = c.locator("g[data-annotations]").last();
  await expect(overlay.locator("line")).toHaveCount(3); // hline + vline + measure
  await expect(overlay.locator("rect")).toHaveCount(1);
  await expect(overlay.locator("text").filter({ hasText: "Limit" })).toBeVisible();
  // Measure readout shows Δx and Δy (+83.3%).
  await expect(overlay.locator("text").filter({ hasText: "Δ 10" })).toBeVisible();
});

test("onPointActivate fires on click and Enter", async ({ mount }) => {
  const activated: string[] = [];
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot
        series={SERIES}
        height={240}
        showLegend={false}
        onPointActivate={(d) => activated.push(`${d.series}:${String(d.x)}`)}
      />
    </div>,
  );
  await c.locator("circle[data-idx='1']").click();
  await expect.poll(() => activated).toEqual(["S:2"]);
  await c.locator("circle[data-idx='3']").focus();
  await c.locator("circle[data-idx='3']").press("Enter");
  await expect.poll(() => activated).toEqual(["S:2", "S:4"]);
});
