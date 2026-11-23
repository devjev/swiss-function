import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import { OutlinerHarness } from "./Outliner.harness";
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
];

const row = (root: Locator, id: string) => root.locator(`[data-bullet-id="${id}"]`);
const tree = (root: Locator) => root.getByTestId("tree");

/** Enter a block and put the caret at `offset` of its source. */
async function caretIn(root: Locator, id: string, offset: number) {
  await row(root, id).click();
  const editor = row(root, id).locator("textarea");
  await expect(editor).toBeFocused();
  await editor.evaluate((el: HTMLTextAreaElement, at) => el.setSelectionRange(at, at), offset);
  return editor;
}

/** The id of the block that holds the caret, and where the caret is. */
async function caret(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLTextAreaElement)) return null;
    const id = el.closest("[data-bullet-id]")?.getAttribute("data-bullet-id") ?? "";
    return { id: /^n\d+$/.test(id) ? "new" : id, at: el.selectionStart, text: el.value };
  });
}

test("renders bullets with markdown content", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await expect(row(component, "a").getByText("Alpha", { exact: true })).toBeVisible();
  await expect(row(component, "a1").getByText("Alpha one")).toBeVisible();
  await expect(row(component, "b").getByText("Bravo")).toBeVisible();
});

test("a click enters the block at the clicked character", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  // The left edge of the "t" in "Alpha two".
  const point = await row(component, "a2").evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf("two") ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + 1, y: rect.top + rect.height / 2 };
    }
    return null;
  });
  expect(point).not.toBeNull();
  await page.mouse.click(point?.x ?? 0, point?.y ?? 0);
  expect(await caret(page)).toEqual({ id: "a2", at: 6, text: "Alpha two" });
});

test("a click past the text puts the caret at the end", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} width={480} />);
  const box = await row(component, "b").boundingBox();
  await page.mouse.click((box?.x ?? 0) + 300, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  expect(await caret(page)).toEqual({ id: "b", at: 5, text: "Bravo" });
});

test("typing is live: every keystroke reaches onChange", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await page.keyboard.type("!!");
  await expect(tree(component)).toContainText("0 b:Bravo!!");
  await expect(component.getByTestId("changes")).toHaveText("2");
});

test("Enter splits the block at the caret", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 3);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/0 b:Bra\n0 new:vo$/);
  expect(await caret(page)).toEqual({ id: "new", at: 0, text: "vo" });
});

test("Enter at the start inserts a block above and keeps the caret", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 0);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/0 new:\n0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "b", at: 0, text: "Bravo" });
});

test("Enter in a block with open children makes the first child", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a", 5);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/^0 a:Alpha\n1 new:\n1 a1:Alpha one/);
});

test("Enter on an empty nested last block outdents it", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a2", 9);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/1 a2:Alpha two\n1 new:\n0 b:Bravo$/);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/1 a2:Alpha two\n0 new:\n0 b:Bravo$/);
  expect((await caret(page))?.id).toBe("new");
});

test("Shift+Enter breaks the line inside the block, and the editor grows", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  const editor = await caretIn(component, "b", 5);
  const oneLine = (await editor.boundingBox())?.height ?? 0;
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second");
  await expect(tree(component)).toContainText("0 b:Bravo\nsecond");
  expect((await editor.boundingBox())?.height).toBeCloseTo(oneLine * 2, 0);
});

test("a long line soft-wraps and the editor grows with it", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} width={240} />);
  const editor = await caretIn(component, "b", 5);
  const oneLine = (await editor.boundingBox())?.height ?? 0;
  await page.keyboard.type(" and a good deal more text than one narrow line can hold");
  const grown = await editor.evaluate((el: HTMLTextAreaElement) => ({
    height: el.getBoundingClientRect().height,
    scroll: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(grown.height).toBeGreaterThanOrEqual(oneLine * 2);
  expect(grown.scroll).toBeLessThanOrEqual(grown.client);
});

test("Backspace at the start merges into the previous block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 0);
  await page.keyboard.press("Backspace");
  await expect(tree(component)).toHaveText(/1 a2:Alpha twoBravo$/);
  expect(await caret(page)).toEqual({ id: "a2", at: 9, text: "Alpha twoBravo" });
});

test("Delete at the end merges the next block in", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a1", 9);
  await page.keyboard.press("Delete");
  await expect(tree(component)).toHaveText(/1 a1:Alpha oneAlpha two\n0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "a1", at: 9, text: "Alpha oneAlpha two" });
});

test("Arrow Down and Up cross blocks and keep the caret's column", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a1", 7);
  await page.keyboard.press("ArrowDown");
  expect(await caret(page)).toEqual({ id: "a2", at: 7, text: "Alpha two" });
  // "Bravo" is shorter and sits one level out: the caret clamps to its end,
  // and comes back to the same column on the way up.
  await page.keyboard.press("ArrowDown");
  expect((await caret(page))?.id).toBe("b");
  await page.keyboard.press("ArrowUp");
  expect(await caret(page)).toEqual({ id: "a2", at: 7, text: "Alpha two" });
  await page.keyboard.press("ArrowUp");
  expect(await caret(page)).toEqual({ id: "a1", at: 7, text: "Alpha one" });
});

test("Arrow Up stays inside a block until its first line", async ({ mount, page }) => {
  const initial: OutlinerValue = [
    { id: "x", content: "first" },
    { id: "y", content: "line one\nline two" },
  ];
  const component = await mount(<OutlinerHarness initial={initial} />);
  await caretIn(component, "y", 17);
  await page.keyboard.press("ArrowUp");
  expect((await caret(page))?.id).toBe("y");
  await page.keyboard.press("ArrowUp");
  expect((await caret(page))?.id).toBe("x");
});

test("Arrow Left at the start and Right at the end cross blocks", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a2", 0);
  await page.keyboard.press("ArrowLeft");
  expect(await caret(page)).toEqual({ id: "a1", at: 9, text: "Alpha one" });
  await page.keyboard.press("ArrowRight");
  expect(await caret(page)).toEqual({ id: "a2", at: 0, text: "Alpha two" });
});

test("Tab and Shift+Tab indent and outdent, the caret stays", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a2", 3);
  await page.keyboard.press("Tab");
  await expect(tree(component)).toHaveText(/1 a1:Alpha one\n2 a2:Alpha two\n0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(tree(component)).toHaveText(/1 a1:Alpha one\n0 a2:Alpha two\n0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });
});

test("outdent takes the following siblings along", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a1", 0);
  await page.keyboard.press("Shift+Tab");
  await expect(tree(component)).toHaveText("0 a:Alpha\n0 a1:Alpha one\n1 a2:Alpha two\n0 b:Bravo");
});

test("Alt+Shift+Arrow moves the block and keeps the caret", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a1", 2);
  await page.keyboard.press("Alt+Shift+ArrowDown");
  await expect(tree(component)).toHaveText(/^0 a:Alpha\n1 a2:Alpha two\n1 a1:Alpha one/);
  expect(await caret(page)).toEqual({ id: "a1", at: 2, text: "Alpha one" });
  // Past the last sibling it enters the parent's next sibling.
  await page.keyboard.press("Alt+Shift+ArrowDown");
  await expect(tree(component)).toHaveText("0 a:Alpha\n1 a2:Alpha two\n0 b:Bravo\n1 a1:Alpha one");
  expect(await caret(page)).toEqual({ id: "a1", at: 2, text: "Alpha one" });
});

