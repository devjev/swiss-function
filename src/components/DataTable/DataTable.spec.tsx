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

test("click-drag extends the selection range", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const cells = component.getByRole("gridcell");
  // Drag from (row 0, col 0) = nth(0) → (row 1, col 2) = nth(5). Expect the
  // rectangle of 6 cells covering rows 0-1 × cols 0-2 to be in-range.
  const start = await cells.nth(0).boundingBox();
  const end = await cells.nth(5).boundingBox();
  if (!start || !end) throw new Error("missing cell bounding boxes");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
  const inRange = await component.locator('[data-in-range="true"]').count();
  // 2 rows × 3 cols = 6 (the corner active cell is data-active, not data-in-range).
  // Range cells include the active corner via data-in-range too in our impl.
  expect(inRange).toBe(6);
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

async function dragHandle(
  page: import("@playwright/test").Page,
  handle: import("@playwright/test").Locator,
  dx: number,
) {
  const box = await handle.boundingBox();
  if (!box) throw new Error("missing handle bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy, { steps: 8 });
  await page.mouse.up();
}

test("drag a column resize handle grows the column", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const header = component.getByRole("columnheader", { name: "name" });
  const before = await header.boundingBox();
  if (!before) throw new Error("missing header bounding box");
  await dragHandle(page, component.locator('[data-column-id="name"]'), 60);
  const after = await header.boundingBox();
  if (!after) throw new Error("missing header bounding box");
  expect(after.width).toBeGreaterThan(before.width + 40);
});

test("dragging far left clamps the column at its minimum width", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const header = component.getByRole("columnheader", { name: "name" });
  // Drag well past zero; width must stop at the --sf-datatable-col-min floor.
  await dragHandle(page, component.locator('[data-column-id="name"]'), -400);
  const after = await header.boundingBox();
  if (!after) throw new Error("missing header bounding box");
  // --sf-unit is 24px, min is 3 units = 72px. Allow a little slack.
  expect(after.width).toBeGreaterThanOrEqual(70);
  expect(after.width).toBeLessThan(100);
});

test("double-click the handle auto-fits the column to its content", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const header = component.getByRole("columnheader", { name: "name" });
  // First squeeze the column down to its min, then auto-fit should grow it back
  // to fit "Alice"/"Carol"/"name" without being stuck at the floor.
  await dragHandle(page, component.locator('[data-column-id="name"]'), -400);
  const squeezed = await header.boundingBox();
  await component.locator('[data-column-id="name"]').dblclick();
  const fitted = await header.boundingBox();
  if (!squeezed || !fitted) throw new Error("missing header bounding box");
  expect(fitted.width).toBeGreaterThan(squeezed.width);
});

test("arrow keys on a focused handle resize the column", async ({ mount, page }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  const header = component.getByRole("columnheader", { name: "name" });
  const before = await header.boundingBox();
  if (!before) throw new Error("missing header bounding box");
  const handle = component.locator('[data-column-id="name"]');
  await handle.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
  const after = await header.boundingBox();
  if (!after) throw new Error("missing header bounding box");
  expect(after.width).toBeGreaterThan(before.width + 80);
});

test("resizableColumns={false} renders no resize handles", async ({ mount }) => {
  const component = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} resizableColumns={false} />,
  );
  await expect(component.getByRole("columnheader", { name: "name" })).toBeVisible();
  expect(await component.locator("[data-column-id]").count()).toBe(0);
});

test("the last column is the filler and has no resize handle", async ({ mount }) => {
  // COLUMNS = ["name", "age", "active"]; "active" is last → no trailing handle.
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  await expect(component.locator('[data-column-id="active"]')).toHaveCount(0);
  await expect(component.locator('[data-column-id="name"]')).toHaveCount(1);
  await expect(component.locator('[data-column-id="age"]')).toHaveCount(1);
});

