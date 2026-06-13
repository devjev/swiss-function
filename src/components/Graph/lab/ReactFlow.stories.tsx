// PROTOTYPE — Phase 2 candidate 2.3: React Flow (@xyflow/react) + elkjs.
// Throwaway lab story used only to benchmark this candidate via
// `scripts/probe-graph.mjs`. Deleted/kept-as-reference after the Phase 3 pick
// (Task 3.3). Exposes the [data-graph-*] hook contract recorded in PLAN §9 so
// the harness can measure interaction latency comparably across candidates.
//
// What this candidate is for: React Flow renders each node as a real React DOM
// element, so it is the node-richness champion (arbitrary custom content per
// node). The trade-off is raw scale — 10k DOM nodes is heavy — which is exactly
// what the harness is here to quantify. `onlyRenderVisibleElements` culls
// offscreen nodes so the LARGE fixture stays navigable.
//
// Layout breadth here: force = elkjs `org.eclipse.elk.force` (stress/force
// engine), hierarchical/tree = elkjs `org.eclipse.elk.layered`. elkjs also
// offers `radial` and the React Flow ecosystem trivially supports a grid —
// i.e. all five required layouts — but the prototype wires only the two the
// harness needs (force + one hierarchical) per the Phase 2 brief.

import type { Story } from "@ladle/react";
import {
  Background,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LARGE, MEDIUM } from "../../../lib/graph/fixtures";
import type { GraphData } from "../../../lib/graph/types";

import "@xyflow/react/dist/style.css";

export default { title: "Graph/lab/ReactFlow" };

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

type LabLayout = "force" | "layered";

const elk = new ELK();

// Run an elkjs layout over the fixture and return positioned React Flow nodes
// + edges. elkjs is async (it runs in a worker via the bundled build), so the
// caller awaits this; for LARGE we bound the force engine's iterations so the
// layout stays tractable on the main thread (mirrors the Sigma/Cytoscape caps).
async function elkLayout(
  data: GraphData,
  layout: LabLayout,
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const large = data.nodes.length > 2000;
  const algorithm = layout === "layered" ? "layered" : "force";
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": algorithm,
      "elk.direction": "DOWN",
      // Bound the force engine so LARGE doesn't block the main thread for
      // minutes (the same finding the other candidates hit with their force/
      // hierarchical engines).
      "elk.force.iterations": large ? "70" : "300",
      "elk.spacing.nodeNode": large ? "20" : "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": large ? "30" : "60",
    },
    children: data.nodes.map((n) => ({ id: n.id, width: 12, height: 12 })),
    edges: data.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const res = await elk.layout(graph);
  const labelEvery = data.nodes.length <= 300;
  const nodes: Node[] = (res.children ?? []).map((c, i) => {
    const src = data.nodes[i];
    return {
      id: c.id,
      position: { x: c.x ?? 0, y: c.y ?? 0 },
      data: { label: labelEvery ? (src?.label ?? src?.id) : "", payload: src?.data },
      // Inline minimal style — themed via tokens; the point of this candidate is
      // that each node is a real DOM element capable of arbitrary content.
      style: {
        width: 12,
        height: 12,
        padding: 0,
        fontSize: 8,
        background: nodeColor(src?.kind),
        color: token("--sf-color-primary-fg", "#fff"),
        border: "none",
        borderRadius: "var(--sf-radius-default)",
      },
    };
  });
  const edges: Edge[] = data.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: { stroke: token("--sf-color-border-subtle", "#e5e7eb") },
  }));
  return { nodes, edges };
}

function ReactFlowLabInner({ data }: { data: GraphData }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();
  const [layout, setLayout] = useState<LabLayout>("force");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Screen position of one reference node, exposed as the [data-graph-node]
  // hit target so the headless harness can click/hover/right-click on it.
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(null);
  const firstId = useRef<string | null>(data.nodes[0]?.id ?? null);

  const placeProbe = useCallback(() => {
    const id = firstId.current;
    if (!id) return;
    const surface = surfaceRef.current;
    const n = rf.getNode(id);
    if (!n || !surface) return;
    const vp = rf.getViewport();
    const w = (n.measured?.width ?? 12) / 2;
    const h = (n.measured?.height ?? 12) / 2;
    setProbePos({
      x: (n.position.x + w) * vp.zoom + vp.x,
      y: (n.position.y + h) * vp.zoom + vp.y,
    });
  }, [rf]);

  // Build + lay out, keyed by data + layout. The first paint after the initial
  // layout sets [data-graph-ready] for the harness's layoutMs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: placeProbe is stable via rf
  useEffect(() => {
    let cancelled = false;
    elkLayout(data, layout).then(({ nodes: ns, edges: es }) => {
      if (cancelled) return;
      setNodes(ns);
      setEdges(es);
      requestAnimationFrame(() => {
        rf.fitView({ padding: 0.1 });
        requestAnimationFrame(() => {
          surfaceRef.current?.setAttribute("data-graph-ready", "");
          placeProbe();
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [data, layout, rf]);

  const cycleLayout = () => setLayout((l) => (l === "force" ? "layered" : "force"));

  return (
    <div style={{ display: "grid", gap: "var(--sf-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button type="button" data-graph-control onClick={() => rf.zoomIn()}>
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
        ref={surfaceRef}
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onlyRenderVisibleElements
          minZoom={0.01}
          proOptions={{ hideAttribution: true }}
          onMove={placeProbe}
          onNodeClick={(_, n) => setSelected(n.id)}
          onNodeMouseEnter={(evt, n) =>
            setTooltip({
              x: evt.clientX,
              y: evt.clientY,
              label: String((n.data as { label?: string }).label ?? n.id),
            })
          }
          onNodeMouseLeave={() => setTooltip(null)}
          onNodeContextMenu={(evt, n) => {
            evt.preventDefault();
            setSelected(n.id);
            const r = surfaceRef.current?.getBoundingClientRect();
            setMenu({ x: evt.clientX - (r?.left ?? 0), y: evt.clientY - (r?.top ?? 0) });
          }}
        >
          <Background color={token("--sf-color-border-subtle", "#e5e7eb")} />
        </ReactFlow>
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
              position: "fixed",
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

function ReactFlowLab({ data }: { data: GraphData }) {
  // Memoize so a parent re-render doesn't rebuild the provider tree.
  const content = useMemo(() => <ReactFlowLabInner data={data} />, [data]);
  return <ReactFlowProvider>{content}</ReactFlowProvider>;
}

export const Medium: Story = () => <ReactFlowLab data={MEDIUM} />;
export const Large: Story = () => <ReactFlowLab data={LARGE} />;