test("Mod+Arrow Up and Down fold and unfold while editing", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a", 2);
  await page.keyboard.press("Control+ArrowUp");
  await expect(row(component, "a1")).toHaveCount(0);
  expect(await caret(page)).toEqual({ id: "a", at: 2, text: "Alpha" });
  await page.keyboard.press("Control+ArrowDown");
  await expect(row(component, "a1")).toBeVisible();
});

test("Escape keeps the text and leaves the block selected", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "a1", 9);
  await page.keyboard.type(" extra");
  await page.keyboard.press("Escape");
  await expect(component.locator("textarea")).toHaveCount(0);
  await expect(row(component, "a1")).toHaveAttribute("data-active", "true");
  await expect(row(component, "a1")).toBeFocused();
  await expect(tree(component)).toContainText("1 a1:Alpha one extra");

  // The arrows walk the tree; Enter goes back into the text, at its end.
  await page.keyboard.press("ArrowDown");
  await expect(row(component, "a2")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(row(component, "a")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Enter");
  expect(await caret(page)).toEqual({ id: "a", at: 5, text: "Alpha" });
});

test("the keyboard gets in and out: Tab passes through, Escape releases", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await component.getByTestId("before").focus();
  await page.keyboard.press("Tab");
  await expect(row(component, "a")).toBeFocused();
  // Only focused, not selected: Tab moves on.
  await page.keyboard.press("Tab");
  await expect(component.getByTestId("after")).toBeFocused();

  // Selected, Tab indents; after Escape it moves on again.
  await page.keyboard.press("Shift+Tab");
  await expect(row(component, "a")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(row(component, "a2")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Tab");
  await expect(tree(component)).toContainText("2 a2:Alpha two");
  await page.keyboard.press("Escape");
  await expect(row(component, "a2")).not.toHaveAttribute("data-active", "true");
  await page.keyboard.press("Tab");
  await expect(component.getByTestId("after")).toBeFocused();
});

test("focus leaving the outline drops the caret and the selection", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 2);
  await component.getByTestId("after").click();
  await expect(component.locator("textarea")).toHaveCount(0);
  await expect(component.locator("[data-active]")).toHaveCount(0);
});

test("an empty outline starts with a click", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={[]} />);
  await component.getByText("Empty outline").click();
  await expect(component.locator("textarea")).toBeFocused();
  await page.keyboard.type("First");
  await expect(tree(component)).toHaveText("0 new:First");
});

test("readOnly: a click selects and opens no editor", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} readOnly />);
  await row(component, "b").click();
  await expect(component.locator("textarea")).toHaveCount(0);
  await expect(row(component, "b")).toHaveAttribute("data-active", "true");
});

test("readOnly: the arrows walk and fold the tree", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} readOnly />);
  await row(component, "a").click();
  await page.keyboard.press("ArrowDown");
  await expect(row(component, "a1")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(row(component, "a")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(row(component, "a1")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(row(component, "a1")).toBeVisible();
});

test("the tree is exposed as a tree", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await expect(component.getByRole("tree")).toBeVisible();
  await expect(row(component, "a")).toHaveAttribute("aria-expanded", "true");
  await expect(row(component, "a1")).toHaveAttribute("aria-level", "2");
});

test("[[wiki links]] render as clickable buttons and do not enter the block", async ({ mount }) => {
  const initial: OutlinerValue = [{ id: "1", content: "see [[Page A]] and [[Page B]]" }];
  const component = await mount(<OutlinerHarness initial={initial} />);
  await expect(component.getByRole("button", { name: "Page B" })).toBeVisible();
  await component.getByRole("button", { name: "Page A" }).click();
  await expect(component.locator("textarea")).toHaveCount(0);
});

test("((id)) transcludes resolved content; missing id shows placeholder", async ({ mount }) => {
  const initial: OutlinerValue = [
    { id: "1", content: "Has ref: ((src))" },
    { id: "2", content: "Missing: ((nope))" },
  ];
  const component = await mount(
    <OutlinerHarness initial={initial} blockRefs={{ src: "**bold source**" }} />,
  );
  await expect(component.getByText("bold source")).toBeVisible();
  await expect(component.getByText(/ref not found.*nope/)).toBeVisible();
});

// --- History, block selection, clipboard (milestone 2) ---------------------

const WIDE: OutlinerValue = [
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

const selected = (root: Locator) =>
  root
    .locator("[data-selected]")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-bullet-id")));

/** Fire a clipboard event at the focused element, as the browser would, and
 *  report what a copy put on the clipboard. */
async function clipboard(page: Page, type: "copy" | "cut" | "paste", text = "") {
  return page.evaluate(
    ([kind, data]) => {
      const transfer = new DataTransfer();
      if (data) transfer.setData("text/plain", data);
      const event = new ClipboardEvent(kind, {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement?.dispatchEvent(event);
      return { text: transfer.getData("text/plain"), handled: event.defaultPrevented };
    },
    [type, text] as const,
  );
}

test("undo takes back a run of typing, redo brings it back", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" and more");
  await expect(tree(component)).toContainText("0 b:Bravo and more");
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText(/0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "b", at: 5, text: "Bravo" });
  await page.keyboard.press("Control+Shift+z");
  await expect(tree(component)).toContainText("0 b:Bravo and more");
  expect(await caret(page)).toEqual({ id: "b", at: 14, text: "Bravo and more" });
});

test("undo crosses structure: a split, then the typing before it", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await page.keyboard.type("!");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/0 b:Bra\n0 new:vo!$/);

  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText(/0 b:Bravo!$/);
  expect(await caret(page)).toEqual({ id: "b", at: 3, text: "Bravo!" });
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText(/0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "b", at: 5, text: "Bravo" });

  await page.keyboard.press("Control+y");
  await page.keyboard.press("Control+y");
  await expect(tree(component)).toHaveText(/0 b:Bra\n0 new:vo!$/);
  expect(await caret(page)).toEqual({ id: "new", at: 0, text: "vo!" });
});

test("undo restores a merge and a deleted selection", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 0);
  await page.keyboard.press("Backspace");
  await expect(tree(component)).toHaveText(/1 a2:Alpha twoBravo$/);
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText(/1 a2:Alpha two\n0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "b", at: 0, text: "Bravo" });

  // A selected block goes with its children, and comes back with them.
  await caretIn(component, "a", 0);
  await page.keyboard.press("Escape");
  expect(await selected(component)).toEqual(["a", "a1", "a2"]);
  await page.keyboard.press("Delete");
  await expect(tree(component)).toHaveText("0 b:Bravo");
  await expect(row(component, "b")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText("0 a:Alpha\n1 a1:Alpha one\n1 a2:Alpha two\n0 b:Bravo");
  expect(await selected(component)).toEqual(["a", "a1", "a2"]);
});

test("Shift+Arrow from a block's edge line selects it, then extends", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await caretIn(component, "b", 2);
  await page.keyboard.press("Shift+ArrowDown");
  await expect(component.locator("textarea")).toHaveCount(0);
  expect(await selected(component)).toEqual(["b"]);
  await page.keyboard.press("Shift+ArrowDown");
  expect(await selected(component)).toEqual(["b", "c"]);
  await page.keyboard.press("Shift+ArrowUp");
  expect(await selected(component)).toEqual(["b"]);
  await page.keyboard.press("Shift+ArrowUp");
  expect(await selected(component)).toEqual(["a2", "b"]);
  // A plain arrow goes back to one block.
  await page.keyboard.press("ArrowUp");
  expect(await selected(component)).toEqual(["a1"]);
});

