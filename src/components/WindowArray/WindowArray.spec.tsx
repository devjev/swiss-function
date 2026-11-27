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

// --- windowMinWidth: a vertical band wraps onto lines -------------------------

/** Every title-bar button of the window lies inside the window's box. */
async function expectChromeInside(page: import("@playwright/test").Page, windowId: string) {
  const win = page.locator(`[data-window-id="${windowId}"]`);
  const box = await win.boundingBox();
  if (!box) throw new Error(`no box for ${windowId}`);
  const buttons = win.locator("header button");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) {
    const b = await buttons.nth(i).boundingBox();
    if (!b) throw new Error(`no box for button ${i} of ${windowId}`);
    expect(b.x).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(b.y).toBeGreaterThanOrEqual(box.y - 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
  }
}

test("vertical, phone width: a band's windows wrap to full-width lines, chrome inside", async ({
  mount,
  page,
}) => {
  // 326px (a 390px phone less the page padding) holds one 240px window per
  // line. Every chrome key is on: custom action, pop-out, split, fullscreen, ✕.
  await mount(
    <WindowArrayHarness
      width={326}
      height={500}
      windowMinWidth={240}
      withActions
      popOutable
      splittable
    />,
  );
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-orientation", "vertical");
  await expect(root).toHaveAttribute("data-stacked", "");
  const band = await page.locator('div[data-column-id="col-1"]').boundingBox();
  const w1a = await page.locator('[data-window-id="w1a"]').boundingBox();
  const w1b = await page.locator('[data-window-id="w1b"]').boundingBox();
  const w2a = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!band || !w1a || !w1b || !w2a) throw new Error("missing bounding boxes");
  // Each window takes the band's whole width (less its own gap of margin).
  expect(band.width).toBeGreaterThan(300);
  expect(Math.abs(w1a.width - (band.width - 10))).toBeLessThan(1);
  expect(Math.abs(w1b.width - w1a.width)).toBeLessThan(1);
  expect(w1a.width).toBeGreaterThanOrEqual(240);
  // One under the other, in order, each line as tall as the band (220px),
  // one gap apart; the band's backdrop spans both lines.
  expect(Math.abs(w1b.x - w1a.x)).toBeLessThan(1);
  expect(Math.round(w1a.height)).toBe(220);
  expect(Math.round(w1b.height)).toBe(220);
  expect(Math.round(w1b.y - (w1a.y + w1a.height))).toBe(10);
  expect(Math.round(band.height)).toBe(450);
  // The next band starts below the first one's last line.
  expect(w2a.y).toBeGreaterThan(w1b.y + w1b.height - 1);
  // One resize gutter per band, however many lines it has.
  await expect(page.getByRole("separator")).toHaveCount(3);
  for (const id of ["w1a", "w1b", "w2a", "w2b", "w3a", "w3b"]) {
    await expectChromeInside(page, id);
  }
});

test("vertical: windows that fit at windowMinWidth stay side by side", async ({ mount, page }) => {
  // 600px under a 700px breakpoint is vertical, and holds two 240px windows.
  await mount(
    <WindowArrayHarness width={600} height={500} verticalBelow={700} windowMinWidth={240} />,
  );
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-orientation", "vertical");
  await expect(root).not.toHaveAttribute("data-stacked", "");
  const band = await page.locator('div[data-column-id="col-1"]').boundingBox();
  const w1a = await page.locator('[data-window-id="w1a"]').boundingBox();
  const w1b = await page.locator('[data-window-id="w1b"]').boundingBox();
  const w2a = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!band || !w1a || !w1b || !w2a) throw new Error("missing bounding boxes");
  expect(Math.abs(w1b.y - w1a.y)).toBeLessThan(1);
  expect(w1b.x).toBeGreaterThan(w1a.x + w1a.width - 1);
  expect(w1a.width).toBeGreaterThanOrEqual(240);
  expect(Math.abs(w1b.width - w1a.width)).toBeLessThan(1);
  // The band is one line: 220px, and the next band follows after one gap.
  expect(Math.round(band.height)).toBe(220);
  expect(Math.round(w2a.y - (w1a.y + w1a.height))).toBe(10);
  await expectChromeInside(page, "w1a");
  await expectChromeInside(page, "w1b");
});

