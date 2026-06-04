import { expect, test } from "@playwright/experimental-ct-react";
import { ToggleGroupHarness } from "./ToggleGroup.harness";

test("renders all items", async ({ mount }) => {
  const c = await mount(<ToggleGroupHarness />);
  await expect(c.getByRole("button", { name: "List" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Grid" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Table" })).toBeVisible();
});

test("single-select: clicking an item marks it pressed and fires onValueChange", async ({
  mount,
}) => {
  const c = await mount(<ToggleGroupHarness />);
  await c.getByRole("button", { name: "Grid" }).click();
  await expect(c.getByRole("button", { name: "Grid" })).toHaveAttribute("data-pressed", "");
  await expect(c.getByTestId("value")).toHaveText("grid");
});

test("single-select: clicking a different item swaps the pressed one", async ({ mount }) => {
  const c = await mount(<ToggleGroupHarness initialValue={["grid"]} />);
  await c.getByRole("button", { name: "List" }).click();
  await expect(c.getByRole("button", { name: "List" })).toHaveAttribute("data-pressed", "");
  await expect(c.getByRole("button", { name: "Grid" })).not.toHaveAttribute("data-pressed", "");
  await expect(c.getByTestId("value")).toHaveText("list");
});

test("multi-select: both pressed items stay pressed; value is an array", async ({ mount }) => {
  const c = await mount(<ToggleGroupHarness multiple />);
  await c.getByRole("button", { name: "List" }).click();
  await c.getByRole("button", { name: "Grid" }).click();
  await expect(c.getByRole("button", { name: "List" })).toHaveAttribute("data-pressed", "");
  await expect(c.getByRole("button", { name: "Grid" })).toHaveAttribute("data-pressed", "");
  await expect(c.getByTestId("value")).toHaveText("list,grid");
});

test("disabled on Root disables all items", async ({ mount }) => {
  const c = await mount(<ToggleGroupHarness disabled />);
  for (const name of ["List", "Grid", "Table"]) {
    await expect(c.getByRole("button", { name })).toBeDisabled();
  }
});

test("disabled on a single item disables just it", async ({ mount }) => {
  const c = await mount(<ToggleGroupHarness disabledItem="grid" />);
  await expect(c.getByRole("button", { name: "Grid" })).toBeDisabled();
  await expect(c.getByRole("button", { name: "List" })).toBeEnabled();
});

test("controlled value updates pressed state across re-renders", async ({ mount }) => {
  const c = await mount(<ToggleGroupHarness initialValue={["table"]} />);
  await expect(c.getByRole("button", { name: "Table" })).toHaveAttribute("data-pressed", "");
});
