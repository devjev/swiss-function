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

test("size presets change the inline control height", async ({ mount }) => {
  const small = await mount(<SelectorHarness size="sm" layout="inline" initial={["Apple"]} />);
  const sb = await small.locator('[data-size="sm"]').first().boundingBox();
  await small.unmount();
  const large = await mount(<SelectorHarness size="lg" layout="inline" initial={["Apple"]} />);
  const lb = await large.locator('[data-size="lg"]').first().boundingBox();
  if (!sb || !lb) throw new Error("missing bounding box");
  expect(lb.height).toBeGreaterThan(sb.height);
});

test("inline overflow: stays one row with an ellipsis, even when focused", async ({ mount }) => {
  const items = ["Amsterdam", "Berlin", "Geneva", "London", "Madrid", "Oslo", "Paris", "Tokyo"];
  const c = await mount(
    <SelectorHarness
      layout="inline"
      items={items}
      initial={items.slice(0, 8)}
      style={{ maxWidth: "18rem" }}
    />,
  );
  const group = c.locator('[class*="inlineGroup"]');
  const ellipsis = c.locator('[class*="overflowEllipsis"]');
  await expect(ellipsis).toBeVisible(); // chips overflow one row → ellipsis shown
  const before = (await group.boundingBox())?.height ?? 0;

  await c.getByRole("combobox").focus(); // must NOT grow vertically
  await expect(ellipsis).toBeVisible(); // ellipsis stays — overflow is still clipped
  const after = (await group.boundingBox())?.height ?? 0;
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});
