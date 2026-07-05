import { expect, test } from "@playwright/experimental-ct-react";
import type { ChartAnnotation } from "../../lib/chart";
import type { FlowPeriod } from "./Flows";
import { FlowsScaffoldHarness } from "./Flows.harness";

// Issue #36: a per-period fund-flow ribbon. Each period is a within-period
// waterfall (open → subscriptions → redemptions → performance → fx → close),
// and periods connect close→open. Gets the shared #35 scaffolding.

const PERIODS: FlowPeriod[] = [
  { x: "Jan", open: 1000, subscriptions: 120, redemptions: 60, performance: 34, fxEffect: -8 },
  { x: "Feb", open: 1086, subscriptions: 90, redemptions: 110, performance: -22, fxEffect: 5 },
];

test("renders one segment per present component and a legend", async ({ mount }) => {
  const c = await mount(
    <FlowsScaffoldHarness
      periods={PERIODS}
      yDomain={[900, 1300]}
      height={260}
      scaffolding="full"
    />,
  );
  // 2 periods × 4 components = 8 segment rects, exposed as role=button.
  await expect(c.getByRole("button", { name: /Subscriptions/ })).toHaveCount(2);
  await expect(c.getByRole("button", { name: /Redemptions/ })).toHaveCount(2);
  // Legend lists every component present (scoped — the labels also appear in
  // each segment's aria-label/title).
  const legendItems = c.locator('[class*="legendItem"]');
  await expect(legendItems).toHaveCount(4);
  await expect(legendItems.filter({ hasText: "Subscriptions" })).toHaveCount(1);
  await expect(legendItems.filter({ hasText: "FX effect" })).toHaveCount(1);
});

test("hovering a segment shows the flow tooltip", async ({ mount, page }) => {
  const c = await mount(
    <FlowsScaffoldHarness
      periods={PERIODS}
      yDomain={[900, 1300]}
      height={260}
      scaffolding="full"
    />,
  );
  await c.getByRole("button", { name: /Jan Subscriptions/ }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Subscriptions");
});

test("controls + value-axis (AUM) zoom, plus an hline reference level", async ({ mount, page }) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(
    <FlowsScaffoldHarness
      periods={PERIODS}
      yDomain={[0, 2000]}
      height={260}
      scaffolding="full"
      controls
      zoomable
      editable
      onChange={(next) => changes.push(next)}
    />,
  );
  await expect(c.getByRole("toolbar", { name: "Chart controls" })).toBeVisible();

  // Step-zoom the AUM axis about its centre: [0,2000] → [500,1500].
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  await expect(c.locator("[aria-live]")).toContainText("Showing 500");

  // Draw an hline reference level.
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");
  await c.getByRole("button", { name: "Horizontal line" }).click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect.poll(() => changes.length).toBe(1);
  expect(changes[0]?.[0]?.type).toBe("hline");
});
