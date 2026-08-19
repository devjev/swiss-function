import { expect, test } from "@playwright/experimental-ct-react";
import { StatGroupHarness, StatHarness } from "./Stat.harness";

test("renders the label and value", async ({ mount }) => {
  const c = await mount(<StatHarness label="Revenue" value="1,284,500" />);
  await expect(c.getByText("Revenue")).toBeVisible();
  await expect(c.getByText("1,284,500")).toBeVisible();
});

test("formats a numeric value in Swiss typography with an apostrophe separator", async ({
  mount,
}) => {
  const c = await mount(<StatHarness value={1284500} valueUnit="CHF" />);
  await expect(c.getByText("1'284'500 CHF")).toBeVisible();
});

test("attaches a symbol unit tight (2.1%) but spaces a word unit", async ({ mount }) => {
  const pct = await mount(<StatHarness value={2.1} decimals={1} valueUnit="%" />);
  // No space before % (normalized text match would still hit "2.1 %" only if spaced).
  await expect(pct.getByText("2.1%", { exact: true })).toBeVisible();
  await expect(pct.getByText("2.1 %", { exact: true })).toHaveCount(0);
});

test("a numeric delta with an absolute unit is grouped too", async ({ mount }) => {
  const c = await mount(<StatHarness delta={1240} deltaUnit="" />);
  await expect(c.locator("[data-trend]").first()).toContainText("1'240");
});

test("supports xs through xl sizes", async ({ mount }) => {
  const c = await mount(<StatHarness value={1000} size="xl" />);
  await expect(c.locator('[data-size="xl"]')).toBeVisible();
});

test("a positive delta with up-is-good reads good and shows the up arrow", async ({ mount }) => {
  const c = await mount(<StatHarness delta={12.5} />);
  const delta = c.locator("[data-trend]").first();
  await expect(delta).toHaveAttribute("data-trend", "good");
  await expect(delta).toContainText("12.5%");
  // The direction glyph is the up arrow (title via Icon label or the svg is present).
  await expect(delta.locator("svg")).toBeVisible();
});

test("a positive delta with down-is-good reads bad", async ({ mount }) => {
  const c = await mount(<StatHarness delta={4} goodDirection="down" />);
  await expect(c.locator("[data-trend]").first()).toHaveAttribute("data-trend", "bad");
});

test("a negative delta with down-is-good reads good", async ({ mount }) => {
  const c = await mount(<StatHarness delta={-0.3} goodDirection="down" />);
  const delta = c.locator("[data-trend]").first();
  await expect(delta).toHaveAttribute("data-trend", "good");
  // The magnitude is shown without a sign (the arrow carries direction).
  await expect(delta).toContainText("0.3%");
});

test("a zero delta reads flat", async ({ mount }) => {
  const c = await mount(<StatHarness delta={0} />);
  await expect(c.locator("[data-trend]").first()).toHaveAttribute("data-trend", "flat");
});

test("deltaLabel overrides the default magnitude text", async ({ mount }) => {
  const c = await mount(<StatHarness delta={5} deltaLabel="87% of target" />);
  await expect(c.getByText("87% of target")).toBeVisible();
});

test("a non-finite delta renders no change indicator", async ({ mount }) => {
  const c = await mount(<StatHarness delta={Number.NaN} />);
  await expect(c.locator("[data-trend]")).toHaveCount(0);
  await expect(c.getByText("NaN", { exact: false })).toHaveCount(0);
});

test("a tiny nonzero delta keeps its up arrow and shows a nonzero magnitude", async ({ mount }) => {
  const c = await mount(<StatHarness delta={0.04} />);
  const delta = c.locator("[data-trend]").first();
  await expect(delta).toHaveAttribute("data-trend", "good");
  await expect(delta).not.toContainText("0%");
  await expect(delta).toContainText("0.04%");
});

test("renders a line sparkline for a 2+ point trend", async ({ mount }) => {
  const c = await mount(<StatHarness trend={[1, 2, 3, 4]} />);
  await expect(c.locator("svg polyline")).toBeAttached();
});

test("renders no sparkline for a single-point trend", async ({ mount }) => {
  const c = await mount(<StatHarness trend={[1]} />);
  await expect(c.locator("svg")).toHaveCount(0);
});

test("bar trend renders rects instead of a polyline", async ({ mount }) => {
  const c = await mount(<StatHarness trend={[1, 2, 3, 4]} trendType="bar" />);
  await expect(c.locator("svg rect")).toHaveCount(4);
  await expect(c.locator("svg polyline")).toHaveCount(0);
});

test("elevation makes it a standalone card", async ({ mount }) => {
  const c = await mount(<StatHarness elevation={2} />);
  await expect(c.locator("[data-card]")).toHaveAttribute("data-elevation", "2");
});

test("Stat.Group lays cards out in a bordered, divided grid", async ({ mount }) => {
  const c = await mount(<StatGroupHarness />);
  await expect(c.getByText("Revenue")).toBeVisible();
  await expect(c.getByText("Churn")).toBeVisible();
  // Three cards in a row: distinct left offsets, same top.
  const cards = c.locator("[data-size]");
  await expect(cards).toHaveCount(3);
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  expect(a && b && b.x > a.x && Math.abs(a.y - b.y) < 2).toBeTruthy();
});
