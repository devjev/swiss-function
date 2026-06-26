import { expect, test } from "@playwright/experimental-ct-react";
import { ReflowHarness } from "./Reflow.harness";

test("wide: every column is shown side by side", async ({ mount }) => {
  const c = await mount(<ReflowHarness width={1000} />);
  await expect(c.getByRole("heading", { name: "Alpha" })).toBeVisible();
  await expect(c.getByRole("heading", { name: "Beta" })).toBeVisible();
  await expect(c.getByText("Alpha body")).toBeVisible();
  await expect(c.getByText("Beta body")).toBeVisible();
});

test("narrow + accordion: titles become triggers; first open; clicking swaps", async ({
  mount,
}) => {
  const c = await mount(<ReflowHarness width={360} collapseMode="accordion" />);
  // Titles are now buttons, not headings-only.
  await expect(c.getByRole("button", { name: "Alpha" })).toBeVisible();
  // First section open by default.
  await expect(c.getByText("Alpha body")).toBeVisible();
  await expect(c.getByText("Beta body")).not.toBeVisible();
  // Opening Beta reveals its panel.
  await c.getByRole("button", { name: "Beta" }).click();
  await expect(c.getByText("Beta body")).toBeVisible();
});

test("narrow + tabs: one panel shown; clicking a tab swaps it", async ({ mount }) => {
  const c = await mount(<ReflowHarness width={360} collapseMode="tabs" />);
  await expect(c.getByRole("tab", { name: "Alpha" })).toBeVisible();
  await expect(c.getByText("Alpha body")).toBeVisible();
  await expect(c.getByText("Beta body")).not.toBeVisible();
  await c.getByRole("tab", { name: "Beta" }).click();
  await expect(c.getByText("Beta body")).toBeVisible();
  await expect(c.getByText("Alpha body")).not.toBeVisible();
});
