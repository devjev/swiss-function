import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { DEFAULT_UNIT_PX as U } from "../../lib/useCssPx";
import { Explorer } from "./Explorer";
import { ColumnShrinkHarness, ExplorerHarness } from "./Explorer.harness";

test("renders headers and root rows; folders show chevron, files don't", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  await expect(c.getByText("Name")).toBeVisible();
  await expect(c.getByText("Size")).toBeVisible();
  await expect(c.getByText("Kind")).toBeVisible();
  await expect(c.getByText("README.md")).toBeVisible();
  // src is a folder → expand chevron present; README.md is a file → no chevron
  const srcRow = c.locator('[data-row-id="src"]');
  await expect(srcRow.locator("button[aria-expanded]")).toHaveCount(1);
  const readmeRow = c.locator('[data-row-id="README.md"]');
  await expect(readmeRow.locator("button[aria-expanded]")).toHaveCount(0);
});

test("showHeader=false hides the header row", async ({ mount }) => {
  const c = await mount(<ExplorerHarness showHeader={false} />);
  await expect(c.getByText("Name")).toHaveCount(0);
  await expect(c.getByText("Size")).toHaveCount(0);
  // Body rows still render.
  await expect(c.locator('[data-row-id="README.md"]')).toBeVisible();
});

test("rows show one indent guide per ancestor depth", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  // src is at depth 0 → no guides.
  await expect(c.locator('[data-row-id="src"] [data-indent-guide]')).toHaveCount(0);
  // src/index.ts is at depth 1 → 1 guide.
  await expect(c.locator('[data-row-id="src/index.ts"] [data-indent-guide]')).toHaveCount(1);
  // src/components/Box.tsx is at depth 2 → 2 guides.
  await expect(c.locator('[data-row-id="src/components/Box.tsx"] [data-indent-guide]')).toHaveCount(
    2,
  );
});

test("clicking chevron toggles expansion", async ({ mount }) => {
  const c = await mount(<ExplorerHarness expanded={[]} />);
  // Children should be hidden initially.
  await expect(c.locator('[data-row-id="src/index.ts"]')).toHaveCount(0);
  await c.locator('[data-row-id="src"] button[aria-expanded]').click();
  await expect(c.locator('[data-row-id="src/index.ts"]')).toBeVisible();
});

test("click row selects it", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  const row = c.locator('[data-row-id="README.md"]');
  await row.click();
  await expect(row).toHaveAttribute("data-selected", "true");
});

test("Cmd-click toggles second row into the selection", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  await c.locator('[data-row-id="README.md"]').click();
  await c.locator('[data-row-id="package.json"]').click({ modifiers: ["Meta"] });
  await expect(c.locator('[data-row-id="README.md"]')).toHaveAttribute("data-selected", "true");
  await expect(c.locator('[data-row-id="package.json"]')).toHaveAttribute("data-selected", "true");
});

test("Shift-click selects range across visible rows", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  await c.locator('[data-row-id="src"]').click();
  await c.locator('[data-row-id="package.json"]').click({ modifiers: ["Shift"] });
  // All rows between src and package.json (inclusive) should be selected.
  for (const id of ["src", "src/index.ts", "src/components", "README.md", "package.json"]) {
    await expect(c.locator(`[data-row-id="${id}"]`)).toHaveAttribute("data-selected", "true");
  }
});

test("F2 on focused row starts rename (editable); Enter commits via onRename", async ({
  mount,
}) => {
  const c = await mount(<ExplorerHarness editable />);
  await c.locator('[data-row-id="README.md"]').click();
  await c.locator('[data-row-id="README.md"]').press("F2");
  const input = c.locator('[data-row-id="README.md"] input');
  await expect(input).toBeVisible();
  await input.fill("RENAMED.md");
  await input.press("Enter");
  await expect(c.getByTestId("last-op")).toHaveText("rename:README.md:RENAMED.md");
});

