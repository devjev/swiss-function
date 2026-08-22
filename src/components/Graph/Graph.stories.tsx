import type { Story } from "@ladle/react";
import { type ReactNode, useState } from "react";
import { LARGE, MEDIUM, SMALL } from "../../lib/graph/fixtures";
import type { GraphData, LayoutKind } from "../../lib/graph/types";
import { Graph } from "./Graph";

export default { title: "Graph" };

const LAYOUTS: LayoutKind[] = ["force", "tree", "org", "radial", "concentric", "grid"];

// --- Org-chart fixture ------------------------------------------------------
// A deterministic ~40-person org with titles: CEO → 4 departments → teams with
// IC lists of varying size, so leaf stacking has something to compress.
function makeOrg(deep = false): GraphData {
  const nodes: GraphData["nodes"] = [];
  const edges: GraphData["edges"] = [];
  let e = 0;
  const add = (id: string, label: string, sublabel: string, kind: string, parent?: string) => {
    nodes.push({ id, label, sublabel, kind });
    if (parent) edges.push({ id: `e${e++}`, source: parent, target: id });
  };
  add("ceo", "Vera Meier", "Chief Executive", "primary");
  const departments: Array<[string, string, number, number]> = [
    ["eng", "Engineering", 3, 4],
    ["ops", "Operations", 2, 3],
    ["fin", "Finance", 1, 3],
    ["sales", "Sales", 2, 5],
  ];
  for (const [dept, deptName, teams, icsPerTeam] of departments) {
    add(dept, `${deptName} Lead`, `VP ${deptName}`, "secondary", "ceo");
    for (let t = 0; t < teams; t++) {
      const teamId = `${dept}-t${t}`;
      add(teamId, `${deptName} Team ${t + 1}`, "Team Lead", "tertiary", dept);
      const ics = deep ? icsPerTeam * 4 : icsPerTeam;
      for (let i = 0; i < ics; i++) {
        add(`${teamId}-p${i}`, `Person ${dept}.${t}.${i}`, "Engineer", "quaternary", teamId);
      }
    }
  }
  return { nodes, edges };
}
const ORG = makeOrg();
const ORG_DEEP = makeOrg(true);
// The org plus one dotted-line reporting relationship (a non-tree edge: the
// engineer also reports to the Operations lead).
const ORG_DOTTED: GraphData = {
  ...ORG,
  edges: [...ORG.edges, { id: "dotline", source: "ops", target: "eng-t0-p0" }],
};

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

// --- Org chart --------------------------------------------------------------
// The hierarchical layout with card nodes: name + title inside each card, a
// kind-coloured accent stripe, tidy spacing by real card widths, and the IC
// lists compressed via leaf stacking.

export const OrgChart: Story = () => (
  <Frame>
    <Graph
      data={ORG_DOTTED}
      layout="org"
      nodeStyle="card"
      layoutOptions={{ org: { rootId: "ceo", stack: "leaves" } }}
      renderEdge={(e) => (e.id === "dotline" ? { style: "dotted" } : undefined)}
      style={{ blockSize: 560 }}
    >
      <Graph.Controls />
      <Graph.Minimap />
    </Graph>
  </Frame>
);

interface OrgDeepArgs {
  stack: "none" | "leaves" | "depth2" | "auto";
}

/** The same org with 4× the ICs — flip `stack` to compare the horizontal-space
 *  strategies (pure tidy vs IC lists vs depth stacking vs container-fit). */
export const OrgChartDeep: Story<OrgDeepArgs> = ({ stack }) => (
  <Frame>
    <Graph
      data={ORG_DEEP}
      layout="org"
      nodeStyle="card"
      layoutOptions={{
        org: {
          rootId: "ceo",
          stack: stack === "depth2" ? { depth: 2 } : stack,
        },
      }}
      style={{ blockSize: 560 }}
    >
      <Graph.Controls />
      <Graph.Minimap />
    </Graph>
  </Frame>
);
OrgChartDeep.args = { stack: "leaves" };
OrgChartDeep.argTypes = {
  stack: { options: ["none", "leaves", "depth2", "auto"], control: { type: "radio" } },
};

