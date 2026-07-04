import { expect, test } from "@playwright/experimental-ct-react";
import { Picker } from "./Picker";

test("typing filters the dropdown and clicking an item selects it", async ({ mount, page }) => {
  let last = "";
  const component = await mount(
    <Picker items={["Apple", "Banana", "Cherry"]} onChange={(v) => (last = v)} />,
  );

  await component.getByRole("combobox").click();
  await component.getByRole("combobox").fill("Ban");
  await page.getByRole("option", { name: "Banana" }).click();

  expect(last).toEqual("Banana");
  await expect(component.getByRole("combobox")).toHaveValue("Banana");
});

test("elevation raises the field; omitted stays flat", async ({ mount }) => {
  const raised = await mount(<Picker items={["Apple", "Banana"]} elevation={2} />);
  const field = raised.locator('[data-elevation="2"]');
  await expect(field).toBeVisible();
  const shadow = await field.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
  await raised.unmount();

  // No elevation prop → no elevation attribute, so the field keeps its flat default.
  const flat = await mount(<Picker items={["Apple", "Banana"]} />);
  await expect(flat.locator("[data-elevation]")).toHaveCount(0);
});

/* --- Virtualized option list (issue #15; same acceptance bar as
       Selector.spec.tsx's issue-#10 tests) --- */

// "Item 000" … "Item 099": enough to overflow the ~15-row virtual window
// several times over, with stable zero-padded labels for exact assertions.
const manyItems = Array.from({ length: 100 }, (_, i) => `Item ${String(i).padStart(3, "0")}`);

/** True when the option sits inside the listbox's visible scrollport (being
 *  mounted is not enough — virtualized rows exist slightly outside it too). */
async function inScrollport(page: import("@playwright/test").Page, name: string) {
  const listBox = await page.getByRole("listbox").boundingBox();
  const optBox = await page.getByRole("option", { name }).boundingBox();
  if (!listBox || !optBox) throw new Error("missing bounding box");
  return optBox.y >= listBox.y - 1 && optBox.y + optBox.height <= listBox.y + listBox.height + 1;
}

test("virtualization renders only a window of options for 100 items", async ({ mount, page }) => {
  const component = await mount(<Picker items={manyItems} />);
  await component.getByRole("combobox").click();
  const first = page.getByRole("option", { name: "Item 000" });
  await expect(first).toBeVisible();

  // ~6 visible rows + 8 overscan each side — far fewer than the 100 items.
  const rendered = await page.getByRole("option").count();
  expect(rendered).toBeGreaterThan(5);
  expect(rendered).toBeLessThan(50);

  // Screen readers must still hear the full list size: Base UI emits no
  // aria-setsize/posinset, so Picker sets them itself.
  await expect(first).toHaveAttribute("aria-setsize", "100");
  await expect(first).toHaveAttribute("aria-posinset", "1");
});

test("ArrowDown far past the window keeps the highlight visible; Enter selects it", async ({
  mount,
  page,
}) => {
  let last = "";
  const component = await mount(<Picker items={manyItems} onChange={(v) => (last = v)} />);
  const input = component.getByRole("combobox");
  await input.click();
  await expect(page.getByRole("option", { name: "Item 000" })).toBeVisible();

  for (let i = 0; i < 30; i++) {
    await input.press("ArrowDown");
  }

  // Nothing highlighted on open, so 30 presses land on index 29 — far past
  // the initially rendered window, so this pins the scrollToIndex wiring.
  const highlighted = page.locator('[role="option"][data-highlighted]');
  await expect(highlighted).toHaveText("Item 029");
  await expect(highlighted).toBeVisible();
  expect(await inScrollport(page, "Item 029")).toBe(true);

  await input.press("Enter");
  expect(last).toEqual("Item 029");
  await expect(input).toHaveValue("Item 029");
});

test("a pre-selected mid-list item is scrolled into view on keyboard open", async ({
  mount,
  page,
}) => {
  // Single-select nuance: Base UI highlights the selected item only on
  // keyboard open (`focusItemOnOpen: 'auto'`) — a click open leaves the list
  // unhighlighted at the top, exactly as it did before virtualization. The
  // keyboard path is where scroll-to-selected must keep working.
  const component = await mount(<Picker items={manyItems} defaultValue="Item 050" />);
  const input = component.getByRole("combobox");
  await input.focus();
  await input.press("ArrowDown");

  const selected = page.getByRole("option", { name: "Item 050" });
  await expect(selected).toBeVisible();
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(selected).toHaveAttribute("data-highlighted", "");
  expect(await inScrollport(page, "Item 050")).toBe(true);
});

test("filtering to zero matches shows the empty message under virtualization", async ({
  mount,
  page,
}) => {
  const component = await mount(<Picker items={manyItems} emptyMessage="No results" />);
  const input = component.getByRole("combobox");
  await input.click();
  await expect(page.getByRole("option", { name: "Item 000" })).toBeVisible();

  await input.fill("zzz");
  await expect(page.getByText("No results")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("keyboard highlight survives its row scrolling out of the virtual window", async ({
  mount,
  page,
}) => {
  // Pins Base UI's virtualized-mode edge behavior: the highlight index lives
  // in Base UI state, not the DOM, so a manual scroll that unmounts the
  // highlighted row does NOT lose it — the next ArrowDown continues from the
  // previous index and scrollToIndex brings the row back into view. If a
  // @base-ui/react upgrade changes this, fail here and decide deliberately
  // instead of shipping the delta silently.
  const component = await mount(<Picker items={manyItems} />);
  const input = component.getByRole("combobox");
  await input.click();

  for (let i = 0; i < 20; i++) {
    await input.press("ArrowDown");
  }
  const highlighted = page.locator('[role="option"][data-highlighted]');
  const before = Number(await highlighted.getAttribute("data-index"));

  // Scroll the listbox to the bottom — stands in for a user wheel-scroll;
  // the behavior under test is driven by the highlighted row unmounting,
  // not by the input device. The row must actually unmount.
  await page.getByRole("listbox").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(highlighted).toHaveCount(0);

  await input.press("ArrowDown");
  const after = Number(await highlighted.getAttribute("data-index"));
  expect(after).toBe(before + 1); // continued from the old highlight
  await expect(highlighted).toBeVisible(); // and was scrolled back into view
});

test("fits inside a grid cell narrower than the input's 20-char default (issue #25)", async ({
  mount,
}) => {
  // Without min-inline-size: 0 on the group (and size=1 on the input), the
  // control bottoms out at ~237px and overflows the 224px cell.
  const component = await mount(
    <div style={{ inlineSize: 224 }}>
      <Picker items={["Apple", "Banana", "Cherry"]} value="Apple" />
    </div>,
  );
  const group = component.locator('[class*="group"]').first();
  const box = await group.boundingBox();
  if (!box) throw new Error("missing bounding box");
  expect(box.width).toBeLessThanOrEqual(225);
});
