import { BarChart } from "../../components/BarChart";
import { BoxPlot } from "../../components/BoxPlot";
import { BridgeChart } from "../../components/BridgeChart";
import { BulletChart } from "../../components/BulletChart";
import { DotPlot } from "../../components/DotPlot";
import { Marimekko } from "../../components/Marimekko";

/** The charts whose fullscreen key and full-screen state come from the shared
 *  scaffold, each framed with the key, in a column narrower than the page so
 *  a key placed against the page would show outside its chart. */
export function ScaffoldFullscreenCharts() {
  const categories = ["Q1", "Q2", "Q3"];
  return (
    <div style={{ display: "grid", gap: 16, inlineSize: 480 }}>
      <BarChart
        data-testid="BarChart"
        frame
        fullscreen
        categories={categories}
        series={[{ name: "Revenue", values: [3, 5, 4] }]}
      />
      <BridgeChart
        data-testid="BridgeChart"
        frame
        fullscreen
        items={[
          { label: "Open", value: 10, kind: "total" },
          { label: "In", value: 4, kind: "delta" },
          { label: "Close", value: 14, kind: "total" },
        ]}
      />
      <BoxPlot
        data-testid="BoxPlot"
        frame
        fullscreen
        categories={["A", "B"]}
        series={[
          {
            name: "Latency",
            values: [
              [1, 2, 3, 4, 5],
              [2, 3, 4, 5, 6],
            ],
          },
        ]}
      />
      <DotPlot
        data-testid="DotPlot"
        frame
        fullscreen
        categories={categories}
        series={[{ name: "Share", values: [3, 5, 4] }]}
      />
      <BulletChart
        data-testid="BulletChart"
        frame
        fullscreen
        items={[{ label: "Revenue", value: 70, target: 80, ranges: [50, 75, 100] }]}
      />
      <Marimekko
        data-testid="Marimekko"
        frame
        fullscreen
        categories={["North", "South"]}
        series={[
          { name: "A", values: [3, 5] },
          { name: "B", values: [2, 4] },
        ]}
      />
    </div>
  );
}
