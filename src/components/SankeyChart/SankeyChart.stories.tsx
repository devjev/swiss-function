import type { Story } from "@ladle/react";
import { useState } from "react";
import {
  SankeyChart,
  type SankeyChartProps,
  type SankeyDatum,
  type SankeyLink,
  type SankeyNode,
} from "./SankeyChart";

export default { title: "Chart/SankeyChart" };

const readout: React.CSSProperties = {
  fontFamily: "var(--sf-font-mono)",
  fontSize: "var(--sf-font-size-sm)",
  color: "var(--sf-color-fg)",
  marginBlockStart: "calc(var(--sf-unit) / 2)",
};

// A company budget, in thousands: three revenue lines, five cost centres,
// six line items. Deterministic.
const budgetNodes: SankeyNode[] = [
  { id: "product", name: "Product revenue" },
  { id: "services", name: "Services" },
  { id: "licences", name: "Licences" },
  { id: "ops", name: "Operations" },
  { id: "rnd", name: "R&D" },
  { id: "sales", name: "Sales" },
  { id: "ga", name: "G&A" },
  { id: "profit", name: "Profit" },
  { id: "salaries", name: "Salaries" },
  { id: "cloud", name: "Cloud" },
  { id: "offices", name: "Offices" },
  { id: "marketing", name: "Marketing" },
  { id: "travel", name: "Travel" },
  { id: "retained", name: "Retained earnings" },
];
const budgetLinks: SankeyLink[] = [
  { source: "product", target: "ops", value: 1200 },
  { source: "product", target: "rnd", value: 1800 },
  { source: "product", target: "sales", value: 900 },
  { source: "product", target: "profit", value: 1100 },
  { source: "services", target: "ops", value: 700 },
  { source: "services", target: "ga", value: 400 },
  { source: "services", target: "profit", value: 300 },
  { source: "licences", target: "rnd", value: 500 },
  { source: "licences", target: "ga", value: 200 },
  { source: "licences", target: "profit", value: 400 },
  { source: "ops", target: "salaries", value: 1100 },
  { source: "ops", target: "cloud", value: 600 },
  { source: "ops", target: "offices", value: 200 },
  { source: "rnd", target: "salaries", value: 1900 },
  { source: "rnd", target: "cloud", value: 400 },
  { source: "sales", target: "salaries", value: 500 },
  { source: "sales", target: "marketing", value: 300 },
  { source: "sales", target: "travel", value: 100 },
  { source: "ga", target: "salaries", value: 400 },
  { source: "ga", target: "offices", value: 200 },
  { source: "profit", target: "retained", value: 1800 },
];

// Fund flows: share classes into funds, funds into strategies. Node colours
// on the strategies so `linkFill="target"` reads.
const fundNodes: SankeyNode[] = [
  { id: "A", name: "Class A" },
  { id: "B", name: "Class B" },
  { id: "I", name: "Class I" },
  { id: "Z", name: "Class Z" },
  { id: "geq", name: "Global Equity" },
  { id: "ebd", name: "Euro Bond" },
  { id: "mas", name: "Multi-Asset" },
  { id: "eq", name: "Equity", color: "var(--sf-color-primary)" },
  { id: "fi", name: "Fixed income", color: "var(--sf-color-success)" },
  { id: "alt", name: "Alternatives", color: "var(--sf-color-warning)" },
  { id: "cash", name: "Cash", color: "var(--sf-color-muted)" },
];
const fundLinks: SankeyLink[] = [
  { source: "A", target: "geq", value: 320 },
  { source: "A", target: "mas", value: 180 },
  { source: "B", target: "geq", value: 140 },
  { source: "B", target: "ebd", value: 260 },
  { source: "I", target: "geq", value: 610 },
  { source: "I", target: "ebd", value: 420 },
  { source: "I", target: "mas", value: 350 },
  { source: "Z", target: "mas", value: 90 },
  { source: "geq", target: "eq", value: 1010 },
  { source: "geq", target: "cash", value: 60 },
  { source: "ebd", target: "fi", value: 640 },
  { source: "ebd", target: "cash", value: 40 },
  { source: "mas", target: "eq", value: 260 },
  { source: "mas", target: "fi", value: 200 },
  { source: "mas", target: "alt", value: 130 },
  { source: "mas", target: "cash", value: 30 },
];

// A small graph with an early sink ("Tax" leaves from the first column), to
// show what the alignments do with it.
const sinkNodes: SankeyNode[] = [
  { id: "in", name: "Income" },
  { id: "tax", name: "Tax" },
  { id: "net", name: "Net" },
  { id: "save", name: "Savings" },
  { id: "spend", name: "Spending" },
  { id: "rent", name: "Rent" },
  { id: "food", name: "Food" },
];
const sinkLinks: SankeyLink[] = [
  { source: "in", target: "tax", value: 25 },
  { source: "in", target: "net", value: 75 },
  { source: "net", target: "save", value: 20 },
  { source: "net", target: "spend", value: 55 },
  { source: "spend", target: "rent", value: 30 },
  { source: "spend", target: "food", value: 25 },
];