test("Tab, the move chord and Delete act on every selected block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await caretIn(component, "b", 0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  expect(await selected(component)).toEqual(["b", "c"]);

  await page.keyboard.press("Tab");
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n1 a2:Alpha two\n1 b:Bravo\n1 c:Charlie",
  );
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n1 b:Bravo\n1 c:Charlie\n1 a2:Alpha two",
  );
  expect(await selected(component)).toEqual(["b", "c"]);
  await page.keyboard.press("Shift+Tab");
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n0 b:Bravo\n0 c:Charlie\n1 a2:Alpha two",
  );
  await page.keyboard.press("Backspace");
  await expect(tree(component)).toHaveText("0 a:Alpha\n1 a1:Alpha one");
  await expect(row(component, "a1")).toHaveAttribute("data-active", "true");
  // One step back for the whole deletion.
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toContainText("0 b:Bravo\n0 c:Charlie\n1 a2:Alpha two");
});

test("Mod+A selects the text, then every block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await caretIn(component, "b", 2);
  await page.keyboard.press("Control+a");
  await expect(row(component, "b").locator("textarea")).toBeFocused();
  await page.keyboard.press("Control+a");
  expect(await selected(component)).toEqual(["a", "a1", "a2", "b", "c"]);
});

test("a drag from one block into another selects the blocks between", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  const from = await row(component, "a1").boundingBox();
  const to = await row(component, "b").boundingBox();
  await page.mouse.move((from?.x ?? 0) + 80, (from?.y ?? 0) + 10);
  await page.mouse.down();
  await page.mouse.move((to?.x ?? 0) + 80, (to?.y ?? 0) + 10, { steps: 4 });
  expect(await selected(component)).toEqual(["a1", "a2", "b"]);
  await page.mouse.up();
  // The release is not a click into the block.
  await expect(component.locator("textarea")).toHaveCount(0);
  expect(await selected(component)).toEqual(["a1", "a2", "b"]);
  // The next click is.
  await row(component, "c").click();
  await expect(row(component, "c").locator("textarea")).toBeFocused();
});

test("Shift+click selects from the block in use to the clicked one", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await caretIn(component, "a2", 0);
  await row(component, "c").click({ modifiers: ["Shift"] });
  await expect(component.locator("textarea")).toHaveCount(0);
  expect(await selected(component)).toEqual(["a2", "b", "c"]);
});

test("copy and cut put the selected blocks on the clipboard as a markdown list", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await caretIn(component, "a", 0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  expect(await clipboard(page, "copy")).toEqual({
    text: "- Alpha\n  - Alpha one\n  - Alpha two\n- Bravo",
    handled: true,
  });
  await expect(tree(component)).toContainText("0 a:Alpha");
  expect((await clipboard(page, "cut")).text).toBe(
    "- Alpha\n  - Alpha one\n  - Alpha two\n- Bravo",
  );
  await expect(tree(component)).toHaveText("0 c:Charlie");
});

test("pasting a list makes nested blocks; pasting a line stays text", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  // Into the text of a block: the list goes in after it.
  await caretIn(component, "b", 5);
  expect((await clipboard(page, "paste", "- one\n  - inner\n- two")).handled).toBe(true);
  await expect(tree(component)).toHaveText(
    /0 b:Bravo\n0 new:one\n1 new:inner\n0 new:two\n0 c:Charlie$/,
  );
  expect(await caret(page)).toEqual({ id: "new", at: 3, text: "two" });

  // An empty block becomes the first pasted one.
  await page.keyboard.press("Enter");
  expect((await clipboard(page, "paste", "first\n\nsecond")).handled).toBe(true);
  await expect(tree(component)).toHaveText(/0 new:two\n0 new:first\n0 new:second\n0 c:Charlie$/);

  // One line is left to the textarea.
  expect((await clipboard(page, "paste", "plain words")).handled).toBe(false);

  // One undo per paste.
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText(/0 new:two\n0 new:\n0 c:Charlie$/);
});

test("pasting onto a selected block inserts after it and selects the result", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await caretIn(component, "b", 0);
  await page.keyboard.press("Escape");
  await clipboard(page, "paste", "- x\n- y");
  await expect(tree(component)).toHaveText(/0 b:Bravo\n0 new:x\n0 new:y\n0 c:Charlie$/);
  expect((await selected(component)).length).toBe(2);
});

test("a drag inside one block selects its text and enters nothing", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  const box = await row(component, "a1").locator("p").boundingBox();
  await page.mouse.move((box?.x ?? 0) + 1, (box?.y ?? 0) + 10);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 10, { steps: 4 });
  await page.mouse.up();
  await expect(component.locator("textarea")).toHaveCount(0);
  expect(await selected(component)).toEqual([]);
  expect(await page.evaluate(() => getSelection()?.toString().length ?? 0)).toBeGreaterThan(0);
});

// --- Typing assistance (milestone 3) ----------------------------------------

/** The focused block's text with the caret as `|` (or a selection as `<>`). */
async function marked(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLTextAreaElement)) return null;
    const { value, selectionStart: s, selectionEnd: e } = el;
    return s === e
      ? `${value.slice(0, s)}|${value.slice(s)}`
      : `${value.slice(0, s)}<${value.slice(s, e)}>${value.slice(e)}`;
  });
}

const options = (page: Page) => page.getByRole("option");

test("an opening bracket gets its closer; Backspace takes both", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" [[");
  expect(await marked(page)).toBe("Bravo [[|]]");
  await page.keyboard.type("Page]]");
  expect(await marked(page)).toBe("Bravo [[Page]]|");
  await expect(tree(component)).toContainText("0 b:Bravo [[Page]]");
  await page.keyboard.type(" `");
  expect(await marked(page)).toBe("Bravo [[Page]] `|`");
  await page.keyboard.press("Backspace");
  expect(await marked(page)).toBe("Bravo [[Page]] |");
});

test("a bracket or an asterisk typed over a selection wraps it", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  const editor = await caretIn(component, "b", 0);
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 5));
  await page.keyboard.type("**");
  expect(await marked(page)).toBe("**<Bravo>**");
  await expect(tree(component)).toContainText("0 b:**Bravo**");
});

test("Mod+B, Mod+I and Mod+K format the selection", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  const editor = await caretIn(component, "a2", 0);
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 9));
  await page.keyboard.press("Control+b");
  expect(await marked(page)).toBe("Alpha **<two>**");
  await page.keyboard.press("Control+b");
  expect(await marked(page)).toBe("Alpha <two>");
  await page.keyboard.press("Control+i");
  expect(await marked(page)).toBe("Alpha *<two>*");
  await page.keyboard.press("Control+z");
  expect(await marked(page)).toBe("Alpha <two>");
  await page.keyboard.press("Control+k");
  expect(await marked(page)).toBe("Alpha [two](|)");
});

