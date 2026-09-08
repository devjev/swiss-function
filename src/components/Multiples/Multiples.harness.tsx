import { useState } from "react";
import { BarChart } from "../BarChart";
import { Scatterplot } from "../Scatterplot";
import { Multiples, type MultiplesDomain, type MultiplesProps } from "./Multiples";

/** Deterministic PRNG (mulberry32). */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Ticker {
  symbol: string;
  data: { x: number; y: number }[];
}

/** `n` tickers, each a random walk of `points` samples on a numeric x. */
export function tickers(n: number, points = 60): Ticker[] {
  const rand = seededRandom(7);
  return Array.from({ length: n }, (_, i) => {
    let y = 100;
    const data: { x: number; y: number }[] = [];
    for (let x = 0; x < points; x++) {
      y += (rand() - 0.5) * 4;
      data.push({ x, y: Math.round(y * 100) / 100 });
    }
    return { symbol: `T${i + 1}`, data };
  });
}

type HarnessProps = Partial<Omit<MultiplesProps<Ticker>, "items" | "render">> & {
  count?: number;
  width?: number;
  /** Panels are zoomable Scatterplots with full axes. */
  zoomable?: boolean;
};

/** Scatterplot panels on a shared numeric x; the shared x window is printed
 *  for the spec to read. */
export function MultiplesHarness({
  count = 4,
  width = 900,
  zoomable = true,
  ...rest
}: HarnessProps) {
  const [domain, setDomain] = useState<MultiplesDomain | null>(null);
  const items = tickers(count);
  return (
    <div style={{ width, padding: 8 }}>
      <Multiples
        items={items}
        titleKey="symbol"
        scaffolding="full"
        onXDomainChange={setDomain}
        render={(t, shared) => (
          <Scatterplot
            series={[{ name: t.symbol, data: t.data, showLine: true, showPoints: false }]}
            height={shared.height}
            scaffolding={shared.scaffolding}
            zoomable={zoomable}
            xDomain={shared.xDomain}
            onXDomainChange={shared.onXDomainChange}
            yDomain={shared.yDomain}
          />
        )}
        {...rest}
      />
      <div data-testid="domain">{domain ? `${domain[0]},${domain[1]}` : "full"}</div>
    </div>
  );
}

/** BarChart panels on a shared value axis. */
export function BarMultiplesHarness(
  props: Partial<Omit<MultiplesProps<Ticker>, "items" | "render">>,
) {
  const items = tickers(3, 5);
  return (
    <div style={{ width: 900, padding: 8 }}>
      <Multiples
        items={items}
        titleKey="symbol"
        link="y"
        yDomain={[90, 110]}
        render={(t, shared) => (
          <BarChart
            categories={t.data.map((d) => `c${d.x}`)}
            series={[{ name: t.symbol, values: t.data.map((d) => d.y) }]}
            height={shared.height}
            scaffolding={shared.scaffolding}
            yDomain={shared.yDomain}
            onValueDomainChange={shared.onValueDomainChange}
          />
        )}
        {...props}
      />
    </div>
  );
}
