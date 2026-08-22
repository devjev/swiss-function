import { expect, test } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import type { GraphData } from "../../lib/graph/types";
import { GraphHarness, GraphRemovableHarness } from "./Graph.harness";

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

test("nodeStyle=card renders nodes through the card program", async ({ mount }) => {
  const c = await mount(<GraphHarness nodeStyle="card" displayProbe />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await expect(c.getByTestId("display-probe")).toHaveAttribute("data-type-hub", "card");
});

test("clicking a card fires onNodeClick (GPU picking over the rect)", async ({ mount }) => {
  const c = await mount(<GraphHarness nodeStyle="card" />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await c.locator("[data-graph-surface]").click();
  await expect(c.getByTestId("last-event")).toHaveText("click:hub");
});

test("a force graph reaches both ready and settled (worker-settle path)", async ({ mount }) => {
  // Force layouts always settle in the FA2 worker when one can spawn (real
  // browsers, including this CT harness), so `ready` (seed-paint, the graph
  // is already interactive) and `settled` (background settle finished) are
  // two genuinely separate, sequential signals rather than one frame. This
  // just checks both eventually land.
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

test("hovering a node fires onNodeHover with its id, and null on leave", async ({
  mount,
  page,
}) => {
  // The probe reports each node's real viewport position (Sigma is WebGL, no
  // per-node DOM); `grid` lays A/B out deterministically so we can aim at A.
  const c = await mount(<GraphHarness data={pair} layout="grid" probe />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);

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

  // Start in an empty corner, then step onto A so Sigma registers the hover-enter.
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.move(a.x, a.y, { steps: 6 });
  await expect(c.getByTestId("last-event")).toHaveText("hover:a");

  // Move back off the node; the leave fires with null.
  await page.mouse.move(box.x + 4, box.y + 4, { steps: 6 });
  await expect(c.getByTestId("last-event")).toHaveText("hover:null");
});

test("layoutOptions.grid.columns changes the column count", async ({ mount }) => {
  const parse = (s: string | null) => {
    const [x, y] = (s ?? "").split(",").map(Number);
    return { x: x ?? Number.NaN, y: y ?? Number.NaN };
  };
  const gap = async (c: Awaited<ReturnType<typeof mount>>) => {
    const probe = c.getByTestId("node-pos");
    const a = parse(await probe.getAttribute("data-pos-a"));
    const b = parse(await probe.getAttribute("data-pos-b"));
    return { x: Math.abs(a.x - b.x), y: Math.abs(a.y - b.y) };
  };

  // Default grid on two nodes = 2 columns: A and B sit side by side (different x).
  const wide = await mount(<GraphHarness data={pair} layout="grid" probe />);
  await expect(wide.locator("[data-graph-ready]")).toHaveCount(1);
  expect((await gap(wide)).x).toBeGreaterThan(10);
  await wide.unmount();

  // Forcing a single column stacks them: (near) same x, different y.
  const tall = await mount(
    <GraphHarness data={pair} layout="grid" layoutOptions={{ grid: { columns: 1 } }} probe />,
  );
  await expect(tall.locator("[data-graph-ready]")).toHaveCount(1);
  const d = await gap(tall);
  expect(d.x).toBeLessThan(2);
  expect(d.y).toBeGreaterThan(10);
});

// Boss with a manager subtree and three leaf ICs — the org-layout fixture.
const orgData: GraphData = {
  nodes: [
    { id: "boss", label: "Boss", sublabel: "CEO", kind: "primary" },
    { id: "mgr", label: "Manager", sublabel: "VP", kind: "secondary" },
    { id: "report", label: "Report", kind: "tertiary" },
    // Short labels all clamp to the minimum card width, so the stacked
    // members' centres align exactly (members are left-aligned; different
    // widths would offset the centres the probe reports).
    { id: "ic1", label: "IC 1", kind: "quaternary" },
    { id: "ic2", label: "IC 2", kind: "quaternary" },
    { id: "ic3", label: "IC 3", kind: "quaternary" },
  ],
  edges: [
    { id: "o1", source: "boss", target: "mgr" },
    { id: "o2", source: "mgr", target: "report" },
    { id: "o3", source: "boss", target: "ic1" },
    { id: "o4", source: "boss", target: "ic2" },
    { id: "o5", source: "boss", target: "ic3" },
  ],
};

test("Controls layouts prop restricts the switcher to the given layouts", async ({ mount }) => {
  const c = await mount(<GraphHarness controlsLayouts={["tree", "grid"]} />);
  await expect(c.getByRole("button", { name: "Tree" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Grid" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Force" })).toHaveCount(0);
  await expect(c.getByRole("button", { name: "Org" })).toHaveCount(0);
});

test("Controls layouts={[]} removes the layout switcher entirely", async ({ mount }) => {
  const c = await mount(<GraphHarness controlsLayouts={[]} />);
  // The rest of the toolbar stays.
  await expect(c.getByRole("button", { name: "Reset view" })).toBeVisible();
  await expect(c.getByRole("group", { name: "Layout" })).toHaveCount(0);
});

test("renderEdge style routes the edge to the dash-capable arrow program", async ({ mount }) => {
  const c = await mount(
    <GraphHarness data={pairLinked} layout="grid" edgeStyleAll="dashed" displayProbe />,
  );
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await expect(c.getByTestId("display-probe")).toHaveAttribute("data-type-e-e1", "styledArrow");
});

test("the Org layout toggle fires onLayoutChange and marks itself pressed", async ({ mount }) => {
  const c = await mount(<GraphHarness />);
  await c.getByRole("button", { name: "Org" }).click();
  await expect(c.getByTestId("last-event")).toHaveText("layout:org");
  await expect(c.getByRole("button", { name: "Org" })).toHaveAttribute("data-pressed", "");
});

test("org layout stacks leaf children into one x column under their parent", async ({ mount }) => {
  const c = await mount(
    <GraphHarness
      data={orgData}
      layout="org"
      nodeStyle="card"
      layoutOptions={{ org: { rootId: "boss", stack: "leaves" } }}
      probe
    />,
  );
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const probe = c.getByTestId("node-pos");
  const parse = (s: string | null) => {
    const [x, y] = (s ?? "").split(",").map(Number);
    return { x: x ?? Number.NaN, y: y ?? Number.NaN };
  };
  const ic1 = parse(await probe.getAttribute("data-pos-ic1"));
  const ic2 = parse(await probe.getAttribute("data-pos-ic2"));
  const ic3 = parse(await probe.getAttribute("data-pos-ic3"));
  // Same-width leaf cards list in one column…
  expect(Math.abs(ic1.x - ic2.x)).toBeLessThan(2);
  expect(Math.abs(ic2.x - ic3.x)).toBeLessThan(2);
  // …top to bottom.
  expect(ic2.y).toBeGreaterThan(ic1.y);
  expect(ic3.y).toBeGreaterThan(ic2.y);
  // The manager stays a regular card on its rank, above the boss's IC list end.
  const boss = parse(await probe.getAttribute("data-pos-boss"));
  const mgr = parse(await probe.getAttribute("data-pos-mgr"));
  expect(mgr.y).toBeGreaterThan(boss.y);
});

test("layoutOptions.org.levelGap re-lays out the chart", async ({ mount }) => {
  const parse = (s: string | null) => {
    const [x, y] = (s ?? "").split(",").map(Number);
    return { x: x ?? Number.NaN, y: y ?? Number.NaN };
  };
  const rankGap = async (c: Awaited<ReturnType<typeof mount>>) => {
    const probe = c.getByTestId("node-pos");
    const boss = parse(await probe.getAttribute("data-pos-boss"));
    const mgr = parse(await probe.getAttribute("data-pos-mgr"));
    return mgr.y - boss.y;
  };
  const tight = await mount(
    <GraphHarness
      data={orgData}
      layout="org"
      nodeStyle="card"
      layoutOptions={{ org: { rootId: "boss", levelGap: 20 } }}
      probe
    />,
  );
  await expect(tight.locator("[data-graph-ready]")).toHaveCount(1);
  const tightGap = await rankGap(tight);
  await tight.unmount();

  const loose = await mount(
    <GraphHarness
      data={orgData}
      layout="org"
      nodeStyle="card"
      layoutOptions={{ org: { rootId: "boss", levelGap: 120 } }}
      probe
    />,
  );
  await expect(loose.locator("[data-graph-ready]")).toHaveCount(1);
  expect(await rankGap(loose)).toBeGreaterThan(tightGap);
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

// --- Node selection (issue #91) -------------------------------------------

// Read the surface origin + a node's probe position into an absolute click
// point (Sigma is WebGL — no per-node DOM to target; the probe reports the
// live viewport centre of each node).
async function nodePoint(c: Locator, id: string): Promise<{ x: number; y: number }> {
  const box = await c.locator("[data-graph-surface]").boundingBox();
  if (!box) throw new Error("no surface box");
  const parts = ((await c.getByTestId("node-pos").getAttribute(`data-pos-${id}`)) ?? "").split(",");
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (Number.isNaN(x) || Number.isNaN(y)) throw new Error("no node position");
  return { x: box.x + x, y: box.y + y };
}

// Note: Sigma's mount inside CT captures the first canvas pointer interaction
// and swallows a second in the same session (the existing specs likewise never
// chain two canvas clicks — they select an edge then press Backspace, never
// click-then-click). So each spec here exercises ONE canvas click; the chained
// flows (select then move, select then clear on stage) are covered by the Ladle
// end-to-end pass in a real browser.

test("clicking a node fires onSelectionChange and gives it a persistent highlight", async ({
  mount,
  page,
}) => {
  const c = await mount(<GraphHarness data={pair} layout="grid" probe selectionProbe />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const probe = c.getByTestId("selection-probe");
  // Nothing selected at rest.
  await expect(probe).toHaveAttribute("data-hl-a", "0");

  const a = await nodePoint(c, "a");
  await page.mouse.click(a.x, a.y);
  await expect(c.getByTestId("last-selection")).toHaveText("a");
  // The selected node is highlighted; the other stays plain — no `renderNode`
  // round-trip, the emphasis is built in.
  await expect(probe).toHaveAttribute("data-hl-a", "1");
  await expect(probe).toHaveAttribute("data-hl-b", "0");
});

test("the controlled `selected` prop drives the highlight without a click", async ({ mount }) => {
  const c = await mount(<GraphHarness data={pair} layout="grid" selected="b" selectionProbe />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const probe = c.getByTestId("selection-probe");
  await expect(probe).toHaveAttribute("data-hl-b", "1");
  await expect(probe).toHaveAttribute("data-hl-a", "0");
});

test("`selected={null}` selects nothing", async ({ mount }) => {
  const c = await mount(<GraphHarness data={pair} layout="grid" selected={null} selectionProbe />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  await expect(c.getByTestId("selection-probe")).toHaveAttribute("data-hl-a", "0");
  await expect(c.getByTestId("selection-probe")).toHaveAttribute("data-hl-b", "0");
});

test("uncontrolled: removing the selected node from data reports the clear", async ({
  mount,
  page,
}) => {
  const c = await mount(<GraphRemovableHarness />);
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const a = await nodePoint(c, "a");
  await page.mouse.click(a.x, a.y);
  await expect(c.getByTestId("last-selection")).toHaveText("a");
  // Removing the selected node from `data` clears the highlight AND reports it,
  // so a consumer tracking selection via the callback doesn't keep a stale id.
  await c.getByTestId("remove-a").click();
  await expect(c.getByTestId("last-selection")).toHaveText("null");
});

test("controlled selection ignores a click the consumer doesn't apply", async ({ mount, page }) => {
  // `selected="a"` fixed with no wiring back: clicking b reports the event but
  // the highlight stays on a (the prop is the source of truth). One canvas click.
  const c = await mount(
    <GraphHarness data={pair} layout="grid" selected="a" probe selectionProbe />,
  );
  await expect(c.locator("[data-graph-ready]")).toHaveCount(1);
  const probe = c.getByTestId("selection-probe");
  await expect(probe).toHaveAttribute("data-hl-a", "1");

  const b = await nodePoint(c, "b");
  await page.mouse.click(b.x, b.y);
  await expect(c.getByTestId("last-selection")).toHaveText("b");
  // Highlight did not move — a is still the selected node.
  await expect(probe).toHaveAttribute("data-hl-a", "1");
  await expect(probe).toHaveAttribute("data-hl-b", "0");
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
