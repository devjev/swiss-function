import { expect, test } from "@playwright/experimental-ct-react";
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
