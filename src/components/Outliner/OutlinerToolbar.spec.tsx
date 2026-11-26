import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import { OutlinerDialogHarness, OutlinerHarness } from "./Outliner.harness";
import type { OutlinerValue } from "./types";

const TREE: OutlinerValue = [
  {
    id: "a",
    content: "Alpha",
    children: [
      { id: "a1", content: "Alpha one" },
      { id: "a2", content: "Alpha two" },
    ],
  },
  { id: "b", content: "Bravo" },
  { id: "c", content: "Charlie" },
];

const row = (root: Locator, id: string) => root.locator(`[data-bullet-id="${id}"]`);
const tree = (root: Locator) => root.getByTestId("tree");
// The bar is rendered outside the outline (a portal to the body).
const bar = (page: Page) => page.getByRole("toolbar", { name: "Outline commands" });
const key = (page: Page, name: string) => bar(page).getByRole("button", { name, exact: true });

/** Enter a block and put the caret at `offset` of its source. */
async function caretIn(root: Locator, id: string, offset: number) {
  await row(root, id).click();
  const editor = row(root, id).locator("textarea");
  await expect(editor).toBeFocused();
  await editor.evaluate((el: HTMLTextAreaElement, at) => el.setSelectionRange(at, at), offset);
  return editor;
}

/** The block that holds the caret, and where the caret is. */
async function caret(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLTextAreaElement)) return null;
    const id = el.closest("[data-bullet-id]")?.getAttribute("data-bullet-id") ?? "";
    return { id, at: el.selectionStart, text: el.value };
  });
}

test("shows while a block is edited, with its keys in order", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await expect(bar(page)).toHaveCount(0);
  await caretIn(component, "a2", 3);
  await expect(bar(page)).toBeVisible();
  await expect(bar(page).getByRole("button")).toHaveCount(8);
  expect(
    await bar(page)
      .getByRole("button")
      .evaluateAll((keys) => keys.map((k) => k.getAttribute("aria-label"))),
  ).toEqual(["Outdent", "Indent", "Move up", "Move down", "Toggle task", "Undo", "Redo", "Done"]);
  // Every key is a glyph with a name, and none is a tab stop.
  expect(
    await bar(page)
      .getByRole("button")
      .evaluateAll((keys) =>
        keys.every((k) => k.querySelector("svg") && k.textContent === "" && k.tabIndex === -1),
      ),
  ).toBe(true);
});

test("is off with a mouse by default, and off when told so", async ({ mount, page }) => {
  // The test browser's pointer is a mouse: "auto" shows nothing.
  const auto = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(auto, "a2", 0);
  await expect(bar(page)).toHaveCount(0);
  await auto.unmount();

  const off = await mount(<OutlinerHarness initial={TREE} toolbar={false} />);
  await caretIn(off, "a2", 0);
  await expect(bar(page)).toHaveCount(0);
});

test("never shows in read-only mode", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar readOnly />);
  await row(component, "a2").click();
  await expect(row(component, "a2")).toHaveAttribute("data-selected", "true");
  await expect(bar(page)).toHaveCount(0);
});

test("Indent and Outdent do what Tab and Shift+Tab do, and the caret stays", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "a2", 3);
  await key(page, "Indent").click();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n2 a2:Alpha two\n0 b:Bravo\n0 c:Charlie",
  );
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });

  await key(page, "Outdent").click();
  await key(page, "Outdent").click();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n0 a2:Alpha two\n0 b:Bravo\n0 c:Charlie",
  );
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });

  // The chord and the key are one command: Tab undoes what Outdent did.
  await page.keyboard.press("Tab");
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n1 a2:Alpha two\n0 b:Bravo\n0 c:Charlie",
  );
});

