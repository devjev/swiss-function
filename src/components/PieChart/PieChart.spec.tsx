import { expect, test } from "@playwright/experimental-ct-react";
import type { PieSlice } from "./PieChart";
import { PieHarness } from "./PieChart.harness";

const DATA: PieSlice[] = [
  { name: "Equity", value: 50 },
  { name: "Bonds", value: 30 },
  { name: "Alternatives", value: 15 },
  { name: "Cash", value: 5 },
];

test("draws one slice per part, sorted biggest first, each with its share", async ({ mount }) => {
  const c = await mount(<PieHarness data={DATA} height={320} />);
  await expect(c.locator("svg path[data-chart-mark]")).toHaveCount(4);
  await expect(c.getByRole("button", { name: "Equity: 50, 50%" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Cash: 5, 5%" })).toBeVisible();
  // The printed figure defaults to the share.
  await expect(c.locator("svg text").filter({ hasText: "Equity" })).toContainText("50%");
});

test("drops parts that carry no share of a whole", async ({ mount }) => {
  const c = await mount(
    <PieHarness data={[...DATA, { name: "Nothing", value: 0 }]} height={320} />,
  );
  await expect(c.locator("svg path[data-chart-mark]")).toHaveCount(4);
});

test("hovering a slice shows its value and share and fades the others", async ({ mount }) => {
  const c = await mount(<PieHarness data={DATA} height={320} />);
  await c.getByRole("button", { name: /^Bonds:/ }).hover();
  await expect(c.page().getByText("30 · 30%")).toBeVisible();
  await expect(c.locator("svg path[data-faded]")).toHaveCount(3);
});

test("click and Enter report the slice", async ({ mount }) => {
  const c = await mount(<PieHarness data={DATA} height={320} />);
  await c.getByRole("button", { name: /^Alternatives:/ }).click();
  await expect(c.getByTestId("log")).toHaveText("Alternatives");
  await c.getByRole("button", { name: /^Cash:/ }).focus();
  await c.page().keyboard.press("Enter");
  await expect(c.getByTestId("log")).toHaveText("Alternatives,Cash");
});

test("selectable: a click pins a popover, a second click on the same slice clears it", async ({
  mount,
}) => {
  const c = await mount(<PieHarness data={DATA} height={320} controlled />);
  const slice = c.getByRole("button", { name: /^Equity:/ });
  await slice.click();
  await expect(c.getByTestId("selection")).toHaveText("Equity");
  await expect(c.page().getByRole("dialog")).toContainText("50%");
  await expect(slice).toHaveAttribute("data-selected", "");
  await slice.click();
  await expect(c.getByTestId("selection")).toHaveText("none");
});

test("innerRadius cuts a hole and the centre slot reads out the focused slice", async ({
  mount,
}) => {
  const c = await mount(<PieHarness data={DATA} height={320} innerRadius={0.6} centerSlot />);
  await expect(c.getByTestId("centre")).toHaveText("Total");
  // A ring segment is two arcs; a wedge would start at the centre with an L.
  const d = await c.locator("svg path[data-chart-mark]").first().getAttribute("d");
  expect(d?.match(/A /g)?.length).toBe(2);
  await c.getByRole("button", { name: /^Bonds:/ }).hover();
  await expect(c.getByTestId("centre")).toHaveText("Bonds");
});

test("a pie has no hole and no centre readout", async ({ mount }) => {
  const c = await mount(<PieHarness data={DATA} height={320} centerSlot />);
  await expect(c.getByTestId("centre")).toHaveCount(0);
  const d = await c.locator("svg path[data-chart-mark]").first().getAttribute("d");
  expect(d?.startsWith("M ")).toBe(true);
  expect(d).toContain(" L ");
});

test("maxSlices groups the tail into one named remainder", async ({ mount }) => {
  const c = await mount(
    <PieHarness
      data={[...DATA, { name: "Gold", value: 3 }, { name: "Crypto", value: 2 }]}
      height={320}
      maxSlices={4}
      otherLabel="Rest"
    />,
  );
  await expect(c.locator("svg path[data-chart-mark]")).toHaveCount(4);
  const rest = c.getByRole("button", { name: /^Rest:/ });
  await expect(rest).toBeVisible();
  await rest.hover();
  await expect(c.page().getByText("3 parts")).toBeVisible();
});

test("one part fills the circle as a closed arc, not a degenerate one", async ({ mount }) => {
  const c = await mount(<PieHarness data={[{ name: "Cash", value: 12 }]} height={320} />);
  const slice = c.locator("svg path[data-chart-mark]");
  await expect(slice).toHaveCount(1);
  const box = await slice.boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);
});

test("labels off, legend on, and the framed full posture", async ({ mount }) => {
  const c = await mount(
    <PieHarness data={DATA} height={320} labels="none" legend frame scaffolding="full" />,
  );
  await expect(c.locator("svg text")).toHaveCount(0);
  await expect(c.locator('[class*="legendItem"]')).toHaveCount(4);
  await expect(c.locator('[class*="frame"]')).toHaveCount(1);
  // The percent ring: one tick every 5%.
  await expect(c.locator('svg line[class*="ringTick"]')).toHaveCount(20);
});

test("the minimal posture drops the ring and the hairlines between slices", async ({ mount }) => {
  const c = await mount(<PieHarness data={DATA} height={320} scaffolding="minimal" />);
  await expect(c.locator('svg line[class*="ringTick"]')).toHaveCount(0);
});

test("valueFormat and categoryFormat reach the labels, tooltip and accessible name", async ({
  mount,
}) => {
  const c = await mount(<PieHarness data={DATA} height={320} showValues="value" formatted />);
  await expect(c.getByRole("button", { name: "equity: CHF 50k, 50%" })).toBeVisible();
  await expect(c.locator("svg text").filter({ hasText: "equity" })).toContainText("CHF 50k");
});

test("a long name is ellipsized, never rotated, and keeps its full text", async ({ mount }) => {
  const c = await mount(
    <PieHarness
      width={360}
      height={320}
      data={[
        { name: "A remarkably long holding name that will not fit", value: 60 },
        { name: "Cash", value: 40 },
      ]}
    />,
  );
  const label = c.locator("svg text").first();
  await expect(label).toContainText("…");
  await expect(label).not.toHaveAttribute("transform", /rotate/);
  await expect(label.locator("title")).toHaveText(
    "A remarkably long holding name that will not fit",
  );
});
