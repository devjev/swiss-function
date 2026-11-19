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
  await expect(options(page)).toHaveText(["todayToday's date", "timeThe time"]);
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
