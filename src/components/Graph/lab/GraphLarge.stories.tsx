// PERF HARNESS — Task 4.9: performance pass on LARGE.
// Throwaway lab story mounting the real `Graph` on the LARGE (10k-node) fixture
// with the `[data-graph-*]` hooks `probe-graph.mjs` drives. Deleted with the
// rest of `lab/` in Task 6.2.
//
// Run: node scripts/probe-graph.mjs graph--lab--large--default http://localhost:61000

import { LARGE } from "../../../lib/graph/fixtures";
import { useGraphControls } from "../context";
import { Graph } from "../Graph";

export default { title: "Graph/lab/Large" };

// Probe-only controls: the harness clicks these to time control-toggle and
// layout-switch latency. Reads the published GraphControls handle, so it must be
// a child of <Graph>.
function ProbeControls() {
  const { zoomIn, setLayout } = useGraphControls();
  return (
    <div style={{ placeSelf: "end start", display: "flex", gap: 4, margin: 8 }}>
      <button type="button" data-graph-control onClick={() => zoomIn()}>
        probe-zoom
      </button>
      <button type="button" data-graph-layout-next onClick={() => setLayout("tree")}>
        probe-layout
      </button>
    </div>
  );
}

export const Default = () => (
  <div style={{ inlineSize: 1200, blockSize: 760 }}>
    <Graph data={LARGE} defaultLayout="force">
      <Graph.Controls />
      <ProbeControls />
      {/* Centered click/hover target. The canvas has no per-node DOM, so the
          harness clicks this marker's box; for a force layout the centroid is
          dense, so the click lands on a node. `pointer-events:none` lets the
          click pass through to the Sigma canvas underneath. */}
      <div
        data-graph-node
        style={{ placeSelf: "center", inlineSize: 8, blockSize: 8, pointerEvents: "none" }}
      />
    </Graph>
  </div>
);