test("vertical: a short last line shares the band's width, and the keys keep their order", async ({
  mount,
  page,
}) => {
  // Three windows per band, two per line: 1A 1B on the first line, 1C alone
  // on the second at the full width.
  await mount(
    <WindowArrayHarness
      width={560}
      height={300}
      orientation="vertical"
      windowsPerColumn={3}
      windowMinWidth={240}
    />,
  );
  const root = page.getByTestId("window-array");
  const box = async (id: string) => {
    const b = await page.locator(`[data-window-id="${id}"]`).boundingBox();
    if (!b) throw new Error(`no box for ${id}`);
    return b;
  };
  const [w1a, w1b, w1c] = [await box("w1a"), await box("w1b"), await box("w1c")];
  expect(Math.abs(w1b.y - w1a.y)).toBeLessThan(1);
  expect(w1b.x).toBeGreaterThan(w1a.x + w1a.width - 1);
  expect(w1c.y).toBeGreaterThan(w1a.y + w1a.height - 1);
  expect(Math.abs(w1c.x - w1a.x)).toBeLessThan(1);
  expect(Math.abs(w1c.width - (w1b.x + w1b.width - w1a.x))).toBeLessThan(1);

  // Left / Right walk the band in order, across the line break, and the
  // strip scrolls the wrapped line into view.
  const scrollTop = () => root.evaluate((el) => (el.firstElementChild as HTMLElement).scrollTop);
  await page.getByRole("button", { name: "Window 1A" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Window 1B" })).toBeFocused();
  expect(await scrollTop()).toBe(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Window 1C" })).toBeFocused();
  await expect.poll(scrollTop).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const rootBox = await root.boundingBox();
      const win = await box("w1c");
      if (!rootBox) return false;
      return win.y >= rootBox.y && win.y + win.height <= rootBox.y + rootBox.height;
    })
    .toBe(true);
  // Up / Down step one line: out of the band's last line into the next
  // band's first, and back into the last line of the band above.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Window 2A" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: "Window 1C" })).toBeFocused();
  // Inside the band they reach the window above or below, the place on the
  // line kept (and clamped on the short line).
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Window 1C" })).toBeFocused();
  // Shift+Left reports the same move as on an unwrapped band.
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1c",
      from: { columnId: "col-1", index: 2 },
      to: { type: "cell", columnId: "col-1", index: 1 },
    }),
  );
});

test("vertical, one window per line: the band's gutter sets every line's height", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness width={326} height={500} windowMinWidth={240} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  const gutter = page.getByRole("separator").first();
  await expect(gutter).toHaveAttribute("aria-valuenow", "220");
  await gutter.focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(gutter).toHaveAttribute("aria-valuenow", "244");
  const w1a = await page.locator('[data-window-id="w1a"]').boundingBox();
  const w1b = await page.locator('[data-window-id="w1b"]').boundingBox();
  const w2a = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!w1a || !w1b || !w2a) throw new Error("missing bounding boxes");
  expect(Math.round(w1a.height)).toBe(244);
  expect(Math.round(w1b.height)).toBe(244);
  // The other bands keep their own height.
  expect(Math.round(w2a.height)).toBe(220);
});

test("vertical, one window per line: a drop on a window's lower half lands after it", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness width={326} height={700} windowMinWidth={240} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  const handle = page.getByRole("button", { name: "Window 1A" });
  const target = page.locator('[data-window-id="w1b"]');
  const hb = await handle.boundingBox();
  const tb = await target.boundingBox();
  if (!hb || !tb) throw new Error("missing bounding boxes");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  // The left side of the lower half: the insertion side follows y here.
  await page.mouse.move(tb.x + tb.width * 0.2, tb.y + tb.height * 0.8, { steps: 10 });
  await expect(target).toHaveAttribute("data-drop-edge", "after");
  // The indicator is a horizontal line on the window's bottom edge.
  const line = await target.evaluate((el) => {
    const s = getComputedStyle(el, "::after");
    return { width: Number.parseFloat(s.width), height: Number.parseFloat(s.height) };
  });
  expect(line.height).toBe(2);
  expect(line.width).toBeGreaterThan(200);
  await page.mouse.up();
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "cell", columnId: "col-1", index: 1 },
    }),
  );
});

test("vertical: widening the container past windowMinWidth unwraps the bands", async ({
  mount,
  page,
}) => {
  await mount(
    <WindowArrayHarness
      width={600}
      narrowWidth={326}
      height={500}
      verticalBelow={700}
      windowMinWidth={240}
    />,
  );
  const root = page.getByTestId("window-array");
  const sideBySide = async () => {
    const a = await page.locator('[data-window-id="w1a"]').boundingBox();
    const b = await page.locator('[data-window-id="w1b"]').boundingBox();
    if (!a || !b) throw new Error("missing bounding boxes");
    return Math.abs(a.y - b.y) < 1;
  };
  await expect(root).toHaveAttribute("data-orientation", "vertical");
  expect(await sideBySide()).toBe(true);
  await page.getByRole("button", { name: "Toggle width" }).click();
  await expect(root).toHaveAttribute("data-stacked", "");
  expect(await sideBySide()).toBe(false);
  await page.getByRole("button", { name: "Toggle width" }).click();
  await expect(root).not.toHaveAttribute("data-stacked", "");
  expect(await sideBySide()).toBe(true);
});

test("vertical, one window per line: fullscreen fills the container and returns to its line", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness width={326} height={500} windowMinWidth={240} />);
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-stacked", "");
  const win = page.locator('[data-window-id="w1b"]');
  await win.scrollIntoViewIfNeeded();
  const before = await win.boundingBox();
  await win.getByRole("button", { name: "Enter fullscreen" }).click();
  const rootBox = await root.boundingBox();
  const fsBox = await win.boundingBox();
  if (!rootBox || !fsBox || !before) throw new Error("missing bounding boxes");
  expect(Math.abs(fsBox.width - rootBox.width)).toBeLessThan(4);
  expect(Math.abs(fsBox.height - rootBox.height)).toBeLessThan(4);
  await page.keyboard.press("Escape");
  await expect(win.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  const after = await win.boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(Math.abs(after.width - before.width)).toBeLessThan(1);
  expect(Math.abs(after.height - before.height)).toBeLessThan(1);
});