/** `stack: "auto"` in a narrow container: the layout measures the viewport and
 *  stacks progressively until the chart's aspect fits. */
export const OrgChartAuto: Story = () => (
  <div style={{ inlineSize: 420 }}>
    <Graph
      data={ORG_DEEP}
      layout="org"
      nodeStyle="card"
      layoutOptions={{ org: { rootId: "ceo", stack: "auto" } }}
      style={{ blockSize: 640 }}
    >
      {/* Narrow container: keep zoom/fit/reset, drop the layout switcher. */}
      <Graph.Controls layouts={[]} />
    </Graph>
  </div>
);

// --- Edge styles ------------------------------------------------------------
// Per-edge line styles via `renderEdge` (solid / dashed / dotted, arrowheads
// kept), and per-state overrides via `edgeStateVisuals` (here: the hovered
// node's incident edges go dashed).

const styleTrio: GraphData = {
  nodes: [
    { id: "s1", label: "Solid", kind: "primary" },
    { id: "s2", label: "solid →", kind: "secondary" },
    { id: "d1", label: "Dashed", kind: "primary" },
    { id: "d2", label: "dashed →", kind: "secondary" },
    { id: "o1", label: "Dotted", kind: "primary" },
    { id: "o2", label: "dotted →", kind: "secondary" },
  ],
  edges: [
    { id: "es", source: "s1", target: "s2", data: { style: "solid" } },
    { id: "ed", source: "d1", target: "d2", data: { style: "dashed" } },
    { id: "eo", source: "o1", target: "o2", data: { style: "dotted" } },
  ],
};

export const EdgeStyles: Story = () => (
  <Frame>
    <Graph
      data={styleTrio}
      layout="grid"
      layoutOptions={{ grid: { columns: 2 } }}
      renderEdge={(e) => ({ style: e.data?.style as "solid" | "dashed" | "dotted" })}
      edgeStateVisuals={{ incident: { style: "dashed" } }}
      style={{ blockSize: 420 }}
    />
  </Frame>
);

/** Cards under a non-org layout: screen-referenced sizing, same program. */
export const Cards: Story = () => (
  <Frame>
    <Graph data={ORG} layout="tree" nodeStyle="card" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

// --- Layout options ---------------------------------------------------------
// `layoutOptions` tunes the active layout in place (only the active layout's
// block is read). Here the tree grows left-to-right with wider levels; a forced
// 4-column grid and a spread-out force layout show the other knobs. Switching
// layout from the toolbar keeps the options that apply to the new layout and
// falls back to size-derived defaults for the rest.

export const LayoutTuning: Story = () => (
  <Frame>
    <Graph
      data={SMALL}
      defaultLayout="tree"
      layoutOptions={{
        tree: { direction: "right", levelGap: 1.4 },
        grid: { columns: 4 },
        force: { scalingRatio: 20, gravity: 2 },
      }}
      style={{ blockSize: 520 }}
    >
      <Graph.Controls />
    </Graph>
  </Frame>
);

// --- Dense node content -----------------------------------------------------
// Arbitrary structured `data` per node/edge, surfaced via the
// `renderNode`/`renderEdge` escape hatches as visual attributes.

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

// --- Hover highlight --------------------------------------------------------
// Hover a node: its incident edges (both directions) light up and its
// neighbours stay lit while the rest of the graph fades, so a node's
// connections read at a glance. On by default (`highlightConnectionsOnHover`);
// the paired story turns it off to keep hover to just the label box.

export const HoverHighlight: Story = () => (
  <Frame>
    <Graph data={services} layout="force" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

export const HoverHighlightOff: Story = () => (
  <Frame>
    <Graph
      data={services}
      layout="force"
      highlightConnectionsOnHover={false}
      style={{ blockSize: 520 }}
    >
      <Graph.Controls />
    </Graph>
  </Frame>
);

// --- Selection --------------------------------------------------------------
// Clicking a node gives it a persistent emphasis (accent fill + ring), the node
// analogue of the selected-edge double stroke — no `renderNode` round-trip
// needed. Clicking the stage clears it. Uncontrolled here; `onSelectionChange`
// still reports the id.

export const SelectedNode: Story = () => (
  <Frame>
    <Graph data={services} layout="force" style={{ blockSize: 520 }}>
      <Graph.Controls />
    </Graph>
  </Frame>
);

// Controlled selection: the `selected` prop drives the highlight (here from an
// out-of-canvas list), and `selectedNodeVisual` retints the emphasis.
export const ControlledSelection: Story = () => {
  const [selected, setSelected] = useState<string | null>(services.nodes[0]?.id ?? null);
  return (
    <Frame>
      <div style={{ display: "flex", gap: "var(--sf-unit)", flexWrap: "wrap" }}>
        {services.nodes.slice(0, 6).map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSelected(n.id)}
            style={{ fontSize: "var(--sf-font-size-sm)" }}
          >
            {n.label ?? n.id}
          </button>
        ))}
      </div>
      <Graph
        data={services}
        layout="force"
        selected={selected}
        selectedNodeVisual={{ color: "var(--sf-color-success)" }}
        onSelectionChange={setSelected}
        style={{ blockSize: 480 }}
      >
        <Graph.Controls />
      </Graph>
    </Frame>
  );
};

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

