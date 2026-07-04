import { useState } from "react";
import { type Candle, CandlestickChart, type ChartAnnotation } from "./CandlestickChart";

/** CT harness for the chart-window mirror specs: a controlled annotations
 *  round-trip over 60 deterministic daily candles. */

const CANDLES: Candle[] = Array.from({ length: 60 }, (_, i) => {
  const open = 100 + Math.sin(i / 5) * 10;
  const close = open + (i % 3 === 0 ? -2 : 2);
  return {
    x: new Date(2026, 0, 1 + i),
    open,
    close,
    high: Math.max(open, close) + 2,
    low: Math.min(open, close) - 2,
  };
});

export function EditableCandlestickChart({
  onChange,
  frame = false,
}: {
  onChange?: (next: ChartAnnotation[]) => void;
  frame?: boolean;
}) {
  const [list, setList] = useState<ChartAnnotation[]>([]);
  return (
    <div style={{ width: 480 }}>
      <CandlestickChart
        candles={CANDLES}
        height={240}
        scaffolding="full"
        zoomable
        controls
        frame={frame}
        annotations={list}
        onAnnotationsChange={(next) => {
          setList(next);
          onChange?.(next);
        }}
      />
    </div>
  );
}
