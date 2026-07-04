import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { forwardRef, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  type BandScale,
  type ChartAnnotation,
  ChartControls,
  Crosshair,
  formatDateDelta,
  formatNumber,
  formatTimeTick,
  indexToX,
  invertLinear,
  linearScale,
  niceTicks,
  pickTimeUnit,
  startOfUnit,
  type TimeUnit,
  Tooltip,
  unitRank,
  useAnnotationEditor,
  useViewport,
  xToIndex,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { useFullscreen } from "../../lib/useFullscreen";
import { FullscreenToggle } from "../Fullscreen";
import styles from "./CandlestickChart.module.css";

export type { AnnotationX, ChartAnnotation } from "../../lib/chart";

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
  /** Interactive viewport (issue #27), in BAR-INDEX space (the trading-chart
   *  "logical range" model — candles stay evenly spaced, weekends stay
   *  collapsed). Wheel zooms at the cursor (click the chart once, or hold
   *  ctrl/⌘), drag pans, double-click resets; ←/→ +/- 0 on the focused
   *  chart. While zoomed the price axis follows the visible candles (unless
   *  `yDomain` fixes it), and far-out views aggregate candles into true OHLC
   *  groups. Default false. */
  zoomable?: boolean;
  /** Controlled visible window as fractional candle indices `[from, to]`
   *  (0 = first candle, `candles.length` = past the last). Pair with
   *  `onVisibleRangeChange`. */
  visibleRange?: [number, number];
  /** Fires as the visible window changes; `null` = reset to all candles.
   *  Doubles as the lazy-history / semantic-zoom hook: when the window nears
   *  index 0, prepend older candles. */
  onVisibleRangeChange?: (range: [number, number] | null) => void;
  /** Data-anchored annotations; `x` values are candle timestamps (mapped
   *  onto the gap-free bar axis), `y` values are prices. */
  annotations?: ChartAnnotation[];
  /** Enables annotation EDITING with `controls` (issue #27 M3): drawing
   *  tools in the toolbar, click-select with drag handles, Delete/Escape.
   *  Drawn x anchors are interpolated timestamps (Dates when the candles
   *  carry Dates). Fires with the complete next array. */
  onAnnotationsChange?: (annotations: ChartAnnotation[]) => void;
  /** On-chart toolbar (zoom when `zoomable`; annotation tools when
   *  `onAnnotationsChange` is set). Replaces the corner Reset button.
   *  Default false. */
  controls?: boolean;
  /** Maximize-to-viewport toggle (Escape exits). Default false. */
  fullscreen?: boolean;
  /** 1px structural border + breathing room around the chart. Default false. */
  frame?: boolean;
  /** Click/Enter on a candle — the drill-down hook (e.g. swap `candles` for
   *  a finer granularity around the activated one). */
  onPointActivate?: (candle: Candle, index: number) => void;
  /** Tooltip body for the hovered candle. Default: a monospace O/H/L/C line. */
  renderTooltip?: (candle: Candle) => ReactNode;
}

