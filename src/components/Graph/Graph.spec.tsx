import { expect, test } from "@playwright/experimental-ct-react";
import type { GraphData } from "../../lib/graph/types";
import { GraphHarness } from "./Graph.harness";

// Two nodes, no edge. With `layout="grid"` they land left + right at the same
// height (deterministic), so connect-drag / edge-click specs have stable hit
// targets: `a` ≈ ¼ width, `b` ≈ ¾ width, both at mid-height.
const pair: GraphData = {
  nodes: [
    { id: "a", label: "A", kind: "primary" },
    { id: "b", label: "B", kind: "secondary" },
  ],
  edges: [],
};
// `pair` with the edge `a → b` already present (for delete specs).
const pairLinked: GraphData = {
  ...pair,
  edges: [{ id: "e1", source: "a", target: "b", label: "link" }],
};

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

test("small graphs mark ready and settled together (synchronous layout path)", async ({
  mount,
}) => {
  // Below the worker-settle threshold the deferred initial layout is computed
  // synchronously, so the seed-paint (`ready`) and layout-at-rest (`settled`)
  // signals land in the same frame.
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await expect(c.locator("[data-graph-settled]")).toHaveCount(1);
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

// --- Relationship editing -------------------------------------------------

test("the Connect toggle is hidden unless editable", async ({ mount }) => {
  const ro = await mount(<GraphHarness />);
  await expect(ro.getByRole("button", { name: "Connect nodes" })).toHaveCount(0);
});

test("the Connect toggle reflects pressed state when editable", async ({ mount }) => {
  const c = await mount(<GraphHarness editable />);
  const connect = c.getByRole("button", { name: "Connect nodes" });
  await expect(connect).toBeVisible();
  await connect.click();
  await expect(connect).toHaveAttribute("data-pressed", "");
  await expect(connect).toHaveAttribute("aria-pressed", "true");
});

test("dragging node→node in Connect mode fires onEdgeCreate", async ({ mount, page }) => {
  // The probe reports each node's real viewport position, so the drag targets the
  // actual nodes (Sigma paints to WebGL — there's no per-node DOM to aim at).
  const c = await mount(<GraphHarness data={pair} editable layout="grid" probe />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await c.getByRole("button", { name: "Connect nodes" }).click();

  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  const probe = c.getByTestId("node-pos");
  const parse = (s: string | null): { x: number; y: number } => {
    const parts = (s ?? "").split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (Number.isNaN(x) || Number.isNaN(y)) throw new Error("no node position");
    return { x: box.x + x, y: box.y + y };
  };
  const a = parse(await probe.getAttribute("data-pos-a"));
  const b = parse(await probe.getAttribute("data-pos-b"));

  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  // Step the move so Sigma registers the hover-enter on B before the release.
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();

  await expect(c.getByTestId("last-event")).toHaveText("create:a->b");
});

test("selecting an edge and pressing Backspace fires onEdgeDelete", async ({ mount, page }) => {
  // `pairLinked` has edge e1 between A (¼) and B (¾); its midpoint is the centre.
  const c = await mount(<GraphHarness data={pairLinked} editable layout="grid" />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);

  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  // Click the edge midpoint to select it.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(c.getByTestId("last-event")).toHaveText("edgeclick:e1");

  // Surface keeps focus; Backspace deletes the selected edge.
  await c.locator("[data-graph-surface]").press("Backspace");
  await expect(c.getByTestId("last-event")).toHaveText("delete:e1");
});

test("right-clicking an edge offers Delete which fires onEdgeDelete", async ({ mount, page }) => {
  const c = await mount(<GraphHarness data={pairLinked} editable layout="grid" />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);

  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });

  const del = page.getByRole("menuitem", { name: "Delete" });
  await expect(del).toBeVisible();
  await del.click();
  await expect(c.getByTestId("last-event")).toHaveText("delete:e1");
});

// --- Layout: fill + frame -------------------------------------------------

test("the default frame draws a border", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-root]")).toHaveCSS("border-top-width", "1px");
});

test("frame={false} removes the component's border", async ({ mount }) => {
  const c = await mount(<GraphHarness frame={false} />);
  await expect(c.locator("[data-graph-root]")).toHaveCSS("border-top-width", "0px");
});

test("fill makes the graph fill its parent's height", async ({ mount }) => {
  // The harness wraps the graph in a 600×400 box.
  const c = await mount(<GraphHarness fill />);
  await expect(c.locator("[data-graph-root]")).toHaveCSS("height", "400px");
});

test("without fill the graph keeps its fixed default height", async ({ mount }) => {
  // 24 × --sf-unit (1.5rem @ 16px) = 576px.
  const c = await mount(<GraphHarness />);
  await expect(c.locator("[data-graph-root]")).toHaveCSS("height", "576px");
});
