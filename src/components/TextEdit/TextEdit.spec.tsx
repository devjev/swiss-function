import { expect, test } from "@playwright/experimental-ct-react";
import type { CSSProperties } from "react";
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

test("resting border is the neutral structural token (primary is focus-only)", async ({
  mount,
}) => {
  const component = await mount(<TextEdit />);
  const color = await component.evaluate((el) => getComputedStyle(el).borderColor);
  // --sf-color-border in light mode is #e5e7eb -> rgb(229, 231, 235).
  expect(color).toBe("rgb(229, 231, 235)");
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

// The focus ring reads --sf-focus-ring-width / --sf-focus-ring-offset (library-
// wide convention), so a container that already communicates focus — a
// WindowArray.Window frame, an active Pane — can tune or disable the inner
// ring for its subtree without specificity games.
test("focus ring obeys the --sf-focus-ring-* custom properties", async ({ mount, page }) => {
  await mount(
    <div>
      <TextEdit aria-label="plain" />
      <div style={{ "--sf-focus-ring-width": "0" } as CSSProperties}>
        <TextEdit aria-label="ringless" />
      </div>
      <div style={{ "--sf-focus-ring-offset": "4px" } as CSSProperties}>
        <TextEdit aria-label="offset" />
      </div>
    </div>,
  );
  const ring = (name: string) =>
    page.getByLabel(name).evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, offset: style.outlineOffset };
    });
  // Untouched: the token default (2px) and the rule's own offset fallback.
  await page.getByLabel("plain").focus();
  expect(await ring("plain")).toEqual({ width: "2px", offset: "1px" });
  // Width 0 disables the ring for the subtree.
  await page.getByLabel("ringless").focus();
  expect((await ring("ringless")).width).toBe("0px");
  // The offset hook overrides the per-rule fallback.
  await page.getByLabel("offset").focus();
  expect(await ring("offset")).toEqual({ width: "2px", offset: "4px" });
});
