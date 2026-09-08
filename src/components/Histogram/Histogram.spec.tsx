import { expect, test } from "@playwright/experimental-ct-react";
import { Histogram } from "./Histogram";
import { HistogramHarness } from "./Histogram.harness";

// Three explicit bins over a small sample: [0,10) has 3, [10,20) has 2, [20,30]
// has 4 (30 is the maximum and lands in the closed last bin).
const DATA = [1, 2, 3, 12, 15, 21, 22, 25, 30];
const EDGES = [0, 10, 20, 30];

test("bins the sample into focusable rects with a11y attrs and a <title>", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Histogram data={DATA} bins={EDGES} height={240} />
    </div>,
  );
  const bars = c.locator("rect[data-idx]");
  await expect(bars).toHaveCount(3);
  const last = c.locator("rect[data-idx='2']");
  await expect(last).toHaveAttribute("role", "button");
  await expect(last).toHaveAttribute("aria-label", "Values: 20 to 30, 4");
  await expect(last.locator("title")).toHaveText("Values: 20 to 30, 4");
  // Flush bins: the second bar starts where the first ends.
  const b0 = await c.locator("rect[data-idx='0']").boundingBox();
  const b1 = await c.locator("rect[data-idx='1']").boundingBox();
  if (!b0 || !b1) throw new Error("no bar boxes");
  expect(Math.abs(b0.x + b0.width - b1.x)).toBeLessThanOrEqual(1);
});

test("hovering a bin shows the range and count and marks the chart hovered", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Histogram data={DATA} bins={EDGES} height={240} />
    </div>,
  );
  await c.locator("rect[data-idx='1']").hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("10 to 20");
  await expect(tooltip).toContainText("count: 2");
  await expect(c.locator("[data-hovered='true']")).toHaveCount(1);
  await page.mouse.move(1, 1);
  await expect(c.locator("[data-hovered='true']")).toHaveCount(0);
});

test("normalize=percent reports the share; cumulative draws a step line over hit areas", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Histogram data={DATA} bins={EDGES} height={240} normalize="percent" cumulative />
    </div>,
  );
  await expect(c.locator("path[data-cumulative]")).toHaveCount(1);
  await c.locator("rect[data-idx='1']").hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("share: 22.2%");
  await expect(tooltip).toContainText("cumulative: 55.6%");
});

test("density overlays one curve per series", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Histogram
        series={[
          { name: "A", data: DATA, color: "var(--sf-color-primary)" },
          { name: "B", data: DATA.map((v) => v + 3), color: "var(--sf-color-success)" },
        ]}
        bins={EDGES}
        density
        height={240}
      />
    </div>,
  );
  await expect(c.locator("path[data-density]")).toHaveCount(2);
  await expect(c.locator("svg[data-overlaid]")).toHaveCount(1);
  await expect(c.locator("rect[data-idx]")).toHaveCount(6);
});

test("onPointActivate fires on click and Enter with the bin datum", async ({ mount }) => {
  const c = await mount(<HistogramHarness zoomable={false} controls={false} />);
  await c.locator("rect[data-idx='10']").click();
  await expect(c.getByTestId("last")).toHaveText(/^0:4:\d+$/);
  await c.locator("rect[data-idx='9']").focus();
  await c.locator("rect[data-idx='9']").press("Enter");
  await expect(c.getByTestId("last")).toHaveText(/^-4:0:\d+$/);
});

test("selectable: clicking a bin pins a popover and rings it; the close button dismisses", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Histogram data={DATA} bins={EDGES} height={240} selectable />
    </div>,
  );
  await c.locator("rect[data-idx='2']").click();
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toBeVisible();
  await expect(c.locator("rect[data-selected]")).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss selection" }).click();
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toHaveCount(0);
  await expect(c.locator("rect[data-selected]")).toHaveCount(0);
});

test("zoomable: wheel after a click windows x and the live region reports it; dblclick resets", async ({
  mount,
  page,
}) => {
  const c = await mount(<HistogramHarness controls={false} />);
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;
  await page.mouse.click(cx, cy);
  await page.mouse.wheel(0, -480);
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();
  const announced = await c.locator("[aria-live]").textContent();
  const nums = (announced ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
  const [from, to] = nums;
  if (from == null || to == null) throw new Error(`unparsable announcement: ${announced}`);
  expect(from).toBeGreaterThan(-40);
  expect(to).toBeLessThan(40);
  // Off-window bins are not rendered.
  const visible = await c.locator("rect[data-idx]").count();
  expect(visible).toBeLessThan(20);
  await page.mouse.dblclick(cx, cy);
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await expect(c.locator("rect[data-idx]")).toHaveCount(20);
});

test("controls: the toolbar renders and an hline annotation places on click", async ({
  mount,
  page,
}) => {
  const seen: unknown[] = [];
  const c = await mount(<HistogramHarness onChange={(next) => seen.push(next)} />);
  await expect(c.getByRole("toolbar")).toBeVisible();
  await c.getByRole("button", { name: "Horizontal line" }).click();
  const svg = c.locator("svg[role='img']");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await expect.poll(() => seen.length).toBe(1);
  const drawn = (seen[0] as { type: string; y: number }[])[0];
  if (!drawn || drawn.type !== "hline") throw new Error(`expected an hline, got ${drawn?.type}`);
  expect(drawn.y).toBeGreaterThan(0);
  // Snaps back to select after the draw.
  await expect(c.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
});

test("full scaffolding draws the y axis ticks; minimal draws none", async ({ mount }) => {
  const full = await mount(
    <div style={{ width: 480 }}>
      <Histogram data={DATA} bins={EDGES} height={240} scaffolding="full" frame />
    </div>,
  );
  await expect(full.locator("[data-scaffolding='full']")).toHaveCount(1);
  const yTicks = full.locator("[data-orientation='y'] [data-tick]");
  expect(await yTicks.count()).toBeGreaterThan(1);
  await full.unmount();
  const minimal = await mount(
    <div style={{ width: 480 }}>
      <Histogram data={DATA} bins={EDGES} height={240} scaffolding="minimal" />
    </div>,
  );
  await expect(minimal.locator("[data-orientation='y'] [data-tick]")).toHaveCount(0);
});
