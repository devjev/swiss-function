// PROTOTYPE — Phase 2 candidate 2.4: G6 (AntV) — canvas/WebGL renderer.
// Throwaway lab story used only to benchmark this candidate via
// `scripts/probe-graph.mjs`. Deleted/kept-as-reference after the Phase 3 pick
// (Task 3.3). Exposes the [data-graph-*] hook contract recorded in PLAN §9 so
// the harness can measure interaction latency comparably across candidates.

import type { GraphData as G6Data, IElementEvent, LayoutOptions, NodeData } from "@antv/g6";
import { Graph } from "@antv/g6";
import type { Story } from "@ladle/react";
import { useEffect, useRef, useState } from "react";
import { LARGE, MEDIUM } from "../../../lib/graph/fixtures";
import type { GraphData } from "../../../lib/graph/types";

export default { title: "Graph/lab/G6" };

// Read a --sf-* token off the live document so the prototype is themed, not
// hard-coded (the §7 "themable" gate). Falls back to a sane value pre-paint.
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const KIND_TOKEN: Record<string, string> = {
  primary: "--sf-color-primary",
  secondary: "--sf-color-fg-subtle",
  tertiary: "--sf-color-success",
  quaternary: "--sf-color-warning",
};

function nodeColor(kind: string | undefined): string {
  return token(KIND_TOKEN[kind ?? "primary"] ?? "--sf-color-primary", "#2563eb");
}

// G6's force layout ("d3-force") and a hierarchical layout ("antv-dagre").
// On LARGE, dagre is super-linear (same wall G6/Cytoscape hit), so the
// layout-switch falls back to the tractable "grid" layout there — mirroring how
// the Sigma/Cytoscape prototypes bounded their expensive engines.
type LabLayout = "force" | "hierarchical";

function toG6Data(data: GraphData): G6Data {
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      data: { kind: n.kind ?? "primary", label: n.label ?? n.id, payload: n.data },
    })),
    edges: data.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function layoutOption(layout: LabLayout, order: number): LayoutOptions {
  if (layout === "hierarchical") {
    // dagre scales poorly past a few thousand nodes; use grid on LARGE.
    return order > 2000
      ? { type: "grid" }
      : { type: "antv-dagre", rankdir: "TB", nodesep: 12, ranksep: 24 };
  }
  // Bounded force (like the other prototypes) so LARGE settles in finite time.
  return order > 2000
    ? { type: "d3-force", iterations: 40 }
    : { type: "d3-force", iterations: 120 };
}

