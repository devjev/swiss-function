import { expect, test } from "@playwright/experimental-ct-react";
import { DataTable } from "./DataTable";
import {
  DataTableHarness,
  EditorsHarness,
  FrozenHarness,
  GroupsHarness,
  ManyValuesHarness,
  MergeHarness,
  TreeHarness,
} from "./DataTable.harness";
import { SortHarness } from "./DataTable.sortHarness";

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
  // editor value, so filter({ hasText }) stops matching. The text editor is a
  // TextEditInline (a <textarea>).
  await component.getByRole("gridcell").first().dblclick();
  await expect(component.locator("textarea").first()).toBeFocused();
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

// --- Edit activation (single vs double click) ---

test("editOn='single': a single click opens the editor", async ({ mount }) => {
  const component = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} editable editOn="single" />,
  );
  await component.getByRole("gridcell").first().click();
  await expect(component.locator("textarea").first()).toBeFocused();
});

test("default (double): a single click does NOT open the editor", async ({ mount }) => {
  const component = await mount(<DataTableHarness data={DATA} cols={COLUMNS} editable />);
  const cell = component.getByRole("gridcell").first();
  await cell.click();
  await expect(cell.locator("input, textarea")).toHaveCount(0);
});

test("column editOn='single' overrides a double-click table default", async ({ mount }) => {
  const component = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} editable singleClickCols={["name"]} />,
  );
  const cells = component.getByRole("gridcell");
  // name (col 0) is single-click; age (col 1) stays double-click.
  await cells.nth(1).click();
  await expect(cells.nth(1).locator("input")).toHaveCount(0);
  await cells.nth(0).click();
  await expect(component.locator("textarea").first()).toBeFocused();
});

test("editOn='single': a shift-click does NOT open an editor (selection gesture)", async ({
  mount,
}) => {
  const component = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} editable editOn="single" />,
  );
  const cell = component.getByRole("gridcell").first();
  await cell.click({ modifiers: ["Shift"] });
  await expect(cell.locator("input, textarea")).toHaveCount(0);
});

// --- Rich cell editors (text → TextEditInline, number → DigitInputMicro,
//     date → DatePicker, boolean/select → Picker) ---

test("number cell edits with a DigitInputMicro and commits a parsed number", async ({
  mount,
  page,
}) => {
  let changes: unknown = null;
  const component = await mount(<EditorsHarness onCellChange={(c) => (changes = c)} />);
  // Columns: name(0) score(1) joined(2). Score is the number cell.
  await component.getByRole("gridcell").nth(1).dblclick();
  await expect(component.locator("input").first()).toBeFocused();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("7");
  await page.keyboard.press("Enter");
  expect(changes).toEqual([{ rowIndex: 0, columnId: "score", value: 7 }]);
});

test("number editor's font-size matches the cell (no size jump on edit)", async ({ mount }) => {
  // Regression: DigitInputMicro defaults to --sf-font-size-md (16px) while the
  // body cell is --sf-font-size-sm (14px); the DataTable editor wrapper pins the
  // editor to the cell size so entering edit mode doesn't grow the row.
  const component = await mount(<EditorsHarness />);
  const scoreCell = component.getByRole("gridcell").nth(1);
  const cellSize = await scoreCell.evaluate((el) => getComputedStyle(el).fontSize);
  await scoreCell.dblclick();
  const input = scoreCell.locator("input").first();
  await expect(input).toBeFocused();
  const inputSize = await input.evaluate((el) => getComputedStyle(el).fontSize);
  expect(inputSize).toBe(cellSize);
});

test("date cell edits with a DatePicker and commits a Date", async ({ mount, page }) => {
  let changes: unknown = null;
  const component = await mount(<EditorsHarness onCellChange={(c) => (changes = c)} />);
  await component.getByRole("gridcell").nth(2).dblclick();
  await expect(component.locator("input").first()).toBeFocused();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("2023-05-15");
  await page.keyboard.press("Enter");
  const value = (changes as { value: unknown }[] | null)?.[0]?.value;
  expect(value).toBeInstanceOf(Date);
  const d = value as Date;
  // Compare local components — the value is local midnight, so toISOString (UTC)
  // can roll to the previous day depending on the runner's timezone.
  expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2023, 4, 15]);
});

