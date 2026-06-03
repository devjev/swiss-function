import { expect, test } from "@playwright/experimental-ct-react";
import { DataTableHarness, GroupsHarness, TreeHarness } from "./DataTable.harness";

const COLUMNS = ["name", "age", "active"];
const DATA = [
  { name: "Alice", age: 30, active: true },
  { name: "Bob", age: 25, active: false },
  { name: "Carol", age: 40, active: true },
];

test("renders header + body cells from data", async ({ mount }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  await expect(component.getByRole("columnheader", { name: "name" })).toBeVisible();
  await expect(component.getByRole("gridcell").filter({ hasText: "Alice" })).toBeVisible();
  await expect(component.getByRole("gridcell").filter({ hasText: "Carol" })).toBeVisible();
});

test("click on a cell marks it active", async ({ mount }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const cell = component.getByRole("gridcell").filter({ hasText: "Bob" });
  await cell.click();
  await expect(cell).toHaveAttribute("data-active", "true");
});

test("arrow key moves active cell", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  await component.getByRole("gridcell").filter({ hasText: "Alice" }).click();
  await page.keyboard.press("ArrowDown");
  await expect(component.getByRole("gridcell").filter({ hasText: "Bob" })).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("Tab moves right and wraps to next row at the end", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const cells = component.getByRole("gridcell");
  // 3 columns × 3 rows = 9 cells. Start at the first cell (row 0, col 0).
  await cells.first().click();
  await page.keyboard.press("Tab");
  await expect(cells.nth(1)).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Tab");
  await expect(cells.nth(2)).toHaveAttribute("data-active", "true");
  // Tab on last column wraps to first column of next row (= cell index 3).
  await page.keyboard.press("Tab");
  await expect(cells.nth(3)).toHaveAttribute("data-active", "true");
  // Shift+Tab from row 1 col 0 wraps back to row 0 col 2.
  await page.keyboard.press("Shift+Tab");
  await expect(cells.nth(2)).toHaveAttribute("data-active", "true");
});

test("shift+arrow extends the range", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  await component.getByRole("gridcell").filter({ hasText: "Alice" }).click();
  await page.keyboard.press("Shift+ArrowDown");
  // 2 cells should now be in-range (Alice and Bob, same column).
  const inRange = await component.locator('[data-in-range="true"]').count();
  expect(inRange).toBe(2);
});

test("double-click on editable cell opens an editor", async ({ mount }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} editable />);
  // Anchor by index — after edit opens, the cell's text content becomes an
  // input value, so filter({ hasText }) stops matching.
  await component.getByRole("gridcell").first().dblclick();
  await expect(component.locator("input").first()).toBeFocused();
});

test("Enter commits the edit and fires onCellChange", async ({ mount, page }) => {
  let lastChanges: unknown = null;
  const component = await mount(
    <DataTableHarness
      data={DATA}
      cols={COLUMNS}
      editable
      onCellChange={(c) => {
        lastChanges = c;
      }}
    />,
  );
  await component.getByRole("gridcell").first().dblclick();
  await page.keyboard.insertText("Z");
  await page.keyboard.press("Enter");
  expect(lastChanges).toEqual([{ rowIndex: 0, columnId: "name", value: "AliceZ" }]);
});

test("editable=false: double-click does NOT open an editor", async ({ mount }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const cell = component.getByRole("gridcell").filter({ hasText: "Alice" });
  await cell.dblclick();
  await expect(cell.locator("input")).toHaveCount(0);
});

// --- Tree rows ---

const TREE = [
  {
    id: "1",
    name: "Engineering",
    value: 100,
    children: [
      { id: "1.1", name: "Alice", value: 50 },
      { id: "1.2", name: "Bob", value: 40 },
    ],
  },
  { id: "2", name: "Sales", value: 80 },
];

test("tree: defaultExpanded={true} mounts all children visible", async ({ mount }) => {
  const component = await mount(<TreeHarness data={TREE} defaultExpanded />);
  await expect(component.getByRole("gridcell").filter({ hasText: "Alice" })).toBeVisible();
  await expect(component.getByRole("gridcell").filter({ hasText: "Bob" })).toBeVisible();
});

test("tree: clicking row chevron toggles expansion", async ({ mount }) => {
  const component = await mount(<TreeHarness data={TREE} defaultExpanded />);
  // Engineering's chevron is in the first row's first cell.
  await component.getByRole("button", { name: "Collapse row" }).first().click();
  await expect(component.getByRole("gridcell").filter({ hasText: "Alice" })).toHaveCount(0);
  await expect(component.getByRole("gridcell").filter({ hasText: "Bob" })).toHaveCount(0);
});

test("tree: collapsing clears the active cell", async ({ mount, page }) => {
  const component = await mount(<TreeHarness data={TREE} defaultExpanded />);
  // Click Alice (a child cell)
  await component.getByRole("gridcell").filter({ hasText: "Alice" }).click();
  await expect(component.locator('[data-active="true"]')).toHaveCount(1);
  // Collapse Engineering
  await component.getByRole("button", { name: "Collapse row" }).first().click();
  // Wait briefly for the effect that clears selection
  await page.waitForTimeout(50);
  await expect(component.locator('[data-active="true"]')).toHaveCount(0);
});

// --- Column groups ---

test("groups: expanded by default — group header spans its leaves", async ({ mount }) => {
  const component = await mount(<GroupsHarness />);
  // 3 leaves under Address; Address header should span 3 columns via grid-column.
  const groupHeader = component.getByRole("columnheader", { name: /Address/ }).first();
  const span = await groupHeader.evaluate((el) => (el as HTMLElement).style.gridColumn);
  expect(span).toContain("span 3");
});

test("groups: clicking the group chevron hides leaves and shows placeholder", async ({ mount }) => {
  const component = await mount(<GroupsHarness />);
  // Initial: Street/City/Zip headers visible
  await expect(component.getByRole("columnheader", { name: "Street" })).toBeVisible();
  await component.getByRole("button", { name: "Collapse group" }).click();
  await expect(component.getByRole("columnheader", { name: "Street" })).toHaveCount(0);
  // Placeholder cell content is "—".
  await expect(component.getByRole("gridcell").filter({ hasText: "—" }).first()).toBeVisible();
});

test("groups: defaultCollapsed mounts collapsed", async ({ mount }) => {
  const component = await mount(<GroupsHarness defaultCollapsed />);
  await expect(component.getByRole("columnheader", { name: "Street" })).toHaveCount(0);
  await expect(component.getByRole("button", { name: "Expand group" })).toBeVisible();
});

test("pagination shows pageSize rows and 'Page 1 of N'", async ({ mount }) => {
  const data = Array.from({ length: 12 }, (_, i) => ({
    name: `r${i}`,
    age: i,
    active: i % 2 === 0,
  }));
  const component = await mount(
    <DataTableHarness data={data} cols={COLUMNS} paginate={{ pageSize: 5 }} />,
  );
  // 5 rows × 3 columns = 15 cells in body.
  const cells = await component.getByRole("gridcell").count();
  expect(cells).toBe(15);
  await expect(component.getByText(/Page 1 of 3/)).toBeVisible();
});
