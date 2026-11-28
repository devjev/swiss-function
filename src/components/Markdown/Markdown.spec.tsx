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

test('variant="terminal": one monospace size, marks kept, tables ruled, the last block flush', async ({
  mount,
}) => {
  const c = await mount(
    <Markdown
      variant="terminal"
      value={
        "# Title\n\n## Section\n\n#### Deep\n\nText `code`.\n\n| a | b |\n| --- | ---: |\n| 1 | 2 |\n\n```js\nlet a;\n```"
      }
    />,
  );
  const m = await c.evaluate((el) => {
    const cs = (sel: string, pseudo?: string) =>
      getComputedStyle(el.querySelector(sel) as Element, pseudo);
    const px = (v: string) => Number.parseFloat(v);
    return {
      sizes: ["h1", "h2", "h4", "p", "td", "pre code"].map((s) => cs(s).fontSize),
      families: ["h1", "p", "td"].map((s) => cs(s).fontFamily.includes("monospace")),
      h4: cs("h4", "::before").content,
      h2: cs("h2", "::before").content,
      cellRule: cs("td").borderTopWidth,
      headBg: cs("th").backgroundColor,
      rowHeight: (el.querySelector("tbody tr") as HTMLElement).getBoundingClientRect().height,
      unit: px(cs("p").lineHeight),
      lang: (el.querySelector("pre") as HTMLElement).dataset.lang,
      lastMargin: cs("pre").marginBottom,
      // A paragraph is one line of the grid, with one blank line after it.
      pHeight: (el.querySelector("p") as HTMLElement).getBoundingClientRect().height,
      pGap: px(cs("p").marginBottom),
    };
  });
  expect(new Set(m.sizes).size).toBe(1);
  expect(m.families).toEqual([true, true, true]);
  expect(m.h4).toBe('"#### "');
  expect(m.h2).toBe("none");
  expect(m.cellRule).toBe("1px");
  expect(m.headBg).toBe("rgba(0, 0, 0, 0)");
  expect(m.rowHeight).toBeCloseTo(m.unit, 0);
  expect(m.lang).toBe("js");
  expect(m.lastMargin).toBe("0px");
  expect(m.pHeight).toBeCloseTo(m.unit, 0);
  expect(m.pGap).toBeCloseTo(m.unit, 0);
});

test('variant="prose" (the default) is unchanged: sized headings, boxed code', async ({
  mount,
}) => {
  const c = await mount(<Markdown value={"# Title\n\nText `code`.\n\n```js\nlet a;\n```"} />);
  const m = await c.evaluate((el) => {
    const cs = (sel: string) => getComputedStyle(el.querySelector(sel) as Element);
    return {
      bigger: Number.parseFloat(cs("h1").fontSize) > Number.parseFloat(cs("p").fontSize),
      preBorder: cs("pre").borderTopWidth,
      fence: getComputedStyle(el.querySelector("pre") as Element, "::before").content,
      lang: (el.querySelector("pre") as HTMLElement).dataset.lang,
    };
  });
  expect(m).toEqual({ bigger: true, preBorder: "1px", fence: "none", lang: undefined });
});

test('variant="terminal": a table wider than the text scrolls inside itself', async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 200 }}>
      <Markdown
        variant="terminal"
        value={"| a long heading | another heading | a third |\n| --- | --- | --- |\n| 1 | 2 | 3 |"}
      />
    </div>,
  );
  const fit = await c.evaluate((el) => {
    const table = el.querySelector("table") as HTMLElement;
    return {
      inside: table.getBoundingClientRect().width <= 200.5,
      scrolls: table.scrollWidth > table.clientWidth,
      outer: el.scrollWidth <= el.clientWidth,
    };
  });
  expect(fit).toEqual({ inside: true, scrolls: true, outer: true });
});

test('variant="terminal" highlights a known language as the editor\'s primary theme does', async ({
  mount,
}) => {
  const c = await mount(
    <Markdown
      variant="terminal"
      value={
        '```ts\nexport function f(x: string) {\n  return "s"; // note\n}\n```\n\n```\nplain output\n```'
      }
    />,
  );
  // The highlighter loads on demand: plain code first, then highlighted.
  await expect(c.locator('[data-token="keyword"]').first()).toBeVisible();
  const m = await c.evaluate((el) => {
    const [ts, plain] = [...el.querySelectorAll("pre")] as HTMLElement[];
    const tok = (kind: string) => ts?.querySelector(`[data-token="${kind}"]`) as HTMLElement;
    const probe = document.createElement("span");
    probe.style.color = "var(--sf-color-code-accent)";
    el.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return {
      text: ts?.textContent,
      keyword: getComputedStyle(tok("keyword")).color === accent,
      definitionWeight: Number(getComputedStyle(tok("definition")).fontWeight),
      stringStyle: getComputedStyle(tok("string")).fontStyle,
      comment: tok("comment").textContent,
      plainTokens: plain?.querySelectorAll("[data-token]").length,
      fence: getComputedStyle(ts as Element, "::before").display,
    };
  });
  // The code reads exactly as written; only its look changes.
  expect(m.text).toBe('export function f(x: string) {\n  return "s"; // note\n}');
  expect(m.keyword).toBe(true);
  expect(m.definitionWeight).toBeGreaterThanOrEqual(600);
  expect(m.stringStyle).toBe("italic");
  expect(m.comment).toBe("// note");
  // A fence with no language stays plain.
  expect(m.plainTokens).toBe(0);
  // The terminal reading keeps its fences unless the token says otherwise.
  expect(m.fence).toBe("block");
});

test("--sf-prose-code-fence: none drops the fence lines and keeps the code's indent", async ({
  mount,
}) => {
  const c = await mount(
    <div style={{ "--sf-prose-code-fence": "none" } as React.CSSProperties}>
      <Markdown variant="terminal" value={"Before.\n\n```js\nlet a = 1;\n```"} />
    </div>,
  );
  const m = await c.evaluate((el) => {
    const pre = el.querySelector("pre") as HTMLElement;
    const p = el.querySelector("p") as HTMLElement;
    const line = Number.parseFloat(getComputedStyle(pre).lineHeight);
    return {
      before: getComputedStyle(pre, "::before").display,
      after: getComputedStyle(pre, "::after").display,
      lines: Math.round(pre.getBoundingClientRect().height / line),
      indented:
        (pre.querySelector("code") as HTMLElement).getBoundingClientRect().left >
        p.getBoundingClientRect().left,
    };
  });
  expect(m).toEqual({ before: "none", after: "none", lines: 1, indented: true });
});

test("the prose reading does not highlight", async ({ mount }) => {
  const c = await mount(<Markdown value={"```ts\nconst a = 1;\n```"} />);
  expect(await c.locator("[data-token]").count()).toBe(0);
});
