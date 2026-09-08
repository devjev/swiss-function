import { expect, test } from "@playwright/experimental-ct-react";
import type { SankeyLink, SankeyNode } from "./SankeyChart";
import { SankeyHarness } from "./SankeyChart.harness";

const NODES: SankeyNode[] = [
  { id: "revenue", name: "Revenue" },
  { id: "ops", name: "Operations" },
  { id: "rnd", name: "R&D" },
  { id: "salaries", name: "Salaries" },
  { id: "rent", name: "Rent" },
  { id: "cloud", name: "Cloud" },
];
const LINKS: SankeyLink[] = [
  { source: "revenue", target: "ops", value: 60 },
  { source: "revenue", target: "rnd", value: 40 },
  { source: "ops", target: "salaries", value: 40 },
  { source: "ops", target: "rent", value: 20 },
  { source: "rnd", target: "salaries", value: 30 },
  { source: "rnd", target: "cloud", value: 10 },
];

test("renders one node per node, one ribbon per link, and the labels", async ({ mount }) => {
  const c = await mount(<SankeyHarness nodes={NODES} links={LINKS} height={280} />);
  await expect(c.locator("svg rect[data-chart-mark]")).toHaveCount(6);
  await expect(c.locator("svg path[data-chart-mark]")).toHaveCount(6);
  await expect(c.locator("svg text")).toHaveCount(6);
  await expect(c.locator("svg text").filter({ hasText: "Revenue" })).toHaveCount(1);
});

test("hovering a node shows its totals and lights only its incident ribbons", async ({ mount }) => {
  const c = await mount(<SankeyHarness nodes={NODES} links={LINKS} height={280} />);
  await c.getByRole("button", { name: /^Operations:/ }).hover();
  await expect(c.page().getByText("in 60 · out 60")).toBeVisible();
  await expect(c.locator("svg path[data-lit]")).toHaveCount(3);
  await expect(c.locator("svg path[data-faded]")).toHaveCount(3);
  await expect(c.locator("svg rect[data-faded]")).toHaveCount(2);
});

test("hovering a ribbon shows its value and share of the source", async ({ mount }) => {
  const c = await mount(<SankeyHarness nodes={NODES} links={LINKS} height={280} />);
  await c.getByRole("button", { name: "Revenue to R&D: 40" }).hover();
  await expect(c.page().getByText("40 · 40% of Revenue")).toBeVisible();
});

test("click and Enter report the node or link datum", async ({ mount }) => {
  const c = await mount(<SankeyHarness nodes={NODES} links={LINKS} height={280} />);
  await c.getByRole("button", { name: /^Cloud:/ }).click();
  await expect(c.getByTestId("log")).toHaveText("node:cloud");
  await c.getByRole("button", { name: "Operations to Rent: 20" }).focus();
  await c.page().keyboard.press("Enter");
  await expect(c.getByTestId("log")).toHaveText("node:cloud,link:ops>rent");
});

test("selectable: a click pins a popover, a second click on the same mark clears it", async ({
  mount,
}) => {
  const c = await mount(<SankeyHarness nodes={NODES} links={LINKS} height={280} controlled />);
  const node = c.getByRole("button", { name: /^Salaries:/ });
  await node.click();
  await expect(c.getByTestId("selection")).toHaveText("node:salaries");
  await expect(c.page().getByRole("dialog")).toContainText("in 70");
  await expect(node).toHaveAttribute("data-selected", "");
  await node.click();
  await expect(c.getByTestId("selection")).toHaveText("none");
});

test("a link that closes a cycle is drawn dashed but keeps the layering acyclic", async ({
  mount,
}) => {
  const c = await mount(
    <SankeyHarness
      nodes={NODES}
      links={[...LINKS, { source: "salaries", target: "revenue", value: 10 }]}
      height={280}
    />,
  );
  await expect(c.locator("svg path[data-chart-mark]")).toHaveCount(7);
  await expect(c.locator('svg path[class*="linkCyclic"]')).toHaveCount(1);
  const revenue = await c.getByRole("button", { name: /^Revenue:/ }).boundingBox();
  const salaries = await c.getByRole("button", { name: /^Salaries:/ }).boundingBox();
  if (!revenue || !salaries) throw new Error("missing nodes");
  expect(revenue.x).toBeLessThan(salaries.x);
});

test("justify moves an early sink to the last column; left keeps it in place", async ({
  mount,
}) => {
  const nodes: SankeyNode[] = [...NODES, { id: "tax", name: "Tax" }];
  const links: SankeyLink[] = [...LINKS, { source: "revenue", target: "tax", value: 5 }];
  const justified = await mount(<SankeyHarness nodes={nodes} links={links} height={280} />);
  const taxJ = await justified.getByRole("button", { name: /^Tax:/ }).boundingBox();
  const salJ = await justified.getByRole("button", { name: /^Salaries:/ }).boundingBox();
  if (!taxJ || !salJ) throw new Error("missing nodes");
  expect(Math.abs(taxJ.x - salJ.x)).toBeLessThan(1);
  await justified.unmount();
  const left = await mount(<SankeyHarness nodes={nodes} links={links} height={280} align="left" />);
  const taxL = await left.getByRole("button", { name: /^Tax:/ }).boundingBox();
  const opsL = await left.getByRole("button", { name: /^Operations:/ }).boundingBox();
  if (!taxL || !opsL) throw new Error("missing nodes");
  expect(Math.abs(taxL.x - opsL.x)).toBeLessThan(1);
});

test("labels off and the framed posture", async ({ mount }) => {
  const c = await mount(
    <SankeyHarness
      nodes={NODES}
      links={LINKS}
      height={280}
      labels="none"
      frame
      scaffolding="full"
      showValues
    />,
  );
  await expect(c.locator("svg text")).toHaveCount(0);
  await expect(c.locator('[class*="frame"]')).toHaveCount(1);
  await expect(c.locator('[data-scaffolding="full"]')).toHaveCount(1);
});

test("showValues prints the flow after each name", async ({ mount }) => {
  const c = await mount(<SankeyHarness nodes={NODES} links={LINKS} height={280} showValues />);
  await expect(c.locator("svg text").filter({ hasText: "Revenue" })).toContainText("100");
});
