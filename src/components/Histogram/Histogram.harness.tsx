import { useState } from "react";
import { type ChartAnnotation, Histogram, type HistogramBinDatum } from "./Histogram";

/** Deterministic PRNG (mulberry32): CT data must be stable across runs. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 400 draws from a standard normal, scaled to a percent-like range. */
export function normalSample(seed = 1, n = 400, scale = 10): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rand() || 1e-12;
    const v = rand();
    out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale);
  }
  return out;
}

/** A zoomable, framed histogram with a controlled annotations round-trip and a
 *  readout of the last activated bin, for the CT specs. */
export function HistogramHarness({
  initialAnnotations = [],
  onChange,
  cumulative = false,
  density = false,
  selectable = false,
  controls = true,
  zoomable = true,
}: {
  initialAnnotations?: ChartAnnotation[];
  onChange?: (next: ChartAnnotation[]) => void;
  cumulative?: boolean;
  density?: boolean;
  selectable?: boolean;
  controls?: boolean;
  zoomable?: boolean;
}) {
  const [list, setList] = useState<ChartAnnotation[]>(initialAnnotations);
  const [last, setLast] = useState<HistogramBinDatum | null>(null);
  return (
    <div style={{ width: 480 }}>
      <Histogram
        data={normalSample()}
        bins={20}
        domain={[-40, 40]}
        height={240}
        scaffolding="full"
        zoomable={zoomable}
        controls={controls}
        cumulative={cumulative}
        density={density}
        selectable={selectable}
        annotations={list}
        onAnnotationsChange={(next) => {
          setList(next);
          onChange?.(next);
        }}
        onPointActivate={setLast}
      />
      <div data-testid="last">{last ? `${last.x0}:${last.x1}:${last.count}` : ""}</div>
    </div>
  );
}
