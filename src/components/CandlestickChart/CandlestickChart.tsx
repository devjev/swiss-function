import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Axis,
  type AxisTick,
  type BandScale,
  bandScale,
  Crosshair,
  formatNumber,
  linearScale,
  niceTicks,
  Tooltip,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import styles from "./CandlestickChart.module.css";

export type ChartScaffolding = "minimal" | "hover" | "full";
export type CandleX = number | Date;

export interface Candle {
  x: CandleX;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlestickChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** OHLC bars in chronological order; spaced evenly (index-based), not by real time. */
  candles: Candle[];
  /** Price range. Auto-fit (padded, not zero-anchored) when omitted. */
  yDomain?: [number, number];
  yLabel?: string;
  xLabel?: string;
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Visual posture (mirrors the other charts):
   *   - `"minimal"`: Tufte idle, no scaffolding; crosshair on hover.
   *   - `"hover"` (default): minimal idle + y-axis and gridlines fade in on hover.
   *   - `"full"`: axis + gridlines always visible. */
  scaffolding?: ChartScaffolding;
  /** Tooltip body for the hovered candle. Default: a monospace O/H/L/C line. */
  renderTooltip?: (candle: Candle) => ReactNode;
}

interface HoverState {
  candle: Candle;
  rect: DOMRect;
  cx: number;
  cy: number;
}

function isDateValue(x: CandleX): x is Date {
  return x instanceof Date;
}

function formatX(x: CandleX): string {
  return isDateValue(x)
    ? x.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : formatNumber(x);
}

/** Fit a price range with ~4% padding, snapped to nice-tick boundaries — and,
 *  unlike `niceDomain`, never anchored at zero (prices shouldn't collapse to a
 *  baseline). */
function priceDomain(candles: Candle[]): [number, number] {
  if (candles.length === 0) return [0, 1];
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const c of candles) {
    lo = Math.min(lo, c.low);
    hi = Math.max(hi, c.high);
  }
  if (lo === hi) return [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.04;
  const ticks = niceTicks(lo - pad, hi + pad, 5);
  if (ticks.length >= 2) {
    return [ticks[0]?.value ?? lo - pad, ticks[ticks.length - 1]?.value ?? hi + pad];
  }
  return [lo - pad, hi + pad];
}

function defaultTooltip(c: Candle): ReactNode {
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{formatX(c.x)}</div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {`O ${formatNumber(c.open)}  H ${formatNumber(c.high)}`}
        <br />
        {`L ${formatNumber(c.low)}  C ${formatNumber(c.close)}`}
      </div>
    </>
  );
}