test("Mod+Shift+H highlights the selection and steps through the colours (#107)", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  const editor = await caretIn(component, "a2", 0);
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 9));
  await page.keyboard.press("Control+Shift+h");
  expect(await marked(page)).toBe("Alpha ==<two>==");
  for (const color of ["green", "blue", "pink", "orange", "purple"]) {
    await page.keyboard.press("Control+Shift+h");
    expect(await marked(page)).toBe(`Alpha =={${color}}<two>==`);
  }
  // After the last colour the highlight comes off.
  await page.keyboard.press("Control+Shift+h");
  expect(await marked(page)).toBe("Alpha <two>");
  await page.keyboard.press("Control+z");
  expect(await marked(page)).toBe("Alpha =={purple}<two>==");
});

test("a highlight renders as a mark in its colour, with its links in ink (#107)", async ({
  mount,
}) => {
  const component = await mount(
    <OutlinerHarness
      initial={[{ id: "h", content: "==plain== and =={green}see [[Page]]==" }, ...TREE]}
    />,
  );
  const marks = row(component, "h").locator("mark[data-highlight]");
  await expect(marks).toHaveCount(2);
  await expect(marks.nth(0)).toHaveAttribute("data-highlight", "yellow");
  await expect(marks.nth(0)).toHaveText("plain");
  await expect(marks.nth(1)).toHaveAttribute("data-highlight", "green");
  await expect(marks.nth(1)).toHaveText("see Page");
  const paint = await marks.nth(1).evaluate((el) => {
    const link = el.querySelector("button, a") as HTMLElement;
    const probe = document.createElement("span");
    probe.style.color = "var(--sf-color-fg)";
    probe.style.backgroundColor = "var(--sf-color-highlight-green)";
    el.append(probe);
    const want = getComputedStyle(probe);
    const out = {
      background: getComputedStyle(el).backgroundColor,
      token: want.backgroundColor,
      link: getComputedStyle(link).color,
      ink: want.color,
    };
    probe.remove();
    return out;
  });
  expect(paint.background).toBe(paint.token);
  expect(paint.link).toBe(paint.ink);
});

test("/green puts a green highlight's pair where the slash stood (#107)", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" /green");
  await expect(options(page)).toHaveText(["Highlight green=={green}…=="]);
  await page.keyboard.press("Enter");
  expect(await marked(page)).toBe("Bravo =={green}|==");
  await page.keyboard.type("go");
  await expect(tree(component)).toContainText("0 b:Bravo =={green}go==");
});

test("Mod+Enter makes a task and ticks it; the checkbox does the same", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 2);
  await page.keyboard.press("Control+Enter");
  expect(await marked(page)).toBe("[ ] Br|avo");
  await page.keyboard.press("Escape");
  const box = row(component, "b").getByRole("checkbox");
  await expect(box).not.toBeChecked();
  await expect(row(component, "b").getByText("Bravo", { exact: true })).toBeVisible();

  // Ticking does not enter the block.
  await box.click();
  await expect(box).toBeChecked();
  await expect(component.locator("textarea")).toHaveCount(0);
  await expect(tree(component)).toContainText("0 b:[x] Bravo");

  // On a selected block the chord cycles on: done, then no task.
  await row(component, "b").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Control+Enter");
  await expect(tree(component)).toHaveText(/0 b:Bravo$/);
});

test("a click into a task lands on the clicked character, past the marker", async ({
  mount,
  page,
}) => {
  const initial: OutlinerValue = [{ id: "t", content: "[ ] Buy milk" }];
  const component = await mount(<OutlinerHarness initial={initial} />);
  const point = await row(component, "t").evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.indexOf("milk") ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + 1, y: rect.top + rect.height / 2 };
    }
    return null;
  });
  await page.mouse.click(point?.x ?? 0, point?.y ?? 0);
  expect(await marked(page)).toBe("[ ] Buy |milk");
});

test("#tags render as links", async ({ mount }) => {
  const initial: OutlinerValue = [{ id: "1", content: "plan #project and #[[Two Words]]" }];
  const component = await mount(<OutlinerHarness initial={initial} />);
  await expect(component.getByRole("button", { name: "#project" })).toBeVisible();
  await expect(component.getByRole("button", { name: "#Two Words" })).toBeVisible();
});

test("[[ opens the page list; the arrows choose and Enter completes", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} withCompletions />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" [[");
  await expect(options(page)).toHaveText(["Project Alpha", "Project Beta", "Daily notes"]);
  await page.keyboard.type("pro");
  await expect(options(page)).toHaveText(["Project Alpha", "Project Beta"]);
  await expect(options(page).nth(0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options(page).nth(1)).toHaveAttribute("aria-selected", "true");
  // The caret stayed in the text, and the list is tied to it.
  const editor = row(component, "b").locator("textarea");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveAttribute("aria-activedescendant", /-1$/);

  await page.keyboard.press("Enter");
  await expect(options(page)).toHaveCount(0);
  expect(await marked(page)).toBe("Bravo [[Project Beta]]|");
  // Enter completed; it did not split the block.
  await expect(tree(component)).toHaveText(/0 b:Bravo \[\[Project Beta\]\]$/);
  // One undo takes the completion back to what was typed.
  await page.keyboard.press("Control+z");
  expect(await marked(page)).toBe("Bravo [[pro|]]");
});

test("the list sits under the trigger and a click on an entry completes", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TREE} withCompletions />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" #dai");
  await expect(options(page)).toHaveText(["Daily notes"]);
  const list = await page.getByRole("listbox").boundingBox();
  const editor = await row(component, "b").locator("textarea").boundingBox();
  expect(list?.y).toBeGreaterThanOrEqual((editor?.y ?? 0) + (editor?.height ?? 0));
  expect(list?.x).toBeGreaterThan(editor?.x ?? 0);
  await options(page).first().click();
  expect(await marked(page)).toBe("Bravo #[[Daily notes]] |");
  await expect(row(component, "b").locator("textarea")).toBeFocused();
});

test("Escape closes the list and leaves the caret in the text", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} withCompletions />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" /t");
  // The app's entries, then the outline's own block commands.
  await expect(options(page)).toHaveText(["todayToday's date", "timeThe time", "Task[ ] "]);
  await page.keyboard.press("Escape");
  await expect(options(page)).toHaveCount(0);
  await expect(row(component, "b").locator("textarea")).toBeFocused();
  // It stays closed while the same word is typed on.
  await page.keyboard.type("o");
  await expect(options(page)).toHaveCount(0);
  expect(await marked(page)).toBe("Bravo /to|");
});

test("a command replaces its slash; a block reference inserts the id", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} withCompletions />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" /tod");
  await page.keyboard.press("Tab");
  expect(await marked(page)).toBe("Bravo 2026-11-19|");
  await page.keyboard.type(" ((ref");
  await expect(options(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  expect(await marked(page)).toBe("Bravo 2026-11-19 ((src))|");
});

test("without a completions source nothing pops up", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await page.keyboard.type(" [[pro");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(/0 b:Bravo \[\[pro\n0 new:\]\]$/);
});

// --- Zoom ---

const bullet = (root: Locator, id: string) => row(root, id).locator("[data-bullet-handle]");
const zoom = (root: Locator) => root.getByTestId("root");
const shown = (root: Locator) =>
  root
    .locator("[data-bullet-id]")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-bullet-id")));

const DEEP: OutlinerValue = [
  {
    id: "a",
    content: "Alpha",
    children: [
      { id: "a1", content: "Alpha **one**", children: [{ id: "a1x", content: "Deep" }] },
      { id: "a2", content: "Alpha two" },
    ],
  },
  { id: "b", content: "Bravo" },
];

