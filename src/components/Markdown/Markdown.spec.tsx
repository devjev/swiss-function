import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import type { CSSProperties } from "react";
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

// --- Text links (issue #109) -------------------------------------------------

/** The computed style of the first link matching `name`. */
function linkStyle(component: Locator, name: string, pseudo?: string) {
  return component.getByRole("link", { name }).evaluate((a, p) => {
    const s = getComputedStyle(a, p ?? null);
    return {
      color: s.color,
      weight: s.fontWeight,
      style: s.fontStyle,
      line: s.textDecorationLine,
      decoStyle: s.textDecorationStyle,
      decoColor: s.textDecorationColor,
      thickness: s.textDecorationThickness,
      content: s.content,
    };
  }, pseudo ?? null);
}

/** The accent as a computed colour. */
function accent(component: Locator) {
  return component.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--sf-color-primary)";
    el.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
}

const LINKS = "[inside](/x) and [outside](https://example.com), **[bold](/b)**";

test("a link takes the text colour around it under an accent rule (#109)", async ({ mount }) => {
  const component = await mount(
    <div style={{ "--sf-color-fg": "rgb(1, 2, 3)" } as CSSProperties}>
      <Markdown value={LINKS} />
    </div>,
  );
  const s = await linkStyle(component, "inside");
  expect(s.color).toBe("rgb(1, 2, 3)");
  expect(s.line).toBe("underline");
  expect(s.thickness).toBe("1px");
  expect(s.decoColor).toBe(await accent(component));
  // A link in bold stays bold.
  expect(Number((await linkStyle(component, "bold")).weight)).toBeGreaterThanOrEqual(600);
});

test("the text and the decoration tokens act apart (#109)", async ({ mount }) => {
  const component = await mount(
    <div
      style={
        {
          "--sf-link-color": "rgb(200, 0, 0)",
          "--sf-link-font-style": "italic",
          "--sf-link-decoration-style": "dotted",
          "--sf-link-decoration-thickness": "3px",
        } as CSSProperties
      }
    >
      <Markdown value={LINKS} />
    </div>,
  );
  const s = await linkStyle(component, "inside");
  expect(s.color).toBe("rgb(200, 0, 0)");
  expect(s.style).toBe("italic");
  expect(s.decoStyle).toBe("dotted");
  expect(s.thickness).toBe("3px");
  // The rule keeps the accent: the text colour did not reach it.
  expect(s.decoColor).toBe(await accent(component));
});

test("a rule colour leaves the text colour alone (#109)", async ({ mount }) => {
  const component = await mount(
    <div
      style={
        {
          "--sf-color-fg": "rgb(1, 2, 3)",
          "--sf-link-decoration-color": "rgb(0, 150, 0)",
        } as CSSProperties
      }
    >
      <Markdown value={LINKS} />
    </div>,
  );
  const s = await linkStyle(component, "inside");
  expect(s.decoColor).toBe("rgb(0, 150, 0)");
  expect(s.color).toBe("rgb(1, 2, 3)");
});

test("an external link carries the marker; its kind tokens reach it alone (#109)", async ({
  mount,
}) => {
  const component = await mount(
    <div style={{ "--sf-link-external-color": "rgb(0, 0, 200)" } as CSSProperties}>
      <Markdown value={LINKS} />
    </div>,
  );
  expect((await linkStyle(component, "outside", "::after")).content).toBe('"↗"');
  expect((await linkStyle(component, "inside", "::after")).content).toBe("none");
  expect((await linkStyle(component, "outside")).color).toBe("rgb(0, 0, 200)");
  expect((await linkStyle(component, "inside")).color).not.toBe("rgb(0, 0, 200)");
});

test("the marker token hides the marker (#109)", async ({ mount }) => {
  const component = await mount(
    <div style={{ "--sf-link-external-marker": "none" } as CSSProperties}>
      <Markdown value={LINKS} />
    </div>,
  );
  expect((await linkStyle(component, "outside", "::after")).content).toBe("none");
});

test("hover thickens the rule; Tab shows the focus ring (#109)", async ({ mount, page }) => {
  const component = await mount(<Markdown value={LINKS} />);
  await component.getByRole("link", { name: "inside" }).hover();
  expect((await linkStyle(component, "inside")).thickness).toBe("2px");
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  const outline = await component
    .getByRole("link", { name: "inside" })
    .evaluate((a) => getComputedStyle(a).outlineStyle);
  expect(outline).toBe("solid");
});