test("Escape during rename cancels with no onRename call", async ({ mount }) => {
  const c = await mount(<ExplorerHarness editable />);
  await c.locator('[data-row-id="README.md"]').click();
  await c.locator('[data-row-id="README.md"]').press("F2");
  const input = c.locator('[data-row-id="README.md"] input');
  await input.fill("garbage");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(c.getByTestId("last-op")).toHaveText("");
});

test("double-click name enters rename mode", async ({ mount }) => {
  const c = await mount(<ExplorerHarness editable />);
  await c.locator('[data-row-id="README.md"]').dblclick();
  await expect(c.locator('[data-row-id="README.md"] input')).toBeVisible();
});

test("editable=false: F2 does nothing, no rename mode", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  await c.locator('[data-row-id="README.md"]').click();
  await c.locator('[data-row-id="README.md"]').press("F2");
  await expect(c.locator('[data-row-id="README.md"] input')).toHaveCount(0);
});

test("Delete fires onDelete with selected ids", async ({ mount }) => {
  const c = await mount(<ExplorerHarness editable />);
  await c.locator('[data-row-id="README.md"]').click();
  await c.locator('[data-row-id="README.md"]').press("Delete");
  await expect(c.getByTestId("last-op")).toHaveText("delete:README.md");
});

test("ArrowRight on collapsed folder expands it", async ({ mount }) => {
  const c = await mount(<ExplorerHarness expanded={[]} />);
  await c.locator('[data-row-id="src"]').click();
  await c.locator('[data-row-id="src"]').press("ArrowRight");
  await expect(c.locator('[data-row-id="src/index.ts"]')).toBeVisible();
});

test("ArrowLeft on expanded folder collapses it", async ({ mount }) => {
  const c = await mount(<ExplorerHarness expanded={["src"]} />);
  await c.locator('[data-row-id="src"]').click();
  await c.locator('[data-row-id="src"]').press("ArrowLeft");
  await expect(c.locator('[data-row-id="src/index.ts"]')).toHaveCount(0);
});

test("right-click on a row opens context menu with New/Rename/Delete (editable)", async ({
  mount,
  page,
}) => {
  const c = await mount(<ExplorerHarness editable />);
  await c.locator('[data-row-id="README.md"]').click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "New file" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
});

test("editable=false: right-click does NOT open context menu", async ({ mount, page }) => {
  const c = await mount(<ExplorerHarness />);
  await c.locator('[data-row-id="README.md"]').click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "New file" })).toHaveCount(0);
});

test("context menu New file fires onAdd with target's parent", async ({ mount, page }) => {
  const c = await mount(<ExplorerHarness editable />);
  // Right-click on README.md → parent is root (null)
  await c.locator('[data-row-id="README.md"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "New file" }).click();
  await expect(c.getByTestId("last-op")).toHaveText("add:root:file");
});

// --- Row drag & drop (editable) ---------------------------------------------

test("dragging over a folder's middle shows the drop-into indicator and commits the move", async ({
  mount,
  page,
}) => {
  const c = await mount(<ExplorerHarness editable />);
  const source = c.locator('[data-row-id="README.md"]');
  const target = c.locator('[data-row-id="src/components"]');
  const src = (await source.boundingBox())!;
  const tgt = (await target.boundingBox())!;
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  // Exceed the 4px sensor activation distance before aiming at the target.
  await page.mouse.move(src.x + src.width / 2 + 10, src.y + src.height / 2, { steps: 2 });
  // Vertical middle of a folder row → "into" zone on exactly that row.
  await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + tgt.height / 2, { steps: 8 });
  await expect(target).toHaveAttribute("data-drop-into", "true");
  await expect(c.locator("[data-drop-before]")).toHaveCount(0);
  await page.mouse.up();
  await expect(c.getByTestId("last-op")).toHaveText("move:README.md:src/components:end");
});