test("a click on a bullet zooms into the block; the breadcrumb leads back", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={DEEP} />);
  await bullet(component, "a1").click();
  await expect(zoom(component)).toHaveText("a1");
  expect(await shown(component)).toEqual(["a1", "a1x"]);
  await expect(row(component, "a1")).toHaveAttribute("data-title", "true");
  await expect(bullet(component, "a1")).toHaveCount(0);
  // The children sit at the first level.
  await expect(row(component, "a1x")).toHaveAttribute("aria-level", "2");
  const indent = await row(component, "a1x").evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(indent).toBe("0px");

  const path = component.getByRole("navigation", { name: "Zoom path" });
  await expect(path.getByRole("button")).toHaveText(["Outline", "Alpha"]);
  await path.getByRole("button", { name: "Alpha" }).click();
  await expect(zoom(component)).toHaveText("a");
  expect(await shown(component)).toEqual(["a", "a1", "a1x", "a2"]);
  await path.getByRole("button", { name: "Outline" }).click();
  await expect(zoom(component)).toHaveText("none");
  await expect(path).toHaveCount(0);
});

test("the zoom keys keep the caret in the block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={DEEP} />);
  await caretIn(component, "a2", 3);
  await page.keyboard.press("Control+.");
  await expect(zoom(component)).toHaveText("a2");
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });
  await page.keyboard.press("Control+,");
  await expect(zoom(component)).toHaveText("a");
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(zoom(component)).toHaveText("none");
  expect(await caret(page)).toEqual({ id: "a2", at: 3, text: "Alpha two" });
  // On a selected block too.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+ArrowRight");
  await expect(zoom(component)).toHaveText("a2");
});

test("zoomed, edits stay inside the block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={DEEP} initialRoot="a" />);
  const before = await tree(component).textContent();
  // A first-level block does not outdent out of view, and the title does not go.
  await caretIn(component, "a2", 0);
  await page.keyboard.press("Shift+Tab");
  await row(component, "a").click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Delete");
  expect(await tree(component).textContent()).toBe(before);
  // Typing in the title reaches the tree, and Enter there starts a first child.
  await page.keyboard.press("Enter");
  await page.keyboard.type("!");
  await page.keyboard.press("Enter");
  await page.keyboard.type("new");
  await expect(tree(component)).toContainText("0 a:Alpha!\n1 new:new\n1 a1:Alpha **one**");
  await expect(zoom(component)).toHaveText("a");
});

test("undo returns to the zoom the change was made in", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={DEEP} initialRoot="a1" />);
  await caretIn(component, "a1x", 4);
  await page.keyboard.type("er");
  await page.keyboard.press("Control+,");
  await page.keyboard.press("Control+,");
  await expect(zoom(component)).toHaveText("none");
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toContainText("2 a1x:Deep\n");
  await expect(zoom(component)).toHaveText("a1");
  expect(await caret(page)).toEqual({ id: "a1x", at: 4, text: "Deep" });
});

test("readOnly zooms but does not drag; zoomable={false} leaves the bullet a mark", async ({
  mount,
}) => {
  const component = await mount(<OutlinerHarness initial={DEEP} readOnly />);
  await expect(bullet(component, "a")).not.toHaveAttribute("data-drag", "");
  await bullet(component, "a").click();
  await expect(zoom(component)).toHaveText("a");
  await component.unmount();
  const plain = await mount(<OutlinerHarness initial={DEEP} readOnly zoomable={false} />);
  await expect(bullet(plain, "a")).toHaveCount(0);
});

// --- Dragging blocks by the bullet ---

/** Press a block's bullet and carry it to the gap under (or above) another
 *  row, with the pointer on the bullet column of `depth`. */
async function carry(
  page: Page,
  root: Locator,
  id: string,
  onto: string,
  { above = false, depth = 0 } = {},
) {
  const from = await bullet(root, id).boundingBox();
  const target = await row(root, onto).boundingBox();
  if (!from || !target) throw new Error("nothing to drag");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 2 });
  await page.mouse.move(
    target.x + 20 * (depth + 1),
    above ? target.y + 3 : target.y + target.height - 3,
    { steps: 6 },
  );
}

/** dnd-kit has loaded and the bullets are draggable. */
const dragReady = (root: Locator) => expect(root.locator('[id^="DndLiveRegion"]')).toHaveCount(1);

test("a bullet drags its block to another place and depth", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await dragReady(component);
  // Under a1, as its sibling.
  await carry(page, component, "c", "a1", { depth: 1 });
  await expect(row(component, "c")).toHaveAttribute("data-dragging", "true");
  const line = component.locator('[class*="dropLine"]');
  const under = await row(component, "a1").boundingBox();
  const mark = await line.boundingBox();
  expect(
    Math.abs((mark?.y ?? 0) + 1 - ((under?.y ?? 0) + (under?.height ?? 0))),
  ).toBeLessThanOrEqual(1);
  // The line starts at the bullet column of depth 1.
  expect(Math.round((mark?.x ?? 0) - (under?.x ?? 0))).toBe(35);
  await page.mouse.up();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n1 c:Charlie\n1 a2:Alpha two\n0 b:Bravo",
  );
  await expect(line).toHaveCount(0);
  await expect(component.locator("[data-dragging]")).toHaveCount(0);
  // The release is not a click on the bullet: nothing zoomed.
  await expect(zoom(component)).toHaveText("none");

  // Further right: a child of a1.
  await carry(page, component, "b", "a1", { depth: 2 });
  await page.mouse.up();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n2 b:Bravo\n1 c:Charlie\n1 a2:Alpha two",
  );

  // Above the first row: the top of the outline. One undo per drag.
  await carry(page, component, "c", "a", { above: true });
  await page.mouse.up();
  await expect(tree(component)).toHaveText(/^0 c:Charlie\n0 a:Alpha/);
  await row(component, "c").click();
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a1:Alpha one\n2 b:Bravo\n1 c:Charlie\n1 a2:Alpha two",
  );
});

test("a drag from a selected block moves the selection; Escape cancels", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await dragReady(component);
  await row(component, "a1").click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  expect(await selected(component)).toEqual(["a1", "a2"]);
  const before = await tree(component).textContent();
  await carry(page, component, "a2", "c");
  await expect(component.locator("[data-dragging]")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await tree(component).textContent()).toBe(before);
  await expect(component.locator("[data-dragging]")).toHaveCount(0);

  await carry(page, component, "a2", "c");
  await page.mouse.up();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n0 b:Bravo\n0 c:Charlie\n0 a1:Alpha one\n0 a2:Alpha two",
  );
  expect(await selected(component)).toEqual(["a1", "a2"]);
});

test("a block dragged with the caret in it keeps the caret", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await dragReady(component);
  await caretIn(component, "b", 2);
  await carry(page, component, "b", "c");
  await page.mouse.up();
  await expect(tree(component)).toHaveText(/0 c:Charlie\n0 b:Bravo$/);
  expect(await caret(page)).toEqual({ id: "b", at: 2, text: "Bravo" });
});

