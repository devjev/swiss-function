import { expect, test } from "@playwright/experimental-ct-react";
import { Tabs } from "./Tabs";

const tree = (
  <Tabs.Root defaultValue="overview">
    <Tabs.List>
      <Tabs.Tab value="overview">Overview</Tabs.Tab>
      <Tabs.Tab value="details">Details</Tabs.Tab>
      <Tabs.Tab value="history">History</Tabs.Tab>
      <Tabs.Indicator />
    </Tabs.List>
    <Tabs.Panel value="overview">Overview content</Tabs.Panel>
    <Tabs.Panel value="details">Details content</Tabs.Panel>
    <Tabs.Panel value="history">History content</Tabs.Panel>
  </Tabs.Root>
);

test("a tab keeps the same width whether or not it is selected (issue #41)", async ({ mount }) => {
  const component = await mount(tree);
  const details = component.getByRole("tab", { name: "Details" });

  // Unselected width (Overview is the default selection).
  const before = (await details.boundingBox())?.width ?? 0;
  await details.click();
  await expect(details).toHaveAttribute("aria-selected", "true");
  const after = (await details.boundingBox())?.width ?? 0;

  expect(before).toBeGreaterThan(0);
  // The reserved bold width means selecting must not resize the tab.
  expect(Math.abs(after - before)).toBeLessThanOrEqual(0.5);
});

test("the selected tab caption is bold", async ({ mount }) => {
  const component = await mount(tree);
  const overview = component.getByRole("tab", { name: "Overview" });
  const weight = await overview.evaluate((el) => getComputedStyle(el).fontWeight);
  // --sf-font-weight-bold resolves to 700.
  expect(Number(weight)).toBeGreaterThanOrEqual(700);
});

test("neighbouring tabs do not move when selection changes", async ({ mount }) => {
  const component = await mount(tree);
  const history = component.getByRole("tab", { name: "History" });
  const x1 = (await history.boundingBox())?.x ?? 0;
  await component.getByRole("tab", { name: "Details" }).click();
  const x2 = (await history.boundingBox())?.x ?? 0;
  expect(Math.abs(x2 - x1)).toBeLessThanOrEqual(0.5);
});

const sections = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
const overflowTree = (
  <div style={{ width: 280 }}>
    <Tabs.Root defaultValue="alpha">
      <Tabs.List overflow>
        {sections.map((s) => (
          <Tabs.Tab key={s} value={s.toLowerCase()}>
            {s}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {sections.map((s) => (
        <Tabs.Panel key={s} value={s.toLowerCase()}>
          {s} content
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  </div>
);

test("overflow folds tabs that don't fit into a ⋯ menu", async ({ mount }) => {
  const c = await mount(overflowTree);
  await expect(c.getByRole("button", { name: "More tabs" })).toBeVisible();
  await expect(c.getByRole("tab", { name: "Alpha" })).toBeVisible();
  // A trailing tab is folded out of the row.
  await expect(c.getByRole("tab", { name: "Foxtrot" })).toBeHidden();
});

test("picking a folded tab from the ⋯ menu selects and pins it visible", async ({
  mount,
  page,
}) => {
  const c = await mount(overflowTree);
  await c.getByRole("button", { name: "More tabs" }).click();
  // The menu popup is portalled outside the component subtree, so query the page.
  await page.getByRole("menuitem", { name: "Foxtrot" }).click();
  const foxtrot = c.getByRole("tab", { name: "Foxtrot" });
  await expect(foxtrot).toHaveAttribute("aria-selected", "true");
  await expect(foxtrot).toBeVisible();
  await expect(c.getByText("Foxtrot content")).toBeVisible();
});

test("keyboard roving skips folded tabs", async ({ mount, page }) => {
  const c = await mount(overflowTree);
  await c.getByRole("tab", { name: "Alpha" }).focus();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowRight");
    const onHidden = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && el.offsetParent === null;
    });
    expect(onHidden).toBe(false);
  }
});
