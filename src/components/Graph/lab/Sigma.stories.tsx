// PROTOTYPE — Phase 2 candidate 2.1: Sigma.js + graphology (WebGL renderer).
// Throwaway lab story used only to benchmark this candidate via
// `scripts/probe-graph.mjs`. Deleted/kept-as-reference after the Phase 3 pick
// (Task 3.3). Exposes the [data-graph-*] hook contract recorded in PLAN §9 so
// the harness can measure interaction latency comparably across candidates.

import type { Story } from "@ladle/react";
import Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import { LARGE, MEDIUM } from "../../../lib/graph/fixtures";
import type { GraphData } from "../../../lib/graph/types";

export default { title: "Graph/lab/Sigma" };

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

type LabLayout = "force" | "circular";

function buildGraph(data: GraphData): Graph {
  const g = new Graph();
  for (const n of data.nodes) {
    g.addNode(n.id, {
      label: n.label ?? n.id,
      kind: n.kind,
      size: 3,
      x: Math.random(),
      y: Math.random(),
      color: nodeColor(n.kind),
      payload: n.data,
    });
  }
  for (const e of data.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.id)) {
      g.addEdgeWithKey(e.id, e.source, e.target, {
        size: Math.max(0.4, (e.weight ?? 0.5) * 1.5),
        color: token("--sf-color-border-subtle", "#e5e7eb"),
      });
    }
  }
  return g;
}

function applyLayout(g: Graph, layout: LabLayout): void {
  if (layout === "circular") {
    circular.assign(g);
  } else {
    forceAtlas2.assign(g, {
      iterations: g.order > 2000 ? 80 : 200,
      settings: forceAtlas2.inferSettings(g),
    });
  }
}

function SigmaLab({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [layout, setLayout] = useState<LabLayout>("force");
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Screen position of one reference node, exposed as the [data-graph-node]
  // hit target so the headless harness can click/hover/right-click on it.
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(null);

  // Build + render once, keyed by data identity.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const g = buildGraph(data);
    applyLayout(g, "force");
    graphRef.current = g;
    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary"),
      labelColor: { color: token("--sf-color-fg", "#0a0a0a") },
      labelFont: token("--sf-font-sans", "system-ui"),
      renderLabels: g.order <= 300,
      allowInvalidContainer: true,
    });
    sigmaRef.current = renderer;

    renderer.on("clickNode", ({ node }) => setSelected(node));
    renderer.on("enterNode", ({ node }) => {
      const p = renderer.getNodeDisplayData(node);
      if (p) setTooltip({ x: p.x, y: p.y, label: g.getNodeAttribute(node, "label") });
    });
    renderer.on("leaveNode", () => setTooltip(null));
    renderer.on("rightClickNode", ({ node, event }) => {
      setSelected(node);
      setMenu({ x: event.x, y: event.y });
    });

    const placeProbe = () => {
      const first = g.nodes()[0];
      if (!first) return;
      const vp = renderer.getNodeDisplayData(first);
      if (vp) setProbePos({ x: vp.x, y: vp.y });
    };
    renderer.on("afterRender", placeProbe);
    placeProbe();
    // Signal first stable layout paint for the harness's layoutMs.
    requestAnimationFrame(() => container.setAttribute("data-graph-ready", ""));

    return () => {
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
  }, [data]);

  // Re-layout on layout switch.
  useEffect(() => {
    const g = graphRef.current;
    const renderer = sigmaRef.current;
    if (!g || !renderer) return;
    applyLayout(g, layout);
    renderer.refresh();
  }, [layout]);

  const cycleLayout = () => setLayout((l) => (l === "force" ? "circular" : "force"));

  return (
    <div style={{ display: "grid", gap: "var(--sf-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button
          type="button"
          data-graph-control
          onClick={() => {
            const cam = sigmaRef.current?.getCamera();
            cam?.animatedZoom({ duration: 200 });
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

export const Medium: Story = () => <SigmaLab data={MEDIUM} />;
export const Large: Story = () => <SigmaLab data={LARGE} />;
