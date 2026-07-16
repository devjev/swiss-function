import { expect, test } from "@playwright/experimental-ct-react";
import { RadioTableHarness } from "./RadioTable.harness";

test("clicking a row selects its radio and fires onValueChange", async ({ mount }) => {
  let last = "";
  const c = await mount(<RadioTableHarness onChange={(v) => (last = v)} />);
  // The whole row is a label; click the description text, not the radio dot.
  await c.getByText("Shared workspaces.").click();
  expect(last).toBe("team");
  await expect(c.getByRole("radio", { name: "Team" })).toBeChecked();
  await expect(c.getByRole("radio", { name: "Pro" })).not.toBeChecked();
});

test("the description renders and names nothing extra (label is the a11y name)", async ({
  mount,
}) => {
  const c = await mount(<RadioTableHarness />);
  await expect(c.getByText("Adds SSO and audit logs.")).toBeVisible();
  // The radio's accessible name is just the title, not the description.
  await expect(c.getByRole("radio", { name: "Pro", exact: true })).toBeVisible();
});

test("arrow keys move the selection within the group", async ({ mount }) => {
  let last = "";
  const c = await mount(<RadioTableHarness onChange={(v) => (last = v)} />);
  const pro = c.getByRole("radio", { name: "Pro" });
  await pro.focus();
  await pro.press("ArrowUp");
  // Wraps/moves to the previous enabled option (Starter).
  await expect(c.getByRole("radio", { name: "Starter" })).toBeChecked();
  expect(last).toBe("starter");
});

test("a disabled option is disabled and unchecked", async ({ mount }) => {
  const c = await mount(<RadioTableHarness />);
  const ent = c.getByRole("radio", { name: "Enterprise" });
  await expect(ent).toBeDisabled();
  await expect(ent).not.toBeChecked();
});

test("descriptions share one left edge (table column alignment)", async ({ mount }) => {
  const c = await mount(<RadioTableHarness />);
  const descs = c.locator('[class*="description"]');
  await expect(descs).toHaveCount(4);
  // Every description starts on the same line despite the four labels having
  // different widths: the subgrid shares one label column across the rows.
  const lefts = await descs.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);
});
