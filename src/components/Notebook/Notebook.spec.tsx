import { expect, test } from "@playwright/experimental-ct-react";
import { NotebookHarness } from "./Notebook.harness";

test("runs the reactive chain: calc feeds SQL feeds calc", async ({ mount }) => {
  const nb = await mount(<NotebookHarness />);
  await expect(nb.locator("[data-cell-id=p3] code")).toHaveText("2 rows");
  await expect(nb.locator("[data-cell-id=p2] [data-testid=notebook-result-table]")).toHaveAttribute(
    "data-rows",
    "2",
  );
  await expect(nb.locator("[data-cell-id=p0]")).toContainText("hello");
});

test("editing an upstream cell re-runs its dependents (Mod+Enter commit)", async ({ mount, page }) => {
  const nb = await mount(<NotebookHarness />);
  await expect(nb.locator("[data-cell-id=p3] code")).toHaveText("2 rows");
  const editor = nb.locator("[data-cell-id=p1] .cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("15000");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(nb.locator("[data-cell-id=p3] code")).toHaveText("1 rows");
});

test("a failing cell marks itself error and its dependents upstream-error", async ({ mount }) => {
  const nb = await mount(<NotebookHarness doc="errors" />);
  await expect(nb.locator("[data-cell-id=x1]")).toHaveAttribute("data-status", "error");
  await expect(nb.locator("[data-cell-id=x2]")).toHaveAttribute("data-status", "upstream-error");
  await expect(nb.locator("[data-cell-id=x2]")).toContainText('upstream cell "broken" failed');
});

test("cells move with the reorder buttons and the document stays consistent", async ({ mount }) => {
  const nb = await mount(<NotebookHarness />);
  await nb.locator("[data-cell-id=p1]").getByRole("button", { name: "Move cell up" }).click();
  const ids = await nb.locator("[data-cell-id]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-cell-id")),
  );
  expect(ids).toEqual(["p1", "p0", "p2", "p3"]);
  // The graph is untouched by a pure reorder: results still stand.
  await expect(nb.locator("[data-cell-id=p3] code")).toHaveText("2 rows");
});

test("keyboard: arrows move cell focus, Alt+Arrow moves the cell", async ({ mount, page }) => {
  const nb = await mount(<NotebookHarness />);
  await expect(nb.locator("[data-cell-id=p3] code")).toHaveText("2 rows");
  await nb.locator("[data-cell-id=p0]").click();
  await page.keyboard.press("ArrowDown");
  await expect(nb.locator("[data-cell-id=p1]")).toBeFocused();
  await page.keyboard.press("Alt+ArrowDown");
  const ids = await nb.locator("[data-cell-id]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-cell-id")),
  );
  expect(ids).toEqual(["p0", "p2", "p1", "p3"]);
});

test("deleting a referenced cell leaves dependents unresolved", async ({ mount }) => {
  const nb = await mount(<NotebookHarness />);
  await expect(nb.locator("[data-cell-id=p3] code")).toHaveText("2 rows");
  await nb.locator("[data-cell-id=p1]").getByRole("button", { name: "Delete cell" }).click();
  await expect(nb.locator("[data-cell-id=p2]")).toHaveAttribute("data-status", "unresolved");
});