// --- A wrapped band: keys, paddles, split view, pop-out, snap ---------------
// 326px holds one 240px window per line: w1a, w1b (band 1), w2a, w2b (band 2),
// w3a, w3b (band 3), one under the other, 220px lines 10px apart.

const STACKED = { width: 326, height: 500, windowMinWidth: 240 } as const;
const STACK_ORDER = ["w1a", "w1b", "w2a", "w2b", "w3a", "w3b"];

function stripViewport(page: import("@playwright/test").Page) {
  return page.getByTestId("window-array").locator("> div").first();
}

/** The window's box relative to the strip's visible area. */
async function inViewport(page: import("@playwright/test").Page, id: string) {
  const view = await stripViewport(page).boundingBox();
  const win = await page.locator(`[data-window-id="${id}"]`).boundingBox();
  if (!view || !win) throw new Error(`missing box for ${id}`);
  return { top: win.y - view.y, bottom: view.y + view.height - (win.y + win.height) };
}

test("vertical, one window per line: Up and Down walk every window in order", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness {...STACKED} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  await page.getByRole("button", { name: "Window 1A" }).click();
  for (const id of STACK_ORDER.slice(1)) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("active-id")).toHaveText(id);
    // Each one is scrolled into view whole.
    await expect
      .poll(async () => {
        const at = await inViewport(page, id);
        return at.top >= 0 && at.bottom >= 0;
      })
      .toBe(true);
  }
  // The end of the strip: nothing further down.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("active-id")).toHaveText("w3b");
  for (const id of STACK_ORDER.slice(0, -1).reverse()) {
    await page.keyboard.press("ArrowUp");
    await expect(page.getByTestId("active-id")).toHaveText(id);
  }
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
});

test("vertical, one window per line: Shift+Down and Shift+Up change places with the neighbour, across bands", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness {...STACKED} height={900} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  const order = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-window-id]")]
        .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y)
        .map((el) => el.dataset.windowId),
    );
  await page.getByRole("button", { name: "Window 1A" }).click();
  // Inside the band: one place down.
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(order).toEqual(["w1b", "w1a", "w2a", "w2b", "w3a", "w3b"]);
  await expect(page.getByRole("button", { name: "Window 1A" })).toBeFocused();
  // Out of the band: under the first window of the band below.
  await page.keyboard.press("Shift+ArrowDown");
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 1 },
      to: { type: "cell", columnId: "col-2", index: 1 },
    }),
  );
  await expect.poll(order).toEqual(["w1b", "w2a", "w1a", "w2b", "w3a", "w3b"]);
  // And back: above the last window of the band above.
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-2", index: 0 },
      to: { type: "cell", columnId: "col-1", index: 0 },
    }),
  );
  await expect.poll(order).toEqual(STACK_ORDER);
});

test("vertical, one window per line: the paddles step one window at a time", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness {...STACKED} controls />);
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-stacked", "");
  const prev = page.getByRole("button", { name: "Previous column" });
  const next = page.getByRole("button", { name: "Next column" });
  // The paddles sit at the top and the bottom edge, centred.
  const rootBox = await root.boundingBox();
  const prevBox = await prev.boundingBox();
  const nextBox = await next.boundingBox();
  if (!rootBox || !prevBox || !nextBox) throw new Error("missing bounding boxes");
  const centre = rootBox.x + rootBox.width / 2;
  expect(Math.abs(prevBox.x + prevBox.width / 2 - centre)).toBeLessThan(1);
  expect(Math.abs(nextBox.x + nextBox.width / 2 - centre)).toBeLessThan(1);
  expect(prevBox.y - rootBox.y).toBeLessThan(12);
  expect(rootBox.y + rootBox.height - (nextBox.y + nextBox.height)).toBeLessThan(12);
  // Next from nothing starts at the first window, then every window in turn.
  await page.mouse.move(centre, rootBox.y + rootBox.height - 10);
  for (const id of STACK_ORDER) {
    await next.click();
    await expect(page.getByTestId("active-id")).toHaveText(id);
    await expect
      .poll(async () => {
        const at = await inViewport(page, id);
        return at.top >= 0 && at.bottom >= 0;
      })
      .toBe(true);
  }
  await expect(next).toBeDisabled();
  await page.mouse.move(centre, rootBox.y + 10);
  for (const id of STACK_ORDER.slice(0, -1).reverse()) {
    await prev.click();
    await expect(page.getByTestId("active-id")).toHaveText(id);
  }
  await expect(prev).toBeDisabled();
});

test("vertical, one window per line: apiRef.switchColumn steps one line", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness {...STACKED} apiHotkeys />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  await page.getByLabel("Note for Window 1A").click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByTestId("active-id")).toHaveText("w1b");
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByTestId("active-id")).toHaveText("w1b");
});

