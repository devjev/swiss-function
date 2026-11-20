import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import type { OutlinerValue } from "../Outliner";
import { OutlinerBlocksHarness } from "./OutlinerBlocks.harness";

const row = (root: Locator, id: string) => root.locator(`[data-bullet-id="${id}"]`);
const tree = (root: Locator) => root.getByTestId("tree");
const options = (page: Page) => page.getByRole("option");

const DOC: OutlinerValue = [
  {
    id: "p",
    content: "Project Alpha",
    children: [
      { id: "t1", content: "[ ] Review the alpha notes" },
      { id: "t2", content: "[ ] Ship beta" },
    ],
  },
  { id: "q", content: "{{query alpha}}" },
  { id: "m", content: "$$ x^2 $$" },
  { id: "bad", content: "$$ \\bad $$" },
  { id: "d", content: "```mermaid\ngraph TD; a-->b\n```" },
  { id: "csv", content: "```csv\nfund,aum\nAlpha,1284\nBeta,640\n```" },
  { id: "js", content: "```js\nlet a = 1;\n```" },
  { id: "url", content: "https://example.com/page" },
  { id: "plain", content: "https://unknown.test/x" },
];

test("a query lists the matching blocks; a click goes to one", async ({ mount, page }) => {
  const component = await mount(<OutlinerBlocksHarness initial={DOC} />);
  const query = row(component, "q");
  const results = query.locator('button[class*="result"]');
  // Every block whose text holds the word: the csv block's does too.
  await expect(results).toHaveText(["Project Alpha", "Review the alpha notesProject Alpha", "csv"]);
  // The results follow the tree.
  await row(component, "t2").getByText("Ship beta").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" for alpha");
  await expect(results).toHaveCount(4);
  await results.filter({ hasText: "Review the alpha notes" }).click();
  await expect(row(component, "t1").locator("textarea")).toBeFocused();
});

test("a query waits for the typing beside it to pause", async ({ mount, page }) => {
  const component = await mount(<OutlinerBlocksHarness initial={DOC} />);
  const results = row(component, "q").locator('button[class*="result"]');
  await expect(results).toHaveCount(3);
  const runs = () => page.evaluate(() => (globalThis as { queryRuns?: number }).queryRuns ?? 0);
  const before = await runs();
  await row(component, "t2").getByText("Ship beta").click();
  await page.keyboard.press("End");
  // Twelve changes to the tree, each well inside the 200ms the query waits.
  await page.keyboard.type(" for alpha x", { delay: 15 });
  await expect(results).toHaveCount(4);
  expect((await runs()) - before).toBeLessThanOrEqual(2);
});

test("math is set by KaTeX; a diagram shows what the app's renderer returns", async ({ mount }) => {
  const component = await mount(<OutlinerBlocksHarness initial={DOC} />);
  const math = row(component, "m");
  await expect(math.locator(".katex-display annotation")).toHaveText("x^2");
  // KaTeX's stylesheet came with it: the copy for screen readers is taken out
  // of the layout.
  await expect(math.locator(".katex-mathml")).toHaveCSS("position", "absolute");
  await expect(row(component, "bad").getByRole("alert")).toContainText(
    "Math: KaTeX parse error: Undefined control sequence: \\bad",
  );
  await expect(row(component, "d").locator("svg title")).toHaveText("graph TD; a-->b");
});