test("Move up and Move down move the block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "b", 2);
  await key(page, "Move down").click();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n1 a2:Alpha two\n0 c:Charlie\n0 b:Bravo",
  );
  expect(await caret(page)).toEqual({ id: "b", at: 2, text: "Bravo" });
  await key(page, "Move up").click();
  await key(page, "Move up").click();
  await expect(tree(component)).toHaveText(
    "0 b:Bravo\n0 a:Alpha\n1 a1:Alpha one\n1 a2:Alpha two\n0 c:Charlie",
  );
  expect(await caret(page)).toEqual({ id: "b", at: 2, text: "Bravo" });
});

test("Toggle task steps through no task, open, done", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "b", 2);
  await key(page, "Toggle task").click();
  expect(await caret(page)).toEqual({ id: "b", at: 6, text: "[ ] Bravo" });
  await key(page, "Toggle task").click();
  expect(await caret(page)).toEqual({ id: "b", at: 6, text: "[x] Bravo" });
  await key(page, "Toggle task").click();
  expect(await caret(page)).toEqual({ id: "b", at: 2, text: "Bravo" });
  await expect(tree(component)).toContainText("0 b:Bravo");
});

test("Undo and Redo step through text and structure", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "b", 5);
  // Nothing to take back yet.
  await expect(key(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  await expect(key(page, "Redo")).toHaveAttribute("aria-disabled", "true");

  await page.keyboard.type("!");
  await key(page, "Indent").click();
  await expect(tree(component)).toContainText("1 b:Bravo!");
  await expect(key(page, "Undo")).not.toHaveAttribute("aria-disabled", "true");

  await key(page, "Undo").click();
  await expect(tree(component)).toContainText("0 b:Bravo!");
  expect(await caret(page)).toEqual({ id: "b", at: 6, text: "Bravo!" });
  await expect(key(page, "Redo")).not.toHaveAttribute("aria-disabled", "true");

  await key(page, "Undo").click();
  await expect(tree(component)).toContainText("0 b:Bravo\n");
  expect(await caret(page)).toEqual({ id: "b", at: 5, text: "Bravo" });
  await expect(key(page, "Undo")).toHaveAttribute("aria-disabled", "true");

  await key(page, "Redo").click();
  await key(page, "Redo").click();
  await expect(tree(component)).toContainText("1 b:Bravo!");
  await expect(key(page, "Redo")).toHaveAttribute("aria-disabled", "true");
  await expect(row(component, "b").locator("textarea")).toBeFocused();
});

test("Done leaves the text as Escape does, and the bar goes", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "a2", 3);
  await key(page, "Done").click();
  await expect(component.locator("textarea")).toHaveCount(0);
  await expect(row(component, "a2")).toBeFocused();
  await expect(row(component, "a2")).toHaveAttribute("data-selected", "true");
  await expect(bar(page)).toHaveCount(0);
});

test("a key that cannot apply is disabled, and a press on it changes nothing", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  const disabled = () =>
    bar(page)
      .locator('[aria-disabled="true"]')
      .evaluateAll((keys) => keys.map((k) => k.getAttribute("aria-label")));
  // The first block: no previous sibling to go under, no level to leave.
  await caretIn(component, "a", 2);
  expect(await disabled()).toEqual(["Outdent", "Indent", "Move up", "Undo", "Redo"]);
  // `force`: the test runner does not press a key that says it is disabled.
  await key(page, "Outdent").click({ force: true });
  await key(page, "Move up").click({ force: true });
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n1 a2:Alpha two\n0 b:Bravo\n0 c:Charlie",
  );
  await expect(component.getByTestId("changes")).toHaveText("0");
  expect(await caret(page)).toEqual({ id: "a", at: 2, text: "Alpha" });

  // The last block cannot move down; a first child cannot be indented.
  await caretIn(component, "c", 0);
  expect(await disabled()).toEqual(["Outdent", "Move down", "Undo", "Redo"]);
  await caretIn(component, "a1", 0);
  expect(await disabled()).toEqual(["Indent", "Move up", "Undo", "Redo"]);
});

