import { expect, test } from "@playwright/experimental-ct-react";
import { TextEdit } from "./TextEdit";

test("renders a <textarea>", async ({ mount }) => {
  const component = await mount(<TextEdit placeholder="hi" />);
  await expect(component).toHaveJSProperty("tagName", "TEXTAREA");
});

test("defaults to 3 rows", async ({ mount }) => {
  const component = await mount(<TextEdit />);
  await expect(component).toHaveAttribute("rows", "3");
});

test("rows prop controls visible row count", async ({ mount }) => {
  const component = await mount(<TextEdit rows={7} />);
  await expect(component).toHaveAttribute("rows", "7");
});

test("uses the monospace font family", async ({ mount }) => {
  const component = await mount(<TextEdit />);
  const family = await component.evaluate((el) => getComputedStyle(el).fontFamily);
  // First entry in --sf-font-mono is JetBrains Mono.
  expect(family).toContain("JetBrains Mono");
});

test("border resolves to the primary token", async ({ mount }) => {
  const component = await mount(<TextEdit />);
  const color = await component.evaluate((el) => getComputedStyle(el).borderColor);
  // --sf-color-primary in light mode is #2563eb -> rgb(37, 99, 235).
  expect(color).toBe("rgb(37, 99, 235)");
});

test("accepts text input", async ({ mount }) => {
  const component = await mount(<TextEdit />);
  await component.fill("hello\nworld");
  await expect(component).toHaveValue("hello\nworld");
});

test("disabled blocks input", async ({ mount }) => {
  const component = await mount(<TextEdit disabled defaultValue="frozen" />);
  await expect(component).toBeDisabled();
});
