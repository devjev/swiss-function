import { expect, test } from "@playwright/experimental-ct-react";
import { SelectorHarness } from "./Selector.harness";

test("typing filters the dropdown and clicking an item adds a chip", async ({ mount, page }) => {
  let last: string[] = [];
  const component = await mount(<SelectorHarness onChange={(v) => (last = v)} />);

  await component.getByRole("combobox").click();
  await component.getByRole("combobox").fill("Ban");
  await page.getByRole("option", { name: "Banana" }).click();

  expect(last).toEqual(["Banana"]);
  await expect(component.getByText("Banana")).toBeVisible();
});

test("panel bucket shows the running count", async ({ mount, page }) => {
  const component = await mount(<SelectorHarness initial={["Apple"]} />);
  await expect(component.getByText("(1)")).toBeVisible();

  await component.getByRole("combobox").click();
  await page.getByRole("option", { name: "Cherry" }).click();
  await expect(component.getByText("(2)")).toBeVisible();
});

test("removing a chip deselects that value", async ({ mount }) => {
  let last: string[] = [];
  const component = await mount(
    <SelectorHarness initial={["Apple", "Cherry"]} onChange={(v) => (last = v)} />,
  );

  await component.getByRole("button", { name: "Remove Apple" }).click();
  expect(last).toEqual(["Cherry"]);
  await expect(component.getByText("(1)")).toBeVisible();
});

test("Clear empties the bucket", async ({ mount }) => {
  let last: string[] = ["Apple", "Cherry"];
  const component = await mount(
    <SelectorHarness initial={["Apple", "Cherry"]} onChange={(v) => (last = v)} />,
  );

  await component.getByRole("button", { name: "Clear all" }).click();
  expect(last).toEqual([]);
  await expect(component.getByText("No items selected")).toBeVisible();
});

test("inline layout renders chips inside the field (no bucket panel)", async ({ mount, page }) => {
  const component = await mount(<SelectorHarness layout="inline" initial={["Apple"]} />);
  await expect(component.getByText("No items selected")).toHaveCount(0);

  await component.getByRole("combobox").click();
  await page.getByRole("option", { name: "Banana" }).click();
  await expect(component.getByText("Banana")).toBeVisible();
});

test("object items search by label and select by value", async ({ mount, page }) => {
  let last: string[] = [];
  const component = await mount(
    <SelectorHarness
      items={[
        { value: "ts", label: "TypeScript" },
        { value: "rs", label: "Rust" },
      ]}
      onChange={(v) => (last = v)}
    />,
  );

  await component.getByRole("combobox").click();
  await component.getByRole("combobox").fill("Type");
  await page.getByRole("option", { name: "TypeScript" }).click();

  expect(last).toEqual(["ts"]);
  await expect(component.getByText("TypeScript")).toBeVisible();
});
