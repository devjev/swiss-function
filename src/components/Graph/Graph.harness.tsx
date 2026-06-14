import { useState } from "react";
import type { GraphData } from "../../lib/graph/types";
import { Graph, type GraphProps } from "./Graph";

// A single, centered node makes a reliable canvas click target: with one node
// the camera frames it at the surface centre, so a centre-click lands on it
// (Sigma paints to WebGL — there is no per-node DOM to target). `renderNode`
// blows it up to a generous size so the hit is unambiguous.
const single: GraphData = {
  nodes: [{ id: "hub", label: "Hub", kind: "primary", data: { role: "center" } }],
  edges: [],
};

interface HarnessProps extends Partial<GraphProps> {
  /** Also render the minimap overlay. */
  minimap?: boolean;
}

/** Test harness for `Graph`: a single big centered node, the controls toolbar,
 *  and a `last-event` readout so specs can assert callback firings. */
export function GraphHarness({ minimap, ...graphProps }: HarnessProps) {
  const [last, setLast] = useState("");
  return (
    <div style={{ inlineSize: 600, blockSize: 400 }}>
      <div data-testid="last-event">{last}</div>
      <Graph
        data={single}
        renderNode={() => ({ size: 30 })}
        onNodeClick={(id) => setLast(`click:${id}`)}
        onLayoutChange={(layout) => setLast(`layout:${layout}`)}
        {...graphProps}
      >
        <Graph.Controls />
        {minimap ? <Graph.Minimap /> : null}
      </Graph>
    </div>
  );
}
