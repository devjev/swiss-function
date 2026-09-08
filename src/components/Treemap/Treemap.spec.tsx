import { expect, test } from "@playwright/experimental-ct-react";
import { TreemapHarness } from "./Treemap.harness";

test("draws one cell per leaf, a container and a header per group", async ({ mount }) => {
  const c = await mount(<TreemapHarness />);
  await expect(c.locator('[data-kind="leaf"]')).toHaveCount(4);
  await expect(c.locator('[data-kind="group"]')).toHaveCount(2);
  await expect(c.locator('[data-kind="header"]')).toHaveCount(2);
  await expect(c.locator('[data-kind="header"]').filter({ hasText: "Tech" })).toBeVisible();
});

test("cells tile the plot without overlapping and stay inside it", async ({ mount }) => {
  const c = await mount(<TreemapHarness />);
  const plot = await c.locator('[class*="plotCell"]').boundingBox();
  const leaves = c.locator('[data-kind="leaf"]');
  const boxes = await leaves.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  if (!plot) throw new Error("no plot");
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(plot.x);
    expect(b.y).toBeGreaterThanOrEqual(plot.y);
    expect(b.x + b.w).toBeLessThanOrEqual(plot.x + plot.width + 0.5);
    expect(b.y + b.h).toBeLessThanOrEqual(plot.y + plot.height + 0.5);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(overlapX <= 0 || overlapY <= 0).toBe(true);
    }
  }
});

test("a cell too small for its name prints no label", async ({ mount }) => {
  const c = await mount(<TreemapHarness dataset="lopsided" />);
  await expect(c.locator('[data-kind="leaf"]')).toHaveCount(2);
  const big = c.locator('[data-kind="leaf"]').filter({ hasText: "Nearly everything" });
  await expect(big).toHaveCount(1);
  // The sliver is a few pixels wide: drawn, hoverable, but without a name.
  const sliver = c.locator('[data-kind="leaf"]').filter({ hasText: "A sliver" });
  await expect(sliver).toHaveCount(0);
  await expect(c.locator('[data-kind="leaf"][data-cell-id="Lopsided/A sliver"]')).toHaveCount(1);
});

test("showValues prints values where they fit, in leaves and headers", async ({ mount }) => {
  const c = await mount(<TreemapHarness showValues />);
  const cash = c.locator('[data-kind="leaf"]').filter({ hasText: "Cash" });
  await expect(cash.locator('[class*="value"]')).toHaveText("40");
  await expect(c.locator('[data-kind="header"]').filter({ hasText: "Tech" })).toContainText("50");
});

test("hovering a cell shows its tooltip with share and change", async ({ mount, page }) => {
  const c = await mount(<TreemapHarness />);
  await c.locator('[data-kind="leaf"]').filter({ hasText: "AAPL" }).hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("AAPL");
  await expect(tip).toContainText("60% of Tech");
  await expect(tip).toContainText("+1.2%");
});

test("a click fires onPointActivate with the cell's datum", async ({ mount }) => {
  const c = await mount(<TreemapHarness />);
  await c.locator('[data-kind="leaf"]').filter({ hasText: "Cash" }).click();
  await expect(c.getByTestId("activated")).toHaveText("leaf:Portfolio/Cash");
  await c.locator('[data-kind="header"]').filter({ hasText: "Tech" }).click();
  await expect(c.getByTestId("activated")).toHaveText("group:Portfolio/Tech");
  await expect(c.getByTestId("activations")).toHaveText("2");
});

test("Enter on a focused cell activates it", async ({ mount }) => {
  const c = await mount(<TreemapHarness />);
  const cash = c.locator('[data-kind="leaf"]').filter({ hasText: "Cash" });
  await expect(cash).toHaveAttribute("role", "button");
  await cash.focus();
  await cash.press("Enter");
  await expect(c.getByTestId("activated")).toHaveText("leaf:Portfolio/Cash");
});

test("root draws a subtree", async ({ mount }) => {
  const c = await mount(<TreemapHarness root="Portfolio/Tech" />);
  await expect(c.locator('[data-kind="leaf"]')).toHaveCount(2);
  await expect(c.locator('[data-kind="group"]')).toHaveCount(0);
});

test("an unknown root falls back to the data root", async ({ mount }) => {
  const c = await mount(<TreemapHarness root="nope" />);
  await expect(c.locator('[data-kind="leaf"]')).toHaveCount(4);
});

test("depth aggregates deeper levels into one cell", async ({ mount }) => {
  const c = await mount(<TreemapHarness depth={1} />);
  await expect(c.locator('[data-kind="leaf"]')).toHaveCount(3);
  await expect(c.locator('[data-kind="leaf"]').filter({ hasText: "Tech" })).toBeVisible();
});

test("colorBy change tones the cells by sign", async ({ mount }) => {
  const c = await mount(<TreemapHarness colorBy="change" />);
  await expect(
    c.locator('[data-kind="leaf"][data-tone="positive"]').filter({ hasText: "AAPL" }),
  ).toHaveCount(1);
  await expect(
    c.locator('[data-kind="leaf"][data-tone="negative"]').filter({ hasText: "MSFT" }),
  ).toHaveCount(1);
  await expect(c.locator('[data-kind="leaf"]').filter({ hasText: "Cash" })).not.toHaveAttribute(
    "data-tone",
    /.+/,
  );
});

test("selectable: clicking a cell pins a popover and marks it; dismiss clears", async ({
  mount,
  page,
}) => {
  const c = await mount(<TreemapHarness selectable />);
  const cash = c.locator('[data-kind="leaf"]').filter({ hasText: "Cash" });
  await cash.click();
  await expect(cash).toHaveAttribute("data-selected", "");
  await expect(page.getByRole("button", { name: "Dismiss selection" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss selection" }).click();
  await expect(cash).not.toHaveAttribute("data-selected", "");
});

test("frame and fullscreen come from the shared scaffold", async ({ mount }) => {
  const c = await mount(<TreemapHarness frame fullscreen />);
  const root = c.locator("[data-scaffolding]").first();
  await expect(root).toHaveClass(/frame/);
  await expect(root).not.toHaveAttribute("data-expanded", "");
  await c.getByRole("button", { name: /fullscreen/i }).click();
  await expect(root).toHaveAttribute("data-expanded", "");
});

test("scaffolding minimal drops the headers and the gaps", async ({ mount }) => {
  const c = await mount(<TreemapHarness scaffolding="minimal" />);
  await expect(c.locator('[data-kind="header"]')).toHaveCount(0);
  await expect(c.locator('[data-kind="leaf"]')).toHaveCount(4);
});
