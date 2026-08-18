import { useEffect, useState } from "react";
import type { GraphData } from "../../lib/graph/types";
import { useGraphInternals } from "./context";
import { Graph, type GraphProps } from "./Graph";

// A single, centered node makes a reliable canvas click target: with one node
// the camera frames it at the surface centre, so a centre-click lands on it
// (Sigma paints to WebGL — there is no per-node DOM to target). `renderNode`
// blows it up to a generous size so the hit is unambiguous.
const single: GraphData = {
  nodes: [{ id: "hub", label: "Hub", kind: "primary", data: { role: "center" } }],
  edges: [],
};

/** Reports each node's current viewport-pixel centre (surface-relative) onto a
 *  `data-pos-<id>="x,y"` attribute, recomputed whenever the layout settles
 *  (`epoch`). Lets WebGL specs target real node positions instead of guessing —
 *  there is no per-node DOM to query. */
function NodeProbe() {
  const { getRenderer, getGraph, epoch } = useGraphInternals();
  const [pos, setPos] = useState<Record<string, string>>({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on every `epoch` bump (graph (re)built / layout settled); the getters are stable.
  useEffect(() => {
    const renderer = getRenderer();
    const g = getGraph();
    if (!renderer || !g) return;
    const next: Record<string, string> = {};
    g.forEachNode((id) => {
      const vp = renderer.graphToViewport({
        x: g.getNodeAttribute(id, "x") as number,
        y: g.getNodeAttribute(id, "y") as number,
      });
      next[id] = `${vp.x},${vp.y}`;
    });
    setPos(next);
  }, [epoch]);

  const attrs: Record<string, string> = {};
  for (const [id, xy] of Object.entries(pos)) attrs[`data-pos-${id}`] = xy;
  return <div data-testid="node-pos" {...attrs} />;
}

/** Reports each node's post-reducer `highlighted` display flag onto a
 *  `data-hl-<id>="1|0"` attribute, refreshed after every Sigma paint. Lets a
 *  spec assert the selected-node emphasis (a WebGL visual with no per-node DOM)
 *  without reading pixels: a selected node's reducer sets `highlighted: true`. */
function SelectionProbe() {
  const { getRenderer, getGraph, epoch } = useGraphInternals();
  const [flags, setFlags] = useState<Record<string, string>>({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe on every `epoch` bump; the getters are stable.
  useEffect(() => {
    const renderer = getRenderer();
    const g = getGraph();
    if (!renderer || !g) return;
    const read = () => {
      const next: Record<string, string> = {};
      g.forEachNode((id) => {
        next[id] = renderer.getNodeDisplayData(id)?.highlighted ? "1" : "0";
      });
      setFlags((prev) => {
        for (const k of Object.keys(next)) if (prev[k] !== next[k]) return next;
        return Object.keys(prev).length === Object.keys(next).length ? prev : next;
      });
    };
    renderer.on("afterRender", read);
    read();
    return () => {
      renderer.off("afterRender", read);
    };
  }, [epoch]);

  const attrs: Record<string, string> = {};
  for (const [id, hl] of Object.entries(flags)) attrs[`data-hl-${id}`] = hl;
  return <div data-testid="selection-probe" {...attrs} />;
}

interface HarnessProps extends Partial<GraphProps> {
  /** Also render the minimap overlay. */
  minimap?: boolean;
  /** Render the node-position probe (for WebGL targeting in specs). */
  probe?: boolean;
  /** Render the selection probe (`data-hl-<id>` per-node highlight flags). */
  selectionProbe?: boolean;
}

/** Test harness for `Graph`: a single big centered node by default, the controls
 *  toolbar, and a `last-event` readout so specs can assert callback firings.
 *  Node/edge interaction callbacks all write to `last-event`; pass `data` (e.g.
 *  two nodes), `editable`, and `layout` to drive the relationship-editing specs. */
/** Uncontrolled selection with a DOM button that removes node "a" from `data`,
 *  so a spec can assert that clearing a selected node reports through
 *  `onSelectionChange` (the button click sidesteps Sigma's one-canvas-click CT
 *  limit). */
export function GraphRemovableHarness() {
  const [data, setData] = useState<GraphData>({
    nodes: [
      { id: "a", label: "A", kind: "primary" },
      { id: "b", label: "B", kind: "secondary" },
    ],
    edges: [],
  });
  const [lastSelection, setLastSelection] = useState("none");
  return (
    <div style={{ inlineSize: 600, blockSize: 400 }}>
      <div data-testid="last-selection">{lastSelection}</div>
      <button
        type="button"
        data-testid="remove-a"
        onClick={() => setData((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== "a") }))}
      >
        remove a
      </button>
      <Graph
        data={data}
        layout="grid"
        renderNode={() => ({ size: 12 })}
        onSelectionChange={(id) => setLastSelection(id ?? "null")}
      >
        <Graph.Controls />
        <NodeProbe />
        <SelectionProbe />
      </Graph>
    </div>
  );
}

export function GraphHarness({ minimap, probe, selectionProbe, ...graphProps }: HarnessProps) {
  const [last, setLast] = useState("");
  const [lastSelection, setLastSelection] = useState("none");
  return (
    <div style={{ inlineSize: 600, blockSize: 400 }}>
      <div data-testid="last-event">{last}</div>
      <div data-testid="last-selection">{lastSelection}</div>
      <Graph
        data={single}
        renderNode={() => ({ size: 24 })}
        renderEdge={() => ({ size: 6 })}
        onNodeClick={(id) => setLast(`click:${id}`)}
        onNodeHover={(id) => setLast(`hover:${id ?? "null"}`)}
        onEdgeClick={(id) => setLast(`edgeclick:${id}`)}
        onEdgeCreate={(e) => setLast(`create:${e.source}->${e.target}`)}
        onEdgeDelete={(id) => setLast(`delete:${id}`)}
        onLayoutChange={(layout) => setLast(`layout:${layout}`)}
        onSelectionChange={(id) => setLastSelection(id ?? "null")}
        {...graphProps}
      >
        <Graph.Controls />
        {minimap ? <Graph.Minimap /> : null}
        {probe ? <NodeProbe /> : null}
        {selectionProbe ? <SelectionProbe /> : null}
      </Graph>
    </div>
  );
}
