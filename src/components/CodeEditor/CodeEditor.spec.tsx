import { expect, test } from "@playwright/experimental-ct-react";
import { CodeEditor } from "./CodeEditor";

test("renders a CodeMirror editor with the initial value", async ({ mount }) => {
  const component = await mount(<CodeEditor defaultValue="const x = 1" />);
  await expect(component.locator(".cm-editor")).toHaveCount(1);
  await expect(component.locator(".cm-content")).toContainText("const x = 1");
});

test("shows a line-number gutter by default", async ({ mount }) => {
  const component = await mount(<CodeEditor defaultValue={"a\nb\nc"} />);
  await expect(component.locator(".cm-lineNumbers")).toHaveCount(1);
});

test("hides the line-number gutter when lineNumbers=false", async ({ mount }) => {
  const component = await mount(<CodeEditor defaultValue={"a\nb\nc"} lineNumbers={false} />);
  await expect(component.locator(".cm-lineNumbers")).toHaveCount(0);
});

test("is editable — typing updates the document", async ({ mount, page }) => {
  const component = await mount(<CodeEditor defaultValue="" placeholder="type…" />);
  await component.locator(".cm-content").click();
  await page.keyboard.type("hi");
  await expect(component.locator(".cm-content")).toContainText("hi");
});

test("readOnly blocks edits", async ({ mount, page }) => {
  const component = await mount(<CodeEditor defaultValue="locked" readOnly />);
  await component.locator(".cm-content").click();
  await page.keyboard.type("x");
  await expect(component.locator(".cm-content")).toHaveText("locked");
});

test("uses the monospace font for content", async ({ mount }) => {
  const component = await mount(<CodeEditor defaultValue="mono" />);
  const family = await component
    .locator(".cm-content")
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain("JetBrains Mono");
});

test("vim mode interprets keys as commands, not literal input", async ({ mount, page }) => {
  const component = await mount(<CodeEditor defaultValue="hello" vim />);
  const content = component.locator(".cm-content");
  await content.click();
  // `A` = append at end-of-line (a Vim command, consumed — never typed as "A").
  await page.keyboard.press("Shift+A");
  await page.keyboard.type("!");
  await page.keyboard.press("Escape");
  await expect(content).toHaveText("hello!");
});
