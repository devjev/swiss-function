import { expect, test } from "@playwright/experimental-ct-react";
import { CodeEditorInline } from "./CodeEditorInline";

test("mounts a CodeMirror editor, collapsed at rest", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 360 }}>
      <CodeEditorInline defaultValue={"one\ntwo\nthree\nfour"} />
    </div>,
  );
  await expect(c.locator(".cm-editor")).toHaveCount(1);
  const wrapper = c.locator('[class*="root"]').first();
  // Collapsed: no data-expanded, and the footprint is ~one line (well under the
  // four-line document's full height).
  expect(await wrapper.getAttribute("data-expanded")).toBeNull();
  const h = (await wrapper.boundingBox())?.height ?? 0;
  expect(h).toBeLessThan(70);
});

test("expands on focus and collapses on blur", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 360 }}>
      {/* Above the editor: the expanded overlay grows downward and would cover a
          button placed below it (that's the point — it floats over content). */}
      <button type="button" data-testid="outside">
        outside
      </button>
      <CodeEditorInline defaultValue={"one\ntwo\nthree\nfour"} />
    </div>,
  );
  const wrapper = c.locator('[class*="root"]').first();

  await c.locator(".cm-content").click();
  await expect(wrapper).toHaveAttribute("data-expanded", "true");
  // The overlay editor now shows more than one line and is vertically resizable.
  const editor = c.locator('[class*="root"] [class*="editor"]').first();
  const { height, resize } = await editor.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    resize: getComputedStyle(el).resize,
  }));
  expect(height).toBeGreaterThan(70);
  expect(resize).toBe("vertical");

  await c.getByTestId("outside").click();
  expect(await wrapper.getAttribute("data-expanded")).toBeNull();
});