// Deterministic PRNG for the stress story (mulberry32).
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function manyNodes(): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const rand = seeded(7);
  const layers = 5;
  const perLayer = 12;
  const nodes: SankeyNode[] = [];
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < perLayer; i++) nodes.push({ id: `n${l}-${i}`, name: `Node ${l}.${i + 1}` });
  }
  const links: SankeyLink[] = [];
  for (let l = 0; l < layers - 1; l++) {
    for (let k = 0; k < 30; k++) {
      const s = Math.floor(rand() * perLayer);
      const t = Math.floor(rand() * perLayer);
      links.push({
        source: `n${l}-${s}`,
        target: `n${l + 1}-${t}`,
        value: 5 + Math.round(rand() * 40),
      });
    }
  }
  return { nodes, links };
}

export const Playground: Story<SankeyChartProps> = (args) => (
  <SankeyChart {...args} nodes={budgetNodes} links={budgetLinks} />
);
Playground.args = {
  align: "justify",
  nodeWidth: 12,
  nodePadding: 8,
  iterations: 6,
  linkFill: "neutral",
  labels: "auto",
  showValues: false,
  scaffolding: "hover",
  frame: false,
  fullscreen: false,
  selectable: false,
  height: 360,
};
Playground.argTypes = {
  align: { options: ["left", "right", "center", "justify"], control: { type: "radio" } },
  linkFill: { options: ["neutral", "source", "target", "dither"], control: { type: "radio" } },
  labels: { options: ["auto", "none"], control: { type: "radio" } },
  scaffolding: { options: ["minimal", "hover", "full"], control: { type: "radio" } },
  nodeWidth: { control: { type: "range", min: 2, max: 40, step: 1 } },
  nodePadding: { control: { type: "range", min: 0, max: 40, step: 1 } },
  iterations: { control: { type: "range", min: 0, max: 32, step: 1 } },
};

export const Default: Story = () => (
  <SankeyChart nodes={budgetNodes} links={budgetLinks} height={360} />
);

export const FundFlows: Story = () => (
  <SankeyChart nodes={fundNodes} links={fundLinks} linkFill="target" height={360} showValues />
);

export const Alignments: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "calc(var(--sf-unit) * 1.5)",
    }}
  >
    {(["left", "right", "center", "justify"] as const).map((align) => (
      <div key={align}>
        <div style={readout}>align="{align}"</div>
        <SankeyChart nodes={sinkNodes} links={sinkLinks} align={align} height={220} />
      </div>
    ))}
  </div>
);

export const LinkFills: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "calc(var(--sf-unit) * 1.5)",
    }}
  >
    {(["neutral", "source", "target", "dither"] as const).map((linkFill) => (
      <div key={linkFill}>
        <div style={readout}>linkFill="{linkFill}"</div>
        <SankeyChart nodes={fundNodes} links={fundLinks} linkFill={linkFill} height={260} />
      </div>
    ))}
  </div>
);

export const Sorted: Story = () => (
  <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)" }}>
    <div>
      <div style={readout}>sort="auto" (the relaxation reorders)</div>
      <SankeyChart nodes={budgetNodes} links={budgetLinks} sort="auto" height={300} />
    </div>
    <div>
      <div style={readout}>sort="none" (input order)</div>
      <SankeyChart nodes={budgetNodes} links={budgetLinks} sort="none" height={300} />
    </div>
    <div>
      <div style={readout}>sort by value, largest first</div>
      <SankeyChart
        nodes={budgetNodes}
        links={budgetLinks}
        sort={(a, b) => b.value - a.value}
        height={300}
      />
    </div>
  </div>
);

export const ManyNodes: Story = () => {
  const { nodes, links } = manyNodes();
  return <SankeyChart nodes={nodes} links={links} height={560} nodePadding={4} iterations={12} />;
};

export const Framed: Story = () => (
  <SankeyChart
    nodes={budgetNodes}
    links={budgetLinks}
    frame
    fullscreen
    scaffolding="full"
    height={400}
  />
);

export const Selection: Story = () => {
  const [selection, setSelection] = useState<SankeyDatum | null>(null);
  return (
    <div>
      <SankeyChart
        nodes={budgetNodes}
        links={budgetLinks}
        selectable
        selection={selection}
        onSelectionChange={setSelection}
        height={360}
      />
      <div style={readout}>
        {selection
          ? selection.kind === "node"
            ? `node ${selection.name}: in ${selection.valueIn}, out ${selection.valueOut}`
            : `link ${selection.sourceName} → ${selection.targetName}: ${selection.value}`
          : "click a node or a ribbon to pin it"}
      </div>
    </div>
  );
};

export const Cycle: Story = () => (
  <SankeyChart
    nodes={sinkNodes}
    links={[...sinkLinks, { source: "save", target: "in", value: 10 }]}
    height={260}
    showValues
  />
);