test("vertical, one window per line: split view fills the two halves and returns to the lines", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness {...STACKED} splittable popOutable withActions />);
  const root = page.getByTestId("window-array");
  await expect(root).toHaveAttribute("data-stacked", "");
  const viewport = stripViewport(page);
  await viewport.evaluate((el) => el.scrollTo({ top: 300, behavior: "instant" }));
  const before = await page.locator('[data-window-id="w2a"]').boundingBox();
  await page.locator('[data-window-id="w2a"]').getByRole("button", { name: "Split view" }).click();
  await page.getByRole("radio", { name: "Window 3B" }).click();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(page.getByTestId("split-ids")).toHaveText('["w2a","w3b"]');
  const rootBox = await root.boundingBox();
  const top = await page.locator('[data-split="1"]').boundingBox();
  const bottom = await page.locator('[data-split="2"]').boundingBox();
  if (!rootBox || !top || !bottom || !before) throw new Error("missing bounding boxes");
  // Top and bottom halves over the whole container, meeting at a hairline.
  expect(Math.abs(top.width - (rootBox.width - 2))).toBeLessThan(1);
  expect(Math.abs(bottom.width - top.width)).toBeLessThan(1);
  expect(Math.abs(top.y - (rootBox.y + 1))).toBeLessThan(1);
  expect(Math.abs(bottom.y + bottom.height - (rootBox.y + rootBox.height - 1))).toBeLessThan(1);
  expect(Math.abs(top.y + top.height - bottom.y)).toBeLessThanOrEqual(1);
  await expectChromeInside(page, "w2a");
  await expectChromeInside(page, "w3b");
  // The strip behind neither scrolls nor moves.
  expect(await viewport.evaluate((el) => getComputedStyle(el).overflowY)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-split]")).toHaveCount(0);
  expect(await viewport.evaluate((el) => el.scrollTop)).toBe(300);
  const after = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!after) throw new Error("missing bounding box");
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(Math.abs(after.height - before.height)).toBeLessThan(1);
});

test("vertical, one window per line: a popped window frees its line and comes back to it", async ({
  mount,
  page,
}) => {
  const c = await mount(<WindowArrayHarness {...STACKED} popOutable />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  const viewport = stripViewport(page);
  const band = page.locator('div[data-column-id="col-1"]');
  const scrollHeight = () => viewport.evaluate((el) => el.scrollHeight);
  const full = await scrollHeight();
  expect(Math.round((await band.boundingBox())?.height ?? 0)).toBe(450);
  await page.getByRole("button", { name: "Window 1A" }).click();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c
      .locator('[data-window-id="w1a"]')
      .getByRole("button", { name: "Open in a separate window" })
      .click(),
  ]);
  await expect(popup.getByText("Body of Window 1A")).toBeVisible();
  // The band is one line shorter and its other window takes the first line.
  await expect(c.locator('[data-window-id="w1a"]')).toHaveCount(0);
  await expect.poll(scrollHeight).toBe(full - 230);
  expect(Math.round((await band.boundingBox())?.height ?? 0)).toBe(220);
  await expect(page.getByTestId("active-id")).toHaveText("w1b");
  expect((await inViewport(page, "w1b")).top).toBeLessThan(12);
  // Keys and moves pass the popped window by.
  await page.getByRole("button", { name: "Window 1B" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("active-id")).toHaveText("w1b");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("active-id")).toHaveText("w1b");
  // Back: its line returns, above w1b, and the strip shows it.
  await popup.getByRole("button", { name: "Bring the window back" }).click();
  await expect(c.locator('[data-window-id="w1a"]')).toHaveCount(1);
  await expect.poll(scrollHeight).toBe(full);
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  const a = await c.locator('[data-window-id="w1a"]').boundingBox();
  const b = await c.locator('[data-window-id="w1b"]').boundingBox();
  if (!a || !b) throw new Error("missing bounding boxes");
  expect(Math.round(b.y - (a.y + a.height))).toBe(10);
});

test("vertical, one window per line: snap gives every line a start and an end position", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness {...STACKED} snap />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  const viewport = stripViewport(page);
  expect(await viewport.evaluate((el) => getComputedStyle(el).scrollSnapType)).toBe("block");
  const settle = async (top: number) => {
    await viewport.evaluate((el, t) => el.scrollTo({ top: t, behavior: "instant" }), top);
    await page.waitForTimeout(200);
    return viewport.evaluate((el) => Math.round(el.scrollTop));
  };
  // Lines are 230px apart from y = 10; the visible area is 498px tall.
  // Start positions: a line's top less one gap. The second line of band 1
  // (230) and of band 2 (690) have one, as the bands' first lines do (460).
  expect(await settle(236)).toBe(230);
  expect(await settle(455)).toBe(460);
  expect(await settle(684)).toBe(690);
  // End positions: a line's bottom plus one gap at the bottom edge.
  expect(await settle(206)).toBe(202);
});

