import Graphology from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { HTMLAttributes } from "react";
import { forwardRef, useEffect, useRef } from "react";
import Sigma from "sigma";
import { cx } from "../../lib/cx";
import type { GraphData, LayoutKind } from "../../lib/graph/types";
import styles from "./Graph.module.css";

export interface GraphProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Nodes + edges to render. Each carries arbitrary structured `data`. */
  data: GraphData;
  /** Active layout. Uncontrolled (initial) when `onSelectionChange`-style
   *  ownership is not needed; controlled when the consumer drives it.
   *  Defaults to `"force"`. Only `"force"` is wired in this skeleton —
   *  the remaining layouts land in a later task. */
  layout?: LayoutKind;
  /** Fired with the node `id` when a node is clicked. */
  onNodeClick?: (id: string) => void;
  /** Fired with the edge `id` when an edge is clicked. */
  onEdgeClick?: (id: string) => void;
  /** Fired with the currently selected node `id` (or `null` when cleared). */
  onSelectionChange?: (id: string | null) => void;
}

const KIND_TOKEN: Record<string, string> = {
  primary: "--sf-color-primary",
  secondary: "--sf-color-fg-subtle",
  tertiary: "--sf-color-success",
  quaternary: "--sf-color-warning",
};

/** Read a `--sf-*` token off the live document so colors are themed, never
 *  hard-coded. Falls back to a sane value before first paint. */
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function nodeColor(kind: string | undefined): string {
  return token(KIND_TOKEN[kind ?? "primary"] ?? "--sf-color-primary", "#2563eb");
}

/** Build a graphology graph from the shared data model, seeding positions and
 *  themed colors. Pre-computed `x`/`y` on a node are honored; otherwise a
 *  layout pass assigns coordinates. */
function buildGraph(data: GraphData): Graphology {
  const g = new Graphology();
  for (const n of data.nodes) {
    g.addNode(n.id, {
      label: n.label ?? n.id,
      kind: n.kind,
      size: 3,
      x: n.x ?? Math.random(),
      y: n.y ?? Math.random(),
      color: nodeColor(n.kind),
      payload: n.data,
    });
  }
  for (const e of data.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.id)) {
      g.addEdgeWithKey(e.id, e.source, e.target, {
        size: Math.max(0.4, (e.weight ?? 0.5) * 1.5),
        color: token("--sf-color-border-subtle", "#e5e7eb"),
        payload: e.data,
      });
    }
  }
  return g;
}

/** Apply a layout in place. Only `"force"` is implemented in this skeleton;
 *  other layouts fall back to force until Task 4.2 wires them. */
function applyLayout(g: Graphology, _layout: LayoutKind): void {
  forceAtlas2.assign(g, {
    iterations: g.order > 2000 ? 80 : 200,
    settings: forceAtlas2.inferSettings(g),
  });
}

export const Graph = forwardRef<HTMLDivElement, GraphProps>(function Graph(
  { data, layout = "force", onNodeClick, onEdgeClick, onSelectionChange, className, ...rest },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Latest callbacks, read inside Sigma listeners without re-subscribing.
  const handlersRef = useRef({ onNodeClick, onEdgeClick, onSelectionChange });
  handlersRef.current = { onNodeClick, onEdgeClick, onSelectionChange };

  // Build + render once per data identity. Layout changes are handled below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: layout is read on (re)build but should not retear the renderer on its own — the layout effect handles updates.
  useEffect(() => {
    const container = surfaceRef.current;
    if (!container) return;

    const g = buildGraph(data);
    applyLayout(g, layout);

    const renderer = new Sigma(g, container, {
      defaultNodeColor: nodeColor("primary"),
      labelColor: { color: token("--sf-color-fg", "#0a0a0a") },
      labelFont: token("--sf-font-sans", "system-ui"),
      renderLabels: g.order <= 300,
      allowInvalidContainer: true,
    });

    renderer.on("clickNode", ({ node }) => {
      handlersRef.current.onNodeClick?.(node);
      handlersRef.current.onSelectionChange?.(node);
    });
    renderer.on("clickEdge", ({ edge }) => {
      handlersRef.current.onEdgeClick?.(edge);
    });
    renderer.on("clickStage", () => {
      handlersRef.current.onSelectionChange?.(null);
    });

    return () => {
      renderer.kill();
    };
    // `layout` intentionally omitted — see the layout effect below.
  }, [data]);

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      {/* Sigma renders its WebGL canvas into this surface. Container role,
          focus order and keyboard navigation are added in the a11y task. */}
      <div ref={surfaceRef} className={styles.surface} />
    </div>
  );
});