test("zoomed, a block cannot be dropped beside the title", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={DEEP} initialRoot="a" />);
  await dragReady(component);
  await carry(page, component, "a1", "a2", { depth: 0 });
  await page.mouse.up();
  await expect(tree(component)).toHaveText(
    "0 a:Alpha\n1 a2:Alpha two\n1 a1:Alpha **one**\n2 a1x:Deep\n0 b:Bravo",
  );
});

test("inside an SfDndProvider the outline joins its context", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} shared />);
  await expect(async () => {
    await carry(page, component, "c", "a", { above: true });
    await expect(component.locator("[data-dragging]")).toHaveCount(1, { timeout: 500 });
  }).toPass();
  await page.mouse.up();
  await expect(tree(component)).toHaveText(/^0 c:Charlie\n0 a:Alpha/);
});

test("reorderable={false} leaves the bullets fixed", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} reorderable={false} />);
  const before = await tree(component).textContent();
  await carry(page, component, "c", "a", { above: true });
  await page.mouse.up();
  expect(await tree(component).textContent()).toBe(before);
});

// --- apiRef ---

test("apiRef.edit reveals a block and puts the caret in it", async ({ mount, page }) => {
  const folded: OutlinerValue = [
    { ...(DEEP[0] as OutlinerValue[number]), collapsed: true },
    { id: "b", content: "Bravo" },
  ];
  const component = await mount(
    <OutlinerHarness initial={folded} initialRoot="b" apiTarget="a1x" apiOffset={2} />,
  );
  await component.getByTestId("api-edit").click();
  await expect(zoom(component)).toHaveText("none");
  expect(await caret(page)).toEqual({ id: "a1x", at: 2, text: "Deep" });
  await component.getByTestId("api-read").click();
  await expect(component.getByTestId("picked")).toHaveText(
    '{"blocks":[],"editing":{"id":"a1x","start":2,"end":2}}',
  );
  // The unfolding is one undo step.
  await component.getByTestId("api-undo").click();
  await expect(row(component, "a1x")).toHaveCount(0);
});

test("apiRef.select selects a block and reports it", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={DEEP} apiTarget="a2" />);
  await component.getByTestId("api-select").click();
  await expect(row(component, "a2")).toBeFocused();
  expect(await selected(component)).toEqual(["a2"]);
  await component.getByTestId("api-read").click();
  await expect(component.getByTestId("picked")).toHaveText('{"blocks":["a2"],"editing":null}');
});

// --- Virtualization, tree semantics, frame ---

test("virtualized: only the rows near the viewport are in the DOM", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerHarness initial={[]} rows={2000} height={300} apiTarget="r1500" apiOffset={1} />,
  );
  await expect(row(component, "r0")).toBeVisible();
  expect(await component.locator("[data-bullet-id]").count()).toBeLessThan(60);
  const scroller = component.getByRole("tree");
  expect(await scroller.evaluate((el) => el.scrollHeight)).toBe(2000 * 25);

  // The keyboard reaches rows that were not rendered.
  await row(component, "r1").click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("End");
  await expect(row(component, "r1999")).toBeFocused();
  await expect(row(component, "r1999")).toBeInViewport();
  await expect(row(component, "r0")).toHaveCount(0);

  // So does the host.
  await component.getByTestId("api-edit").click();
  expect(await caret(page)).toEqual({ id: "r1500", at: 1, text: "Row 1500" });
  await expect(row(component, "r1500")).toBeInViewport();

  // The block with the caret stays mounted when it scrolls away.
  await expect(async () => {
    await scroller.evaluate((el) => el.scrollTo(0, 0));
    await expect(row(component, "r0")).toBeVisible({ timeout: 300 });
  }).toPass();
  await expect(row(component, "r1500").locator("textarea")).toBeFocused();
  await page.keyboard.type("!");
  await expect(tree(component)).toContainText("0 r1500:R!ow 1500");

  // A taller block pushes the rest down. (Typing brought the caret's block
  // back into view, as in any text field.)
  await scroller.evaluate((el) => el.scrollTo(0, 0));
  await caretIn(component, "r2", 5);
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second line");
  const second = await row(component, "r2").boundingBox();
  const third = await row(component, "r3").boundingBox();
  expect(second?.height).toBe(45);
  expect((third?.y ?? 0) - (second?.y ?? 0)).toBe(45);
});

test("virtualized: a block brought on screen stays there while rows are measured", async ({
  mount,
  page,
}) => {
  // Every fifth row is taller than the estimate, so the rows around the
  // target move once they are rendered.
  const component = await mount(
    <OutlinerHarness initial={[]} rows={2000} height={300} tall apiTarget="r1504" apiOffset={0} />,
  );
  await expect(row(component, "r0")).toBeVisible();
  const inside = () =>
    row(component, "r1504").evaluate((el) => {
      const box = el.getBoundingClientRect();
      const view = (el.closest('[role="tree"]') as HTMLElement).getBoundingClientRect();
      return box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
    });
  await component.getByTestId("api-edit").click();
  expect(await caret(page)).toMatchObject({ id: "r1504", at: 0 });
  await expect.poll(inside).toBe(true);
  await component.getByTestId("api-select").click();
  await expect(row(component, "r1504")).toBeFocused();
  await expect.poll(inside).toBe(true);
});

test("each block reports its level, position and siblings", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} />);
  await expect(component.getByRole("tree", { name: "Outline" })).toBeVisible();
  for (const [id, level, position, size] of [
    ["a", "1", "1", "3"],
    ["a2", "2", "2", "2"],
    ["c", "1", "3", "3"],
  ] as const) {
    await expect(row(component, id)).toHaveAttribute("aria-level", level);
    await expect(row(component, id)).toHaveAttribute("aria-posinset", position);
    await expect(row(component, id)).toHaveAttribute("aria-setsize", size);
  }
});

test("frame={false} drops the border and the padding", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={WIDE} frame={false} />);
  const box = await component.getByRole("tree").evaluate((el) => {
    const style = getComputedStyle(el.parentElement as HTMLElement);
    return [style.borderTopWidth, style.paddingTop];
  });
  expect(box).toEqual(["0px", "0px"]);
});

// --- Block types ---

const content = (root: Locator, id: string) => row(root, id).locator('[class*="content"]').first();

test("a heading is read from the text; Mod+Alt+digit sets and removes it", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <OutlinerHarness initial={[{ id: "h", content: "# Title" }, ...TREE]} />,
  );
  await expect(content(component, "h")).toHaveAttribute("data-kind", "heading");
  await expect(content(component, "h")).toHaveAttribute("data-level", "1");
  await expect(content(component, "h")).toHaveText("Title");
  const sizes = await Promise.all(
    ["h", "b"].map((id) => content(component, id).evaluate((el) => getComputedStyle(el).fontSize)),
  );
  expect(Number.parseFloat(sizes[0] ?? "")).toBeGreaterThan(Number.parseFloat(sizes[1] ?? ""));

  await caretIn(component, "b", 2);
  await page.keyboard.press("Control+Alt+2");
  expect(await caret(page)).toEqual({ id: "b", at: 5, text: "## Bravo" });
  // The source is edited in the heading's face.
  await expect(content(component, "b")).toHaveAttribute("data-level", "2");
  await page.keyboard.press("Control+Alt+1");
  expect(await caret(page)).toEqual({ id: "b", at: 4, text: "# Bravo" });
  await page.keyboard.press("Control+Alt+1");
  expect(await caret(page)).toEqual({ id: "b", at: 2, text: "Bravo" });
  // On selected blocks too.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Control+Alt+3");
  await expect(tree(component)).toContainText("1 a2:### Alpha two\n0 b:### Bravo");
});