test("vertical: a focus move to a line as tall as the container keeps its title bar in view", async ({
  mount,
  page,
}) => {
  // Bands of 480px are capped to the 298px container: every line fills it.
  await mount(<WindowArrayHarness {...STACKED} height={300} columnWidth={480} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-stacked", "");
  await page.getByRole("button", { name: "Window 1A" }).click();
  for (const id of ["w1b", "w2a", "w2b"]) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("active-id")).toHaveText(id);
    // The window fills the visible area exactly: nothing cut at either end.
    await expect
      .poll(async () => {
        const at = await inViewport(page, id);
        return Math.abs(at.top) < 1 && Math.abs(at.bottom) < 1;
      })
      .toBe(true);
  }
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(async () => {
      const at = await inViewport(page, "w2a");
      return Math.abs(at.top) < 1 && Math.abs(at.bottom) < 1;
    })
    .toBe(true);
});

test("the paddles pass over a popped-out window and a column that is all popped out", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <WindowArrayHarness popOutable controls columnCount={3} windowsPerColumn={1} />,
  );
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c
      .locator('[data-window-id="w2a"]')
      .getByRole("button", { name: "Open in a separate window" })
      .click(),
  ]);
  await expect(popup.getByText("Body of Window 2A")).toBeVisible();
  const box = await page.getByTestId("window-array").boundingBox();
  if (!box) throw new Error("missing bounding box");
  const next = page.getByRole("button", { name: "Next column" });
  await page.getByRole("button", { name: "Window 1A" }).click();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await next.click();
  await expect(page.getByTestId("active-id")).toHaveText("w3a");
  await expect(next).toBeDisabled();
  // Arrow keys cross the gap as well.
  await page.getByRole("button", { name: "Window 3A" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("active-id")).toHaveText("w1a");
  await popup.close();
});

// --- A column with no windows ------------------------------------------------

test("a column with no windows keeps its track and takes a dropped window", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness columnCount={2} emptyColumn width={760} />);
  const empty = page.locator('div[data-column-id="col-empty"]');
  await expect(empty).toHaveAttribute("data-empty", "");
  const track = await empty.boundingBox();
  const last = await page.locator('div[data-column-id="col-2"]').boundingBox();
  if (!track || !last) throw new Error("missing bounding boxes");
  // Its own 220px track, one gutter after the last column with windows.
  expect(Math.round(track.width)).toBe(220);
  expect(Math.round(track.x - (last.x + last.width))).toBe(10);
  expect(track.height).toBeGreaterThan(300);
  // Drag a title bar over it: the column shows as the drop target.
  const hb = await page.getByRole("button", { name: "Window 1A" }).boundingBox();
  if (!hb) throw new Error("missing bounding box");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2, { steps: 10 });
  await expect(empty).toHaveAttribute("data-drop-active", "");
  expect(await empty.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.mouse.up();
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "cell", columnId: "col-empty", index: 0 },
    }),
  );
  await expect(page.locator('[data-window-id="w1a"]')).toHaveAttribute(
    "data-column-id",
    "col-empty",
  );
  await expect(empty).not.toHaveAttribute("data-empty", "");
  await expect(empty).not.toHaveAttribute("data-drop-active", "");
});

test("a column with no windows: arrows stop before it, Shift+Right moves a window into it", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness columnCount={2} emptyColumn width={760} />);
  await page.getByRole("button", { name: "Window 2A" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("active-id")).toHaveText("w2a");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w2a",
      from: { columnId: "col-2", index: 0 },
      to: { type: "cell", columnId: "col-empty", index: 0 },
    }),
  );
  await expect(page.getByRole("button", { name: "Window 2A" })).toBeFocused();
});

