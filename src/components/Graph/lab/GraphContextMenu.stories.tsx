// VERIFICATION HARNESS — Task 4.6b: right-click context menu.
// Throwaway lab story that mounts the *real* `Graph` component (not the Phase 2
// Sigma prototype) so the context-menu wiring from 4.6a can be exercised with a
// Playwright driver. Uses the deterministic `grid` layout on the SMALL fixture
// so node screen positions are stable for the driver to right-click. Deleted
// with the rest of `lab/` in Task 6.2.

import { SMALL } from "../../../lib/graph/fixtures";
import { Graph } from "../Graph";

export default { title: "Graph/lab/ContextMenu" };

// Oversized nodes so the Playwright driver (which probes screen points, the
// canvas having no per-node DOM) reliably lands a right-click on a node.
export const Default = () => (
  <div style={{ inlineSize: 1200, blockSize: 760 }}>
    <Graph data={SMALL} defaultLayout="grid" renderNode={() => ({ size: 14 })}>
      <Graph.Controls />
    </Graph>
  </div>
);
