// PROTOTYPE — Phase 2 candidate 2.2: Cytoscape.js (+ fcose / dagre).
// Throwaway lab story used only to benchmark this candidate via
// `scripts/probe-graph.mjs`. Deleted/kept-as-reference after the Phase 3 pick
// (Task 3.3). Exposes the [data-graph-*] hook contract recorded in PLAN §9 so
// the harness can measure interaction latency comparably across candidates.
//
// Layout breadth here: force = `fcose` (extension), hierarchical/tree = `dagre`
// (extension). Cytoscape also natively offers `concentric`, `grid`, `circular`
// (radial) — i.e. all five required layouts — but the prototype only wires the
// two the harness needs (force + one hierarchical) per the Phase 2 brief.

import type { Story } from "@ladle/react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import fcose from "cytoscape-fcose";
import { useEffect, useRef, useState } from "react";
import { LARGE, MEDIUM } from "../../../lib/graph/fixtures";
import type { GraphData } from "../../../lib/graph/types";

cytoscape.use(fcose);
cytoscape.use(cytoscapeDagre);

export default { title: "Graph/lab/Cytoscape" };

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

type LabLayout = "force" | "dagre";

function toElements(data: GraphData): cytoscape.ElementDefinition[] {
  const els: cytoscape.ElementDefinition[] = [];
  const ids = new Set<string>();
  for (const n of data.nodes) {
    ids.add(n.id);
    els.push({
      group: "nodes",
      data: {
        id: n.id,
        label: n.label ?? n.id,
        color: nodeColor(n.kind),
        payload: n.data,
      },
    });
  }
  for (const e of data.edges) {
    if (ids.has(e.source) && ids.has(e.target)) {
      els.push({
        group: "edges",
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          width: Math.max(0.5, (e.weight ?? 0.5) * 2),
        },
      });
    }
  }
  return els;
}

function layoutOptions(layout: LabLayout, count: number): cytoscape.LayoutOptions {
  if (layout === "dagre") {
    // The hierarchical engine. `dagre` gives the nicest layered output but its
    // run time is super-linear: on 10k nodes / 20k edges it blocks the main
    // thread for minutes (an unusable layout-switch — a finding in itself). For
    // the LARGE fixture we fall back to Cytoscape's native, tractable
    // `breadthfirst` tree layout so the layout-switch stays interactive and the
    // harness can measure it; MEDIUM keeps the prettier `dagre`.
    if (count > 2000) {
      // biome-ignore lint/suspicious/noExplicitAny: extension/native layout names not in core typings
      return { name: "breadthfirst", animate: false, spacingFactor: 0.6 } as any;
    }
    // biome-ignore lint/suspicious/noExplicitAny: extension layout name not in core typings
    return { name: "dagre", rankDir: "TB", animate: false } as any;
  }
  // fcose: for large graphs we drop to the "draft" (spectral-only) tier and hard-
  // cap the incremental cose iterations so layout time stays bounded — fcose's
  // default 2500 iterations on 10k nodes runs for minutes synchronously and
  // blocks the main thread (mirrors the Sigma prototype's bounded iteration cap).
  const large = count > 2000;
  return {
    name: "fcose",
    quality: large ? "draft" : "default",
    numIter: large ? 250 : 2500,
    animate: false,
    randomize: true,
    // biome-ignore lint/suspicious/noExplicitAny: extension layout name not in core typings
  } as any;
}

function CytoscapeLab({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
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
    const count = data.nodes.length;
    const cy = cytoscape({
      container,
      elements: toElements(data),
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            width: 8,
            height: 8,
            label: count <= 300 ? "data(label)" : "",
            color: token("--sf-color-fg", "#0a0a0a"),
            "font-family": token("--sf-font-sans", "system-ui"),
            "font-size": 8,
          },
        },
        {
          selector: "edge",
          style: {
            width: "data(width)",
            "line-color": token("--sf-color-border-subtle", "#e5e7eb"),
            "curve-style": "haystack",
          },
        },
        {
          selector: "node:selected",
          style: { "background-color": token("--sf-color-primary", "#2563eb") },
        },
      ],
      // Large-graph rendering hints: skip motion-blur/texture churn while idle.
      textureOnViewport: count > 2000,
      pixelRatio: 1,
      wheelSensitivity: 0.2,
    });
    cyRef.current = cy;

    const placeProbe = () => {
      const first = cy.nodes().first();
      if (!first || first.empty()) return;
      const p = first.renderedPosition();
      setProbePos({ x: p.x, y: p.y });
    };

    cy.on("tap", "node", (evt) => setSelected(evt.target.id()));
    cy.on("mouseover", "node", (evt) => {
      const p = evt.target.renderedPosition();
      setTooltip({ x: p.x, y: p.y, label: evt.target.data("label") });
    });
    cy.on("mouseout", "node", () => setTooltip(null));
    cy.on("cxttap", "node", (evt) => {
      setSelected(evt.target.id());
      const p = evt.target.renderedPosition();
      setMenu({ x: p.x, y: p.y });
    });
    cy.on("render pan zoom", placeProbe);

    cy.layout(layoutOptions("force", count)).run();
    cy.fit(undefined, 24);
    placeProbe();
    // Signal first stable layout paint for the harness's layoutMs.
    requestAnimationFrame(() => container.setAttribute("data-graph-ready", ""));

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data]);

  // Re-layout on layout switch.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout(layoutOptions(layout, cy.nodes().length)).run();
    cy.fit(undefined, 24);
  }, [layout]);

  const cycleLayout = () => setLayout((l) => (l === "force" ? "dagre" : "force"));

  return (
    <div style={{ display: "grid", gap: "var(--sf-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button
          type="button"
          data-graph-control
          onClick={() => {
            const cy = cyRef.current;
            if (cy) cy.zoom({ level: cy.zoom() * 1.4, renderedPosition: { x: 640, y: 380 } });
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

export const Medium: Story = () => <CytoscapeLab data={MEDIUM} />;
export const Large: Story = () => <CytoscapeLab data={LARGE} />;