test("a locked column carries the data-locked hint on its header and cells", async ({ mount }) => {
  const component = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} lockedCols={["age"]} />,
  );
  // Exactly one header is marked locked, and it's "age".
  const lockedHeaders = component.locator('[role="columnheader"][data-locked]');
  await expect(lockedHeaders).toHaveCount(1);
  await expect(lockedHeaders).toHaveText(/age/);
  // Its body cells are marked too (one per data row).
  expect(await component.locator('[role="gridcell"][data-locked]').count()).toBe(DATA.length);
});

const widthOf = async (c: import("@playwright/test").Locator, id: string) => {
  const b = await c.getByRole("columnheader", { name: id }).boundingBox();
  if (!b) throw new Error(`missing ${id} header`);
  return b.width;
};

test("resizing keeps the total width constant and pushes the neighbour", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <DataTableHarness
      data={DATA}
      cols={COLUMNS}
      widths={{ name: 8, age: 8 }}
      containerWidth={900}
    />,
  );
  const total = async () =>
    (await widthOf(component, "name")) +
    (await widthOf(component, "age")) +
    (await widthOf(component, "active"));
  const totalBefore = await total();
  const nameBefore = await widthOf(component, "name");
  const ageBefore = await widthOf(component, "age");

  await dragHandle(page, component.locator('[data-column-id="name"]'), 60);

  expect(await widthOf(component, "name")).toBeGreaterThan(nameBefore + 40);
  expect(await widthOf(component, "age")).toBeLessThan(ageBefore - 40); // neighbour pushed
  expect(Math.abs((await total()) - totalBefore)).toBeLessThanOrEqual(1); // total unchanged
});

test("the last column gets a leading handle when its neighbour is locked", async ({
  mount,
  page,
}) => {
  // "age" locked → no handle. "active" is the last filler whose neighbour (age)
  // is locked, so it gets its own leading-edge handle and stays resizable; the
  // cascade trades with "name", flowing around the locked "age".
  const component = await mount(
    <DataTableHarness
      data={DATA}
      cols={COLUMNS}
      lockedCols={["age"]}
      widths={{ name: 8, age: 8 }}
      containerWidth={900}
    />,
  );
  await expect(component.locator('[data-column-id="age"]')).toHaveCount(0);
  const lastHandle = component.locator('[data-column-id="active"]');
  await expect(lastHandle).toHaveCount(1); // last column has its own (leading) handle

  const total = async () =>
    (await widthOf(component, "name")) +
    (await widthOf(component, "age")) +
    (await widthOf(component, "active"));
  const totalBefore = await total();
  const ageBefore = await widthOf(component, "age");
  const activeBefore = await widthOf(component, "active");

  await dragHandle(page, lastHandle, -60); // drag the leading handle left → last grows

  expect(await widthOf(component, "active")).toBeGreaterThan(activeBefore + 40);
  expect(Math.abs((await widthOf(component, "age")) - ageBefore)).toBeLessThanOrEqual(1); // locked
  expect(Math.abs((await total()) - totalBefore)).toBeLessThanOrEqual(1); // total unchanged
});

test("scrollSnap sets the snap data-attributes on the viewport", async ({ mount }) => {
  const c = await mount(<DataTableHarness data={DATA} cols={COLUMNS} scrollSnap="both" />);
  const vp = c.locator('[class*="viewport"]').first();
  await expect(vp).toHaveAttribute("data-snap-rows", "");
  await expect(vp).toHaveAttribute("data-snap-cols", "");
});

test("edgeFade renders a bottom fade overlay (and none without it)", async ({ mount }) => {
  const plain = await mount(<DataTableHarness data={DATA} cols={COLUMNS} />);
  expect(await plain.locator('[class*="edgeFade"]').count()).toBe(0);
  await plain.unmount();
  const faded = await mount(<DataTableHarness data={DATA} cols={COLUMNS} edgeFade />);
  expect(await faded.locator('[class*="edgeFade"]').count()).toBe(1);
});