// --- Editable relationships -------------------------------------------------
// `editable` adds a Connect toggle to the toolbar: turn it on, then drag from one
// node to another to draw an edge. Right-click an edge (or select it and press
// Delete/Backspace) to remove it. The Graph updates its view instantly and fires
// onEdgeCreate / onEdgeDelete; this story persists both into local state so the
// changes survive (and the camera/layout stay put across updates).

const EDITABLE_SEED: GraphData = {
  nodes: [
    { id: "ingest", label: "Ingest", kind: "primary" },
    { id: "queue", label: "Queue", kind: "secondary" },
    { id: "worker", label: "Worker", kind: "secondary" },
    { id: "store", label: "Store", kind: "tertiary" },
    { id: "api", label: "API", kind: "quaternary" },
  ],
  edges: [
    { id: "s1", source: "ingest", target: "queue", label: "enqueue" },
    { id: "s2", source: "queue", target: "worker", label: "consume" },
    { id: "s3", source: "worker", target: "store", label: "write" },
  ],
};

export const Editable: Story = () => {
  const [data, setData] = useState<GraphData>(EDITABLE_SEED);
  const [log, setLog] = useState<string[]>([]);
  const note = (msg: string) => setLog((l) => [msg, ...l].slice(0, 6));

  return (
    <Frame>
      <Graph
        data={data}
        layout="tree"
        style={{ blockSize: 520 }}
        editable
        onEdgeCreate={(edge) => {
          setData((d) => ({ ...d, edges: [...d.edges, edge] }));
          note(`created ${edge.source} → ${edge.target}`);
        }}
        onEdgeDelete={(id) => {
          setData((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
          note(`deleted ${id}`);
        }}
      >
        <Graph.Controls />
      </Graph>
      <p style={{ marginBlockStart: "0.75rem", fontFamily: "var(--sf-font-mono)" }}>
        {log.length === 0 ? "Toggle Connect, then drag node → node." : log.join("  ·  ")}
      </p>
    </Frame>
  );
};

// --- Embedded (fill + frameless) --------------------------------------------
// `fill` makes the graph take its parent's height instead of the fixed default,
// and `frame={false}` drops the component's own border so it doesn't double up
// with a surrounding container. Here the graph fills a fixed-height bordered box
// and re-fits to it on resize (try dragging the box's corner).

export const Embedded: Story = () => (
  <Frame>
    <div
      style={{
        blockSize: 420,
        resize: "both",
        overflow: "hidden",
        border: "1px solid var(--sf-color-border)",
        borderRadius: "var(--sf-radius-default)",
      }}
    >
      <Graph data={services} layout="radial" fill frame={false}>
        <Graph.Controls />
      </Graph>
    </div>
  </Frame>
);
