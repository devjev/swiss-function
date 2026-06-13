// VERIFICATION HARNESS — Task 4.7: minimap + viewport indicator.
// Throwaway lab story mounting the real `Graph` with `<Graph.Minimap />` over a
// MEDIUM (1k-node) fixture, so the overview canvas + viewport rectangle can be
// eyeballed and driven. Deleted with the rest of `lab/` in Task 6.2.

import { MEDIUM } from "../../../lib/graph/fixtures";
import { Graph } from "../Graph";

export default { title: "Graph/lab/Minimap" };

export const Default = () => (
  <div style={{ inlineSize: 1200, blockSize: 760 }}>
    <Graph data={MEDIUM} defaultLayout="radial">
      <Graph.Controls />
      <Graph.Minimap />
    </Graph>
  </div>
);