test("vertical: a column with no windows is a full-width band", async ({ mount, page }) => {
  await mount(<WindowArrayHarness columnCount={1} emptyColumn width={326} height={600} />);
  await expect(page.getByTestId("window-array")).toHaveAttribute("data-orientation", "vertical");
  const empty = await page.locator('div[data-column-id="col-empty"]').boundingBox();
  const band = await page.locator('div[data-column-id="col-1"]').boundingBox();
  if (!empty || !band) throw new Error("missing bounding boxes");
  expect(Math.round(empty.height)).toBe(220);
  expect(empty.y).toBeGreaterThan(band.y + band.height);
  expect(empty.width).toBeGreaterThan(290);
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

// --- Split view ("1|2") ------------------------------------------------------

/** Click `source`'s split button and pick `target` for the second half. */
async function enterSplit(page: import("@playwright/test").Page, source: string, target: string) {
  await page
    .getByRole("group", { name: source })
    .getByRole("button", { name: "Split view", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: target }).click();
  await dialog.getByRole("button", { name: "Split", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test("split view: the 1|2 button opens a picker and two windows fill the halves", async ({
  mount,
  page,
}) => {
  await mount(<WindowArrayHarness splittable />);
  const root = page.getByTestId("window-array");
  await page
    .getByRole("group", { name: "Window 1A" })
    .getByRole("button", { name: "Split view", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The clicked window is half 1, so it is not offered for half 2.
  await expect(dialog.getByRole("radio", { name: "Window 1A" })).toHaveCount(0);
  await dialog.getByRole("radio", { name: "Window 2A" }).click();
  await dialog.getByRole("button", { name: "Split", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const rootBox = await root.boundingBox();
  const b1 = await page.locator('[data-window-id="w1a"]').boundingBox();
  const b2 = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!rootBox || !b1 || !b2) throw new Error("missing bounding boxes");
  // Each half is half the container along the split axis (within a few px:
  // borders and the 1px divider overlap) and full size on the cross axis;
  // half 2 sits to the right of half 1, flush at the divider.
  expect(Math.abs(b1.width - rootBox.width / 2)).toBeLessThanOrEqual(4);
  expect(Math.abs(b2.width - rootBox.width / 2)).toBeLessThanOrEqual(4);
  expect(Math.abs(b1.height - rootBox.height)).toBeLessThan(6);
  expect(b2.x).toBeGreaterThan(b1.x + b1.width - 4);
  expect(b2.x).toBeLessThan(b1.x + b1.width + 4);
  await expect(page.getByTestId("split-ids")).toHaveText('["w1a","w2a"]');
  // Both halves show the pressed exit toggle; maximize is hidden while split.
  for (const id of ["w1a", "w2a"]) {
    const win = page.locator(`[data-window-id="${id}"]`);
    await expect(win.getByRole("button", { name: "Exit split view", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(win.getByRole("button", { name: "Enter fullscreen" })).toHaveCount(0);
  }
});

test("split view: Cancel leaves the strip untouched", async ({ mount, page }) => {
  await mount(<WindowArrayHarness splittable />);
  await page
    .getByRole("group", { name: "Window 1A" })
    .getByRole("button", { name: "Split view", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("[data-split]")).toHaveCount(0);
  await expect(page.getByTestId("split-ids")).toHaveText("");
});

test("split view: Escape exits and restores window geometry", async ({ mount, page }) => {
  await mount(<WindowArrayHarness splittable />);
  const win = page.locator('[data-window-id="w1a"]');
  const before = await win.boundingBox();
  await enterSplit(page, "Window 1A", "Window 2A");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-split]")).toHaveCount(0);
  await expect(page.getByTestId("split-ids")).toHaveText("");
  const after = await win.boundingBox();
  if (!before || !after) throw new Error("missing bounding boxes");
  expect(Math.abs(after.width - before.width)).toBeLessThan(4);
  expect(Math.abs(after.height - before.height)).toBeLessThan(4);
});

test("split view: the pressed 1|2 button exits", async ({ mount, page }) => {
  await mount(<WindowArrayHarness splittable />);
  await enterSplit(page, "Window 1A", "Window 2A");
  await page
    .locator('[data-window-id="w1a"]')
    .getByRole("button", { name: "Exit split view", exact: true })
    .click();
  await expect(page.locator("[data-split]")).toHaveCount(0);
  await expect(page.getByTestId("split-ids")).toHaveText("");
});

test("split view: vertical orientation stacks the halves top/bottom", async ({ mount, page }) => {
  // 360px wide with the default verticalBelow (480) → vertical strip.
  await mount(<WindowArrayHarness splittable width={360} height={500} />);
  const root = page.getByTestId("window-array");
  await enterSplit(page, "Window 1A", "Window 2A");
  const rootBox = await root.boundingBox();
  const b1 = await page.locator('[data-window-id="w1a"]').boundingBox();
  const b2 = await page.locator('[data-window-id="w2a"]').boundingBox();
  if (!rootBox || !b1 || !b2) throw new Error("missing bounding boxes");
  expect(Math.abs(b1.height - rootBox.height / 2)).toBeLessThanOrEqual(4);
  expect(Math.abs(b2.height - rootBox.height / 2)).toBeLessThanOrEqual(4);
  expect(Math.abs(b1.width - rootBox.width)).toBeLessThan(6);
  expect(b2.y).toBeGreaterThan(b1.y + b1.height - 4);
  expect(b2.y).toBeLessThan(b1.y + b1.height + 4);
});

test("split view: closing a member window exits the split", async ({ mount, page }) => {
  await mount(<WindowArrayHarness splittable />);
  await enterSplit(page, "Window 1A", "Window 2A");
  await page.locator('[data-window-id="w1a"]').getByRole("button", { name: "Close" }).click();
  await expect(page.locator("[data-split]")).toHaveCount(0);
  await expect(page.getByTestId("split-ids")).toHaveText("");
});

test("split view: splitting from fullscreen exits fullscreen", async ({ mount, page }) => {
  await mount(<WindowArrayHarness splittable />);
  const win = page.locator('[data-window-id="w1a"]');
  await win.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(win).toHaveAttribute("data-fullscreen", "");
  await enterSplit(page, "Window 1A", "Window 2A");
  await expect(page.locator("[data-fullscreen]")).toHaveCount(0);
  await expect(page.locator("[data-split]")).toHaveCount(2);
});

test("split view: a controlled splitIds pins the split", async ({ mount, page }) => {
  await mount(
    <div style={{ inlineSize: 640, blockSize: 360 }}>
      <WindowArray aria-label="Controlled split" splittable splitIds={["one", "two"]}>
        <WindowArray.Column id="a" defaultWidth={220}>
          <WindowArray.Window id="one" title="One">
            <p>1</p>
          </WindowArray.Window>
          <WindowArray.Window id="two" title="Two">
            <p>2</p>
          </WindowArray.Window>
        </WindowArray.Column>
        <WindowArray.Column id="b" defaultWidth={220}>
          <WindowArray.Window id="three" title="Three">
            <p>3</p>
          </WindowArray.Window>
        </WindowArray.Column>
      </WindowArray>
    </div>,
  );
  // The controlled pair renders as halves without any interaction.
  await expect(page.locator('[data-split="1"]')).toHaveAttribute("data-window-id", "one");
  await expect(page.locator('[data-split="2"]')).toHaveAttribute("data-window-id", "two");
  // Escape reports the change, but the controlled value pins the split.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-split]")).toHaveCount(2);
});

// --- Pop-out windows (issue #84) --------------------------------------------

test("pop-out moves the window (with its chrome) to a popup and leaves no strip cell", async ({
  mount,
  page,
}) => {
  const c = await mount(<WindowArrayHarness popOutable />);
  const win = c.locator('[data-window-id="w1a"]');
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    win.getByRole("button", { name: "Open in a separate window" }).click(),
  ]);
  // The popup carries the window's body AND its title-bar chrome.
  await expect(popup.getByText("Body of Window 1A")).toBeVisible();
  await expect(popup.getByText("Window 1A", { exact: true })).toBeVisible();
  await expect(c.getByTestId("popped-ids")).toHaveText('["w1a"]');
  // No skeleton is left in the strip: the section is gone entirely.
  await expect(win).toHaveCount(0);
  await expect(c.getByText("Body of Window 1A")).toHaveCount(0);
  // The pressed pop-out button in the popup returns it to the strip.
  await popup.getByRole("button", { name: "Bring the window back" }).click();
  await expect(win).toHaveCount(1);
  await expect(win.getByText("Body of Window 1A")).toBeVisible();
  await expect(c.getByTestId("popped-ids")).toHaveText("[]");
  await expect.poll(() => popup.isClosed()).toBe(true);
});

test("a column whose windows are all popped out collapses away", async ({ mount, page }) => {
  // 3 columns × 1 window each: popping the middle window empties its column.
  const c = await mount(<WindowArrayHarness popOutable columnCount={3} windowsPerColumn={1} />);
  // A backdrop div per column (windows are <section>s, not <div>s).
  await expect(c.locator("div[data-column-id]")).toHaveCount(3);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c
      .locator('[data-window-id="w2a"]')
      .getByRole("button", { name: "Open in a separate window" })
      .click(),
  ]);
  await expect(popup.getByText("Body of Window 2A")).toBeVisible();
  // The middle column is gone — the strip tightens to two columns.
  await expect(c.locator("div[data-column-id]")).toHaveCount(2);
  await expect(c.locator('div[data-column-id="col-2"]')).toHaveCount(0);
  await popup.getByRole("button", { name: "Bring the window back" }).click();
  await expect(c.locator("div[data-column-id]")).toHaveCount(3);
});

test("the after drop line renders on the last visible window when the one below is popped out", async ({
  mount,
  page,
}) => {
  const c = await mount(<WindowArrayHarness popOutable />);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c
      .locator('[data-window-id="w2b"]')
      .getByRole("button", { name: "Open in a separate window" })
      .click(),
  ]);
  await expect(popup.getByText("Body of Window 2B")).toBeVisible();
  // w2a is column 2's only visible window now. Dragging onto its lower half
  // targets the slot after it (full-array index 1, before the popped w2b);
  // the indicator must render even though w2a is not the full-array last row.
  const handle = page.getByRole("button", { name: "Window 1A" });
  const target = page.locator('[data-window-id="w2a"]');
  const hb = await handle.boundingBox();
  const tb = await target.boundingBox();
  if (!hb || !tb) throw new Error("missing bounding boxes");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height * 0.8, { steps: 10 });
  await expect(target).toHaveAttribute("data-drop-edge", "after");
  await page.mouse.up();
  await expect(page.getByTestId("last-move")).toHaveText(
    JSON.stringify({
      windowId: "w1a",
      from: { columnId: "col-1", index: 0 },
      to: { type: "cell", columnId: "col-2", index: 1 },
    }),
  );
  await popup.close();
});

test("popping a window holds the strip's horizontal scroll position", async ({ mount, page }) => {
  // Enough columns to overflow horizontally.
  const c = await mount(
    <WindowArrayHarness
      popOutable
      columnCount={8}
      windowsPerColumn={1}
      columnWidth={220}
      width={500}
    />,
  );
  const viewport = c.locator('[class*="viewport"]').first();
  // Scroll right (instant, so no smooth-scroll animation confuses the read).
  await viewport.evaluate((el) => el.scrollTo({ left: 300, behavior: "instant" }));
  await page.waitForTimeout(150);
  const before = await viewport.evaluate((el) => Math.round(el.scrollLeft));
  expect(before).toBeGreaterThan(200);
  // Pop a window whose button is on screen at this scroll (col-3), via a DOM
  // click so the test harness doesn't auto-scroll it into view itself.
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c
      .locator('[data-window-id="w3a"]')
      .evaluate((el) =>
        el
          .querySelector<HTMLButtonElement>('button[aria-label="Open in a separate window"]')
          ?.click(),
      ),
  ]);
  await expect(popup.getByText("Body of Window 3A")).toBeVisible();
  await page.waitForTimeout(300);
  const after = await viewport.evaluate((el) => Math.round(el.scrollLeft));
  // The strip did not jump (it used to reveal-scroll to the new active window).
  expect(Math.abs(after - before)).toBeLessThan(20);
  await popup.close();
});

test("custom window actions travel into the popped-out window", async ({ mount, page }) => {
  const c = await mount(<WindowArrayHarness popOutable withActions />);
  const win = c.locator('[data-window-id="w1a"]');
  await expect(win.getByRole("button", { name: "Pin Window 1A" })).toBeVisible();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    win.getByRole("button", { name: "Open in a separate window" }).click(),
  ]);
  await expect(popup.getByRole("button", { name: "Pin Window 1A" })).toBeVisible();
  await popup.close();
});

