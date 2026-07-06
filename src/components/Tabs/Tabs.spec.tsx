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