test("dragging over a row's top quarter shows the drop-before indicator on that row", async ({
  mount,
  page,
}) => {
  const c = await mount(<ExplorerHarness editable />);
  const source = c.locator('[data-row-id="package.json"]');
  const target = c.locator('[data-row-id="README.md"]');
  const src = (await source.boundingBox())!;
  const tgt = (await target.boundingBox())!;
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2 + 10, src.y + src.height / 2, { steps: 2 });
  // Top quarter of the target row → "before" zone on exactly that row.
  await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + 3, { steps: 8 });
  await expect(target).toHaveAttribute("data-drop-before", "true");
  await expect(c.locator("[data-drop-into]")).toHaveCount(0);
  await page.mouse.up();
  await expect(c.getByTestId("last-op")).toHaveText("move:package.json:root:README.md");
});

// --- Data-grid features (sort / filter / resize / empty) -------------------

test("empty tree shows the empty state", async ({ mount }) => {
  const c = await mount(<ExplorerHarness emptyData />);
  await expect(c.getByText("No data")).toBeVisible();
  await expect(c.locator('[data-row-id="README.md"]')).toHaveCount(0);
});

test("clicking a sortable header sorts sibling groups, folders first", async ({ mount }) => {
  const c = await mount(<ExplorerHarness grid expanded={["src"]} />);
  // Seed order inside src: index.ts (file) then components (folder).
  const before = await c.locator('[data-row-id="src/index.ts"]').boundingBox();
  const beforeFolder = await c.locator('[data-row-id="src/components"]').boundingBox();
  expect(before!.y).toBeLessThan(beforeFolder!.y);
  // Sort by Name asc → folders first, so components moves above index.ts.
  await c.getByText("Name", { exact: true }).click();
  const after = await c.locator('[data-row-id="src/index.ts"]').boundingBox();
  const afterFolder = await c.locator('[data-row-id="src/components"]').boundingBox();
  expect(afterFolder!.y).toBeLessThan(after!.y);
});

test("sort cycles asc → desc → none, showing/removing the arrow", async ({ mount }) => {
  const c = await mount(<ExplorerHarness grid />);
  const name = c.getByText("Name", { exact: true });
  await expect(name.locator("xpath=..").getByText("↑")).toHaveCount(0);
  await name.click();
  await expect(name.locator("xpath=..").getByText("↑")).toBeVisible();
  await name.click();
  await expect(name.locator("xpath=..").getByText("↓")).toBeVisible();
  await name.click();
  await expect(name.locator("xpath=..").getByText("↓")).toHaveCount(0);
});

test("keyboard resize steps 8px per arrow, 24px with Shift (shared constants)", async ({
  mount,
}) => {
  const c = await mount(<ExplorerHarness grid />);
  const nameCell = c.getByText("Name", { exact: true }).locator("xpath=..");
  const handle = c.getByRole("separator", { name: "Resize Name" });
  await handle.focus();
  const before = (await nameCell.boundingBox())!.width;
  await handle.press("ArrowRight");
  const afterPlain = (await nameCell.boundingBox())!.width;
  expect(Math.round(afterPlain - before)).toBe(8);
  await handle.press("Shift+ArrowRight");
  const afterCoarse = (await nameCell.boundingBox())!.width;
  expect(Math.round(afterCoarse - afterPlain)).toBe(24);
});

test("resize handle exposes ARIA value semantics; double-click auto-fits the column", async ({
  mount,
}) => {
  const c = await mount(<ExplorerHarness grid />);
  const handle = c.getByRole("separator", { name: "Resize Name" });
  // The minimum is the measured header floor (issue #102), at least the 48px
  // default; no override yet, so valuenow is absent.
  const valuemin = Number(await handle.getAttribute("aria-valuemin"));
  expect(valuemin).toBeGreaterThanOrEqual(48);
  await expect(handle).not.toHaveAttribute("aria-valuenow", /.*/);
  await handle.dblclick();
  // Auto-fit writes a px override, which then surfaces as aria-valuenow.
  const valuenow = await handle.getAttribute("aria-valuenow");
  expect(Number(valuenow)).toBeGreaterThanOrEqual(valuemin);
  const nameCell = c.getByText("Name", { exact: true }).locator("xpath=..");
  const width = (await nameCell.boundingBox())!.width;
  expect(Math.round(width)).toBe(Number(valuenow));
});