test("while zoomed, a child of the title does not outdent", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar initialRoot="a" />);
  await caretIn(component, "a2", 0);
  await expect(key(page, "Outdent")).toHaveAttribute("aria-disabled", "true");
  await expect(key(page, "Indent")).not.toHaveAttribute("aria-disabled", "true");
  await expect(key(page, "Move down")).toHaveAttribute("aria-disabled", "true");
});

test("the bar follows the caret from block to block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "a", 5);
  await expect(key(page, "Indent")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("ArrowDown");
  await expect(row(component, "a1").locator("textarea")).toBeFocused();
  await expect(bar(page)).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expect(row(component, "a2").locator("textarea")).toBeFocused();
  await expect(key(page, "Indent")).not.toHaveAttribute("aria-disabled", "true");
  // Leaving the outline takes the bar away.
  await component.getByTestId("after").click();
  await expect(bar(page)).toHaveCount(0);
});

test("the bar docks to the bottom edge of the window and reserves its room", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} toolbar />);
  await caretIn(component, "b", 0);
  const box = await bar(page).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      position: getComputedStyle(el).position,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: innerWidth,
      height: innerHeight,
      docked: el.hasAttribute("data-docked"),
    };
  });
  expect(box.position).toBe("fixed");
  expect(box.left).toBe(0);
  expect(box.right).toBe(box.width);
  expect(box.bottom).toBe(box.height);
  expect(box.docked).toBe(true);
});

test("an embedded block and the outline around it show one bar", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerHarness
      toolbar
      initial={[
        { id: "src", content: "Source", children: [{ id: "kid", content: "Child" }] },
        { id: "e", content: "{{embed ((src))}}" },
        { id: "z", content: "Zulu" },
      ]}
    />,
  );
  await caretIn(component, "z", 0);
  await expect(bar(page)).toHaveCount(1);
  const embed = row(component, "e").getByRole("tree", { name: "Embedded block" });
  await embed.locator('[data-bullet-id="kid"]').getByText("Child").click();
  await expect(embed.locator("textarea")).toBeFocused();
  await expect(bar(page)).toHaveCount(1);
  // The bar is the embedded outline's: its keys act on the block in it.
  await page.keyboard.type("!");
  await key(page, "Toggle task").click();
  await expect(tree(component)).toContainText("1 kid:[ ] ");
  await expect(embed.locator("textarea")).toBeFocused();
});

