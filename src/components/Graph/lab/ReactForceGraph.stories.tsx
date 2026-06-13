// PROTOTYPE — Phase 2 candidate 2.5: react-force-graph (force-graph 2D / canvas).
// Throwaway lab story used only to benchmark this candidate via
// `scripts/probe-graph.mjs`. Deleted/kept-as-reference after the Phase 3 pick
// (Task 3.3). Exposes the [data-graph-*] hook contract recorded in PLAN §9 so
// the harness can measure interaction latency comparably across candidates.
//
// react-force-graph ships several entry points (2D canvas, 3D/three.js,
// VR, AR). The 2D canvas variant (`react-force-graph-2d`) is the relevant
// one for this library — a flat, dense, Swiss/Bauhaus graph view; the 3D/VR
// builds drag in three.js and are out of scope. This is the d3-force
// "reference baseline" candidate from the §9 shortlist.

import type { Story } from "@ladle/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import { LARGE, MEDIUM } from "../../../lib/graph/fixtures";
import type { GraphData } from "../../../lib/graph/types";

export default { title: "Graph/lab/ReactForceGraph" };

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

// react-force-graph node/link shapes. `kind`/`payload` are our own fields.
type FgNode = {
  id: string;
  label: string;
  kind?: string;
  payload?: Record<string, unknown>;
};
type FgLink = { id: string; source: string; target: string; weight: number };
type FgData = { nodes: FgNode[]; links: FgLink[] };

// "force" = unconstrained d3-force; "tree" = top-down DAG mode (hierarchical).
type LabLayout = "force" | "tree";

function toFgData(data: GraphData): FgData {
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      label: n.label ?? n.id,
      kind: n.kind,
      payload: n.data,
    })),
    links: data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      weight: e.weight ?? 0.5,
    })),
  };
}

function ReactForceGraphLab({ data }: { data: GraphData }) {
  const fgRef = useRef<ForceGraphMethods<FgNode, FgLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const refNodeRef = useRef<NodeObject<FgNode> | null>(null);
  const [layout, setLayout] = useState<LabLayout>("force");
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Screen position of one reference node, exposed as the [data-graph-node]
  // hit target so the headless harness can click/hover/right-click on it.
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(null);

  const fgData = useMemo(() => toFgData(data), [data]);
  const isLarge = data.nodes.length > 2000;

  const fg = () => fgRef.current;
  const fgEl = () => wrapRef.current;
  const edgeColor = token("--sf-color-border-subtle", "#e5e7eb");
  const labelColor = token("--sf-color-fg", "#0a0a0a");

  // Keep the [data-graph-node] overlay glued to one reference node by
  // projecting its graph coords through the live viewport transform.
  const placeProbe = () => {
    const node = refNodeRef.current;
    const api = fg();
    if (!node || !api || node.x == null || node.y == null) return;
    const s = api.graph2ScreenCoords(node.x, node.y);
    setProbePos({ x: s.x, y: s.y });
  };

  // Pick the reference node once data is present.
  useEffect(() => {
    refNodeRef.current = (fgData.nodes[0] as NodeObject<FgNode>) ?? null;
    setProbePos(null);
  }, [fgData]);

  const cycleLayout = () => setLayout((l) => (l === "force" ? "tree" : "force"));

  return (
    <div style={{ display: "grid", gap: "var(--sf-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button
          type="button"
          data-graph-control
          onClick={() => {
            const api = fg();
            if (api) api.zoom(api.zoom() * 1.4, 200);
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
        ref={wrapRef}
        style={{
          position: "relative",
          width: 1280,
          height: 760,
          maxWidth: "100%",
          border: "1px solid var(--sf-color-border)",
          borderRadius: "var(--sf-radius-default)",
          background: "var(--sf-color-bg)",
          overflow: "hidden",
        }}
      >
        <ForceGraph2D<FgNode, FgLink>
          ref={fgRef}
          width={1280}
          height={760}
          graphData={fgData}
          backgroundColor={token("--sf-color-bg", "#ffffff")}
          dagMode={layout === "tree" ? "td" : undefined}
          dagLevelDistance={40}
          nodeRelSize={3}
          nodeColor={(n) => nodeColor((n as FgNode).kind)}
          nodeLabel={(n) => (n as FgNode).label}
          linkColor={() => edgeColor}
          linkWidth={(l) => Math.max(0.4, (l as FgLink).weight * 1.5)}
          linkDirectionalArrowLength={isLarge ? 0 : 2}
          linkDirectionalArrowColor={() => edgeColor}
          // Render labels only when the graph is small enough to stay legible
          // (mirrors the Sigma prototype's renderLabels threshold).
          nodeCanvasObjectMode={() => (data.nodes.length <= 300 ? "after" : "replace")}
          nodeCanvasObject={(node, ctx, scale) => {
            const n = node as NodeObject<FgNode>;
            if (n.x == null || n.y == null) return;
            ctx.fillStyle = nodeColor(n.kind);
            ctx.beginPath();
            ctx.arc(n.x, n.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            if (data.nodes.length <= 300) {
              ctx.fillStyle = labelColor;
              ctx.font = `${12 / scale}px ${token("--sf-font-sans", "system-ui")}`;
              ctx.fillText(n.label, n.x + 4, n.y + 3);
            }
          }}
          // Bound the simulation so LARGE settles instead of running forever
          // (matches how the other candidates cap their force iterations).
          warmupTicks={isLarge ? 20 : 0}
          cooldownTicks={isLarge ? 60 : Number.POSITIVE_INFINITY}
          onEngineStop={() => {
            placeProbe();
            const el = fgEl();
            if (el) requestAnimationFrame(() => el.setAttribute("data-graph-ready", ""));
          }}
          onZoom={placeProbe}
          onNodeClick={(node) => setSelected(String((node as FgNode).id))}
          onNodeHover={(node) => {
            const n = node as NodeObject<FgNode> | null;
            const api = fg();
            if (n && api && n.x != null && n.y != null) {
              const s = api.graph2ScreenCoords(n.x, n.y);
              setTooltip({ x: s.x, y: s.y, label: n.label });
            } else {
              setTooltip(null);
            }
          }}
          onNodeRightClick={(node, event) => {
            setSelected(String((node as FgNode).id));
            const el = fgEl();
            const rect = el?.getBoundingClientRect();
            setMenu({
              x: event.clientX - (rect?.left ?? 0),
              y: event.clientY - (rect?.top ?? 0),
            });
          }}
        />
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

export const Medium: Story = () => <ReactForceGraphLab data={MEDIUM} />;
export const Large: Story = () => <ReactForceGraphLab data={LARGE} />;