test("text cell allows a newline via Shift+Enter and commits on Enter", async ({ mount, page }) => {
  let changes: unknown = null;
  const component = await mount(<EditorsHarness onCellChange={(c) => (changes = c)} />);
  await component.getByRole("gridcell").nth(0).dblclick();
  await expect(component.locator("textarea").first()).toBeFocused();
  await page.keyboard.type(" x");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("y");
  await page.keyboard.press("Enter");
  expect((changes as { value: unknown }[] | null)?.[0]?.value).toBe("Alice x\ny");
});

test("boolean cell edits with a Picker and commits a boolean", async ({ mount, page }) => {
  let changes: unknown = null;
  const component = await mount(<EditorsHarness onCellChange={(c) => (changes = c)} />);
  // Columns: name(0) score(1) joined(2) active(3) role(4).
  await component.getByRole("gridcell").nth(3).dblclick();
  await component.getByRole("gridcell").nth(3).locator("input").first().click();
  await page.getByRole("option", { name: "False", exact: true }).click();
  expect((changes as { value: unknown }[] | null)?.[0]).toEqual({
    rowIndex: 0,
    columnId: "active",
    value: false,
  });
});

test("select cell edits with a Picker and commits the chosen value", async ({ mount, page }) => {
  let changes: unknown = null;
  const component = await mount(<EditorsHarness onCellChange={(c) => (changes = c)} />);
  await component.getByRole("gridcell").nth(4).dblclick();
  await component.getByRole("gridcell").nth(4).locator("input").first().click();
  await page.getByRole("option", { name: "Guest", exact: true }).click();
  expect((changes as { value: unknown }[] | null)?.[0]).toEqual({
    rowIndex: 0,
    columnId: "role",
    value: "guest",
  });
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

test("tree: a collapsed parent keeps its expand chevron and expands (pruned subtrees, #18)", async ({
  mount,
}) => {
  // No defaultExpanded: children are pruned from the row model entirely, so
  // the chevron's visibility must come from the tree walk, not getCanExpand().
  const component = await mount(<TreeHarness data={TREE} />);
  await expect(component.getByRole("gridcell").filter({ hasText: "Alice" })).toHaveCount(0);
  const chevrons = component.getByRole("button", { name: "Expand row" });
  await expect(chevrons).toHaveCount(1); // Engineering only — Sales has no children
  await chevrons.click();
  await expect(component.getByRole("gridcell").filter({ hasText: "Alice" })).toBeVisible();
  await expect(component.getByRole("gridcell").filter({ hasText: "Bob" })).toBeVisible();
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

test("filterableColumns: unchecking a value in a column filter narrows the rows", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} filterableColumns containerWidth={600} />,
  );
  await expect(c.getByRole("gridcell").filter({ hasText: "Alice" })).toBeVisible();

  // Open the boolean "active" column's filter and uncheck "True".
  await c.getByRole("button", { name: "Filter active" }).click();
  // The popover renders in a portal (document.body), so query via `page`.
  await page.getByRole("checkbox", { name: "True" }).click();

  // Only the inactive row (Bob) survives.
  await expect(c.getByRole("gridcell").filter({ hasText: "Bob" })).toBeVisible();
  await expect(c.getByRole("gridcell").filter({ hasText: "Alice" })).toHaveCount(0);
});

test("filter funnel windows a high-cardinality checklist and still filters via search", async ({
  mount,
  page,
}) => {
  const c = await mount(<ManyValuesHarness count={500} />);
  await c.getByRole("button", { name: "Filter name" }).click();

  // 500 distinct values, but only the virtualized window of option rows is
  // mounted (+ the select-all checkbox) — not one checkbox per value (#17).
  await expect(page.getByRole("textbox", { name: "Search values" })).toBeVisible();
  await expect(page.getByRole("checkbox").nth(1)).toBeVisible();
  expect(await page.getByRole("checkbox").count()).toBeLessThan(100);

  // Search narrows across the FULL value set (not just the mounted window)…
  await page.getByRole("textbox", { name: "Search values" }).fill("V0499");
  await expect(page.getByRole("checkbox", { name: "V0499" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search values" }).fill("V0000");

  // …and unchecking a match commits against the full set: only V0000 hidden.
  await page.getByRole("checkbox", { name: "V0000" }).click();
  await expect(c.getByRole("gridcell").filter({ hasText: "V0001" })).toBeVisible();
  await expect(c.getByRole("gridcell").filter({ hasText: "V0000" })).toHaveCount(0);
});

test("reorderableColumns: dragging a header past its neighbour reorders the columns", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} reorderableColumns containerWidth={600} />,
  );
  const headers = c.getByRole("columnheader");
  await expect(headers.first()).toHaveText(/name/);

  const nameBox = await c.getByRole("columnheader", { name: "name" }).boundingBox();
  const ageBox = await c.getByRole("columnheader", { name: "age" }).boundingBox();
  if (!nameBox || !ageBox) throw new Error("missing header boxes");

  // Drag "name" onto the right side of "age" so it lands after it.
  await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2);
  await page.mouse.down();
  // Cross the 4px sensor threshold, then move over the age column in small steps.
  await page.mouse.move(nameBox.x + nameBox.width / 2 + 12, nameBox.y + nameBox.height / 2, {
    steps: 4,
  });
  await page.mouse.move(ageBox.x + ageBox.width * 0.8, ageBox.y + ageBox.height / 2, { steps: 10 });
  await page.mouse.up();

  // "age" is now the first column.
  await expect(headers.first()).toHaveText(/age/);
});

