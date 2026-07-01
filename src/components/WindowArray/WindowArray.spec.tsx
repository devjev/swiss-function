import { expect, test } from "@playwright/experimental-ct-react";
import { WindowArray } from "./WindowArray";
import { WindowArrayHarness } from "./WindowArray.harness";

// Harness layout: 3 columns × 2 windows (w1a/w1b, w2a/w2b, w3a/w3b), column
// width 220px in a 640px viewport — the strip overflows horizontally.

async function dragMouse(
  page: import("@playwright/test").Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test("renders labelled window groups; ✕ only appears with onClose", async ({ mount, page }) => {
  await mount(
    <div style={{ inlineSize: 500, blockSize: 300 }}>
      <WindowArray aria-label="Static">
        <WindowArray.Column id="a" defaultWidth={220}>
          <WindowArray.Window id="one" title="Closable" onClose={() => {}}>
            <p>body</p>
          </WindowArray.Window>
          <WindowArray.Window id="two" title="Fixed">
            <p>body</p>
          </WindowArray.Window>
        </WindowArray.Column>
      </WindowArray>
    </div>,
  );
  const closable = page.getByRole("group", { name: "Closable" });
  const fixed = page.getByRole("group", { name: "Fixed" });
  await expect(closable).toBeVisible();
  await expect(fixed).toBeVisible();
  await expect(closable.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(fixed.getByRole("button", { name: "Close" })).toHaveCount(0);
  await expect(fixed.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
});

test("closing a window removes it and hands focus to its successor", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  await page
    .getByRole("group", { name: "Window 1A" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.getByRole("group", { name: "Window 1A" })).toHaveCount(0);
  // Successor is the next window in the column; focus moved because the close
  // button's removal dropped focus on <body>.
  await expect(page.getByRole("button", { name: "Window 1B" })).toBeFocused();
  await expect(page.locator('[data-window-id="w1b"]')).toHaveAttribute("data-active", "");
});

test("fullscreen fills the WindowArray container and Escape exits", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  const root = page.getByTestId("window-array");
  const win = page.locator('[data-window-id="w1b"]');
  const before = await win.boundingBox();
  await win.getByRole("button", { name: "Enter fullscreen" }).click();
  const rootBox = await root.boundingBox();
  const fsBox = await win.boundingBox();
  if (!rootBox || !fsBox || !before) throw new Error("missing bounding boxes");
  expect(Math.abs(fsBox.width - rootBox.width)).toBeLessThan(4);
  expect(Math.abs(fsBox.height - rootBox.height)).toBeLessThan(4);
  await expect(win.getByRole("button", { name: "Exit fullscreen" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(win.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  const after = await win.boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(Math.abs(after.width - before.width)).toBeLessThan(4);
});

test("keyboard: arrows navigate, Home/End jump, and the strip auto-scrolls", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness />);
  const root = page.getByTestId("window-array");
  const scrollLeft = () => root.evaluate((el) => (el.firstElementChild as HTMLElement).scrollLeft);

  await page.getByRole("button", { name: "Window 1A" }).click();
  // Exactly one roving tab stop.
  await expect(page.locator('button[tabindex="0"]')).toHaveCount(1);

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Window 1B" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Window 2B" })).toBeFocused();

  expect(await scrollLeft()).toBe(0);
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Window 3A" })).toBeFocused();
  await expect(page.locator('[data-window-id="w3a"]')).toHaveAttribute("data-active", "");
  // Nearest-edge alignment: the last column lands flush with the END edge
  // (its trailing gutter included) — exactly the max scroll, never centered.
  const maxScroll = await root.evaluate((el) => {
    const viewport = el.firstElementChild as HTMLElement;
    return viewport.scrollWidth - viewport.clientWidth;
  });
  await expect.poll(scrollLeft).toBe(maxScroll);

  await page.keyboard.press("Home");
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
  await expect.poll(scrollLeft).toBe(0);
});

test("Shift+ArrowRight reports a cell move that the consumer applies", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  await page.getByRole("button", { name: "Window 1A" }).click();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "cell", columnId: "col-2", index: 0 },
    }),
  );
  await expect(page.locator('section[data-column-id="col-2"]').first()).toHaveAttribute(
    "data-window-id",
    "w1a",
  );
  // Focus follows the moved window into its new column.
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
});

test("dragging a gutter resizes its column, clamped at the minimum", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  const column = page.locator('div[data-column-id="col-1"]');
  const gutter = page.getByRole("separator").first();
  const before = await column.boundingBox();
  const gb = await gutter.boundingBox();
  if (!before || !gb) throw new Error("missing bounding boxes");
  expect(Math.round(before.width)).toBe(220);

  await dragMouse(
    page,
    { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 },
    { x: gb.x + gb.width / 2 + 60, y: gb.y + gb.height / 2 },
  );
  const grown = await column.boundingBox();
  if (!grown) throw new Error("missing bounding box");
  expect(Math.round(grown.width)).toBe(280);

  // Way past the 120px minimum → clamps.
  const gb2 = await gutter.boundingBox();
  if (!gb2) throw new Error("missing bounding box");
  await dragMouse(
    page,
    { x: gb2.x + gb2.width / 2, y: gb2.y + gb2.height / 2 },
    { x: gb2.x + gb2.width / 2 - 400, y: gb2.y + gb2.height / 2 },
  );
  const clamped = await column.boundingBox();
  if (!clamped) throw new Error("missing bounding box");
  expect(Math.round(clamped.width)).toBe(120);
});

