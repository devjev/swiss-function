import { expect, test } from "@playwright/experimental-ct-react";
import { GraphHarness } from "./Graph.harness";

test("renders the interaction surface and the controls toolbar", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-surface]")).toBeVisible();
  await expect(c.getByRole("button", { name: "Reset view" })).toBeVisible();
  for (const name of ["Force", "Tree", "Radial", "Concentric", "Grid"]) {
    await expect(c.getByRole("button", { name })).toBeVisible();
  }
});

test("renders the minimap overlay when included", async ({ mount }) => {
  const c = await mount(<GraphHarness minimap />);
  await expect(c.locator("[data-graph-minimap]")).toBeVisible();
});

test("a layout toggle fires onLayoutChange and marks itself pressed", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  await c.getByRole("button", { name: "Tree" }).click();
  await expect(c.getByTestId("last-event")).toHaveText("layout:tree");
  await expect(c.getByRole("button", { name: "Tree" })).toHaveAttribute("data-pressed", "");
});

test("clicking a node fires onNodeClick with its id", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  // Wait for the deferred layout to settle (the surface marks itself ready).
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await c.locator("[data-graph-surface]").click();
  await expect(c.getByTestId("last-event")).toHaveText("click:hub");
});

test("click-to-pin: the inspector persists after the cursor leaves the node", async ({
  mount,
  page,
}) => {
  // Regression: an inline `renderNode` must not rebuild the renderer on the
  // re-render that `onNodeClick` triggers (which would wipe the selection).
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(c.getByTestId("last-event")).toHaveText("click:hub");
  // Leave the node — hover inspection clears, but the click-pinned one stays.
  await page.mouse.move(box.x + 4, box.y + 4);
  const tip = page.locator("[data-graph-tooltip]");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Hub");
});

test("hovering a node opens the inspector with its label + data", async ({ mount, page }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The inspector tooltip surfaces the node's label + its `data` record.
  const tip = page.locator("[data-graph-tooltip]");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Hub");
  await expect(tip).toContainText("center");
});

test("exposes role, label, and a node/edge-count summary via aria-describedby", async ({
  mount,
}) => {
  const data = {
    nodes: [
      { id: "a", label: "A", kind: "primary", data: {} },
      { id: "b", label: "B", kind: "secondary", data: {} },
      { id: "c", label: "C", kind: "tertiary", data: {} },
    ],
    edges: [
      { id: "e1", source: "a", target: "b", data: {} },
      { id: "e2", source: "b", target: "c", data: {} },
    ],
  };
  const c = await mount(<GraphHarness data={data} />);
  const surface = c.locator("[data-graph-surface]");
  await expect(surface).toHaveAttribute("role", "application");
  await expect(surface).toHaveAttribute("aria-label", "Graph view");
  // The describedby summary names the counts, and the surface points at it.
  const summary = c.locator("[data-graph-summary]");
  await expect(summary).toContainText("3 nodes");
  await expect(summary).toContainText("2 edges");
  const id = await summary.getAttribute("id");
  await expect(surface).toHaveAttribute("aria-describedby", id ?? "");
});

test("the surface is keyboard-focusable", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  const surface = c.locator("[data-graph-surface]");
  await surface.focus();
  await expect(surface).toBeFocused();
});

test("the polite live region announces the active layout on switch", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  const status = c.locator("[data-graph-status]");
  await expect(status).toHaveText("force layout");
  await c.getByRole("button", { name: "Grid" }).click();
  await expect(status).toHaveText("grid layout");
});

test("under prefers-reduced-motion, a layout switch still applies (snapped)", async ({
  mount,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const c = await mount(<GraphHarness />);
  await c.getByRole("button", { name: "Grid" }).click();
  await expect(c.locator("[data-graph-status]")).toHaveText("grid layout");
  await expect(c.getByRole("button", { name: "Grid" })).toHaveAttribute("data-pressed", "");
});

test("right-clicking a node opens the context menu; Escape closes it", async ({ mount, page }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await c.locator("[data-graph-surface]").click({ button: "right" });
  const focus = page.getByRole("menuitem", { name: "Focus" });
  await expect(focus).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(focus).toHaveCount(0);
});