test("closing the popup returns the content to the strip", async ({ mount, page }) => {
  const c = await mount(<WindowArrayHarness popOutable />);
  const win = c.locator('[data-window-id="w2a"]');
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    win.getByRole("button", { name: "Open in a separate window" }).click(),
  ]);
  await expect(popup.getByText("Body of Window 2A")).toBeVisible();
  await popup.close();
  await expect(win.getByText("Body of Window 2A")).toBeVisible();
  await expect(c.getByTestId("popped-ids")).toHaveText("[]");
});

test("Escape inside the popup returns the content", async ({ mount, page }) => {
  const c = await mount(<WindowArrayHarness popOutable />);
  const win = c.locator('[data-window-id="w1a"]');
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    win.getByRole("button", { name: "Open in a separate window" }).click(),
  ]);
  await expect(popup.getByText("Body of Window 1A")).toBeVisible();
  // The keydown handler closes the window mid-press; press() may lose the
  // page on the keyup half. That is the behavior under test.
  await popup.keyboard.press("Escape").catch(() => {});
  await expect(win.getByText("Body of Window 1A")).toBeVisible();
  await expect(c.getByTestId("popped-ids")).toHaveText("[]");
});

test("popping a fullscreen window exits fullscreen and leaves no strip cell", async ({
  mount,
  page,
}) => {
  const c = await mount(<WindowArrayHarness popOutable />);
  const win = c.locator('[data-window-id="w1a"]');
  await win.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(win).toHaveAttribute("data-fullscreen", "");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    win.getByRole("button", { name: "Open in a separate window" }).click(),
  ]);
  await expect(popup.getByText("Body of Window 1A")).toBeVisible();
  await expect(win).toHaveCount(0);
  // Fullscreen and split controls are absent in the popped window; pop-out is
  // the toggle back.
  await expect(popup.getByRole("button", { name: "Enter fullscreen" })).toHaveCount(0);
  await popup.getByRole("button", { name: "Bring the window back" }).click();
  await expect(win).toHaveCount(1);
  await expect(win).not.toHaveAttribute("data-fullscreen", "");
  await expect(win.getByText("Body of Window 1A")).toBeVisible();
});