interface HoverState {
  candle: Candle;
  /** Index into the source `candles` array (survives aggregation). */
  index: number;
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

/** True OHLC aggregation: `groupSize` candles collapse into one (first open,
 *  last close, extreme high/low) — the far-zoomed-out LOD for candlesticks
 *  (min/max decimation would break OHLC semantics). */
function aggregateCandles(
  candles: readonly Candle[],
  groupSize: number,
): { candles: Candle[]; sourceIndex: number[] } {
  const out: Candle[] = [];
  const sourceIndex: number[] = [];
  for (let g = 0; g < candles.length; g += groupSize) {
    const first = candles[g];
    if (!first) break;
    let high = first.high;
    let low = first.low;
    let close = first.close;
    for (let i = g + 1; i < Math.min(g + groupSize, candles.length); i++) {
      const c = candles[i];
      if (!c) break;
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      close = c.close;
    }
    out.push({ x: first.x, open: first.open, high, low, close });
    sourceIndex.push(g);
  }
  return { candles: out, sourceIndex };
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
  onCandleActivate,
}: {
  candles: Candle[];
  keys: string[];
  xBand: BandScale;
  yScale: (value: number) => number;
  plotHeight: number;
  onCandleHover: (hover: HoverState) => void;
  onCandleLeave: () => void;
  onCandleActivate?: (candle: Candle, index: number) => void;
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
      index: Number(keys[i]),
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
  const handleClick = onCandleActivate
    ? (e: { target: EventTarget | null }) => {
        const hit = resolveCandle(e.target);
        if (hit) onCandleActivate(hit.candle, hit.index);
      }
    : undefined;
  const handleKeyDown = onCandleActivate
    ? (e: { target: EventTarget | null; key: string; preventDefault: () => void }) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const hit = resolveCandle(e.target);
        if (hit) {
          e.preventDefault();
          onCandleActivate(hit.candle, hit.index);
        }
      }
    : undefined;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pure event delegation — the interactive/focusable surface is each candle's hit rect (role="button", tabIndex) below; the group only hosts the shared listeners (issue #14).
    <g
      onPointerOver={handleEnter}
      onPointerOut={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
      zoomable = false,
      visibleRange,
      onVisibleRangeChange,
      annotations,
      onAnnotationsChange,
      controls = false,
      fullscreen = false,
      frame = false,
      onPointActivate,
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

    // --- Viewport (bar-index space: the "logical range" model) ---
    const n = candles.length;
    const extent: [number, number] = useMemo(() => [0, Math.max(1, n)], [n]);

    const formatIndexValue = useCallback(
      (v: number) => {
        const c = candles[Math.min(candles.length - 1, Math.max(0, Math.round(v)))];
        return c ? formatX(c.x) : String(Math.round(v));
      },
      [candles],
    );

    // Annotation editor — called before useViewport (fresh `toolArmed` for
    // pointer precedence); px→data converters are handler-time only and read
    // a ref filled below once the resolved domains are known.
    const invertRef = useRef<{
      xFromPx: (px: number) => AnnotationX;
      yFromPx: (px: number) => number;
    }>({ xFromPx: (px) => px, yFromPx: (px) => px });
    const editingEnabled = controls && !!onAnnotationsChange;
    const editor = useAnnotationEditor({
      annotations: annotations ?? [],
      onAnnotationsChange,
      enabled: editingEnabled,
      xFromPx: (px) => invertRef.current.xFromPx(px),
      yFromPx: (px) => invertRef.current.yFromPx(px),
      plotRef,
    });

    const { expanded, toggle: toggleExpanded } = useFullscreen({});

    const viewport = useViewport({
      extent,
      domain: zoomable && visibleRange ? visibleRange : undefined,
      onDomainChange: onVisibleRangeChange,
      minSpan: Math.min(4, Math.max(1, n)),
      plotRef,
      enabled: zoomable,
      suspended: editor.toolArmed,
      formatValue: formatIndexValue,
    });
    const [d0, d1] = zoomable ? viewport.domain : extent;

    // Visible window + LOD: past ~4 bars per pixel-column budget, candles
    // aggregate into true OHLC groups (first open, last close, extreme
    // high/low) — min/max decimation would break OHLC semantics. Keys stay
    // source indices so hover/activate report real candles.
    const visible = useMemo(() => {
      const start = Math.max(0, Math.floor(d0));
      const end = Math.min(n, Math.ceil(d1));
      const windowed = start === 0 && end === n ? candles : candles.slice(start, end);
      const maxBars = Math.max(16, Math.floor(plotSize.width / 4));
      if (windowed.length <= maxBars) {
        return {
          candles: windowed,
          keys: windowed.map((_, i) => String(start + i)),
          groupSize: 1,
        };
      }
      const groupSize = Math.ceil(windowed.length / maxBars);
      const agg = aggregateCandles(windowed, groupSize);
      return {
        candles: agg.candles,
        keys: agg.sourceIndex.map((i) => String(start + i)),
        groupSize,
      };
    }, [candles, n, d0, d1, plotSize.width]);

    const resolvedYDomain: [number, number] = useMemo(
      () => yDomain ?? priceDomain(visible.candles),
      [visible.candles, yDomain],
    );

    // Fractional band scale over bar indices — like bandScale(keys, …, 0.3)
    // at rest, but the window may start/end mid-candle while panning.
    const xBand: BandScale = useMemo(() => {
      const span = d1 - d0;
      const pxPerIndex = span > 0 ? plotSize.width / span : 0;
      const step = pxPerIndex * visible.groupSize;
      const bandwidth = step * 0.7;
      return {
        step,
        bandwidth,
        position(key: string) {
          const i = Number(key);
          if (!Number.isFinite(i)) return null;
          return (i - d0) * pxPerIndex + (step - bandwidth) / 2;
        },
      };
    }, [d0, d1, plotSize.width, visible.groupSize]);

    const yScale = useMemo(
      () => linearScale(resolvedYDomain, [plotSize.height, 0]),
      [resolvedYDomain, plotSize.height],
    );

    // px → data inverses for the annotation editor: px → fractional bar index
    // (exact inverse of annotationXPx's center-of-candle +0.5) → interpolated
    // timestamp; price via the inverted y scale.
    const yInvert = invertLinear(resolvedYDomain, [plotSize.height, 0]);
    invertRef.current = {
      xFromPx: (px) => {
        const span = d1 - d0;
        const idx = span > 0 && plotSize.width > 0 ? d0 + (px / plotSize.width) * span - 0.5 : 0;
        return indexToX(candles, idx);
      },
      yFromPx: yInvert,
    };

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

    // X labels: for dated candles, tick where a calendar unit changes between
    // neighbors (the TradingView model — the bar axis is gap-free, so ticks
    // can't come from a regular time grid) with boundary promotion; numeric
    // candles fall back to even sampling.
    const xAxisTicks: AxisTick[] = useMemo(() => {
      const vc = visible.candles;
      if (vc.length === 0 || plotSize.width <= 0) return [];
      const center = (i: number) => {
        const left = xBand.position(visible.keys[i] ?? "") ?? 0;
        return (left + xBand.bandwidth / 2) / plotSize.width;
      };
      const first = vc[0];
      const last = vc[vc.length - 1];
      if (first && last && isDateValue(first.x) && vc.length > 1) {
        const spanMs = Number(last.x) - Number(first.x);
        if (spanMs > 0) {
          const unit = pickTimeUnit(spanMs, plotSize.width).unit;
          const levels: TimeUnit[] = ["year", "month", "week", "day", "hour", "minute"];
          const out: AxisTick[] = [];
          for (let i = 1; i < vc.length; i++) {
            const prev = vc[i - 1];
            const cur = vc[i];
            if (!prev || !cur) continue;
            let level: TimeUnit | null = null;
            for (const u of levels) {
              if (unitRank(u) < unitRank(unit)) break;
              if (
                startOfUnit(cur.x as Date, u).getTime() !== startOfUnit(prev.x as Date, u).getTime()
              ) {
                level = u;
                break;
              }
            }
            if (level == null) continue;
            out.push({
              label: formatTimeTick(cur.x as Date, level),
              position: center(i),
              major: unitRank(level) > unitRank(unit),
            });
          }
          if (out.length >= 2) {
            // Fine-grained bars can cross a boundary every candle — thin the
            // minor ticks, keep every promoted one.
            const maxTicks = Math.max(2, Math.floor(plotSize.width / 70));
            let ticks = out;
            if (ticks.length > maxTicks) {
              const k = Math.ceil(ticks.length / maxTicks);
              ticks = ticks.filter((t, idx) => t.major || idx % k === 0);
            }
            // A kept minor can still crowd a promoted neighbor ("Jun 28"
            // against "Jul") — drop minors within a label's width of a major.
            const minGap = plotSize.width > 0 ? 48 / plotSize.width : 0;
            return ticks.filter(
              (t) =>
                t.major ||
                !ticks.some((m) => m.major && Math.abs(m.position - t.position) < minGap),
            );
          }
        }
      }
      const stepN = Math.max(
        1,
        Math.ceil(vc.length / Math.max(1, Math.floor(plotSize.width / 100))),
      );
      const out: AxisTick[] = [];
      for (let i = 0; i < vc.length; i += stepN) {
        const c = vc[i];
        if (!c) continue;
        out.push({ label: formatX(c.x), position: center(i), major: false });
      }
      return out;
    }, [visible, xBand, plotSize.width]);

    // Annotation x-anchors are timestamps; map them onto the gap-free bar
    // axis by interpolating between neighboring candles.
    const annotationXPx = useCallback(
      (x: AnnotationX) => {
        const span = d1 - d0;
        const pxPerIndex = span > 0 ? plotSize.width / span : 0;
        return (xToIndex(candles, x) + 0.5 - d0) * pxPerIndex;
      },
      [candles, d0, d1, plotSize.width],
    );

    const formatXDelta = useCallback(
      (a: AnnotationX, b: AnnotationX) =>
        a instanceof Date || b instanceof Date
          ? formatDateDelta(a, b)
          : formatNumber(Math.abs(Number(b) - Number(a))),
      [],
    );

    const handleCandleHover = useCallback((hover: HoverState) => setHover(hover), []);
    const handleLeave = useCallback(() => setHover(null), []);

    const wrapperStyle: CSSProperties = {
      // The inline height would beat the fullscreen class; drop it while
      // expanded.
      ...(height != null && !expanded
        ? { height: typeof height === "number" ? `${height}px` : height }
        : {}),
      ...style,
    };

    // Editor keys before the viewport's zoom/pan keys.
    const handleRootKeyDown = (e: ReactKeyboardEvent) => {
      if (editingEnabled && editor.handleKeyDown(e)) return;
      if (zoomable) viewport.rootProps.onKeyDown(e);
    };

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: the root is the chart's keyboard surface — it gets tabIndex 0 exactly when the zoom/annotation shortcuts are active; pointer interaction lives on the focusable points/candles inside.
      <div
        {...rest}
        {...(zoomable ? viewport.rootProps : null)}
        onKeyDown={zoomable || editingEnabled ? handleRootKeyDown : undefined}
        tabIndex={zoomable || editingEnabled ? 0 : undefined}
        ref={ref}
        className={cx(styles.root, expanded && styles.expanded, frame && styles.frame, className)}
        style={wrapperStyle}
        data-scaffolding={scaffolding}
        data-zoomable={zoomable || undefined}
        data-tool={editor.toolArmed || viewport.marqueeArmed || undefined}
        data-expanded={expanded || undefined}
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
              {...editor.surfaceProps}
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
                candles={visible.candles}
                keys={visible.keys}
                xBand={xBand}
                yScale={yScale}
                plotHeight={plotSize.height}
                onCandleHover={handleCandleHover}
                onCandleLeave={handleLeave}
                onCandleActivate={onPointActivate}
              />

              {editingEnabled || (annotations && annotations.length > 0) ? (
                <AnnotationsLayer
                  annotations={editingEnabled ? editor.displayAnnotations : (annotations ?? [])}
                  xPx={annotationXPx}
                  yPx={yScale}
                  width={plotSize.width}
                  height={plotSize.height}
                  formatXDelta={formatXDelta}
                  formatY={formatNumber}
                  editing={editor.layerEditing}
                />
              ) : null}

              {viewport.marquee ? (
                <rect
                  x={Math.min(viewport.marquee[0], viewport.marquee[1]) * plotSize.width}
                  y={0}
                  width={Math.abs(viewport.marquee[1] - viewport.marquee[0]) * plotSize.width}
                  height={plotSize.height}
                  className={styles.zoomMarquee}
                />
              ) : null}

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
          {zoomable && viewport.isZoomed && !controls ? (
            <button type="button" className={styles.resetButton} onClick={viewport.reset}>
              Reset
            </button>
          ) : null}
          {controls ? (
            <ChartControls
              viewport={zoomable ? viewport : undefined}
              editor={editingEnabled ? editor : undefined}
            />
          ) : null}
          {editor.textEdit ? (
            <div
              className={styles.textEditWrap}
              style={{
                left: annotationXPx(editor.textEdit.anchor.x),
                top: yScale(editor.textEdit.anchor.y),
              }}
              data-annotation=""
            >
              <input
                // Focus on mount: the input exists because the user just
                // clicked with the text tool — focusing it IS the interaction.
                ref={(el) => el?.focus()}
                className={styles.textEditInput}
                value={editor.textEdit.value}
                placeholder="Note…"
                aria-label="Annotation text"
                onChange={(e) => editor.textEdit?.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    editor.textEdit?.commit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    editor.textEdit?.cancel();
                  }
                }}
                onBlur={() => editor.textEdit?.commit()}
              />
            </div>
          ) : null}
        </div>
        {fullscreen ? <FullscreenToggle expanded={expanded} onToggle={toggleExpanded} /> : null}
        <Axis orientation="x" ticks={xAxisTicks} className={styles.xAxis} />
        {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}

        <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
          {hover ? renderTooltip(hover.candle) : null}
        </Tooltip>

        {zoomable ? (
          <div className={styles.srOnly} aria-live="polite">
            {viewport.announcement}
          </div>
        ) : null}
      </div>
    );
  },
);
