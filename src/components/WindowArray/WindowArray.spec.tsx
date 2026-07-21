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

test("paddle controls fade in near their edge, switch the active column and disable at the ends", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness controls />);
  const box = await page.getByTestId("window-array").boundingBox();
  if (!box) throw new Error("missing bounding box");
  const midY = box.y + box.height / 2;
  const prev = page.getByRole("button", { name: "Previous column" });
  const next = page.getByRole("button", { name: "Next column" });
  // At rest both paddles are faded out (opacity 0 → Playwright still counts
  // them visible, so assert the computed style) and click-through.
  await expect(prev).toHaveCSS("opacity", "0");
  await expect(next).toHaveCSS("opacity", "0");
  // Pointer near the trailing edge reveals only that paddle.
  await page.mouse.move(box.x + box.width - 10, midY);
  await expect(next).toHaveCSS("opacity", "1");
  await expect(prev).toHaveCSS("opacity", "0");
  // Nothing active yet: "next" starts at the strip's first window.
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w3a");
  await expect(next).toBeDisabled();
  // The other edge reveals (and enables clicking) the "previous" paddle.
  await page.mouse.move(box.x + 10, midY);
  await expect(prev).toHaveCSS("opacity", "1");
  await prev.click();
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  // Away from both edges everything fades back out.
  await page.mouse.move(box.x + box.width / 2, midY);
  await expect(prev).toHaveCSS("opacity", "0");
  await expect(next).toHaveCSS("opacity", "0");
});

test("apiRef.switchColumn drives column switching from a consumer's hotkey (issue #32)", async ({
  mount,
  page,
}) => {
  // The harness plays the consumer: it wires Alt+Arrow on its wrapper to
  // apiRef.switchColumn. WindowArray itself binds no shortcut.
  await mount(<WindowArrayHarness apiHotkeys />);
  // Focus deep inside a window body — not on a title bar. The consumer's
  // handler still catches it (the event bubbles to the wrapper).
  await page.getByLabel("Note for Window 1A").click();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await expect(page.getByRole("button", { name: "Window 2A" })).toBeFocused();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
});

test("WindowArray binds no column-switch hotkey of its own (issue #32)", async ({
  mount,
  page,
}) => {
  // Without the consumer wiring (no apiHotkeys), Alt+Arrow does nothing — the
  // component no longer owns the shortcut.
  await mount(<WindowArrayHarness />);
  await page.getByLabel("Note for Window 1A").click();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.getByTestId("active-id")).not.toHaveText("w2a");
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

test("the strip background is the dither fill, pinned to the root's box", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness columnCount={1} />);
  const root = page.getByTestId("window-array");
  const before = await root.evaluate((el) => {
    const strip = el.firstElementChild?.firstElementChild as HTMLElement;
    const style = getComputedStyle(strip, "::before");
    return {
      position: style.position,
      mask: style.maskImage,
      background: style.backgroundColor,
    };
  });
  // Positioned against .root (the containing-block invariant) with the Bayer
  // dither mask over a muted color — DataTable's column-fill vocabulary.
  expect(before.position).toBe("absolute");
  expect(before.mask).toContain("svg+xml");
  expect(before.background).not.toBe("rgba(0, 0, 0, 0)");
  // An underfilled strip has no horizontal overflow.
  const viewport = await root.evaluate((el) => {
    const v = el.firstElementChild as HTMLElement;
    return { scrollWidth: v.scrollWidth, clientWidth: v.clientWidth };
  });
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
});

test("a near-exact fit absorbs up to 8px of overflow instead of scrolling", async ({
  mount,
  page,
}) => {
  // 2×305px columns + 3×12px gutters = 646px natural in a 638px viewport
  // (640 minus the root border) — 8px of overflow, absorbed by the last column.
  await mount(<WindowArrayHarness columnCount={2} columnWidth={305} />);
  const root = page.getByTestId("window-array");
  await expect
    .poll(() =>
      root.evaluate((el) => {
        const v = el.firstElementChild as HTMLElement;
        return v.scrollWidth - v.clientWidth;
      }),
    )
    .toBe(0);
  // Only the rendered track shrank — the width STATE still reports 305.
  await expect(page.getByRole("separator").first()).toHaveAttribute("aria-valuenow", "305");
});