test("$x$ inside a block's text is math; a price is not", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerBlocksHarness
      initial={[
        { id: "a", content: "Euler: $e^{i\\pi} + 1 = 0$, for $5 and $10" },
        { id: "b", content: "`$x$` and \\$y$ and $\\bad$" },
      ]}
    />,
  );
  const a = row(component, "a");
  await expect(a.locator(".katex annotation")).toHaveText(["e^{i\\pi} + 1 = 0"]);
  await expect(a.locator(".katex-display")).toHaveCount(0);
  await expect(a).toContainText(", for $5 and $10");
  // Code and an escaped dollar stay text; TeX that does not parse stays as
  // its source, with the error in a title.
  const b = row(component, "b");
  await expect(b.locator(".katex")).toHaveCount(0);
  await expect(b.locator("code")).toHaveText("$x$");
  await expect(b).toContainText("$y$ and \\bad");
  await expect(b.locator("[title*='Undefined control sequence']")).toHaveText("\\bad");
  // The source is what is edited.
  await a.getByText("Euler").click();
  await expect(a.locator("textarea")).toHaveValue("Euler: $e^{i\\pi} + 1 = 0$, for $5 and $10");
  await page.keyboard.press("Escape");
});

test("a csv block is a table; numbers sit at the end of their column", async ({ mount }) => {
  const component = await mount(<OutlinerBlocksHarness initial={DOC} />);
  const data = row(component, "csv");
  await expect(data.getByRole("columnheader")).toHaveText(["fund", "aum"]);
  await expect(data.getByRole("gridcell", { name: "1284" })).toBeVisible();
  await expect(data.getByRole("gridcell", { name: "1284" })).toHaveCSS("text-align", "right");
});

test("a fenced block no other type claims is edited in a code editor", async ({ mount, page }) => {
  const component = await mount(<OutlinerBlocksHarness initial={DOC} />);
  const editor = row(component, "js").locator(".cm-content");
  await expect(editor).toHaveText("let a = 1;");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" // one");
  await expect(tree(component)).toContainText("0 js:```js⏎let a = 1; // one⏎```");
  // The outline did not enter the block: the editor is the block at rest.
  await expect(row(component, "js").locator("textarea")).toHaveCount(0);
});

test("a block that is one URL shows a preview when there is one", async ({ mount }) => {
  const component = await mount(<OutlinerBlocksHarness initial={DOC} />);
  const card = row(component, "url").getByRole("link");
  await expect(card).toContainText("Example Domain");
  await expect(card).toContainText("example.com");
  await expect(card).toHaveAttribute("href", "https://example.com/page");
  await expect(row(component, "plain").getByRole("link")).toHaveText("https://unknown.test/x");
});

test("/ offers the block commands; one changes the block", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerBlocksHarness initial={[{ id: "a", content: "Title" }]} />,
  );
  await row(component, "a").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" /h2");
  await expect(options(page)).toHaveText(["Heading 2## "]);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText("0 a:## Title");
  // In an empty block the commands that replace it are offered too.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/tab");
  await expect(options(page)).toHaveText(["TableRows from the child blocks"]);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText(
    "0 a:## Title\n0 new:{{table}}\n1 new:Column 1\n2 new:Column 2\n1 new:\n2 new:",
  );
  // One undo step for the command.
  await page.keyboard.press("Control+z");
  await expect(tree(component)).toHaveText("0 a:## Title\n0 new:/tab");
});

test("a registered type's command, and an action of the app's", async ({ mount, page }) => {
  const component = await mount(<OutlinerBlocksHarness initial={[{ id: "a", content: "" }]} />);
  await row(component, "a").click();
  await page.keyboard.type("/que");
  await expect(options(page)).toHaveText(["QueryThe blocks that match"]);
  await page.keyboard.press("Enter");
  await expect(tree(component)).toHaveText("0 a:{{query }}");
  await page.keyboard.press("Control+a");
  await page.keyboard.type("note /st");
  await expect(options(page)).toHaveText(["stampAn action of the app's"]);
  await page.keyboard.press("Enter");
  await expect(component.getByTestId("ran")).toHaveText("a");
  await expect(tree(component)).toHaveText("0 a:note ");
});

test("commands={false} leaves / to the app", async ({ mount, page }) => {
  const component = await mount(
    <OutlinerBlocksHarness initial={[{ id: "a", content: "" }]} commands={false} />,
  );
  await row(component, "a").click();
  await page.keyboard.type("/h");
  await expect(options(page)).toHaveCount(0);
});