test("a numbered block continues its list, and the list renumbers itself", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={[{ id: "x", content: "" }]} />);
  await caretIn(component, "x", 0);
  await page.keyboard.type("1. one");
  await page.keyboard.press("Enter");
  expect(await caret(page)).toEqual({ id: "new", at: 3, text: "2. " });
  await page.keyboard.type("two");
  await page.keyboard.press("Enter");
  await page.keyboard.type("three");
  await expect(tree(component)).toHaveText("0 x:1. one\n0 new:2. two\n0 new:3. three");
  // The number stands in the bullet's place, and the text is the rest.
  await page.keyboard.press("Escape");
  await expect(bullet(component, "x")).toHaveText("1.");
  await expect(content(component, "x")).toHaveText("one");
  // Moving a block renumbers the run.
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await expect(tree(component)).toHaveText("0 new:1. three\n0 x:2. one\n0 new:3. two");
  // Enter on an empty number ends the list.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  expect(await caret(page)).toMatchObject({ text: "2. " });
  await page.keyboard.press("Enter");
  expect(await caret(page)).toMatchObject({ at: 0, text: "" });
  await expect(tree(component)).toHaveText("0 new:1. three\n0 new:\n0 x:1. one\n0 new:2. two");
});

test("a numbered block's number is its bullet, and entering the block moves nothing", async ({
  mount,
}) => {
  const steps = Array.from({ length: 10 }, (_, i) => ({
    id: `s${i + 1}`,
    content: `${i + 1}. step`,
  }));
  const component = await mount(
    <OutlinerHarness
      initial={[
        { id: "p", content: "plain" },
        ...steps,
        { id: "f", content: "1. folded", collapsed: true, children: [{ id: "f1", content: "in" }] },
      ]}
      zoomable
    />,
  );
  // Left edges of the number and of the text after it, in view or under edit.
  const edges = (id: string) =>
    row(component, id).evaluate((el) => {
      const editor = el.querySelector("textarea");
      if (editor) {
        const probe = document.createElement("span");
        probe.style.position = "absolute";
        probe.style.whiteSpace = "pre";
        probe.textContent = editor.value.slice(0, editor.value.indexOf(" ") + 1);
        editor.parentElement?.append(probe);
        const number = editor.getBoundingClientRect().left;
        const text = number + probe.getBoundingClientRect().width;
        probe.remove();
        return { number, text };
      }
      const range = document.createRange();
      const texts = (root: Element) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const found: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) found.push(node as Text);
        return found;
      };
      range.selectNodeContents(texts(el.children[1] as Element)[0] as Text);
      const number = range.getBoundingClientRect().left;
      range.selectNodeContents(texts(el.children[2] as Element)[0] as Text);
      return { number, text: range.getBoundingClientRect().left };
    });

  // No dot: the handle holds the number and nothing else.
  await expect(bullet(component, "s3")).toHaveText("3.");
  expect(await bullet(component, "s3").locator(":scope > *").count()).toBe(1);
  await expect(bullet(component, "p")).toHaveText("");

  // The run takes the width of its last number: the texts line up, and the
  // number starts where a dot does.
  const nine = await edges("s9");
  const ten = await edges("s10");
  expect(nine.text).toBeCloseTo(ten.text, 1);
  expect(nine.number).toBeGreaterThan(ten.number + 4);
  const dot = await bullet(component, "p").locator(":scope > *").boundingBox();
  expect(ten.number).toBeCloseTo(dot?.x ?? 0, 1);

  // Under edit the source's number and text stand where they were shown.
  for (const id of ["s9", "s10"]) {
    const shown = await edges(id);
    const height = (await row(component, id).boundingBox())?.height;
    await caretIn(component, id, 0);
    await expect(row(component, id).locator("[data-bullet-handle]")).toHaveCount(0);
    const edited = await edges(id);
    expect(edited.number).toBeCloseTo(shown.number, 1);
    expect(edited.text).toBeCloseTo(shown.text, 1);
    expect((await row(component, id).boundingBox())?.height).toBe(height);
  }

  // A folded block is marked on its number, as a dot is by its ring.
  const tint = (id: string) =>
    bullet(component, id)
      .locator(":scope > * > *")
      .last()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await tint("f")).not.toBe(await tint("s1"));

  // The number is the handle: a click zooms into the block.
  await bullet(component, "s2").click();
  await expect(component.getByRole("navigation", { name: "Zoom path" })).toBeVisible();
});

test("quotes, callouts and dividers render from their markers", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerHarness
      initial={[
        { id: "q", content: "> said" },
        { id: "w", content: "> [!warning] careful" },
        { id: "d", content: "---" },
        { id: "b", content: "Bravo" },
      ]}
    />,
  );
  await expect(row(component, "q").locator("blockquote")).toHaveText("said");
  const callout = row(component, "w").locator('[class*="callout"][data-tone]');
  await expect(callout).toHaveAttribute("data-tone", "warning");
  await expect(callout).toHaveText("Warningcareful");
  await expect(row(component, "d").locator("hr")).toBeVisible();
  // A click into the callout lands in its text, past the marker.
  await row(component, "w")
    .getByText("careful")
    .click({ position: { x: 1, y: 8 } });
  expect(await caret(page)).toMatchObject({ id: "w", at: 13 });
  // Mod+Shift+. quotes a block and takes the quote off.
  await caretIn(component, "b", 5);
  await page.keyboard.press("Control+Shift+Period");
  expect(await caret(page)).toEqual({ id: "b", at: 7, text: "> Bravo" });
  await page.keyboard.press("Control+Shift+Period");
  expect(await caret(page)).toEqual({ id: "b", at: 5, text: "Bravo" });
});

test("a code fence makes a code block: Enter and Tab stay inside it", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={[{ id: "c", content: "" }]} />);
  await caretIn(component, "c", 0);
  await page.keyboard.type("```js");
  await page.keyboard.press("Enter");
  expect(await caret(page)).toEqual({ id: "c", at: 6, text: "```js\n\n```" });
  await page.keyboard.type("if (a) {");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("b[0]");
  // No pairing in code, one block, the indentation kept.
  expect(await caret(page)).toMatchObject({ text: "```js\nif (a) {\n  b[0]\n```" });
  await expect(component.getByTestId("changes")).not.toHaveText("0");
  await page.keyboard.press("Enter");
  expect(await caret(page)).toMatchObject({ text: "```js\nif (a) {\n  b[0]\n  \n```" });
  // After the closing fence Enter is a new block again.
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  expect(await caret(page)).toEqual({ id: "new", at: 0, text: "" });
  await expect(row(component, "c").locator("pre")).toContainText("if (a) {");
});