test("in a dialog: the bar is above it, and a press on a key is not a press outside", async ({
  mount,
  page,
}) => {
  await mount(<OutlinerDialogHarness initial={TREE} />);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-bullet-id="b"]').click();
  await expect(dialog.locator("textarea")).toBeFocused();
  await expect(bar(page)).toBeVisible();
  // The key is what the pointer meets at its centre: nothing of the dialog
  // (its backdrop included) lies over the bar.
  expect(
    await key(page, "Indent").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return el === hit || el.contains(hit);
    }),
  ).toBe(true);
  await key(page, "Indent").click();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("tree")).toContainText("1 b:Bravo");
  await expect(dialog.locator("textarea")).toBeFocused();
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });

  test("shows by default, and a tap on a key keeps the caret in the text", async ({
    mount,
    page,
  }) => {
    const component = await mount(<OutlinerHarness initial={TREE} />);
    await expect(bar(page)).toHaveCount(0);
    await row(component, "a2").tap();
    const editor = row(component, "a2").locator("textarea");
    await expect(editor).toBeFocused();
    await expect(bar(page)).toBeVisible();

    await key(page, "Indent").tap();
    await expect(tree(component)).toContainText("2 a2:Alpha two");
    await expect(editor).toBeFocused();
    await key(page, "Outdent").tap();
    await expect(tree(component)).toContainText("1 a2:Alpha two");
    await expect(editor).toBeFocused();
    await key(page, "Move up").tap();
    await expect(tree(component)).toHaveText(
      "0 a:Alpha\n1 a2:Alpha two\n1 a1:Alpha one\n0 b:Bravo\n0 c:Charlie",
    );
    await expect(editor).toBeFocused();
    await key(page, "Toggle task").tap();
    await expect(tree(component)).toContainText("1 a2:[ ] Alpha two");
    await expect(editor).toBeFocused();
    await key(page, "Undo").tap();
    await expect(tree(component)).toContainText("1 a2:Alpha two");
    await expect(editor).toBeFocused();
    // A tap on a disabled key keeps the caret too.
    await expect(key(page, "Move up")).toHaveAttribute("aria-disabled", "true");
    await key(page, "Move up").tap({ force: true });
    await expect(editor).toBeFocused();

    await key(page, "Done").tap();
    await expect(component.locator("textarea")).toHaveCount(0);
    await expect(bar(page)).toHaveCount(0);
  });

  test("every key is a touch target, and the bar is inside the window", async ({ mount, page }) => {
    const component = await mount(<OutlinerHarness initial={TREE} />);
    await row(component, "b").tap();
    await expect(bar(page)).toBeVisible();
    const boxes = await bar(page).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        bar: { left: rect.left, right: rect.right, bottom: rect.bottom },
        window: { width: innerWidth, height: innerHeight },
        keys: Array.from(el.querySelectorAll("button"), (k) => {
          const box = k.getBoundingClientRect();
          return { width: box.width, height: box.height, right: box.right };
        }),
      };
    });
    expect(boxes.bar).toEqual({ left: 0, right: boxes.window.width, bottom: boxes.window.height });
    for (const box of boxes.keys) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      // At this width nothing is scrolled out of the bar.
      expect(box.right).toBeLessThanOrEqual(boxes.window.width);
    }
  });

  test("sits above the on-screen keyboard, and keeps the block in sight", async ({
    mount,
    page,
  }) => {
    const component = await mount(
      <OutlinerHarness
        initial={Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, content: `Row ${i}` }))}
      />,
    );
    // The test browser has no on-screen keyboard: its visual viewport is
    // made to report one, 300px tall.
    const keyboard = 300;
    await page.evaluate((covered) => {
      const viewport = window.visualViewport;
      if (!viewport) throw new Error("no visualViewport");
      const height = viewport.height;
      Object.defineProperty(viewport, "height", {
        configurable: true,
        get: () => height - covered,
      });
    }, keyboard);
    await row(component, "r39").scrollIntoViewIfNeeded();
    await row(component, "r39").tap();
    await expect(row(component, "r39").locator("textarea")).toBeFocused();
    await expect(bar(page)).toBeVisible();
    const measure = () =>
      page.evaluate(() => {
        const el = document.querySelector("[data-outliner-toolbar]") as HTMLElement;
        const rect = el.getBoundingClientRect();
        const editing = document.activeElement?.closest("[data-bullet-id]");
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: innerHeight,
          docked: el.hasAttribute("data-docked"),
          row: editing?.getBoundingClientRect().bottom ?? Number.NaN,
        };
      });
    const up = await measure();
    expect(up.bottom).toBe(up.height - keyboard);
    expect(up.docked).toBe(false);
    // The last block of the page is above the bar, not behind it.
    expect(up.row).toBeLessThanOrEqual(up.top + 0.5);

    // The page pans under the keyboard: the bar follows the visible part.
    await page.evaluate(() => {
      const viewport = window.visualViewport;
      if (!viewport) throw new Error("no visualViewport");
      Object.defineProperty(viewport, "offsetTop", { configurable: true, get: () => 100 });
      viewport.dispatchEvent(new Event("scroll"));
    });
    await expect.poll(async () => (await measure()).bottom).toBe(up.height - keyboard + 100);
    const panned = await measure();
    expect(panned.row).toBeLessThanOrEqual(panned.top + 0.5);
  });
});
