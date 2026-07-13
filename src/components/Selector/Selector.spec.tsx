import { expect, test } from "@playwright/experimental-ct-react";
import { Selector } from "./Selector";
import { SelectorHarness } from "./Selector.harness";

test("typing filters the dropdown and clicking an item adds a chip", async ({ mount, page }) => {
  let last: string[] = [];
  const component = await mount(<SelectorHarness onChange={(v) => (last = v)} />);

  await component.getByRole("combobox").click();
  await component.getByRole("combobox").fill("Ban");
  await page.getByRole("option", { name: "Banana" }).click();

  expect(last).toEqual(["Banana"]);
  await expect(component.getByText("Banana")).toBeVisible();
});

test("panel bucket shows the running count", async ({ mount, page }) => {
  const component = await mount(<SelectorHarness initial={["Apple"]} />);
  await expect(component.getByText("(1)")).toBeVisible();

  await component.getByRole("combobox").click();
  await page.getByRole("option", { name: "Cherry" }).click();
  await expect(component.getByText("(2)")).toBeVisible();
});

test("removing a chip deselects that value", async ({ mount }) => {
  let last: string[] = [];
  const component = await mount(
    <SelectorHarness initial={["Apple", "Cherry"]} onChange={(v) => (last = v)} />,
  );

  await component.getByRole("button", { name: "Remove Apple" }).click();
  expect(last).toEqual(["Cherry"]);
  await expect(component.getByText("(1)")).toBeVisible();
});

test("Clear empties the bucket", async ({ mount }) => {
  let last: string[] = ["Apple", "Cherry"];
  const component = await mount(
    <SelectorHarness initial={["Apple", "Cherry"]} onChange={(v) => (last = v)} />,
  );

  await component.getByRole("button", { name: "Clear all" }).click();
  expect(last).toEqual([]);
  await expect(component.getByText("No items selected")).toBeVisible();
});

test("inline layout renders chips inside the field (no bucket panel)", async ({ mount, page }) => {
  const component = await mount(<SelectorHarness layout="inline" initial={["Apple"]} />);
  await expect(component.getByText("No items selected")).toHaveCount(0);

  await component.getByRole("combobox").click();
  await page.getByRole("option", { name: "Banana" }).click();
  await expect(component.getByText("Banana")).toBeVisible();
});

test("object items search by label and select by value", async ({ mount, page }) => {
  let last: string[] = [];
  const component = await mount(
    <SelectorHarness
      items={[
        { value: "ts", label: "TypeScript" },
        { value: "rs", label: "Rust" },
      ]}
      onChange={(v) => (last = v)}
    />,
  );

  await component.getByRole("combobox").click();
  await component.getByRole("combobox").fill("Type");
  await page.getByRole("option", { name: "TypeScript" }).click();

  expect(last).toEqual(["ts"]);
  await expect(component.getByText("TypeScript")).toBeVisible();
});

test("size presets change the inline control height", async ({ mount }) => {
  const small = await mount(<SelectorHarness size="sm" layout="inline" initial={["Apple"]} />);
  const sb = await small.locator('[data-size="sm"]').first().boundingBox();
  await small.unmount();
  const large = await mount(<SelectorHarness size="lg" layout="inline" initial={["Apple"]} />);
  const lb = await large.locator('[data-size="lg"]').first().boundingBox();
  if (!sb || !lb) throw new Error("missing bounding box");
  expect(lb.height).toBeGreaterThan(sb.height);
});

test("elevation raises the field; omitted stays flat", async ({ mount }) => {
  // Applies in every layout — check the default panel field and an inline group.
  const raised = await mount(<Selector items={["Apple", "Banana"]} elevation={2} />);
  const field = raised.locator('[data-elevation="2"]');
  await expect(field).toBeVisible();
  const shadow = await field.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
  await raised.unmount();

  const inline = await mount(
    <Selector items={["Apple", "Banana"]} layout="inline" elevation={3} />,
  );
  await expect(inline.locator('[data-elevation="3"]')).toBeVisible();
  await inline.unmount();

  // No elevation prop → no elevation attribute, so the field keeps its flat default.
  const flat = await mount(<Selector items={["Apple", "Banana"]} />);
  await expect(flat.locator("[data-elevation]")).toHaveCount(0);
});

