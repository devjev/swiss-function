import { expect, test } from "@playwright/experimental-ct-react";
import { ContextEditorHarness } from "./ContextEditor.harness";

test("renders each context block and its type tag", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  await expect(c.getByText("System prompt")).toBeVisible();
  await expect(c.getByText("PRD.md")).toBeVisible();
  await expect(c.getByText("web_search")).toBeVisible();
  await expect(c.getByTestId("ids")).toHaveText("sys,doc,tool");
});

test("excluding a block frees its budget and dims the row", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  // Wait for the lazy dnd rows to replace the Suspense fallback before clicking.
  await c.getByRole("button", { name: "Reorder PRD.md" }).waitFor();
  const row = c.locator('[class*="rowLive"]', { hasText: "PRD.md" });
  await row.getByRole("button", { name: /Exclude/ }).click();
  await expect(c.getByTestId("enabled")).toHaveText("sys,tool");
  await expect(row).toHaveAttribute("data-disabled");
  // Re-including restores it.
  await row.getByRole("button", { name: /Include/ }).click();
  await expect(c.getByTestId("enabled")).toHaveText("sys,doc,tool");
});

test("removing a block drops it from the list", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  await c.getByRole("button", { name: "Reorder web_search" }).waitFor();
  const row = c.locator('[class*="rowLive"]', { hasText: "web_search" });
  await row.getByRole("button", { name: /Remove/ }).click();
  await expect(c.getByTestId("ids")).toHaveText("sys,doc");
});

test("a pinned block resists exclude and remove", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  const row = c.locator('[class*="rowLive"]', { hasText: "System prompt" });
  await expect(row.getByRole("button", { name: /Exclude/ })).toHaveCount(0);
  await expect(row.getByRole("button", { name: /Remove/ })).toHaveCount(0);
});

test("the reorder grip is a focusable, labelled button", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  const grip = c.getByRole("button", { name: "Reorder PRD.md" });
  await expect(grip).toBeVisible();
  await grip.focus();
  await expect(grip).toBeFocused();
});

test("action buttons name their block", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  await c.getByRole("button", { name: "Reorder PRD.md" }).waitFor();
  await expect(c.getByRole("button", { name: "Remove PRD.md" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Exclude web_search" })).toBeVisible();
});

test("over budget: the gauge marks the track and reads 'over by'", async ({ mount }) => {
  // Blocks sum to 7k against a 5k window.
  const c = await mount(<ContextEditorHarness contextWindow={5_000} />);
  await expect(c.locator('[class*="gaugeTrack"]')).toHaveAttribute("data-over", "");
  await expect(c.getByText(/over by/)).toBeVisible();
});

test("readOnly hides every editing control", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness readOnly />);
  await expect(c.getByText("System prompt")).toBeVisible();
  await expect(c.getByRole("button", { name: /Reorder/ })).toHaveCount(0);
  await expect(c.getByRole("button", { name: /Exclude/ })).toHaveCount(0);
  await expect(c.getByRole("button", { name: /Remove/ })).toHaveCount(0);
});
