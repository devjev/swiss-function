import { expect, test } from "@playwright/experimental-ct-react";
import { Explorer } from "./Explorer";
import { ExplorerHarness } from "./Explorer.harness";

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

test("keyboard resize widens a column (ArrowRight on its separator)", async ({ mount }) => {
  const c = await mount(<ExplorerHarness grid />);
  const nameCell = c.getByText("Name", { exact: true }).locator("xpath=..");
  const before = (await nameCell.boundingBox())!.width;
  const handle = c.getByRole("separator", { name: "Resize Name" });
  await handle.focus();
  for (let i = 0; i < 6; i++) await handle.press("ArrowRight");
  const after = (await nameCell.boundingBox())!.width;
  expect(after).toBeGreaterThan(before);
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
  expect(xs.pad).toBe(6);
  expect(lg.pad).toBe(18);
  expect(xs.font).toBeLessThan(lg.font);
});
