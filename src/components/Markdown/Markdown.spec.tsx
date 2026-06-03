import { expect, test } from "@playwright/experimental-ct-react";
import { Markdown } from "./Markdown";

test("renders markdown as HTML", async ({ mount }) => {
  const component = await mount(<Markdown value="# Hello" />);
  await expect(component.getByRole("heading", { level: 1, name: "Hello" })).toBeVisible();
});

test("renders GFM tables", async ({ mount }) => {
  const md = "| A | B |\n| - | - |\n| 1 | 2 |";
  const component = await mount(<Markdown value={md} />);
  await expect(component.getByRole("table")).toBeVisible();
  await expect(component.getByRole("columnheader", { name: "A" })).toBeVisible();
});

test("empty value shows placeholder", async ({ mount }) => {
  const component = await mount(<Markdown value="" placeholder="Write something…" />);
  await expect(component.getByText("Write something…")).toBeVisible();
});

test("editable={false}: double-click does NOT open an editor", async ({ mount }) => {
  const component = await mount(<Markdown value="# Hello" />);
  await component.dblclick();
  await expect(component.locator("textarea")).toHaveCount(0);
});

test("editable: double-click switches to a textarea pre-filled with source", async ({ mount }) => {
  const component = await mount(<Markdown editable value="# Hello" />);
  await component.dblclick();
  const textarea = component.locator("textarea");
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue("# Hello");
});

test("Esc cancels edit (reverts to original)", async ({ mount, page }) => {
  const component = await mount(<Markdown editable value="# Hello" />);
  await component.dblclick();
  await page.keyboard.insertText(" world");
  await page.keyboard.press("Escape");
  await expect(component.locator("textarea")).toHaveCount(0);
  // Original heading still rendered, unmodified.
  await expect(component.getByRole("heading", { level: 1, name: "Hello" })).toBeVisible();
});
