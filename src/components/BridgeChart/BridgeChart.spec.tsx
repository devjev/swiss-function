import { expect, test } from "@playwright/experimental-ct-react";
import type { ChartAnnotation } from "../../lib/chart";
import type { BridgeItem } from "./BridgeChart";
import { BridgeChartScaffoldHarness } from "./BridgeChart.harness";

// Issue #35: the shared scaffolding on the categorical waterfall — controls,
// value-axis (y) zoom, and a data-anchored hline reference level.

const ITEMS: BridgeItem[] = [
  { label: "Start", value: 0, kind: "total" },
  { label: "Subs", value: 60, kind: "delta" },
  { label: "Reds", value: -30, kind: "delta" },
  { label: "End", value: 30, kind: "total" },
];

test("controls + value-axis zoom windows the y range; Reset restores it", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <BridgeChartScaffoldHarness
      items={ITEMS}
      yDomain={[0, 100]}
      height={240}
      scaffolding="full"
      zoomable
      controls
    />,
  );
  await expect(c.getByRole("toolbar", { name: "Chart controls" })).toBeVisible();
  const reset = c.getByRole("button", { name: "Reset view" });
  await expect(reset).toBeDisabled();

  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await expect(reset).toBeEnabled();
  await page.keyboard.press("0");
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("hline reference level places on click at a data-space y", async ({ mount, page }) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(
    <BridgeChartScaffoldHarness
      items={ITEMS}
      yDomain={[0, 100]}
      height={240}
      scaffolding="full"
      controls
      editable
      onChange={(next) => changes.push(next)}
    />,
  );
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");

  await c.getByRole("button", { name: "Horizontal line" }).click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);
  await expect.poll(() => changes.length).toBe(1);
  const drawn = changes[0]?.[0];
  if (!drawn || drawn.type !== "hline") throw new Error(`expected an hline, got ${drawn?.type}`);
  expect(drawn.y).toBeGreaterThan(15);
  expect(drawn.y).toBeLessThan(35);
});
