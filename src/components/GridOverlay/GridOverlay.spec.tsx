import { expect, test } from "@playwright/experimental-ct-react";
import { DEFAULT_UNIT_PX as U } from "../../lib/useCssPx";
import { OverlayHarness } from "./GridOverlay.harness";

test("names the major crossings row:col, counted from 1 at the top left", async ({ mount }) => {
  const c = await mount(<OverlayHarness />);
  const labels = await c.locator('[data-layer="labels"] span').evaluateAll((els) =>
    els.map((el) => ({
      text: el.textContent,
      left: Number.parseFloat((el as HTMLElement).style.left),
      top: Number.parseFloat((el as HTMLElement).style.top),
    })),
  );
  // 20 by 12 units, a label every 5 cells: rows 1, 6, 11 and columns 1, 6, 11, 16.
  expect(labels.map((l) => l.text)).toEqual([
    "1:1",
    "1:6",
    "1:11",
    "1:16",
    "6:1",
    "6:6",
    "6:11",
    "6:16",
    "11:1",
    "11:6",
    "11:11",
    "11:16",
  ]);
  expect(labels[5]).toEqual({ text: "6:6", left: 5 * U, top: 5 * U });
});

test("the baseline lines fall where body text sits", async ({ mount }) => {
  const c = await mount(<OverlayHarness />);
  const m = await c.evaluate((root) => {
    const region = root.querySelector('[data-testid="region"]') as HTMLElement;
    const mark = root.querySelector('[data-testid="baseline-mark"]') as HTMLElement;
    const overlay = region.querySelector("[data-layer='baseline']")?.parentElement as HTMLElement;
    return {
      text: Math.round(mark.getBoundingClientRect().bottom - region.getBoundingClientRect().top),
      line: Number.parseFloat(getComputedStyle(overlay).getPropertyValue("--go-baseline")),
    };
  });
  expect(m.line).toBeGreaterThan(U / 2);
  expect(m.line).toBeLessThan(U);
  expect(Math.abs(m.line - m.text)).toBeLessThanOrEqual(1);
});

test("the pointer's cell is outlined and named; the app under the overlay still takes presses", async ({
  mount,
  page,
}) => {
  const c = await mount(<OverlayHarness />);
  const box = await c.getByTestId("region").boundingBox();
  if (!box) throw new Error("no region");
  // Cell 3:5: the third row, fifth column.
  await page.mouse.move(box.x + 4.5 * U, box.y + 2.5 * U);
  await expect(c.locator("[data-chip]")).toHaveText("3:5");
  await expect(c.locator("[data-hover-cell]")).toHaveText("3:5");
  await c.getByRole("button", { name: "under" }).click();
  await expect(c.getByTestId("presses")).toHaveText("1");
});

test("pick mode names a cell on a press and a range on a drag, then leaves on Escape", async ({
  mount,
  page,
}) => {
  const c = await mount(<OverlayHarness />);
  const box = await c.getByTestId("region").boundingBox();
  if (!box) throw new Error("no region");
  await c.getByRole("button", { name: "[pick]" }).click();
  await expect(c.getByRole("button", { name: "[picking]" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A press on 2:3.
  await page.mouse.click(box.x + 2.5 * U, box.y + 1.5 * U);
  // A drag from 4:2 to 6:9, drawn from the bottom right back to the top left.
  await page.mouse.move(box.x + 8.5 * U, box.y + 5.5 * U);
  await page.mouse.down();
  await page.mouse.move(box.x + 1.5 * U, box.y + 3.5 * U, { steps: 4 });
  await page.mouse.up();
  await expect(c.getByTestId("picks")).toHaveText("2:3,4:2-6:9");
  await expect(c.locator("[data-last-pick]")).toContainText("4:2-6:9 · 3 rows · 8 cols");
  const outline = await c.locator("[data-pick]").evaluate((el) => {
    const s = (el as HTMLElement).style;
    return [s.left, s.top, s.width, s.height].map((v) => Number.parseFloat(v));
  });
  expect(outline).toEqual([1 * U, 3 * U, 8 * U, 3 * U]);
  // While picking, a press does not reach the app.
  await c.getByRole("button", { name: "under" }).click({ force: true });
  await expect(c.getByTestId("presses")).toHaveText("0");
  await page.keyboard.press("Escape");
  await expect(c.getByRole("button", { name: "[pick]" })).toHaveAttribute("aria-pressed", "false");
  await c.getByRole("button", { name: "under" }).click();
  await expect(c.getByTestId("presses")).toHaveText("1");
});

test("marks outline places by name and skip names that do not parse", async ({ mount }) => {
  const c = await mount(<OverlayHarness marks={["2:2-3:5", "7:1", "nonsense"]} panel={false} />);
  const marks = await c.locator("[data-mark]").evaluateAll((els) =>
    els.map((el) => {
      const s = (el as HTMLElement).style;
      return {
        name: el.getAttribute("data-mark"),
        box: [s.left, s.top, s.width, s.height].map((v) => Number.parseFloat(v)),
        label: el.textContent,
      };
    }),
  );
  expect(marks).toEqual([
    { name: "2:2-3:5", box: [1 * U, 1 * U, 4 * U, 2 * U], label: "2:2-3:5" },
    { name: "7:1", box: [0, 6 * U, 1 * U, 1 * U], label: "7:1" },
  ]);
  await expect(c.locator('[aria-label="Unit grid"]')).toHaveCount(0);
});

test("the panel toggles the layers and steps the cell size", async ({ mount }) => {
  const c = await mount(<OverlayHarness />);
  await c.getByRole("button", { name: "[x] baseline" }).click();
  await expect(c.locator('[data-layer="baseline"]')).toHaveCount(0);
  await c.getByRole("button", { name: "[x] labels" }).click();
  await expect(c.locator('[data-layer="labels"]')).toHaveCount(0);
  await c.getByRole("button", { name: "[ ] labels" }).click();
  await c.getByRole("button", { name: "Cell size 1 units" }).click();
  // Two-unit cells: the labels name 2u squares, a label every 5 of them.
  await expect(c.locator('[data-layer="labels"] span')).toHaveText(["1:1", "1:6", "6:1", "6:6"]);
  const cell = await c
    .locator("[data-layer='cells']")
    .evaluate((el) =>
      Number.parseFloat(
        getComputedStyle(el.parentElement as HTMLElement).getPropertyValue("--go-cell"),
      ),
    );
  expect(cell).toBe(2 * U);
});

test("a cell follows the density: one unit is 24px in the comfortable density", async ({
  mount,
  page,
}) => {
  const c = await mount(<OverlayHarness density="comfortable" />);
  await expect(c.locator("[aria-label='Unit grid']")).toContainText("1u 24px");
  const box = await c.getByTestId("region").boundingBox();
  if (!box) throw new Error("no region");
  await page.mouse.move(box.x + 24 * 2.5, box.y + 24 * 1.5);
  await expect(c.locator("[data-chip]")).toHaveText("2:3");
});
