import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import {
  AutoDoc,
  AutoHorizontalWrap,
  Clustered,
  InOuterScroller,
  Short,
  Shrinkable,
  Tall,
  WithLabels,
} from "./Minimap.harness";

/** The scroll element is the target of the scrollbar's aria-controls. */
async function scrollTopOf(c: { locator(selector: string): Locator; page(): Page }) {
  const id = await c.locator('[role="scrollbar"]').getAttribute("aria-controls");
  return c.page().evaluate((sel) => {
    const el = sel ? document.getElementById(sel) : null;
    return el ? el.scrollTop : Number.NaN;
  }, id);
}

test("dragging the indicator scrolls the container proportionally", async ({ mount, page }) => {
  const c = await mount(<Tall />);
  const rail = c.locator('[class*="rail"]');
  const box = (await rail.boundingBox())!;
  // Press inside the grab zone (band rests at the top), drag down 100px.
  await page.mouse.move(box.x + box.width / 2, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 106, { steps: 4 });
  await page.mouse.up();
  const st = await scrollTopOf(c);
  // Band top moved ~100px on a 400px rail over 8000px content: ~2000px.
  expect(st).toBeGreaterThan(1600);
  expect(st).toBeLessThan(2400);
});

test("pressing empty rail centers the viewport on the pressed position", async ({
  mount,
  page,
}) => {
  const c = await mount(<Tall />);
  const rail = c.locator('[class*="rail"]');
  const box = (await rail.boundingBox())!;
  // Press at mid-rail (y=200 of 400): content position 4000, centered → 3800.
  await page.mouse.click(box.x + box.width / 2, box.y + 200);
  const st = await scrollTopOf(c);
  expect(Math.abs(st - 3800)).toBeLessThan(60);
});

test("a press inside the grab zone does not jump", async ({ mount, page }) => {
  const c = await mount(<Tall />);
  const rail = c.locator('[class*="rail"]');
  const box = (await rail.boundingBox())!;
  // Band rests at the top; its 24px grab zone covers y 0..24. Press, no move.
  await page.mouse.click(box.x + box.width / 2, box.y + 10);
  expect(await scrollTopOf(c)).toBe(0);
});

test("wheel over the rail forwards to the content scroll", async ({ mount, page }) => {
  const c = await mount(<Tall />);
  const rail = c.locator('[class*="rail"]');
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => scrollTopOf(c)).toBe(320);
});

test("keyboard operates the scrollbar: arrows, paging, Home/End", async ({ mount }) => {
  const c = await mount(<Tall />);
  const zone = c.locator('[role="scrollbar"]');
  await zone.focus();
  await zone.press("ArrowDown");
  await expect.poll(() => scrollTopOf(c)).toBe(24);
  await zone.press("PageDown");
  await expect.poll(() => scrollTopOf(c)).toBe(24 + 400);
  await zone.press("End");
  await expect.poll(() => scrollTopOf(c)).toBe(8000 - 400);
  await zone.press("Home");
  await expect.poll(() => scrollTopOf(c)).toBe(0);
  // aria-valuenow tracks percent scrolled.
  await zone.press("End");
  await expect(zone).toHaveAttribute("aria-valuenow", "100");
});

test("without scrollable overflow the rail collapses out of the tab order", async ({ mount }) => {
  const c = await mount(<Short />);
  await expect(c.locator('[role="scrollbar"]')).toBeHidden();
});

test("the indicator band frames exactly the visible content region", async ({ mount, page }) => {
  const c = await mount(<Tall />);
  const id = await c.locator('[role="scrollbar"]').getAttribute("aria-controls");
  await page.evaluate((sel: string) => {
    document.getElementById(sel)?.scrollTo({ top: 4000, behavior: "instant" });
  }, id!);
  // Wait for the rAF-coalesced sync.
  await page.waitForTimeout(100);
  const rail = c.locator('[class*="rail"]');
  const railBox = (await rail.boundingBox())!;
  const band = (await c.locator('[class*="indicator"]').boundingBox())!;
  // Visible content is [4000, 4400] of 8000 → band [200, 220] on the 400px rail.
  expect(Math.abs(band.y - railBox.y - 200)).toBeLessThan(2);
  expect(Math.abs(band.height - 20)).toBeLessThan(2);
});

test("a header label click jumps top-aligned", async ({ mount }) => {
  const c = await mount(<WithLabels />);
  await c.getByRole("button", { name: "Three" }).click();
  // Smooth scroll: poll until it settles at the heading's content top.
  await expect.poll(() => scrollTopOf(c), { timeout: 3000 }).toBe(4000);
});

