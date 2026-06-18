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

interface HarnessProps extends Partial<GraphProps> {
  /** Also render the minimap overlay. */
  minimap?: boolean;
  /** Render the node-position probe (for WebGL targeting in specs). */
  probe?: boolean;
}

/** Test harness for `Graph`: a single big centered node by default, the controls
 *  toolbar, and a `last-event` readout so specs can assert callback firings.
 *  Node/edge interaction callbacks all write to `last-event`; pass `data` (e.g.
 *  two nodes), `editable`, and `layout` to drive the relationship-editing specs. */
export function GraphHarness({ minimap, probe, ...graphProps }: HarnessProps) {
  const [last, setLast] = useState("");
  return (
    <div style={{ inlineSize: 600, blockSize: 400 }}>
      <div data-testid="last-event">{last}</div>
      <Graph
        data={single}
        renderNode={() => ({ size: 24 })}
        renderEdge={() => ({ size: 6 })}
        onNodeClick={(id) => setLast(`click:${id}`)}
        onEdgeClick={(id) => setLast(`edgeclick:${id}`)}
        onEdgeCreate={(e) => setLast(`create:${e.source}->${e.target}`)}
        onEdgeDelete={(id) => setLast(`delete:${id}`)}
        onLayoutChange={(layout) => setLast(`layout:${layout}`)}
        {...graphProps}
      >
        <Graph.Controls />
        {minimap ? <Graph.Minimap /> : null}
        {probe ? <NodeProbe /> : null}
      </Graph>
    </div>
  );
}