test("the split picker excludes popped-out windows", async ({ mount, page }) => {
  const c = await mount(<WindowArrayHarness popOutable splittable />);
  const w1a = c.locator('[data-window-id="w1a"]');
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    w1a.getByRole("button", { name: "Open in a separate window" }).click(),
  ]);
  await expect(popup.getByText("Body of Window 1A")).toBeVisible();
  await c.locator('[data-window-id="w2a"]').getByRole("button", { name: "Split view" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Window 2B")).toBeVisible();
  await expect(dialog.getByText("Window 1A")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await popup.getByRole("button", { name: "Bring the window back" }).click();
  await expect(w1a.getByText("Body of Window 1A")).toBeVisible();
});

// --- Touch ---------------------------------------------------------------------

test.describe("with a finger", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });

  test("the paddles stay hidden: a touch near an edge does not bring them up", async ({
    mount,
    page,
  }) => {
    await mount(<WindowArrayHarness width={326} height={500} windowMinWidth={240} controls />);
    const root = page.getByTestId("window-array");
    await expect(root).toHaveAttribute("data-stacked", "");
    const prev = page.getByRole("button", { name: "Previous column" });
    const next = page.getByRole("button", { name: "Next column" });
    await expect(prev).toHaveCSS("opacity", "0");
    await expect(next).toHaveCSS("opacity", "0");
    await expect(next).toHaveCSS("pointer-events", "none");
    // A finger that travels along the bottom edge, where the next paddle is.
    const box = await root.boundingBox();
    if (!box) throw new Error("missing bounding box");
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    const y = box.y + box.height - 20;
    await touch("touchStart", box.x + 60, y);
    await touch("touchMove", box.x + 90, y);
    await touch("touchMove", box.x + 120, y);
    await expect(next).not.toHaveAttribute("data-visible", "");
    await expect(next).toHaveCSS("opacity", "0");
    await touch("touchEnd", 0, 0);
    // A tap where the paddle is goes to the window under it.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 20);
    await expect(page.getByTestId("active-id")).toHaveText("w1a");
    // The strip still scrolls, and a keyboard still reaches a paddle.
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("active-id")).toHaveText("w1b");
  });
});
