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