function G6Lab({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [layout, setLayout] = useState<LabLayout>("force");
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Screen position of one reference node, exposed as the [data-graph-node]
  // hit target so the headless harness can click/hover/right-click on it.
  // G6 paints to a single canvas, so (as with Sigma/Cytoscape) there is no
  // per-node DOM — the overlay is the harness's hit target.
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(null);

  // Build + render once, keyed by data identity.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const order = data.nodes.length;
    const graph = new Graph({
      container,
      data: toG6Data(data),
      autoResize: false,
      node: {
        style: {
          size: order > 2000 ? 6 : 12,
          fill: (d: NodeData) => nodeColor(d.data?.kind as string | undefined),
          stroke: token("--sf-color-bg", "#ffffff"),
          lineWidth: 1,
          labelText: order <= 300 ? (d: NodeData) => (d.data?.label as string) ?? d.id : undefined,
          labelFill: token("--sf-color-fg", "#0a0a0a"),
          labelFontFamily: token("--sf-font-sans", "system-ui"),
          labelFontSize: 11,
        },
      },
      edge: {
        style: { stroke: token("--sf-color-border-subtle", "#e5e7eb"), lineWidth: 1 },
      },
      layout: layoutOption("force", order),
      behaviors: ["drag-canvas", "zoom-canvas", "click-select"],
    });
    graphRef.current = graph;

    const firstId = data.nodes[0]?.id;
    const placeProbe = () => {
      if (firstId == null) return;
      try {
        const pos = graph.getElementPosition(firstId);
        const client = graph.getClientByCanvas([pos[0], pos[1]]);
        const rect = container.getBoundingClientRect();
        setProbePos({ x: client[0] - rect.x, y: client[1] - rect.y });
      } catch {
        // element not yet rendered
      }
    };

    graph.on("node:click", (e: IElementEvent) => setSelected(e.target.id));
    graph.on("node:pointerenter", (e: IElementEvent) => {
      try {
        const datum = graph.getNodeData(e.target.id);
        const pos = graph.getElementPosition(e.target.id);
        const client = graph.getClientByCanvas([pos[0], pos[1]]);
        const rect = container.getBoundingClientRect();
        setTooltip({
          x: client[0] - rect.x,
          y: client[1] - rect.y,
          label: (datum.data?.label as string) ?? e.target.id,
        });
      } catch {
        // ignore
      }
    });
    graph.on("node:pointerleave", () => setTooltip(null));
    graph.on("node:contextmenu", (e: IElementEvent) => {
      setSelected(e.target.id);
      const rect = container.getBoundingClientRect();
      setMenu({ x: e.client.x - rect.x, y: e.client.y - rect.y });
    });
    graph.on("afterrender", placeProbe);
    graph.on("afterdraw", placeProbe);

    graph.render().then(() => {
      placeProbe();
      // Signal first stable layout paint for the harness's layoutMs.
      requestAnimationFrame(() => container.setAttribute("data-graph-ready", ""));
    });

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [data]);

  // Re-layout on layout switch.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.setLayout(layoutOption(layout, data.nodes.length));
    graph.layout();
  }, [layout, data.nodes.length]);

  const cycleLayout = () => setLayout((l) => (l === "force" ? "hierarchical" : "force"));

  return (
    <div style={{ display: "grid", gap: "var(--sf-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button
          type="button"
          data-graph-control
          onClick={() => {
            graphRef.current?.zoomBy(1.2);
          }}
        >
          Zoom in
        </button>
        <button type="button" data-graph-layout-next onClick={cycleLayout}>
          Layout: {layout}
        </button>
        <span style={{ color: "var(--sf-color-fg)" }}>
          {data.nodes.length} nodes / {data.edges.length} edges
        </span>
      </div>
      <div
        data-graph-surface
        ref={containerRef}
        style={{
          position: "relative",
          width: 1280,
          height: 760,
          maxWidth: "100%",
          border: "1px solid var(--sf-color-border)",
          borderRadius: "var(--sf-radius-default)",
          background: "var(--sf-color-bg)",
        }}
      >
        {probePos && (
          <div
            data-graph-node
            style={{
              position: "absolute",
              left: probePos.x - 8,
              top: probePos.y - 8,
              width: 16,
              height: 16,
              pointerEvents: "none",
            }}
          />
        )}
        {selected && (
          <div data-graph-selected hidden>
            {selected}
          </div>
        )}
        {tooltip && (
          <div
            data-graph-tooltip
            style={{
              position: "absolute",
              left: tooltip.x + 8,
              top: tooltip.y + 8,
              padding: "var(--sf-space-1) var(--sf-space-2)",
              background: "var(--sf-color-bg)",
              color: "var(--sf-color-fg)",
              border: "1px solid var(--sf-color-border)",
              borderRadius: "var(--sf-radius-default)",
              font: "var(--sf-font-size-sm)/1.3 var(--sf-font-sans)",
              pointerEvents: "none",
            }}
          >
            {tooltip.label}
          </div>
        )}
        {menu && (
          <ul
            data-graph-context-menu
            style={{
              position: "absolute",
              left: menu.x,
              top: menu.y,
              margin: 0,
              padding: "var(--sf-space-1)",
              listStyle: "none",
              background: "var(--sf-color-bg)",
              color: "var(--sf-color-fg)",
              border: "1px solid var(--sf-color-border)",
              borderRadius: "var(--sf-radius-default)",
            }}
          >
            <li style={{ padding: "var(--sf-space-1) var(--sf-space-2)" }}>Focus</li>
            <li style={{ padding: "var(--sf-space-1) var(--sf-space-2)" }}>Hide</li>
          </ul>
        )}
      </div>
    </div>
  );
}

export const Medium: Story = () => <G6Lab data={MEDIUM} />;
export const Large: Story = () => <G6Lab data={LARGE} />;
