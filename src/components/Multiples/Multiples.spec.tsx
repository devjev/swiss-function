import { expect, test } from "@playwright/experimental-ct-react";
import { BarMultiplesHarness, MultiplesHarness } from "./Multiples.harness";

test("renders one titled panel per item in a row-major grid", async ({ mount }) => {
  const c = await mount(<MultiplesHarness count={5} columns={3} />);
  const panels = c.locator("[data-panel]");
  await expect(panels).toHaveCount(5);
  await expect(c.locator("[data-columns]")).toHaveAttribute("data-columns", "3");
  await expect(c.locator("[data-columns]")).toHaveAttribute("data-rows", "2");
  await expect(panels.nth(0).locator('[class*="title"]')).toHaveText("T1");
  await expect(panels.nth(3)).toHaveAttribute("data-row", "1");
  await expect(panels.nth(3)).toHaveAttribute("data-col", "0");
  await expect(c.locator('svg[role="img"]')).toHaveCount(5);
});

test("auto columns follow the container width and the minimum panel width", async ({ mount }) => {
  const wide = await mount(<MultiplesHarness count={8} width={900} minPanelWidth={200} gap={1} />);
  await expect(wide.locator("[data-columns]")).toHaveAttribute("data-columns", "4");
  await wide.unmount();
  const narrow = await mount(
    <MultiplesHarness count={8} width={300} minPanelWidth={200} gap={1} />,
  );
  await expect(narrow.locator("[data-columns]")).toHaveAttribute("data-columns", "1");
});

test("a zoom in one panel windows every panel (linked x)", async ({ mount, page }) => {
  const c = await mount(<MultiplesHarness count={2} columns={2} />);
  const second = c.locator("[data-panel]").nth(1);
  const secondTicks = second.locator('[data-orientation="x"] [data-tick]');
  await expect(secondTicks.first()).toBeVisible();
  const before = await secondTicks.allTextContents();

  // Scatterplot gates the plain wheel behind a click on the chart.
  const first = c.locator("[data-panel]").nth(0).locator('svg[role="img"]');
  const box = await first.boundingBox();
  if (!box) throw new Error("no plot box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);

  await expect(c.getByTestId("domain")).not.toHaveText("full");
  await expect
    .poll(async () => (await secondTicks.allTextContents()).join())
    .not.toBe(before.join());
  await expect(c.locator("[data-zoomed]")).toHaveCount(1);
});

test("a reset in one panel returns every panel to its full extent", async ({ mount, page }) => {
  const c = await mount(<MultiplesHarness count={2} columns={2} />);
  const first = c.locator("[data-panel]").nth(0).locator('svg[role="img"]');
  const box = await first.boundingBox();
  if (!box) throw new Error("no plot box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);
  await expect(c.getByTestId("domain")).not.toHaveText("full");
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(c.getByTestId("domain")).toHaveText("full");
  await expect(c.locator("[data-zoomed]")).toHaveCount(0);
});

test("outer axes: one x axis per column and one y axis per row, the panels axis-less", async ({
  mount,
}) => {
  const c = await mount(
    <MultiplesHarness
      count={5}
      columns={3}
      axes="outer"
      xDomain={[0, 59]}
      yDomain={[80, 120]}
      link="both"
    />,
  );
  await expect(c.locator("[data-axis-col]")).toHaveCount(3);
  await expect(c.locator("[data-axis-row]")).toHaveCount(2);
  // Every outer axis carries ticks from the shared domains.
  for (let col = 0; col < 3; col++) {
    await expect(c.locator(`[data-axis-col="${col}"] [data-tick]`).first()).toBeVisible();
  }
  await expect(c.locator('[data-axis-row="0"] [data-tick]').first()).toBeVisible();
  // The panels' own axes are hidden.
  await expect(c.locator('[data-panel-body] [data-orientation="x"]').first()).toBeHidden();
  // The x axis of a column lines up with that column's plot.
  const axis = await c.locator('[data-axis-col="0"] [data-orientation="x"]').boundingBox();
  const plot = await c.locator("[data-panel]").nth(3).locator('svg[role="img"]').boundingBox();
  if (!axis || !plot) throw new Error("missing boxes");
  expect(Math.abs(axis.x - plot.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(axis.width - plot.width)).toBeLessThanOrEqual(1);
});

test("dividers mark every panel that has a neighbour to the right or below", async ({ mount }) => {
  const c = await mount(<MultiplesHarness count={5} columns={3} dividers />);
  // Five panels in three columns: panels 0, 1 and 3 have a right-hand
  // neighbour (row 1 holds only two, and panel 4 is the last), panels 0 and 1
  // have one below.
  await expect(c.locator("[data-panel][data-divider-col]")).toHaveCount(3);
  await expect(c.locator("[data-panel][data-divider-row]")).toHaveCount(2);
});

test("frame and fullscreen: the toggle expands the whole grid; Escape exits", async ({
  mount,
  page,
}) => {
  const c = await mount(<MultiplesHarness count={4} columns={2} frame fullscreen />);
  await expect(c.locator("[data-frame]")).toHaveCount(1);
  await c.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(c.locator("[data-expanded]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(c.locator("[data-expanded]")).toHaveCount(0);
});

test("bar panels share a controlled value domain (linked y)", async ({ mount }) => {
  const c = await mount(<BarMultiplesHarness columns={3} scaffolding="full" />);
  await expect(c.locator("[data-panel]")).toHaveCount(3);
  // Every panel's y axis shows the same shared domain ticks.
  const first = await c
    .locator("[data-panel]")
    .nth(0)
    .locator('[data-orientation="y"] [data-tick]')
    .allTextContents();
  const last = await c
    .locator("[data-panel]")
    .nth(2)
    .locator('[data-orientation="y"] [data-tick]')
    .allTextContents();
  expect(first.length).toBeGreaterThan(1);
  expect(first).toEqual(last);
});