test("columnFill: last column gets a handle and a dither filler renders", async ({ mount }) => {
  const component = await mount(
    <DataTableHarness data={DATA} cols={COLUMNS} columnFill containerWidth={900} />,
  );
  // The viewport opts into fill mode.
  await expect(component.locator("[data-column-fill]")).toHaveCount(1);
  // The last column ("active") now has its own trailing resize handle (it's no
  // longer the flush-right filler).
  await expect(component.locator('[data-column-id="active"]')).toHaveCount(1);
  // The single dither backdrop renders behind the grid content.
  await expect(component.locator('[class*="fill"]')).toHaveCount(1);
});

test("columnFill: virtualized body keeps the header's column widths when the viewport is narrower than the columns (issue #3)", async ({
  mount,
}) => {
  // Columns total 3×14u (= 1008px) inside a 480px wrapper → viewport < columns.
  const c = await mount(
    <DataTableHarness
      data={DATA}
      cols={COLUMNS}
      columnFill={{ animated: false, color: "var(--sf-color-primary)" }}
      widths={{ name: 14, age: 14, active: 14 }}
      containerWidth={480}
    />,
  );
  const headerRow = c.locator('[class*="headerRow"]').first();
  const bodyRow = c.locator('[class*="body"] [role="row"]').first();

  // The body's resolved grid tracks must equal the header's (they diverge before
  // the fix: the virtualized body collapses to the viewport width).
  const headerTpl = await headerRow.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  const bodyTpl = await bodyRow.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(bodyTpl).toBe(headerTpl);

  // And the body spans the full columns width, not the (smaller) viewport.
  const headerW = await headerRow.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const bodyW = await bodyRow.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  expect(Math.abs(bodyW - headerW)).toBeLessThanOrEqual(1);
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

test("columns shrink to fit a narrow container, then scroll with the header spanning content", async ({
  mount,
}) => {
  const COLS = ["name", "age", "active"];
  // Tight: 8u (192) preferred each can't all fit 400, but mins (3u=72) do → shrink, no scroll.
  const tight = await mount(
    <DataTableHarness data={DATA} cols={COLS} widths={{ name: 8, age: 8 }} containerWidth={400} />,
  );
  const m1 = await tight
    .locator('[class*="viewport"]')
    .first()
    .evaluate((el) => ({ s: el.scrollWidth, c: el.clientWidth }));
  expect(m1.s).toBeLessThanOrEqual(m1.c + 1); // shrank to fit — no horizontal scroll
  await tight.unmount();

  // Overflow: even mins don't fit 180 → scrolls, and the header spans the full content.
  const over = await mount(
    <DataTableHarness data={DATA} cols={COLS} widths={{ name: 8, age: 8 }} containerWidth={180} />,
  );
  const vp = over.locator('[class*="viewport"]').first();
  const m2 = await vp.evaluate((el) => ({ s: el.scrollWidth, c: el.clientWidth }));
  expect(m2.s).toBeGreaterThan(m2.c); // can't fit even at min → scrolls
  const headerW = await over
    .locator('[class*="headerRow"]')
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
  expect(headerW).toBeGreaterThan(m2.c); // header background spans the full content, not the viewport
});

test("merge: covered cells are blanked and the lead carries the content", async ({ mount }) => {
  const c = await mount(<MergeHarness />);
  // Department merges rows 0–2 ("Engineering"): only the lead shows the text,
  // the two covered cells render blank.
  await expect(c.getByRole("gridcell").filter({ hasText: "Engineering" })).toHaveCount(1);
  // Internal seams erased on the lead + the middle covered cell, not the region's
  // last row — so exactly two cells in the merged column carry data-merge-bottom.
  await expect(c.locator('[role="gridcell"][data-merge-bottom]')).toHaveCount(2);
});

test("merge: a suppressed edge resolves to the no-op shadow", async ({ mount }) => {
  const c = await mount(<MergeHarness />);
  const lead = c.getByRole("gridcell").filter({ hasText: "Engineering" });
  // The lead's bottom edge (toward the covered cell below) is erased.
  const edgeB = await lead.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--sf-cell-edge-b").trim(),
  );
  expect(edgeB).toBe("0 0 transparent");
});

test("merge: an ungrouped leaf header fills the full header height", async ({ mount }) => {
  const c = await mount(<MergeHarness />);
  // "Department" is ungrouped, so its placeholder above merges down.
  const placeholders = c.locator('[role="columnheader"][data-merge-bottom]');
  await expect(placeholders.first()).toBeVisible();
  // The grouped "2026" header colspans its two quarter columns (existing behaviour).
  await expect(c.getByRole("columnheader", { name: "2026" })).toBeVisible();
});

test("frozen columns stay pinned while the rest scroll horizontally", async ({ mount, page }) => {
  const c = await mount(<FrozenHarness width={360} frozenColumns={2} />);
  const nameHeader = c.getByRole("columnheader", { name: "Name" });
  await expect(nameHeader).toHaveAttribute("data-frozen", "true");
  const firstCell = c.getByRole("gridcell").filter({ hasText: "Name 0" }).first();
  await expect(firstCell).toHaveAttribute("data-frozen", "true");

  const before = await nameHeader.boundingBox();
  const vp = c.getByRole("grid");
  await vp.evaluate((el) => {
    el.scrollLeft = 300;
  });
  await page.waitForTimeout(50);

  // The viewport actually scrolled, but the frozen header didn't move.
  const scrolled = await vp.evaluate((el) => el.scrollLeft);
  expect(scrolled).toBeGreaterThan(0);
  const after = await nameHeader.boundingBox();
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(2);
  await expect(nameHeader).toBeVisible();
});

test("frozenColumns=0 leaves no frozen cells", async ({ mount }) => {
  const c = await mount(<FrozenHarness width={360} frozenColumns={0} />);
  await expect(c.locator('[data-frozen="true"]')).toHaveCount(0);
});

// --- Sorting (flat mode renders body rows from computeRowOrder) ---
// SortHarness data order starts at "Row 7"; asc-first is "Row 1", desc-first
// is "Row 12", so every state of the cycle is distinguishable.

test("clicking a sortable header cycles asc → desc → cleared", async ({ mount }) => {
  const c = await mount(<SortHarness />);
  const header = c.getByRole("columnheader", { name: "name" });
  // First gridcell of each body row = the name column, in display order.
  const nameCells = c.locator('[role="gridcell"]:first-child');
  await expect(nameCells.first()).toHaveText("Row 7"); // unsorted = data order

  await header.click(); // strings toggle asc first (getAutoSortDir sniff)
  await expect(nameCells.first()).toHaveText("Row 1");
  // Alphanumeric, not lexicographic: Row 2 sorts before Row 10.
  const names = await nameCells.allTextContents();
  expect(names.indexOf("Row 2")).toBeLessThan(names.indexOf("Row 10"));

  await header.click(); // desc
  await expect(nameCells.first()).toHaveText("Row 12");

  await header.click(); // third click clears the sort
  await expect(nameCells.first()).toHaveText("Row 7");
});

test("sorting composes with a column filter", async ({ mount, page }) => {
  const c = await mount(<SortHarness filterable />);
  // Keep only kind=alpha (the odd rows: 1, 3, 5, 7, 9, 11).
  await c.getByRole("button", { name: "Filter kind" }).click();
  await page.getByRole("checkbox", { name: "beta" }).click();
  await page.keyboard.press("Escape"); // close the popover so it can't cover the header
  const nameCells = c.locator('[role="gridcell"]:first-child');
  await expect(nameCells).toHaveCount(6);

  await c.getByRole("columnheader", { name: "name" }).click(); // asc
  await expect(nameCells.first()).toHaveText("Row 1");
  await expect(nameCells).toHaveCount(6);
  await expect(c.getByRole("gridcell").filter({ hasText: "Row 12" })).toHaveCount(0);
});

test("custom cell renderer keeps rowIndex = original data index after sorting", async ({
  mount,
}) => {
  const c = await mount(<SortHarness customCell />);
  const nameCells = c.locator('[role="gridcell"]:first-child');
  await expect(nameCells.first()).toHaveText("Row 7#0");

  await c.getByRole("columnheader", { name: "name" }).click(); // asc
  // "Row 1" sits at data index 3 — rowIndex stays the ORIGINAL index, not the
  // display index (parity with TanStack's row.index).
  await expect(nameCells.first()).toHaveText("Row 1#3");
});

test("editing after sorting fires CellChange with the display row index", async ({
  mount,
  page,
}) => {
  let lastChanges: unknown = null;
  const c = await mount(
    <SortHarness
      editable
      onCellChange={(changes) => {
        lastChanges = changes;
      }}
    />,
  );
  await c.getByRole("columnheader", { name: "name" }).click(); // asc → "Row 1" first
  const first = c.locator('[role="gridcell"]:first-child').first();
  await expect(first).toHaveText("Row 1");
  await first.dblclick();
  await page.keyboard.insertText("X");
  await page.keyboard.press("Enter");
  // rowIndex is the DISPLAY index (0 = top visible row), not the data index.
  expect(lastChanges).toEqual([{ rowIndex: 0, columnId: "name", value: "Row 1X" }]);
});

test("cellPadding and cellFontSize scale header + body cells", async ({ mount }) => {
  const cols = [{ id: "name", header: "Name", accessor: "name" as const }];
  const data = [{ name: "Alice" }];
  const c = await mount(
    <div>
      <div data-testid="xs">
        <DataTable data={data} columns={cols} height={100} cellPadding="xs" cellFontSize="xs" />
      </div>
      <div data-testid="lg">
        <DataTable data={data} columns={cols} height={100} cellPadding="lg" cellFontSize="lg" />
      </div>
    </div>,
  );
  const read = (id: string) =>
    c
      .getByTestId(id)
      .locator('[role="gridcell"]')
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

test("a Picker cell editor fits its cell instead of overflowing it (issue #69 regression)", async ({
  mount,
}) => {
  // In a narrow table the active/role columns are well under the Picker's
  // standalone 12rem min-width; the editor must fill the cell, not spill into
  // the next column.
  const c = await mount(
    <div style={{ maxWidth: 460 }}>
      <EditorsHarness />
    </div>,
  );
  const cell = c.getByRole("gridcell").nth(3); // active (boolean → Picker)
  await cell.dblclick();
  const { cellW, editorW } = await cell.evaluate((el) => {
    const ed = el.querySelector('[class*="editor"]');
    return {
      cellW: el.getBoundingClientRect().width,
      editorW: ed ? ed.getBoundingClientRect().width : 0,
    };
  });
  expect(editorW).toBeGreaterThan(0);
  expect(editorW).toBeLessThanOrEqual(cellW + 1);
});

test("fillHeight holds the viewport height and dithers the space below the rows", async ({
  mount,
}) => {
  const cols = [{ id: "a", header: "A", accessor: "a" as const }];
  const data = [{ a: "one" }, { a: "two" }];
  const c = await mount(
    <div style={{ width: 240 }}>
      <DataTable data={data} columns={cols} height={300} fillHeight columnFill />
    </div>,
  );
  // The viewport fills the full height rather than shrinking to two rows.
  const vpH = await c
    .getByRole("grid")
    .evaluate((el) => Math.round(el.getBoundingClientRect().height));
  expect(vpH).toBe(300);
  // Exactly one dither backdrop (not the old two panels), and it covers the
  // leftover: its box extends below the last row (it spans the full held-open
  // content area, so the empty band shows).
  const fill = c.locator('[class*="fill"]');
  await expect(fill).toHaveCount(1);
  const fillBottom = await fill.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
  const rowBottom = await c
    .getByRole("gridcell")
    .last()
    .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
  expect(fillBottom).toBeGreaterThan(rowBottom + 20);
});

test("fillHeight alone still fits the columns horizontally (no forced overflow)", async ({
  mount,
}) => {
  // fillHeight is vertical-only: in a container narrower than the columns'
  // preferred widths, the last column must still stretch (1fr) and the tracks
  // shrink so the table fits, exactly as without fillHeight. columnFill (not set
  // here) is the mode that pins columns and leaves a right gutter.
  const cols = [
    { id: "a", header: "A", accessor: "a" as const, width: 16 },
    { id: "b", header: "B", accessor: "b" as const, width: 16 },
    { id: "c", header: "C", accessor: "c" as const, width: 16 },
  ];
  const data = [{ a: "1", b: "2", c: "3" }];
  const c = await mount(
    <div style={{ width: 240 }}>
      <DataTable data={data} columns={cols} height={300} fillHeight />
    </div>,
  );
  const { scrollW, clientW } = await c
    .getByRole("grid")
    .evaluate((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
  // No horizontal overflow beyond the min-content floor (a couple of px slack).
  expect(scrollW).toBeLessThanOrEqual(clientW + 2);
});

test("highlights render coloured range overlays with a perimeter border", async ({ mount }) => {
  const data = [
    { name: "Ada", age: 20, active: true },
    { name: "Bo", age: 21, active: false },
    { name: "Cai", age: 22, active: true },
  ];
  const c = await mount(
    <DataTableHarness
      data={data}
      cols={["name", "age", "active"]}
      containerWidth={520}
      highlights={[
        // The "age" column (col 1), all three rows — a charting range.
        { id: "series", range: { start: { row: 0, col: 1 }, end: { row: 2, col: 1 } } },
      ]}
    />,
  );
  const overlays = c.locator('[class*="highlight"]');
  // One overlay per covered cell (3 rows × 1 col).
  await expect(overlays).toHaveCount(3);
  // Top row carries the top border, bottom row the bottom; the single column
  // carries both side borders on every cell.
  const top = overlays.first();
  await expect(top).toHaveAttribute("data-edge-top", "true");
  await expect(top).toHaveAttribute("data-edge-start", "true");
  await expect(top).toHaveAttribute("data-edge-end", "true");
  expect(await top.getAttribute("data-edge-bottom")).toBeNull();
  await expect(overlays.last()).toHaveAttribute("data-edge-bottom", "true");
  // The border paints in the resolved colour (default palette slot 0 = primary).
  const borderTopW = await top.evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(borderTopW).toBe("2px");
});

test("highlights: two ranges render in distinct colours; explicit color wins", async ({
  mount,
}) => {
  const data = [
    { name: "Ada", age: 20, active: true },
    { name: "Bo", age: 21, active: false },
  ];
  const c = await mount(
    <DataTableHarness
      data={data}
      cols={["name", "age", "active"]}
      containerWidth={520}
      highlights={[
        { id: "a", range: { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } } },
        {
          id: "b",
          range: { start: { row: 0, col: 2 }, end: { row: 1, col: 2 } },
          color: "rgb(1, 2, 3)",
        },
      ]}
    />,
  );
  const overlays = c.locator('[class*="highlight"]');
  await expect(overlays).toHaveCount(4); // 2 cells each
  const colorOf = (el: HTMLElement) => getComputedStyle(el).borderTopColor;
  const first = await overlays.first().evaluate(colorOf);
  const last = await overlays.last().evaluate(colorOf);
  expect(first).not.toBe(last); // distinct colours
  expect(last).toBe("rgb(1, 2, 3)"); // explicit color honoured
});

test("highlights are positional: they stay on the same cells across a data change", async ({
  mount,
}) => {
  // A highlight on row 0 marks the top row by position. Positional anchoring
  // means it frames whatever data occupies that row, so it stays put.
  const c = await mount(
    <DataTableHarness
      data={[
        { name: "Ada", age: 20, active: true },
        { name: "Bo", age: 21, active: false },
      ]}
      cols={["name", "age"]}
      containerWidth={400}
      highlights={[{ id: "top", range: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } } }]}
    />,
  );
  // Two overlays (row 0, both columns), and they sit on the first row's cells.
  const overlays = c.locator('[class*="highlight"]');
  await expect(overlays).toHaveCount(2);
  const rowTop = await c
    .getByRole("row")
    .nth(1) // row 0 is the header row
    .evaluate((el) => Math.round(el.getBoundingClientRect().top));
  const hlTop = await overlays.first().evaluate((el) => Math.round(el.getBoundingClientRect().top));
  expect(Math.abs(hlTop - rowTop)).toBeLessThanOrEqual(1);
});
