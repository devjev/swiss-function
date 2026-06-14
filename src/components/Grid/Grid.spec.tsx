import { expect, test } from "@playwright/experimental-ct-react";
import { Grid } from "./Grid";

test("renders a div by default with display: grid", async ({ mount }) => {
  const component = await mount(<Grid>content</Grid>);
  await expect(component).toHaveJSProperty("tagName", "DIV");
  const display = await component.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("grid");
});

test("columns={2} produces a 2-track template", async ({ mount }) => {
  const component = await mount(
    <Grid columns={2}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  const template = await component.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  // Computed style resolves repeat() to two equal track sizes (e.g. "Npx Npx").
  expect(template.split(/\s+/).filter(Boolean)).toHaveLength(2);
});

test("gap={1} resolves to one --sf-unit (24px at default leading)", async ({ mount }) => {
  const component = await mount(
    <Grid gap={1}>
      <div>a</div>
    </Grid>,
  );
  const gap = await component.evaluate((el) => getComputedStyle(el).gap);
  expect(gap).toBe("24px");
});

test("areas produces a quoted-rows grid-template-areas string", async ({ mount }) => {
  const component = await mount(
    <Grid areas={["a b", "c d"]}>
      <div>x</div>
    </Grid>,
  );
  const areas = await component.evaluate((el) => getComputedStyle(el).gridTemplateAreas);
  // Browsers normalize the value to quoted rows separated by spaces.
  expect(areas).toContain("a b");
  expect(areas).toContain("c d");
});

test("Grid.Item area maps to grid-area", async ({ mount }) => {
  const component = await mount(
    <Grid areas={["header", "body"]}>
      <Grid.Item area="header" data-testid="h">
        H
      </Grid.Item>
    </Grid>,
  );
  const area = await component
    .locator('[data-testid="h"]')
    .evaluate((el) => getComputedStyle(el).gridArea);
  expect(area).toContain("header");
});

test("Grid.Item colSpan produces grid-column: span N", async ({ mount }) => {
  const component = await mount(
    <Grid columns={4}>
      <Grid.Item colSpan={2} data-testid="wide">
        wide
      </Grid.Item>
    </Grid>,
  );
  const column = await component
    .locator('[data-testid="wide"]')
    .evaluate((el) => getComputedStyle(el).gridColumn);
  expect(column).toContain("span 2");
});

test("render prop renders the requested element", async ({ mount }) => {
  const component = await mount(<Grid render={<section />}>content</Grid>);
  await expect(component).toHaveJSProperty("tagName", "SECTION");
});

test("consumer style wins over computed grid styles", async ({ mount }) => {
  const component = await mount(
    <Grid columns={3} style={{ display: "block" }}>
      content
    </Grid>,
  );
  const display = await component.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("block");
});

test("inline prop yields display: inline-grid", async ({ mount }) => {
  const component = await mount(<Grid inline>content</Grid>);
  const display = await component.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("inline-grid");
});

test("resizable=columns renders one gutter between two tracks", async ({ mount }) => {
  const component = await mount(
    <Grid columns={2} resizable="columns" style={{ width: 400 }}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  await expect(component.locator('[data-axis="col"]')).toHaveCount(1);
});

test("dragging a column gutter redistributes the two adjacent tracks", async ({ mount, page }) => {
  const component = await mount(
    <Grid columns={2} resizable="columns" style={{ width: 400 }}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  const tracks = () =>
    component.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(/\s+/)
        .map((s) => Number.parseFloat(s)),
    );
  const before = await tracks();
  const box = await component.locator('[data-axis="col"]').boundingBox();
  if (!box) throw new Error("missing gutter bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy, { steps: 8 });
  await page.mouse.up();
  const after = await tracks();
  const [b0 = 0, b1 = 0] = before;
  const [a0 = 0, a1 = 0] = after;
  // Track 0 grows ~60px, track 1 shrinks ~60px, total preserved.
  expect(a0).toBeGreaterThan(b0 + 40);
  expect(a1).toBeLessThan(b1 - 40);
  expect(a0 + a1).toBeCloseTo(b0 + b1, 0);
});

test("arrow keys on a focused gutter resize the adjacent tracks", async ({ mount, page }) => {
  const component = await mount(
    <Grid columns={2} resizable="columns" style={{ width: 400 }}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  const track0 = () =>
    component.evaluate((el) => Number.parseFloat(getComputedStyle(el).gridTemplateColumns));
  const before = await track0();
  await component.locator('[data-axis="col"]').focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
  expect(await track0()).toBeGreaterThan(before + 80);
});

test("double-clicking a gutter splits its two tracks evenly", async ({ mount, page }) => {
  const component = await mount(
    <Grid columns={2} resizable="columns" style={{ width: 400 }}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  const tracks = () =>
    component.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(/\s+/)
        .map((s) => Number.parseFloat(s)),
    );
  // Skew the split with the keyboard, then reset it with a double-click.
  const gutter = component.locator('[data-axis="col"]');
  await gutter.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  const [s0 = 0, s1 = 0] = await tracks();
  expect(Math.abs(s0 - s1)).toBeGreaterThan(40);
  await gutter.dblclick();
  const [r0 = 0, r1 = 0] = await tracks();
  expect(Math.abs(r0 - r1)).toBeLessThan(2);
});

test("dragging a row gutter redistributes the two rows", async ({ mount, page }) => {
  const component = await mount(
    <Grid rows={2} resizable="rows" style={{ height: 400, width: 200 }}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  const rowsOf = () =>
    component.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateRows.split(/\s+/)
        .map((s) => Number.parseFloat(s)),
    );
  const [b0 = 0] = await rowsOf();
  const box = await component.locator('[data-axis="row"]').boundingBox();
  if (!box) throw new Error("missing gutter bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 60, { steps: 8 });
  await page.mouse.up();
  const [a0 = 0] = await rowsOf();
  expect(a0).toBeGreaterThan(b0 + 40);
});

test("dragging a gutter past its neighbor's minimum clamps both tracks", async ({
  mount,
  page,
}) => {
  const component = await mount(
    <Grid columns={2} resizable="columns" style={{ width: 400 }}>
      <div>a</div>
      <div>b</div>
    </Grid>,
  );
  const tracks = () =>
    component.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(/\s+/)
        .map((s) => Number.parseFloat(s)),
    );
  const box = await component.locator('[data-axis="col"]').boundingBox();
  if (!box) throw new Error("missing gutter bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 400, cy, { steps: 10 });
  await page.mouse.up();
  const [a0 = 0, a1 = 0] = await tracks();
  // track 0 hits the 48px floor; the pair still sums to ~400.
  expect(a0).toBeGreaterThanOrEqual(46);
  expect(a0).toBeLessThan(60);
  expect(a0 + a1).toBeCloseTo(400, 0);
});
