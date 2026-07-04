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