// The candle layer is a memo component with one delegated pointer/focus
// handler pair (candle groups carry data-idx), so a hover re-render bails out
// at a single fiber instead of re-reconciling 4 fibers per candle — same class
// as Heatmap's grid layers. Delegation must resolve via closest("[data-idx]"):
// pointer events target the inner wick/body/hit nodes, never the <g> itself,
// and React's onFocus/onBlur (focusin/focusout) need the same lookup. The memo
// only holds while every prop is identity-stable across hover renders — the
// scales are useMemo'd and the callbacks useCallback'd in the root.
// (BridgeChart keeps the inline per-bar handlers: its realistic N is dozens of
// bars, measured at the frame floor — see issue #14.)
const CandlesLayer = memo(function CandlesLayer({
  candles,
  keys,
  xBand,
  yScale,
  plotHeight,
  onCandleHover,
  onCandleLeave,
}: {
  candles: Candle[];
  keys: string[];
  xBand: BandScale;
  yScale: (value: number) => number;
  plotHeight: number;
  onCandleHover: (hover: HoverState) => void;
  onCandleLeave: () => void;
}) {
  const resolveCandle = (target: EventTarget | null): HoverState | null => {
    const el = target instanceof Element ? target.closest("[data-idx]") : null;
    if (!el) return null;
    const i = Number(el.getAttribute("data-idx"));
    const candle = candles[i];
    const left = xBand.position(keys[i] ?? "");
    if (!candle || left == null) return null;
    return {
      candle,
      rect: el.getBoundingClientRect(),
      cx: left + xBand.bandwidth / 2,
      cy: yScale(candle.close),
    };
  };
  const handleEnter = (e: { target: EventTarget | null }) => {
    const hover = resolveCandle(e.target);
    if (hover) onCandleHover(hover);
  };
  const handleLeave = (e: { target: EventTarget | null }) => {
    if (e.target instanceof Element && e.target.closest("[data-idx]")) onCandleLeave();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pure event delegation — the interactive/focusable surface is each candle's hit rect (role="button", tabIndex) below; the group only hosts the shared listeners (issue #14).
    <g
      onPointerOver={handleEnter}
      onPointerOut={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {candles.map((c, i) => {
        const left = xBand.position(keys[i] ?? "");
        if (left == null) return null;
        const center = left + xBand.bandwidth / 2;
        const up = c.close >= c.open;
        const yHigh = yScale(c.high);
        const yLow = yScale(c.low);
        const bodyTop = Math.min(yScale(c.open), yScale(c.close));
        const bodyH = Math.max(1, Math.abs(yScale(c.close) - yScale(c.open)));
        return (
          // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
          <g
            key={keys[i]}
            data-idx={i}
            className={cx(styles.candle, up ? styles.up : styles.down)}
            role="button"
            tabIndex={0}
            aria-label={`${formatX(c.x)}: open ${c.open}, high ${c.high}, low ${c.low}, close ${c.close}`}
          >
            <line x1={center} x2={center} y1={yHigh} y2={yLow} className={styles.wick} />
            <rect
              x={left}
              y={bodyTop}
              width={xBand.bandwidth}
              height={bodyH}
              className={styles.body}
            />
            {/* Transparent full-height hit target so the thin candle is easy to hover. */}
            <rect
              x={left}
              y={0}
              width={xBand.bandwidth}
              height={plotHeight}
              className={styles.hit}
            />
          </g>
        );
      })}
    </g>
  );
});

export const CandlestickChart = forwardRef<HTMLDivElement, CandlestickChartProps>(
  function CandlestickChart(
    {
      candles,
      yDomain,
      yLabel,
      xLabel,
      height,
      scaffolding = "hover",
      renderTooltip = defaultTooltip,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const isTufte = scaffolding !== "full";
    const plotRef = useRef<HTMLDivElement>(null);
    const [plotSize, setPlotSize] = useState<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });
    const [hover, setHover] = useState<HoverState | null>(null);

    useLayoutEffect(() => {
      const el = plotRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      const update = () => setPlotSize({ width: el.clientWidth, height: el.clientHeight });
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    const resolvedYDomain: [number, number] = useMemo(
      () => yDomain ?? priceDomain(candles),
      [candles, yDomain],
    );

    // Index-based keys so the band scale spaces candles evenly (no time gaps).
    const keys = useMemo(() => candles.map((_, i) => String(i)), [candles]);
    const xBand = useMemo(() => bandScale(keys, [0, plotSize.width], 0.3), [keys, plotSize.width]);
    const yScale = useMemo(
      () => linearScale(resolvedYDomain, [plotSize.height, 0]),
      [resolvedYDomain, plotSize.height],
    );

    const yAxisTicks: AxisTick[] = useMemo(() => {
      if (scaffolding === "minimal") return [];
      const [yMin, yMax] = resolvedYDomain;
      if (yMax <= yMin) return [];
      return niceTicks(yMin, yMax, 5).map((t) => ({
        label: t.label,
        position: (t.value - yMin) / (yMax - yMin),
        major: t.major,
      }));
    }, [resolvedYDomain, scaffolding]);

    // Sample ~6 evenly-spaced candles for x labels so dense series stay readable.
    const xAxisTicks: AxisTick[] = useMemo(() => {
      if (candles.length === 0 || plotSize.width <= 0) return [];
      const stepN = Math.max(1, Math.ceil(candles.length / 6));
      const out: AxisTick[] = [];
      for (let i = 0; i < candles.length; i += stepN) {
        const c = candles[i];
        if (!c) continue;
        const left = xBand.position(keys[i] ?? "") ?? 0;
        out.push({
          label: formatX(c.x),
          position: (left + xBand.bandwidth / 2) / plotSize.width,
          major: false,
        });
      }
      return out;
    }, [candles, keys, xBand, plotSize.width]);

    const handleCandleHover = useCallback((hover: HoverState) => setHover(hover), []);
    const handleLeave = useCallback(() => setHover(null), []);

    const wrapperStyle: CSSProperties = {
      ...(height != null ? { height: typeof height === "number" ? `${height}px` : height } : {}),
      ...style,
    };

    return (
      <div
        {...rest}
        ref={ref}
        className={cx(styles.root, className)}
        style={wrapperStyle}
        data-scaffolding={scaffolding}
        data-hovered={hover != null ? "true" : undefined}
      >
        {yLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
        <Axis orientation="y" ticks={yAxisTicks} noLine={isTufte} className={styles.yAxis} />
        <div ref={plotRef} className={styles.plot}>
          {plotSize.width > 0 && plotSize.height > 0 ? (
            <svg
              width={plotSize.width}
              height={plotSize.height}
              viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
              className={styles.svg}
              role="img"
              aria-label={yLabel ? `${yLabel} candlestick chart` : "Candlestick chart"}
              onMouseLeave={handleLeave}
            >
              {scaffolding !== "minimal"
                ? yAxisTicks.map((tick) => {
                    const y = plotSize.height * (1 - tick.position);
                    return (
                      <line
                        key={`grid-${tick.label}-${tick.position}`}
                        x1={0}
                        x2={plotSize.width}
                        y1={y}
                        y2={y}
                        className={cx(styles.gridline, tick.major && styles.gridlineMajor)}
                      />
                    );
                  })
                : null}

              {/* Candles — memo'd layer so hover re-renders bail out at one fiber. */}
              <CandlesLayer
                candles={candles}
                keys={keys}
                xBand={xBand}
                yScale={yScale}
                plotHeight={plotSize.height}
                onCandleHover={handleCandleHover}
                onCandleLeave={handleLeave}
              />

              {isTufte && hover ? (
                <Crosshair
                  x={hover.cx}
                  y={hover.cy}
                  height={plotSize.height}
                  axes="both"
                  xLabel={formatX(hover.candle.x)}
                  yLabel={formatNumber(hover.candle.close)}
                />
              ) : null}
            </svg>
          ) : null}
        </div>
        <Axis orientation="x" ticks={xAxisTicks} className={styles.xAxis} />
        {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}

        <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
          {hover ? renderTooltip(hover.candle) : null}
        </Tooltip>
      </div>
    );
  },
);