test("active tracking follows scroll, including the short final section", async ({
  mount,
  page,
}) => {
  const c = await mount(<WithLabels />);
  const id = await c.locator('[role="scrollbar"]').getAttribute("aria-controls");
  const scrollTo = (top: number) =>
    page.evaluate(
      ([sel, t]) =>
        document.getElementById(sel as string)?.scrollTo({ top: t as number, behavior: "instant" }),
      [id!, top] as const,
    );
  await scrollTo(2000);
  await expect(c.getByRole("button", { name: "Two" })).toHaveAttribute("aria-current", "true");
  // "Four" (top 7900) is beyond maxScroll (7600): only the at-bottom clamp
  // can activate it.
  await scrollTo(7600);
  await expect(c.getByRole("button", { name: "Four" })).toHaveAttribute("aria-current", "true");
});

test("clustered labels decimate; dropped ones are absent from the tab order", async ({ mount }) => {
  const c = await mount(<Clustered />);
  const buttons = c.getByRole("button");
  // Labels render after the rAF-coalesced first measure; wait for the winner.
  await expect(buttons.first()).toBeVisible();
  const count = await buttons.count();
  // 12 headers spanning 1200px of an 80000px document land within ~6 rail px:
  // only one label can hold the 24px spacing.
  expect(count).toBeLessThan(12);
  expect(count).toBeGreaterThanOrEqual(1);
});

test("auto mode scans headings, skips nested scrollables, and rescans on mutation", async ({
  mount,
  page,
}) => {
  const c = await mount(<AutoDoc />);
  await expect(c.getByRole("button", { name: "Alpha" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Beta" })).toBeVisible();
  // The heading inside the nested scrollable is excluded from the rail.
  await expect(c.getByRole("button", { name: "Nested (skipped)" })).toHaveCount(0);
  // Mutate the content: a new heading appears after the debounced rescan.
  await page.evaluate(() => {
    const host = document.querySelector('[data-testid="autodoc"]');
    const h = document.createElement("h2");
    h.textContent = "Gamma";
    host?.appendChild(h);
  });
  await expect(c.getByRole("button", { name: "Gamma" })).toBeVisible({ timeout: 2000 });
});

test("grabbing the band wins over a label it covers; uncovered labels stay clickable", async ({
  mount,
  page,
}) => {
  const c = await mount(<WithLabels />);
  const rail = c.locator('[class*="rail"]');
  const box = (await rail.boundingBox())!;
  // Band rests at the top, covering the "One" label. A press there must grab
  // the focus marker (drag scrolls), never click the label.
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 108, { steps: 4 });
  await page.mouse.up();
  const st = await scrollTopOf(c);
  expect(st).toBeGreaterThan(1600);
  expect(st).toBeLessThan(2400);
  // A label the band does not cover stays clickable and jumps.
  await c.getByRole("button", { name: "Three" }).click();
  await expect.poll(() => scrollTopOf(c), { timeout: 3000 }).toBe(4000);
});

test("wheel over the rail does not chain to an outer scroller while consuming", async ({
  mount,
  page,
}) => {
  const c = await mount(<InOuterScroller />);
  // The fixture root IS the outer scroller; component locators search
  // descendants only, so resolve it at the page level.
  const outer = page.getByTestId("outer");
  const rail = c.locator('[class*="rail"]');
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 320);
  // The content consumed the delta; the outer page did not move.
  await expect.poll(() => scrollTopOf(c)).toBe(320);
  await expect.poll(() => outer.evaluate((el) => el.scrollTop)).toBe(0);
  // At the content's bottom the delta is not consumable: chaining resumes.
  const id = await c.locator('[role="scrollbar"]').getAttribute("aria-controls");
  await page.evaluate((sel) => {
    const el = sel ? document.getElementById(sel) : null;
    el?.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  }, id);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => outer.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("the rail collapses again when overflowing content shrinks to fit", async ({
  mount,
  page,
}) => {
  const c = await mount(<Shrinkable />);
  await expect(c.locator('[role="scrollbar"]')).toBeVisible();
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="grow"]');
    if (el) el.style.height = "100px";
  });
  await expect(c.locator('[role="scrollbar"]')).toBeHidden();
});

test("auto mode keeps headings inside horizontal-only scroll wrappers", async ({ mount }) => {
  const c = await mount(<AutoHorizontalWrap />);
  await expect(c.getByRole("button", { name: "Alpha" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Wide (kept)" })).toBeVisible();
});
