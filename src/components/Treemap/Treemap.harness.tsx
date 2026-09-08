import { useState } from "react";
import { Treemap, type TreemapDatum, type TreemapProps } from "./Treemap";
import type { TreemapNode } from "./Treemap.math";

const portfolio: TreemapNode = {
  name: "Portfolio",
  children: [
    {
      name: "Tech",
      children: [
        { name: "AAPL", value: 30, change: 1.2 },
        { name: "MSFT", value: 20, change: -0.4 },
      ],
    },
    { name: "Energy", children: [{ name: "XOM", value: 10, change: 2 }] },
    { name: "Cash", value: 40 },
  ],
};

/** One huge leaf and one sliver, to check that a tiny cell prints no label. */
const lopsided: TreemapNode = {
  name: "Lopsided",
  children: [
    { name: "Nearly everything", value: 5000 },
    { name: "A sliver", value: 60 },
  ],
};

const datasets = { portfolio, lopsided };

/** The CT harness. Data is picked by name so the spec imports one component
 *  only (Playwright CT registers every import of a spec as a component). */
export function TreemapHarness({
  dataset = "portfolio",
  width = 480,
  ...props
}: Omit<Partial<TreemapProps>, "data"> & { dataset?: keyof typeof datasets; width?: number }) {
  const [activated, setActivated] = useState<TreemapDatum | null>(null);
  const [activations, setActivations] = useState(0);
  return (
    <div style={{ width, padding: 24 }}>
      <Treemap
        data={datasets[dataset]}
        height={280}
        {...props}
        onPointActivate={(d) => {
          setActivated(d);
          setActivations((n) => n + 1);
          props.onPointActivate?.(d);
        }}
      />
      <div data-testid="activated">{activated ? `${activated.kind}:${activated.id}` : ""}</div>
      <div data-testid="activations">{activations}</div>
    </div>
  );
}
