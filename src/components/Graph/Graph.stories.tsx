import type { Story } from "@ladle/react";
import type { ReactNode } from "react";
import { LARGE, MEDIUM, SMALL } from "../../lib/graph/fixtures";
import type { GraphData, LayoutKind } from "../../lib/graph/types";
import { Graph } from "./Graph";

export default { title: "Graph" };

const LAYOUTS: LayoutKind[] = ["force", "tree", "radial", "concentric", "grid"];

/** Frame wrapper: a sized box so the graph has room. The Graph root has its own
 *  default height; we give it a taller one here for a fuller view. */
function Frame({ children }: { children: ReactNode }) {
  return <div style={{ inlineSize: "min(64rem, 100%)" }}>{children}</div>;
}

// --- Playground -------------------------------------------------------------

interface PlaygroundArgs {
  size: "small" | "medium" | "large";
  layout: LayoutKind;
}

const FIXTURES: Record<PlaygroundArgs["size"], GraphData> = {
  small: SMALL,
  medium: MEDIUM,
  large: LARGE,
};

export const Playground: Story<PlaygroundArgs> = ({ size, layout }) => (
  <Frame>
    <Graph data={FIXTURES[size]} layout={layout} style={{ blockSize: 520 }}>
      <Graph.Controls />
      <Graph.Minimap />
    </Graph>
  </Frame>
);
Playground.args = { size: "small", layout: "force" };
Playground.argTypes = {
  size: { options: ["small", "medium", "large"], control: { type: "radio" } },
  layout: { options: LAYOUTS, control: { type: "select" } },
};

// --- One story per layout ---------------------------------------------------
// SMALL (100 nodes ≤ the 300-node label threshold) so labels render and each
// layout's shape is legible.

export const Force: Story = () => (
  <Frame>
    <Graph data={SMALL} layout="force" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

export const Tree: Story = () => (
  <Frame>
    <Graph data={SMALL} layout="tree" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

export const Radial: Story = () => (
  <Frame>
    <Graph data={SMALL} layout="radial" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

export const Concentric: Story = () => (
  <Frame>
    <Graph data={SMALL} layout="concentric" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

export const Grid: Story = () => (
  <Frame>
    <Graph data={SMALL} layout="grid" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

// --- Dense node content -----------------------------------------------------
// Arbitrary structured `data` per node/edge, surfaced two ways: visual
// attributes via the `renderNode`/`renderEdge` escape hatches, and the full
// record via the hover/click inspector.

const services: GraphData = {
  nodes: [
    {
      id: "gw",
      label: "API Gateway",
      kind: "primary",
      data: { tier: "edge", rps: 4200, slo: "99.95%" },
    },
    {
      id: "auth",
      label: "Auth",
      kind: "secondary",
      data: { tier: "core", rps: 3100, slo: "99.9%" },
    },
    {
      id: "orders",
      label: "Orders",
      kind: "secondary",
      data: { tier: "core", rps: 1800, slo: "99.9%" },
    },
    {
      id: "pay",
      label: "Payments",
      kind: "tertiary",
      data: { tier: "core", rps: 950, slo: "99.99%" },
    },
    {
      id: "ledger",
      label: "Ledger",
      kind: "tertiary",
      data: { tier: "core", rps: 600, slo: "99.99%" },
    },
    {
      id: "search",
      label: "Search",
      kind: "quaternary",
      data: { tier: "support", rps: 2400, slo: "99.5%" },
    },
    {
      id: "cache",
      label: "Cache",
      kind: "quaternary",
      data: { tier: "support", rps: 8800, slo: "99.5%" },
    },
    {
      id: "db",
      label: "Primary DB",
      kind: "primary",
      data: { tier: "data", rps: 5200, slo: "99.99%" },
    },
  ],
  edges: [
    { id: "e1", source: "gw", target: "auth", label: "verify", weight: 0.9, data: { p99: "12ms" } },
    {
      id: "e2",
      source: "gw",
      target: "orders",
      label: "route",
      weight: 0.7,
      data: { p99: "40ms" },
    },
    {
      id: "e3",
      source: "gw",
      target: "search",
      label: "query",
      weight: 0.6,
      data: { p99: "55ms" },
    },
    {
      id: "e4",
      source: "orders",
      target: "pay",
      label: "charge",
      weight: 0.8,
      data: { p99: "120ms" },
    },
    {
      id: "e5",
      source: "pay",
      target: "ledger",
      label: "post",
      weight: 0.5,
      data: { p99: "30ms" },
    },
    {
      id: "e6",
      source: "orders",
      target: "db",
      label: "write",
      weight: 0.9,
      data: { p99: "18ms" },
    },
    { id: "e7", source: "search", target: "cache", label: "read", weight: 1, data: { p99: "3ms" } },
    {
      id: "e8",
      source: "auth",
      target: "cache",
      label: "session",
      weight: 0.7,
      data: { p99: "2ms" },
    },
  ],
};

/**
 * `renderNode` sizes each node by its request rate and the `renderEdge` hatch is
 * left to the weight-derived default. Hover or click any node/edge to inspect
 * its full `data` record.
 */
export const DenseContent: Story = () => (
  <Frame>
    <Graph
      data={services}
      layout="tree"
      style={{ blockSize: 520 }}
      renderNode={(node) => {
        const rps = Number(node.data?.rps ?? 0);
        return { size: 6 + Math.round(rps / 1000) };
      }}
    >
      <Graph.Controls />
    </Graph>
  </Frame>
);

// --- Context menu -----------------------------------------------------------
// Right-click a node for the built-in menu: Focus / Expand (camera), Pin label,
// Hide. The `contextMenuItems` prop can replace these per target; this story
// uses the defaults so every action does something real.

export const ContextMenu: Story = () => (
  <Frame>
    <Graph data={services} layout="radial" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

// --- Large stress -----------------------------------------------------------
// The LARGE fixture: 10k nodes / ~20k edges. Labels are culled at this scale;
// pan/zoom, the controls, and the minimap stay responsive.

export const LargeStress: Story = () => (
  <Frame>
    <Graph data={LARGE} layout="force" style={{ blockSize: 600 }}>
      <Graph.Controls />
      <Graph.Minimap />
    </Graph>
  </Frame>
);
