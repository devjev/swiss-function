import { useState } from "react";
import { type ChartAnnotation, Scatterplot, type ScatterSeries } from "./Scatterplot";

/** CT harness for the chart-window specs (issue #27 M3): a controlled
 *  annotations round-trip — the array is the document, so selection/drag
 *  tests need the chart to actually receive what onAnnotationsChange emits.
 *  (Playwright CT can only mount components imported from real files.) */

const SERIES: ScatterSeries[] = [
  {
    name: "Z",
    data: Array.from({ length: 101 }, (_, i) => ({ x: i, y: 50 + 40 * Math.sin(i / 7) })),
    showLine: true,
    showPoints: false,
  },
];

export function EditableScatterplot({
  initial = [],
  onChange,
  fullscreen = false,
  width = 480,
}: {
  initial?: ChartAnnotation[];
  onChange?: (next: ChartAnnotation[]) => void;
  fullscreen?: boolean;
  /** Container width in px: under about 400 the toolbar takes its compact form. */
  width?: number;
}) {
  const [list, setList] = useState<ChartAnnotation[]>(initial);
  return (
    <div style={{ width }}>
      <Scatterplot
        series={SERIES}
        height={240}
        showLegend={false}
        scaffolding="full"
        zoomable
        controls
        fullscreen={fullscreen}
        annotations={list}
        onAnnotationsChange={(next) => {
          setList(next);
          onChange?.(next);
        }}
      />
    </div>
  );
}
