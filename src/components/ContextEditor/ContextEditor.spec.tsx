import { expect, test } from "@playwright/experimental-ct-react";
import { ContextEditorHarness } from "./ContextEditor.harness";

test("renders each context block and its type tag", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  await expect(c.getByText("System prompt")).toBeVisible();
  await expect(c.getByText("PRD.md")).toBeVisible();
  await expect(c.getByText("web_search")).toBeVisible();
  await expect(c.getByTestId("ids")).toHaveText("sys,doc,tool");
});

test("the reorder grip is a focusable, labelled button", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness />);
  const grip = c.getByRole("button", { name: "Reorder PRD.md" });
  await expect(grip).toBeVisible();
  await grip.focus();
  await expect(grip).toBeFocused();
});

test("over budget: the gauge marks the track", async ({ mount }) => {
  // Blocks sum to 7k against a 5k window.
  const c = await mount(<ContextEditorHarness contextWindow={5_000} />);
  await expect(c.locator('[class*="gaugeTrack"]')).toHaveAttribute("data-over", "");
});

test("readOnly drops the reorder grip", async ({ mount }) => {
  const c = await mount(<ContextEditorHarness readOnly />);
  await expect(c.getByText("System prompt")).toBeVisible();
  await expect(c.getByRole("button", { name: /Reorder/ })).toHaveCount(0);
});