test("a header's title and chrome set the resize floor (issue #102)", async ({ mount, page }) => {
  const c = await mount(<ExplorerHarness grid />);
  const nameCell = c.getByText("Name", { exact: true }).locator("xpath=..");
  const handle = c.getByRole("separator", { name: "Resize Name" });
  const valuemin = Number(await handle.getAttribute("aria-valuemin"));
  // Sortable + filterable: the title, the reserved arrow and the funnel all
  // need room, well past the 48px default.
  expect(valuemin).toBeGreaterThan(80);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 400, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const width = (await nameCell.boundingBox())!.width;
  expect(Math.abs(width - valuemin)).toBeLessThanOrEqual(1);
  // The title is whole (no ellipsis) and the funnel is inside the key.
  const whole = await nameCell.evaluate((el) => {
    const label = el.querySelector("span") as HTMLElement;
    return label.scrollWidth <= label.clientWidth + 1;
  });
  expect(whole).toBe(true);
  const funnel = (await c.getByRole("button", { name: "Filter Name", exact: true }).boundingBox())!;
  const key = (await nameCell.boundingBox())!;
  expect(funnel.x + funnel.width).toBeLessThanOrEqual(key.x + key.width + 1);
});

test("filter funnel prunes to matches and keeps the ancestor path", async ({ mount, page }) => {
  const c = await mount(<ExplorerHarness grid expanded={["src", "src/components"]} />);
  // Filter the Kind column down to "tsx" — only Box.tsx / Grid.tsx qualify, so
  // src → components is retained (auto-expanded) and README.md is pruned.
  await c.getByRole("button", { name: "Filter Kind", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select all" }).click(); // clear
  await page.getByRole("checkbox", { name: "tsx" }).click();
  await expect(c.locator('[data-row-id="src/components/Box.tsx"]')).toBeVisible();
  await expect(c.locator('[data-row-id="README.md"]')).toHaveCount(0);
  await expect(c.locator('[data-row-id="src/index.ts"]')).toHaveCount(0);
});

// --- columnShrink: columns that hold their width ---------------------------

/** The px widths of the header cells, in column order. */
const headerWidths = (c: Locator) =>
  c
    .locator('[class*="headerCell"]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
/** Scroll geometry of the tree's viewport. */
const scrollBox = (c: Locator) =>
  c
    .getByRole("treegrid")
    .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, left: el.scrollLeft }));
const sideFade = (c: Locator) => c.locator('[class*="sideFade"]');
/** Left edges of the header cells and of the first row's cells. */
const columnEdges = (c: Locator) =>
  c.evaluate((root) => {
    const lefts = (els: Element[]) => els.map((el) => Math.round(el.getBoundingClientRect().left));
    const row = root.querySelector("[data-row-id]");
    return {
      header: lefts([...root.querySelectorAll('[class*="headerCell"]')]),
      body: lefts(row ? [...row.children] : []),
    };
  });