test("inline overflow: stays one row with an ellipsis, even when focused", async ({ mount }) => {
  const items = ["Amsterdam", "Berlin", "Geneva", "London", "Madrid", "Oslo", "Paris", "Tokyo"];
  const c = await mount(
    <SelectorHarness
      layout="inline"
      items={items}
      initial={items.slice(0, 8)}
      style={{ maxWidth: "18rem" }}
    />,
  );
  const group = c.locator('[class*="inlineGroup"]');
  const ellipsis = c.locator('[class*="overflowEllipsis"]');
  await expect(ellipsis).toBeVisible(); // chips overflow one row → ellipsis shown
  const before = (await group.boundingBox())?.height ?? 0;

  await c.getByRole("combobox").focus(); // must NOT grow vertically
  await expect(ellipsis).toBeVisible(); // ellipsis stays — overflow is still clipped
  const after = (await group.boundingBox())?.height ?? 0;
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

/* --- Virtualized option list (issue #10) --- */

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
  const component = await mount(<SelectorHarness items={manyItems} />);
  await component.getByRole("combobox").click();
  const first = page.getByRole("option", { name: "Item 000" });
  await expect(first).toBeVisible();

  // ~6 visible rows + 8 overscan each side — far fewer than the 100 items.
  const rendered = await page.getByRole("option").count();
  expect(rendered).toBeGreaterThan(5);
  expect(rendered).toBeLessThan(50);

  // Screen readers must still hear the full list size: Base UI emits no
  // aria-setsize/posinset, so Selector sets them itself.
  await expect(first).toHaveAttribute("aria-setsize", "100");
  await expect(first).toHaveAttribute("aria-posinset", "1");
});

test("ArrowDown far past the window keeps the highlight visible; Enter selects it", async ({
  mount,
  page,
}) => {
  let last: string[] = [];
  const component = await mount(<SelectorHarness items={manyItems} onChange={(v) => (last = v)} />);
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
  expect(last).toEqual(["Item 029"]);
});

test("a pre-selected mid-list item is scrolled into view on open", async ({ mount, page }) => {
  const component = await mount(<SelectorHarness items={manyItems} initial={["Item 050"]} />);
  await component.getByRole("combobox").click();

  const selected = page.getByRole("option", { name: "Item 050" });
  await expect(selected).toBeVisible();
  await expect(selected).toHaveAttribute("aria-selected", "true");
  expect(await inScrollport(page, "Item 050")).toBe(true);
});

test("filtering to zero matches shows the empty message under virtualization", async ({
  mount,
  page,
}) => {
  const component = await mount(<SelectorHarness items={manyItems} emptyMessage="No results" />);
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
  const component = await mount(<SelectorHarness items={manyItems} initial={["Item 050"]} />);
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

test("compact layout clamps to a narrow container instead of underlapping it (issue #25)", async ({
  mount,
}) => {
  // fit-content + a selection ("1 class" badge + 20-char search input) ran
  // ~300px pre-fix; max-inline-size: 100% (and size=1 on the input) clamp it.
  const component = await mount(
    <div style={{ inlineSize: 224 }}>
      <SelectorHarness
        layout="compact"
        initial={["Apple"]}
        compactLabel={(n: number) => `${n} class`}
      />
    </div>,
  );
  const group = component.locator('[class*="compactGroup"]').first();
  const box = await group.boundingBox();
  if (!box) throw new Error("missing bounding box");
  expect(box.width).toBeLessThanOrEqual(225);
});

test("panel layout holds a width floor in a shrink-to-fit parent (not the input's min-content)", async ({
  mount,
}) => {
  // In an inline-flex parent, `inline-size: 100%` is inert (the parent sizes to
  // the child), and the size=1 search input leaves a ~90px min-content — the
  // control collapsed to that before the fix. The 12rem (192px) floor holds it.
  const component = await mount(
    <div style={{ display: "inline-flex" }}>
      <SelectorHarness layout="panel" />
    </div>,
  );
  const root = component.locator('[data-layout="panel"]');
  const box = await root.boundingBox();
  if (!box) throw new Error("missing bounding box");
  expect(box.width).toBeGreaterThanOrEqual(190);
});

test("--sf-selector-min-inline-size overrides the width floor", async ({ mount }) => {
  const component = await mount(
    <div style={{ display: "inline-flex", ["--sf-selector-min-inline-size" as string]: "0" }}>
      <SelectorHarness layout="panel" />
    </div>,
  );
  const root = component.locator('[data-layout="panel"]');
  const box = await root.boundingBox();
  if (!box) throw new Error("missing bounding box");
  // Floor disabled: the control falls back to its (tiny) content width.
  expect(box.width).toBeLessThan(190);
});

test("compact layout stays fit-content in a shrink-to-fit parent (floor does not apply)", async ({
  mount,
}) => {
  // The floor is scoped to panel/inline; compact must still tuck into a toolbar.
  const component = await mount(
    <div style={{ display: "inline-flex" }}>
      <SelectorHarness layout="compact" initial={["Apple"]} />
    </div>,
  );
  const root = component.locator('[data-layout="compact"]');
  const box = await root.boundingBox();
  if (!box) throw new Error("missing bounding box");
  expect(box.width).toBeLessThan(190);
});