test("controls hide the horizontal scrollbar", async ({ mount, page }) => {
  await mount(<WindowArrayHarness controls />);
  const root = page.getByTestId("window-array");
  const scrollbarWidth = await root.evaluate(
    (el) => getComputedStyle(el.firstElementChild as HTMLElement).scrollbarWidth,
  );
  expect(scrollbarWidth).toBe("none");
});

test("a narrow container transposes the strip: bands stack down, windows sit side by side", async ({
  mount,
  page,
}) => {
  // 360px container < the 480px default breakpoint → auto goes vertical.
  await mount(<WindowArrayHarness width={360} height={500} />);
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-orientation", "vertical");
  const w1a = await page.locator('[data-window-id="w1a"]').boundingBox();
  const w1b = await page.locator('[data-window-id="w1b"]').boundingBox();
  const w2a = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!w1a || !w1b || !w2a) throw new Error("missing bounding boxes");
  // Same band: the column's two windows share a y-range, split side by side.
  expect(Math.abs(w1b.y - w1a.y)).toBeLessThan(2);
  expect(w1b.x).toBeGreaterThan(w1a.x + w1a.width - 2);
  // The next column is the band below.
  expect(w2a.y).toBeGreaterThan(w1a.y + w1a.height - 2);
  expect(Math.abs(w2a.x - w1a.x)).toBeLessThan(2);
  // The gutter separator now reads as a horizontal splitter.
  await expect(page.getByRole("separator").first()).toHaveAttribute(
    "aria-orientation",
    "horizontal",
  );
});

test("a wide container stays horizontal; orientation='vertical' forces the transpose", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness orientation="vertical" />);
  // 640px wide — above the breakpoint, vertical only because it's forced.
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-orientation", "vertical");
  const w1a = await page.locator('[data-window-id="w1a"]').boundingBox();
  const w1b = await page.locator('[data-window-id="w1b"]').boundingBox();
  if (!w1a || !w1b) throw new Error("missing bounding boxes");
  expect(w1b.x).toBeGreaterThan(w1a.x + w1a.width - 2);
});

test("vertical: arrow keys follow the transposed layout", async ({ mount, page }) => {
  await mount(<WindowArrayHarness width={360} height={500} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-orientation", "vertical");
  await page.getByRole("button", { name: "Window 1A" }).click();
  // Right = along the band (was "down" in the model), Down = next band.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Window 1B" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Window 2A" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
  // Shift+Down moves the window into the band below (a model "right" move).
  await page.keyboard.press("Shift+ArrowDown");
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "cell", columnId: "col-2", index: 0 },
    }),
  );
});