test("gutter keyboard: arrows step 8px (Shift 24px), double-click resets", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness />);
  const column = page.locator('div[data-column-id="col-1"]');
  const gutter = page.getByRole("separator").first();
  await gutter.focus();
  await page.keyboard.press("ArrowRight");
  await expect(gutter).toHaveAttribute("aria-valuenow", "228");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(gutter).toHaveAttribute("aria-valuenow", "204");
  await gutter.dblclick();
  await expect(gutter).toHaveAttribute("aria-valuenow", "220");
  const box = await column.boundingBox();
  if (!box) throw new Error("missing bounding box");
  expect(Math.round(box.width)).toBe(220);
});

test("dragging a title bar onto another window's lower half moves it there", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness />);
  const handle = page.getByRole("button", { name: "Window 1A" });
  const target = page.locator('[data-window-id="w2a"]');
  const hb = await handle.boundingBox();
  const tb = await target.boundingBox();
  if (!hb || !tb) throw new Error("missing bounding boxes");
  await dragMouse(
    page,
    { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 },
    { x: tb.x + tb.width / 2, y: tb.y + tb.height * 0.8 },
  );
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "cell", columnId: "col-2", index: 1 },
    }),
  );
  const col2 = page.locator('section[data-column-id="col-2"]');
  await expect(col2).toHaveCount(3);
  await expect(col2.nth(1)).toHaveAttribute("data-window-id", "w1a");
});

test("dropping a title bar on a gutter breaks the window out into a new column", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness />);
  const handle = page.getByRole("button", { name: "Window 1A" });
  // First separator = the gutter between columns 1 and 2 (gap index 1).
  const gutter = page.getByRole("separator").first();
  const hb = await handle.boundingBox();
  const gb = await gutter.boundingBox();
  if (!hb || !gb) throw new Error("missing bounding boxes");
  await dragMouse(
    page,
    { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 },
    { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 },
  );
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "column", index: 1 },
    }),
  );
  // 4 columns now; the new one holds only w1a.
  const newColumn = page.locator('section[data-column-id="col:w1a"]');
  await expect(newColumn).toHaveCount(1);
  await expect(newColumn).toHaveAttribute("data-window-id", "w1a");
});

test("dragging from the window body does not start a move", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  const body = page.getByText("Body of Window 1A");
  const target = page.locator('[data-window-id="w2a"]');
  const bb = await body.boundingBox();
  const tb = await target.boundingBox();
  if (!bb || !tb) throw new Error("missing bounding boxes");
  await dragMouse(
    page,
    { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 },
    { x: tb.x + tb.width / 2, y: tb.y + tb.height * 0.8 },
  );
  await expect(page.getByTestId("last-move")).toHaveText("");
  await expect(page.locator('section[data-column-id="col-1"]').first()).toHaveAttribute(
    "data-window-id",
    "w1a",
  );
});

test("clicking a window body activates it", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  await page.getByText("Body of Window 2A").click();
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await expect(page.locator('[data-window-id="w2a"]')).toHaveAttribute("data-active", "");
});

test("paddle controls switch the active column and disable at the ends", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness controls />);
  const prev = page.getByRole("button", { name: "Previous column" });
  const next = page.getByRole("button", { name: "Next column" });
  // Nothing active yet: "next" starts at the strip's first window.
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w3a");
  await expect(next).toBeDisabled();
  await prev.click();
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
});

test("Alt+Arrow hotkeys switch columns from inside window content", async ({ mount, page }) => {
  await mount(<WindowArrayHarness hotkeys />);
  // Focus deep inside a window body — not on a title bar.
  await page.getByLabel("Note for Window 1A").click();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await expect(page.getByRole("button", { name: "Window 2A" })).toBeFocused();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
});

test("snap turns on proximity column snapping, suspended while resizing", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness snap />);
  const root = page.getByTestId("window-array");
  const snapType = () =>
    root.evaluate((el) => getComputedStyle(el.firstElementChild as HTMLElement).scrollSnapType);
  // `inline proximity` serializes as just the axis (proximity is the default
  // strictness).
  expect(await snapType()).toBe("inline");
  // Mid-gesture the root carries data-interacting and snapping is off.
  const gutter = page.getByRole("separator").first();
  const gb = await gutter.boundingBox();
  if (!gb) throw new Error("missing bounding box");
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2 + 30, gb.y + gb.height / 2, { steps: 3 });
  expect(await snapType()).toBe("none");
  await page.mouse.up();
  expect(await snapType()).toBe("inline");
});

test("window content state survives a cross-column move", async ({ mount, page }) => {
  await mount(<WindowArrayHarness />);
  const input = page.getByLabel("Note for Window 1A");
  await input.fill("draft text");
  await page.getByRole("button", { name: "Window 1A" }).click();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator('section[data-window-id="w1a"]')).toHaveAttribute(
    "data-column-id",
    "col-2",
  );
  // The window was re-placed, not remounted — the uncontrolled input keeps its
  // DOM value (v1 nested windows inside column elements and lost it here).
  await expect(input).toHaveValue("draft text");
});