test("tasks in progress and cancelled; a parent counts its tasks", async ({ mount }) => {
  const component = await mount(
    <OutlinerHarness
      initial={[
        {
          id: "p",
          content: "Plan",
          children: [
            { id: "t1", content: "[x] done" },
            { id: "t2", content: "[/] going" },
            { id: "t3", content: "[-] dropped" },
            { id: "t4", content: "[ ] open" },
            { id: "n", content: "a note" },
          ],
        },
      ]}
    />,
  );
  const count = row(component, "p").getByRole("img", { name: "1 of 3 tasks done" });
  await expect(count).toHaveText("1/3");
  await expect(row(component, "t2").getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  await row(component, "t2").getByRole("checkbox").click();
  await expect(tree(component)).toContainText("1 t2:[x] going");
  await expect(row(component, "p").getByRole("img")).toHaveText("2/3");
  await expect(row(component, "t3").locator('[class*="text"]')).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await row(component, "t3").getByRole("button", { name: "Cancelled. Reopen" }).click();
  await expect(tree(component)).toContainText("1 t3:[ ] dropped");
  await expect(row(component, "p").getByRole("img")).toHaveText("2/4");
});

test("a due date is a chip that opens a calendar", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerHarness
      initial={[
        { id: "late", content: "[ ] ship @2020-01-10" },
        { id: "done", content: "[x] shipped @2020-01-10" },
      ]}
      width={480}
    />,
  );
  const chip = row(component, "late").locator('[class*="due"]');
  await expect(chip).toHaveText("2020-01-10");
  await expect(chip).toHaveAttribute("data-late", "true");
  await expect(row(component, "done").locator('[class*="due"]')).not.toHaveAttribute("data-late");
  // The chip sits on the text line.
  expect((await row(component, "late").boundingBox())?.height).toBe(25);
  await chip.click();
  const field = page.getByRole("dialog", { name: "Due date" }).locator("input");
  await expect(field).toBeFocused();
  await field.fill("2031-03-04");
  await page.keyboard.press("Enter");
  await expect(tree(component)).toContainText("0 late:[ ] ship @2031-03-04");
  await expect(page.getByRole("dialog", { name: "Due date" })).toHaveCount(0);
  await expect(chip).toHaveText("2031-03-04");
  await expect(chip).not.toHaveAttribute("data-late");
  // Nothing was entered on the way.
  await expect(component.locator("textarea")).toHaveCount(0);
});

test("a property shows its name and value; a click lands in the value", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerHarness initial={[{ id: "s", content: "status:: in review" }]} width={480} />,
  );
  await expect(row(component, "s").locator('[class*="key"]')).toHaveText("status");
  await row(component, "s")
    .getByText("in review")
    .click({ position: { x: 1, y: 8 } });
  expect(await caret(page)).toEqual({ id: "s", at: 9, text: "status:: in review" });
});

const TABLE: OutlinerValue = [
  {
    id: "t",
    content: "{{table}}",
    collapsed: true,
    children: [
      { id: "h", content: "Name", children: [{ id: "h2", content: "Age" }] },
      { id: "r", content: "**Ada**", children: [{ id: "r2", content: "36" }] },
    ],
  },
];

test("a table shows its child blocks; a click on a cell goes to its block", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={TABLE} />);
  const table = row(component, "t").getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText(["Name", "Age"]);
  await expect(table.getByRole("cell")).toHaveText(["Ada", "36"]);
  // Folded, the rows show only in the table.
  await expect(row(component, "r2")).toHaveCount(0);
  await table.getByRole("cell", { name: "36" }).click();
  expect(await caret(page)).toEqual({ id: "r2", at: 2, text: "36" });
  await page.keyboard.type("5");
  await expect(table.getByRole("cell").nth(1)).toHaveText("365");
});

const BOARD: OutlinerValue = [
  {
    id: "k",
    content: "{{kanban}}",
    children: [
      {
        id: "todo",
        content: "To do",
        children: [
          { id: "c1", content: "First" },
          { id: "c2", content: "Second" },
        ],
      },
      { id: "doing", content: "Doing" },
    ],
  },
];

test("a board shows columns and cards; dragging a card moves its block", async ({
  mount,
  page,
}) => {
  const component = await mount(<OutlinerHarness initial={BOARD} width={640} />);
  const board = row(component, "k").locator('[class*="board"]');
  await expect(board.getByRole("region")).toHaveCount(2);
  const todo = board.getByRole("region", { name: "To do" });
  const doing = board.getByRole("region", { name: "Doing" });
  await expect(todo.locator('[class*="card"]')).toHaveText(["First", "Second"]);
  const card = await todo.getByText("First").boundingBox();
  const target = await doing.boundingBox();
  if (!card || !target) throw new Error("nothing to drag");
  await page.mouse.move(card.x + 20, card.y + 10);
  await page.mouse.down();
  await page.mouse.move(card.x + 30, card.y + 14, { steps: 2 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 10, { steps: 8 });
  await page.mouse.up();
  await expect(tree(component)).toHaveText(
    "0 k:{{kanban}}\n1 todo:To do\n2 c2:Second\n1 doing:Doing\n2 c1:First",
  );
  await expect(doing.locator('[class*="card"]')).toHaveText(["First"]);
  // One undo step.
  await row(component, "doing").click();
  await page.keyboard.press("Control+z");
  await expect(todo.locator('[class*="card"]')).toHaveText(["First", "Second"]);
});

test("an embed is the block itself: an edit in it is an edit of the block", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <OutlinerHarness
      initial={[
        { id: "src", content: "Source", children: [{ id: "kid", content: "Child" }] },
        { id: "e", content: "{{embed ((src))}}" },
        { id: "self", content: "{{embed ((self))}}" },
        { id: "gone", content: "{{embed ((nope))}}" },
      ]}
      width={480}
    />,
  );
  const embed = row(component, "e").getByRole("tree", { name: "Embedded block" });
  await expect(embed.locator("[data-bullet-id]")).toHaveCount(2);
  await embed.locator('[data-bullet-id="kid"]').getByText("Child").click();
  const editor = embed.locator("textarea");
  await expect(editor).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await expect(tree(component)).toContainText("1 kid:Child!");
  // The outer outline did not enter the embed's own block.
  await expect(component.locator("textarea")).toHaveCount(1);
  await expect(row(component, "self")).toContainText("the block embeds itself");
  await expect(row(component, "gone")).toContainText("ref not found: nope");
});

test("an image block shows the image; its grip sets the width", async ({ mount, page }) => {
  const pixel =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTIwIi8+";
  const component = await mount(
    <OutlinerHarness initial={[{ id: "i", content: `![Ridge|200](${pixel})` }]} width={600} />,
  );
  const image = row(component, "i").getByRole("img", { name: "Ridge" });
  await expect(image).toBeVisible();
  expect((await image.boundingBox())?.width).toBe(200);
  const grip = await row(component, "i").getByRole("separator").boundingBox();
  if (!grip) throw new Error("no grip");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + grip.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(tree(component)).toHaveText(`0 i:![Ridge|260](${pixel})`);
  await expect(component.locator("textarea")).toHaveCount(0);
});

test("a pasted file is handed to onUpload and becomes a block", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} withUpload />);
  await caretIn(component, "b", 5);
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "shot one.png", { type: "image/png" }));
    transfer.items.add(new File(["x"], "notes.pdf", { type: "application/pdf" }));
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }),
    );
  });
  await expect(tree(component)).toContainText(
    "0 b:Bravo\n0 new:![shot one.png](upload:shot%20one.png)\n0 new:[notes.pdf](upload:notes.pdf)",
  );
});

test("a pasted ordered list keeps its numbers", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await caretIn(component, "b", 5);
  await clipboard(page, "paste", "7. first\n8. second");
  await expect(tree(component)).toContainText("0 new:1. first\n0 new:2. second");
});