test("vertical: gutter drags and arrows resize the band height", async ({ mount, page }) => {
  await mount(<WindowArrayHarness width={360} height={500} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-orientation", "vertical");
  const band = page.locator('div[data-column-id="col-1"]');
  const gutter = page.getByRole("separator").first();
  const before = await band.boundingBox();
  const gb = await gutter.boundingBox();
  if (!before || !gb) throw new Error("missing bounding boxes");
  expect(Math.round(before.height)).toBe(220);
  await dragMouse(
    page,
    { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 },
    { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 + 60 },
  );
  const grown = await band.boundingBox();
  if (!grown) throw new Error("missing bounding box");
  expect(Math.round(grown.height)).toBe(280);
  await expect(gutter).toHaveAttribute("aria-valuenow", "280");
  // A horizontal separator resizes with Up/Down.
  await gutter.focus();
  await page.keyboard.press("ArrowDown");
  await expect(gutter).toHaveAttribute("aria-valuenow", "288");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(gutter).toHaveAttribute("aria-valuenow", "264");
});

test("vertical: apiRef switches bands (Alt+Up/Down), fullscreen still fills the container", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness width={360} height={500} apiHotkeys />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-orientation", "vertical");
  await page.getByLabel("Note for Window 1A").click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  const win = page.locator('[data-window-id="w1a"]');
  await win.getByRole("button", { name: "Enter fullscreen" }).click();
  const rootBox = await page.getByTestId("window-array").boundingBox();
  const fsBox = await win.boundingBox();
  if (!rootBox || !fsBox) throw new Error("missing bounding boxes");
  expect(Math.abs(fsBox.width - rootBox.width)).toBeLessThan(4);
  expect(Math.abs(fsBox.height - rootBox.height)).toBeLessThan(4);
  await page.keyboard.press("Escape");
  await expect(win.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
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

test("custom WindowButton actions share the chrome, sit before fullscreen/close, and never start a drag (issue #26)", async ({
  mount,
  page,
}) => {
  let pinClicks = 0;
  let moves = 0;
  await mount(
    <div style={{ inlineSize: 500, blockSize: 300 }}>
      <WindowArray aria-label="Actions" onWindowMove={() => moves++}>
        <WindowArray.Column id="a" defaultWidth={300}>
          <WindowArray.Window
            id="one"
            title="Notes"
            onClose={() => {}}
            actions={
              <WindowArray.WindowButton aria-label="Pin" onClick={() => pinClicks++}>
                ●
              </WindowArray.WindowButton>
            }
          >
            <p>body</p>
          </WindowArray.Window>
        </WindowArray.Column>
      </WindowArray>
    </div>,
  );
  const group = page.getByRole("group", { name: "Notes" });
  const buttons = group.getByRole("button");
  // Title handle first, then the custom action BEFORE the built-in pair.
  await expect(buttons.nth(0)).toHaveText("Notes");
  await expect(buttons.nth(1)).toHaveAccessibleName("Pin");
  await expect(buttons.nth(2)).toHaveAccessibleName("Enter fullscreen");
  await expect(buttons.nth(3)).toHaveAccessibleName("Close");

  // Chrome parity: identical box to the built-in icon buttons.
  const pin = group.getByRole("button", { name: "Pin" });
  const fsBtn = group.getByRole("button", { name: "Enter fullscreen" });
  const pinBox = await pin.boundingBox();
  const fsBox = await fsBtn.boundingBox();
  if (!pinBox || !fsBox) throw new Error("missing bounding boxes");
  expect(pinBox.width).toBe(fsBox.width);
  expect(pinBox.height).toBe(fsBox.height);

  // Clicking fires the handler without toggling fullscreen.
  await pin.click();
  expect(pinClicks).toBe(1);
  await expect(group.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();

  // Dragging from the action never starts a window move (the actions row
  // swallows pointer-down).
  const pb = await pin.boundingBox();
  if (!pb) throw new Error("missing bounding box");
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move(pb.x + 80, pb.y + 60, { steps: 6 });
  await page.mouse.up();
  expect(moves).toBe(0);
  await expect(page.locator("[data-dragging]")).toHaveCount(0);
});

// --- Issue #31: vertical band sizing must not corrupt or overflow -----------

test("collapse → resize band → expand retains the column widths (issue #31)", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness width={640} narrowWidth={360} height={400} columnWidth={220} />);
  const root = page.getByTestId("window-array");
  const sep = page.getByRole("separator").first();

  // Horizontal: grow column 1 to 244px.
  await sep.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(sep).toHaveAttribute("aria-valuenow", "244");

  // Collapse to vertical; the band seeds its height from the width.
  await page.getByRole("button", { name: "Toggle width" }).click();
  await expect(root).toHaveAttribute("data-orientation", "vertical");
  await expect(sep).toHaveAttribute("aria-valuenow", "244");

  // Resize the BAND (a height, not a width).
  await sep.focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(sep).toHaveAttribute("aria-valuenow", "268");

  // Expand: the width the user set before collapsing is intact.
  await page.getByRole("button", { name: "Toggle width" }).click();
  await expect(root).toHaveAttribute("data-orientation", "horizontal");
  await expect(sep).toHaveAttribute("aria-valuenow", "244");
});

test("vertical windows are never taller than the container (issue #31)", async ({
  mount,
  page,
}) => {
  // 480px default column width in a 400px-tall container: without the cap the
  // first band alone would overflow the WindowArray.
  await mount(<WindowArrayHarness width={360} height={400} columnWidth={480} />);
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-orientation", "vertical");

  const box = await page.locator('[data-window-id="w1a"]').boundingBox();
  if (!box) throw new Error("no window box");
  expect(box.height).toBeLessThanOrEqual(400);

  // The band is capped at the container's content height (borders excluded),
  // and keyboard resize can't push past the cap.
  const sep = page.getByRole("separator").first();
  const capped = Number(await sep.getAttribute("aria-valuenow"));
  expect(capped).toBeLessThanOrEqual(400);
  expect(capped).toBeGreaterThan(390);
  await sep.focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(sep).toHaveAttribute("aria-valuenow", String(capped));
});

// --- Wheel scrolling is native (no custom directional handler) ---------------

test("horizontal strip: a plain wheel over a window body scrolls the body, not the strip", async ({
  mount,
  page,
}) => {
  // A tall window body inside an overflowing strip: a plain wheel scrolls the
  // body under the pointer and leaves the strip put (nothing intercepts it).
  const c = await mount(
    <div style={{ inlineSize: 480, blockSize: 300 }}>
      <WindowArray aria-label="Native wheel" data-testid="wa" orientation="horizontal">
        {["a", "b", "c", "d"].map((id) => (
          <WindowArray.Column key={id} id={id} defaultWidth={220}>
            <WindowArray.Window id={`w-${id}`} title={`Window ${id}`}>
              <div data-testid={`tall-${id}`} style={{ blockSize: 1600 }}>
                tall body {id}
              </div>
            </WindowArray.Window>
          </WindowArray.Column>
        ))}
      </WindowArray>
    </div>,
  );
  const viewport = c.locator("[data-testid='wa'] > div").first();
  const tall = c.getByTestId("tall-a");
  const box = await tall.boundingBox();
  if (!box) throw new Error("no body box");
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height, 300) / 2);

  await page.mouse.wheel(0, 200);
  // The body (nearest vertically-scrollable ancestor) took the delta.
  await expect
    .poll(() =>
      tall.evaluate((el) => {
        let node: HTMLElement | null = el.parentElement;
        while (node && node.scrollTop === 0) node = node.parentElement;
        return node ? node.scrollTop : 0;
      }),
    )
    .toBeGreaterThan(0);
  // The horizontal strip never moved.
  expect(await viewport.evaluate((el) => el.scrollLeft)).toBe(0);
});

test("horizontal strip: Shift+wheel scrolls the strip sideways (native)", async ({
  mount,
  page,
}) => {
  // Many columns in a narrow container → the strip overflows horizontally.
  const c = await mount(
    <WindowArrayHarness
      columnCount={8}
      columnWidth={220}
      width={480}
      height={300}
      orientation="horizontal"
    />,
  );
  const viewport = c.locator("[data-testid='window-array'] > div").first();
  const box = await viewport.boundingBox();
  if (!box) throw new Error("no viewport box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // Shift+wheel is the browser's standard horizontal-scroll gesture.
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 200);
  await page.keyboard.up("Shift");
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test("vertical strip: a plain wheel scrolls the strip vertically (native)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <WindowArrayHarness
      columnCount={6}
      columnWidth={220}
      width={360}
      height={280}
      orientation="vertical"
    />,
  );
  const viewport = c.locator("[data-testid='window-array'] > div").first();
  const box = await viewport.boundingBox();
  if (!box) throw new Error("no viewport box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  // Native vertical scroll moves the strip down; the cross axis stays put.
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await viewport.evaluate((el) => el.scrollLeft)).toBe(0);
});