test('columnShrink="hold" keeps every column at its preferred width and the tree scrolls', async ({
  mount,
}) => {
  // 180 + 100 + 100 + 140 = 520px of columns in a 320px container.
  const c = await mount(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const widths = await headerWidths(c);
  expect(widths.map(Math.round)).toEqual([180, 100, 100, 140]);
  const box = await scrollBox(c);
  expect(box.scroll).toBeGreaterThan(box.client);
  expect(box.scroll).toBe(520);
});

test('columnShrink="squeeze" shrinks the columns to fit, as "auto" does for a mouse', async ({
  mount,
}) => {
  const c = await mount(<ColumnShrinkHarness width={320} />);
  const header = c.locator('[class*="headerRow"]');
  const template = () => header.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  const auto = await template();
  const widths = await headerWidths(c);
  // Every column under its preferred width, and the four fit: no scroll.
  [180, 100, 100, 140].forEach((preferred, i) => {
    expect(widths[i]).toBeLessThan(preferred - 1);
  });
  const box = await scrollBox(c);
  expect(box.scroll).toBe(box.client);

  await c.update(<ColumnShrinkHarness width={320} columnShrink="squeeze" />);
  expect(await template()).toBe(auto);

  await c.update(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  await expect.poll(template).toBe("180px 100px 100px 140px");
});

test("the header stays over its columns when the tree scrolls sideways", async ({
  mount,
  page,
}) => {
  const c = await mount(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const before = await columnEdges(c);
  expect(before.header).toEqual(before.body);
  await c.getByRole("treegrid").evaluate((el) => {
    el.scrollLeft = 150;
  });
  await page.waitForTimeout(50);
  const after = await columnEdges(c);
  expect(after.header).toEqual(after.body);
  expect((before.header[0] ?? 0) - (after.header[0] ?? 0)).toBe(150);
});

test("a sideways scroll on the headings scrolls the tree with them", async ({ mount, page }) => {
  const c = await mount(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const heading = c.locator('[class*="headerCell"]').first();
  const box = await heading.boundingBox();
  if (!box) throw new Error("no heading");
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await scrollBox(c)).left).toBe(120);
  const edges = await columnEdges(c);
  expect(edges.header).toEqual(edges.body);
});

test("a tree that fits gives its header nothing to scroll", async ({ mount }) => {
  const c = await mount(<ColumnShrinkHarness width={700} columnShrink="hold" />);
  const header = c.locator('[class*="headerScroll"]');
  const range = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(range).toBe(0);
  // The header's range is the viewport's, so the two cannot drift apart: also
  // when they scroll (the last handle's overhang is cut at the row's edge).
  await c.update(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const ranges = () =>
    c.locator("[data-explorer-root]").evaluate((root) => {
      const hs = root.querySelector('[class*="headerScroll"]') as HTMLElement;
      const vp = root.querySelector('[role="treegrid"]') as HTMLElement;
      return [hs.scrollWidth - hs.clientWidth, vp.scrollWidth - vp.clientWidth];
    });
  // 520px of columns in a 318px scrollport, for the header and for the rows.
  await expect.poll(ranges).toEqual([202, 202]);
  await c.update(<ColumnShrinkHarness width={700} columnShrink="hold" />);
  const box = await scrollBox(c);
  expect(box.scroll).toBe(box.client);
  await expect(sideFade(c)).toHaveCSS("display", "none");
});

test("a reorderable header that fits has nothing to scroll either", async ({ mount }) => {
  // Drag-to-reorder mounts dnd-kit's own elements after the last header cell.
  const c = await mount(<ExplorerHarness grid />);
  const range = await c
    .locator('[class*="headerScroll"]')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(range).toBe(0);
});

test("the width readout shows whole under the header while a column is resized", async ({
  mount,
  page,
}) => {
  const c = await mount(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const handle = c.getByRole("separator").first();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  const readout = c.locator("[data-width-readout]");
  await expect(readout).toBeVisible();
  // Inside the header scroller's box (which reaches below the row), so the
  // scroller does not clip it, and the scroller did not gain a vertical scroll.
  const fit = await c.locator('[class*="headerScroll"]').evaluate((el) => {
    const chip = el.querySelector("[data-width-readout]") as HTMLElement;
    const a = el.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    return { inside: b.bottom <= a.bottom + 0.5, scrollTop: el.scrollTop };
  });
  expect(fit.inside).toBe(true);
  expect(fit.scrollTop).toBe(0);
});

test("the rows under the header's scroller still take a click", async ({ mount }) => {
  // The scroller reaches 1.5 units below the header row, over the first rows.
  const c = await mount(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const first = c.locator('[data-row-id="src"]');
  await first.click({ position: { x: 60, y: 4 } });
  await expect(first).toHaveAttribute("data-focused", "true");
});

test('"auto" follows the --sf-table-column-hold token', async ({ mount }) => {
  const c = await mount(<ColumnShrinkHarness width={320} tokenHold={1} />);
  expect((await headerWidths(c)).map(Math.round)).toEqual([180, 100, 100, 140]);
  await c.update(<ColumnShrinkHarness width={320} tokenHold={1} columnShrink="squeeze" />);
  await expect.poll(async () => (await headerWidths(c))[0]).toBeLessThan(179);
});

test("a stretching tree column of a plain tree holds at its own width", async ({ mount }) => {
  // Not resizable: a name column with no width (1fr) beside 340px of fixed ones.
  const c = await mount(<ColumnShrinkHarness width={320} resizable={false} />);
  const squeezed = await headerWidths(c);
  expect(squeezed[0]).toBeLessThan(119);
  await c.update(<ColumnShrinkHarness width={320} resizable={false} columnShrink="hold" />);
  // The first column carries the indentation and the name: 200px.
  await expect.poll(async () => Math.round((await headerWidths(c))[0] ?? 0)).toBe(200);
  const box = await scrollBox(c);
  expect(box.scroll).toBe(540);
  // With room it still fills the slack.
  await c.update(<ColumnShrinkHarness width={700} resizable={false} columnShrink="hold" />);
  await expect.poll(async () => (await headerWidths(c))[0]).toBeGreaterThan(300);
});

test("the side fade shows where the columns hold, only while there is more to scroll", async ({
  mount,
}) => {
  const c = await mount(<ColumnShrinkHarness width={320} columnShrink="hold" />);
  const fade = sideFade(c);
  await expect(fade).toHaveCSS("display", "block");
  await expect(fade).toHaveCSS("opacity", "1");
  // Over the header and the rows, at the wrapper's trailing edge.
  const edges = await c.locator("[data-explorer-root]").evaluate((root) => {
    const f = root.querySelector('[class*="sideFade"]') as HTMLElement;
    const w = root.getBoundingClientRect();
    const r = f.getBoundingClientRect();
    return {
      right: w.right - root.clientLeft - r.right,
      top: r.top - w.top - root.clientTop,
      height: r.height - root.clientHeight,
    };
  });
  expect(Math.abs(edges.right)).toBeLessThan(1);
  expect(Math.abs(edges.top)).toBeLessThan(1);
  expect(Math.abs(edges.height)).toBeLessThan(1);

  const vp = c.getByRole("treegrid");
  await vp.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(fade).toHaveCSS("display", "none");
  await vp.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await expect(fade).toHaveCSS("display", "block");
});

test("the side fade is off where the columns squeeze; an explicit edgeFade wins both ways", async ({
  mount,
}) => {
  // 160px: the four columns at their minimums no longer fit, so the squeezed
  // tree scrolls too, and still shows no fade by default.
  const c = await mount(<ColumnShrinkHarness width={160} columnShrink="squeeze" />);
  const box = await scrollBox(c);
  expect(box.scroll).toBeGreaterThan(box.client);
  await expect(sideFade(c)).toHaveCSS("opacity", "0");

  await c.update(<ColumnShrinkHarness width={160} columnShrink="squeeze" edgeFade />);
  await expect(sideFade(c)).toHaveCSS("opacity", "1");
  await expect(sideFade(c)).toHaveCSS("display", "block");

  await c.update(<ColumnShrinkHarness width={160} columnShrink="hold" edgeFade={false} />);
  await expect(sideFade(c)).toHaveCount(0);
});

// --- Issue #28: spreadsheet grid lines ---------------------------------------

test("gridLines draws per-cell right+bottom edges (spreadsheet look)", async ({ mount }) => {
  const c = await mount(<ExplorerHarness gridLines />);
  const cell = c.locator('[data-row-id="README.md"] > div').first();
  const shadow = await cell.evaluate((el) => getComputedStyle(el).boxShadow);
  // Two inset hairlines: right and bottom (DataTable's per-cell edge model).
  expect(shadow).toContain("inset");
  expect(shadow.split("inset")).toHaveLength(3);
});

test("without gridLines the body cells stay borderless", async ({ mount }) => {
  const c = await mount(<ExplorerHarness />);
  const cell = c.locator('[data-row-id="README.md"] > div').first();
  const shadow = await cell.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toBe("none");
});

test("body columns stay aligned with the header when a scrollbar reserves width (issue #70)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ inlineSize: 360, blockSize: 160 }}>
      <ExplorerHarness />
    </div>,
  );
  // Headless Chromium uses overlay scrollbars (no reserved width), so force a
  // gutter to reproduce the width reduction a classic scrollbar causes. Without
  // the header-width mirror the body shrinks to the reduced width and its
  // rightmost column drifts left of the header's.
  await page.addStyleTag({
    content: '[class*="viewport"]{ scrollbar-gutter: stable !important; }',
  });
  await page.waitForTimeout(100);
  const drift = await c.evaluate((root) => {
    const hcells = [...root.querySelectorAll('[class*="headerCell"]')];
    const rows = [...root.querySelectorAll('[role="row"]')];
    const bodyRow = rows.find(
      (r) => !r.querySelector('[class*="headerCell"]') && r.children.length > 1,
    );
    if (!bodyRow || !hcells.length) return Number.NaN;
    const lastH = hcells[hcells.length - 1] as HTMLElement;
    const lastB = bodyRow.children[bodyRow.children.length - 1] as HTMLElement;
    return Math.round(lastB.getBoundingClientRect().right - lastH.getBoundingClientRect().right);
  });
  expect(Math.abs(drift)).toBeLessThanOrEqual(1);
});

test("cellPadding and cellFontSize scale header + body cells", async ({ mount }) => {
  const nodes = [{ id: "a", name: "Alpha" }];
  const columns = [{ id: "name", header: "Name" }];
  const c = await mount(
    <div>
      <div data-testid="xs" style={{ blockSize: 120 }}>
        <Explorer nodes={nodes} columns={columns} cellPadding="xs" cellFontSize="xs" />
      </div>
      <div data-testid="lg" style={{ blockSize: 120 }}>
        <Explorer nodes={nodes} columns={columns} cellPadding="lg" cellFontSize="lg" />
      </div>
    </div>,
  );
  const read = (id: string) =>
    c
      .getByTestId(id)
      .locator('[class*="headerCell"]')
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { pad: Number.parseFloat(cs.paddingLeft), font: Number.parseFloat(cs.fontSize) };
      });
  const xs = await read("xs");
  const lg = await read("lg");
  expect(xs.pad).toBe(U / 4);
  expect(lg.pad).toBe((U * 3) / 4);
  expect(xs.font).toBeLessThan(lg.font);
});

test("the handle takes the splitter keys and shows the readout (issue #102 parity)", async ({
  mount,
  page,
}) => {
  const c = await mount(<ExplorerHarness grid />);
  const nameCell = c.getByText("Name", { exact: true }).locator("xpath=..");
  const handle = c.getByRole("separator", { name: "Resize Name" });
  await expect(handle).toHaveAttribute("aria-valuemax", "4096");
  const min = Number(await handle.getAttribute("aria-valuemin"));
  const rest = (await nameCell.boundingBox())!.width;
  await handle.focus();
  await handle.press("Home");
  expect(Math.abs((await nameCell.boundingBox())!.width - min)).toBeLessThanOrEqual(1);
  await expect(handle).toHaveAttribute("aria-valuetext", /minimum$/);
  await expect(handle).toHaveAttribute("data-at-floor");
  // The readout says min, in mono, under the handle.
  await expect(nameCell.locator("[data-width-readout]")).toHaveText(/px · min$/);
  await handle.press("PageUp");
  expect(Math.abs((await nameCell.boundingBox())!.width - (min + 96))).toBeLessThanOrEqual(1);
  await expect(handle).not.toHaveAttribute("data-at-floor");
  await handle.press("Escape");
  expect(Math.abs((await nameCell.boundingBox())!.width - rest)).toBeLessThanOrEqual(1);
  // A drag past the floor locks the cursor on the wrapper and marks the clamp.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 400, box.y + box.height / 2, { steps: 6 });
  const root = c.locator("[data-explorer-root]");
  await expect(root).toHaveAttribute("data-resizing");
  await expect(root).toHaveAttribute("data-at-floor");
  await page.mouse.up();
  await expect(root).not.toHaveAttribute("data-resizing");
});

// --- Touch --------------------------------------------------------------------

test.describe("with a finger", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });

  /** Raw touch events through CDP: Playwright's `tap` cannot hold or move. */
  const finger = async (page: import("@playwright/test").Page) => {
    const cdp = await page.context().newCDPSession(page);
    return (type: "touchStart" | "touchMove" | "touchEnd", point?: { x: number; y: number }) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [],
      });
  };
  const centre = async (row: import("@playwright/test").Locator) => {
    const box = await row.boundingBox();
    if (!box) throw new Error("row is not laid out");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test("the columns hold their width and the tree scrolls sideways, with the fade as the cue", async ({
    mount,
  }) => {
    // No columnShrink: "auto" reads the token, 1 on a coarse pointer.
    const c = await mount(<ColumnShrinkHarness width={320} />);
    expect((await headerWidths(c)).map(Math.round)).toEqual([180, 100, 100, 140]);
    const box = await scrollBox(c);
    expect(box.scroll).toBeGreaterThan(box.client);
    await expect(sideFade(c)).toHaveCSS("display", "block");
    await expect(sideFade(c)).toHaveCSS("opacity", "1");

    // "squeeze" keeps the columns fitting on touch.
    await c.update(<ColumnShrinkHarness width={320} columnShrink="squeeze" />);
    await expect.poll(async () => (await headerWidths(c))[0]).toBeLessThan(179);
    await expect(sideFade(c)).toHaveCSS("opacity", "0");
  });

  test("a draggable row still lets a finger scroll: it does not give up touch panning", async ({
    mount,
  }) => {
    const c = await mount(<ExplorerHarness editable />);
    const row = c.locator('[data-row-id="README.md"]');
    await expect(row).toHaveAttribute("data-draggable", "true");
    expect(await row.evaluate((el) => getComputedStyle(el).touchAction)).toBe("auto");
  });

  test("a long press opens the context menu (iOS fires no contextmenu event)", async ({
    mount,
    page,
  }) => {
    const c = await mount(<ExplorerHarness editable />);
    const touch = await finger(page);
    await touch("touchStart", await centre(c.locator('[data-row-id="README.md"]')));
    await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();
    await touch("touchEnd");
  });

  test("a finger that rests, then moves, drags the row; one that moves at once does not", async ({
    mount,
    page,
  }) => {
    const c = await mount(<ExplorerHarness editable />);
    const touch = await finger(page);
    const from = await centre(c.locator('[data-row-id="README.md"]'));
    const to = await centre(c.locator('[data-row-id="src"]'));

    // At once: a swipe, which belongs to scrolling. Nothing is picked up.
    await touch("touchStart", from);
    await touch("touchMove", { x: from.x, y: from.y - 30 });
    await expect(c.locator("[data-dragging]")).toHaveCount(0);
    await touch("touchEnd");

    // Rested past the touch sensor's delay: the row follows the finger.
    await touch("touchStart", from);
    await page.waitForTimeout(320);
    for (let step = 1; step <= 6; step++) {
      await touch("touchMove", { x: to.x, y: from.y + ((to.y - from.y) * step) / 6 });
      await page.waitForTimeout(20);
    }
    await expect(c.locator("[data-dragging]")).toHaveCount(1);
    await touch("touchEnd");
    await expect(c.getByTestId("last-op")).toContainText("move:README.md");
  });
});
