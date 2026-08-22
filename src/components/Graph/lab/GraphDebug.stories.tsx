import type { Story } from "@ladle/react";
import type { GraphData } from "../../../lib/graph/types";
import { Graph } from "../Graph";

export default { title: "Graph/lab" };

// Vertical chain with edge labels: reproduces the selected-label pill with an
// edge passing straight through its rounded cap.
const chain: GraphData = {
  nodes: [
    { id: "billing", label: "Billing", kind: "primary" },
    { id: "payments", label: "Payments", kind: "tertiary" },
    { id: "ledger", label: "Ledger", kind: "tertiary" },
  ],
  edges: [
    { id: "e1", source: "billing", target: "payments", label: "charge" },
    { id: "e2", source: "payments", target: "ledger", label: "post" },
  ],
};

export const SelectedPill: Story = () => (
  <Graph
    data={chain}
    layout="tree"
    defaultLayout="tree"
    selected="payments"
    style={{ blockSize: 560 }}
  >
    <Graph.Controls />
  </Graph>
);
