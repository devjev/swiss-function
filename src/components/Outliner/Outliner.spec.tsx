import { expect, test } from "@playwright/experimental-ct-react";
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

test("renders bullets with markdown content", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await expect(component.getByText("Alpha", { exact: true })).toBeVisible();
  await expect(component.getByText("Alpha one")).toBeVisible();
  await expect(component.getByText("Bravo")).toBeVisible();
});

test("click activates a bullet", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  const row = component.locator('[data-bullet-id="b"]');
  await row.click();
  await expect(row).toHaveAttribute("data-active", "true");
});

test("readOnly: ArrowDown moves active to next visible bullet", async ({ mount, page }) => {
  // With edit-by-default, arrow keys route to the textarea. Read-mode keyboard
  // navigation only fires in readOnly mode.
  const component = await mount(<OutlinerHarness initial={TREE} readOnly />);
  await component.locator('[data-bullet-id="a"]').click();
  await page.keyboard.press("ArrowDown");
  await expect(component.locator('[data-bullet-id="a1"]')).toHaveAttribute("data-active", "true");
});

test("readOnly: ArrowLeft collapses; ArrowRight expands", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} readOnly />);
  await component.locator('[data-bullet-id="a"]').click();
  await page.keyboard.press("ArrowLeft");
  await expect(component.locator('[data-bullet-id="a1"]')).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(component.locator('[data-bullet-id="a1"]')).toBeVisible();
});

test("Tab in editor indents the focused bullet", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  // Click now activates AND enters edit mode (Roam-style edit-by-default).
  await component.locator('[data-bullet-id="b"]').click();
  await page.keyboard.press("Tab");
  // After indent, "b" should be a child of "a". padding-inline-start = depth*unit
  // (24px) + 1/8 unit base (3px) = 27px.
  const pl = await component
    .locator('[data-bullet-id="b"]')
    .evaluate((el) => getComputedStyle(el).paddingInlineStart);
  expect(pl).toBe("27px");
});

test("click opens editor pre-filled with source (edit-by-default)", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await component.locator('[data-bullet-id="b"]').click();
  const ta = component.locator("textarea");
  await expect(ta).toBeVisible();
  await expect(ta).toBeFocused();
  await expect(ta).toHaveValue("Bravo");
});

test("Esc cancels edit without writing", async ({ mount, page }) => {
  const component = await mount(<OutlinerHarness initial={TREE} />);
  await component.locator('[data-bullet-id="b"]').click();
  await page.keyboard.insertText(" extra");
  await page.keyboard.press("Escape");
  await expect(component.locator("textarea")).toHaveCount(0);
  await expect(component.getByText("Bravo", { exact: true })).toBeVisible();
});

test("readOnly: click does NOT open an editor", async ({ mount }) => {
  const component = await mount(<OutlinerHarness initial={TREE} readOnly />);
  await component.locator('[data-bullet-id="b"]').click();
  await expect(component.locator("textarea")).toHaveCount(0);
});

test("[[wiki links]] render as clickable buttons", async ({ mount }) => {
  const initial: OutlinerValue = [{ id: "1", content: "see [[Page A]] and [[Page B]]" }];
  const component = await mount(<OutlinerHarness initial={initial} />);
  await expect(component.getByRole("button", { name: "Page A" })).toBeVisible();
  await expect(component.getByRole("button", { name: "Page B" })).toBeVisible();
});

test("((id)) transcludes resolved content; missing id shows placeholder", async ({ mount }) => {
  const initial: OutlinerValue = [
    { id: "1", content: "Has ref: ((src))" },
    { id: "2", content: "Missing: ((nope))" },
  ];
  const component = await mount(
    <OutlinerHarness initial={initial} blockRefs={{ src: "**bold source**" }} />,
  );
  // Resolved markdown — "bold source" rendered as bold; the word "source" is visible.
  await expect(component.getByText("bold source")).toBeVisible();
  await expect(component.getByText(/ref not found.*nope/)).toBeVisible();
});
