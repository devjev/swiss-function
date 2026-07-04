import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Axis,
  type AxisTick,
  Crosshair,
  formatNumber,
  linearScale,
  niceDomain,
  niceTicks,
  Tooltip,
  timeScale,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { computeTicks as computeDateTicks } from "../Timeline/ticks";
import styles from "./Scatterplot.module.css";

const MS_DAY = 24 * 60 * 60 * 1000;

export type ScatterX = number | Date;
export type ChartScaffolding = "minimal" | "hover" | "full";

export interface ScatterDatum {
  x: ScatterX;
  y: number;
  label?: string;
}

export interface ScatterSeries {
  name: string;
  data: ScatterDatum[];
  /** CSS color (e.g. `"var(--sf-color-primary)"`, `"#dc2626"`). Default
   *  `--sf-color-primary`. Multi-series consumers supply explicit colors. */
  color?: string;
  /** Draw a polyline through this series' points (in input order). Default false. */
  showLine?: boolean;
  /** Render point markers. Default true. */
  showPoints?: boolean;
}

export interface ScatterplotProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  series: ScatterSeries[];
  xDomain?: [number, number] | [Date, Date];
  yDomain?: [number, number];
  xLabel?: string;
  yLabel?: string;
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Render a legend below the x-axis. Default: true when >1 series. */
  showLegend?: boolean;
  /** Visual posture:
   *   - `"minimal"` (Tufte/dot-dash): per-datum tick marks on both axes, no
   *     gridlines. Hover draws a dashed crosshair from the point to the axes.
   *   - `"hover"` (default): the dot-dash axes stay; nice-tick horizontal
   *     gridlines additionally fade in when a point is hovered.
   *   - `"full"`: nice-tick axes + gridlines visible at all times (no
   *     dot-dash). Useful when the data is too dense for per-datum ticks. */
  scaffolding?: ChartScaffolding;
  /** Tooltip body. Receives the hovered datum + series name. Default: a
   *  monospace `(x, y)` line. */
  renderTooltip?: (datum: ScatterDatum & { series: string }) => ReactNode;
}

interface HoverState {
  datum: ScatterDatum;
  series: string;
  rect: DOMRect;
  /** SVG-coords for the hovered point — used to anchor the crosshair. */
  cx: number;
  cy: number;
}

function isDateValue(x: ScatterX): x is Date {
  return x instanceof Date;
}

// The point layer is a memo component per series with one delegated
// pointer/focus handler pair (circles carry data-idx), so a hover re-render
// bails out at a single fiber instead of re-reconciling ~2 fibers per point —
// same class as Heatmap's grid layers. Delegation must resolve via
// closest("[data-idx]"): events can target a circle's <title> child, and
// React's onFocus/onBlur (focusin/focusout) need the same lookup. The memo
// only holds while every prop is identity-stable across hover renders — the
// scales are useMemo'd and the callbacks useCallback'd in the root.
const ScatterPointsLayer = memo(function ScatterPointsLayer({
  series,
  xPx,
  yScale,
  onPointHover,
  onPointLeave,
}: {
  series: ScatterSeries;
  xPx: (x: ScatterX) => number;
  yScale: (y: number) => number;
  onPointHover: (hover: HoverState) => void;
  onPointLeave: () => void;
}) {
  const resolvePoint = (target: EventTarget | null): HoverState | null => {
    const el = target instanceof Element ? target.closest("[data-idx]") : null;
    const datum = el ? series.data[Number(el.getAttribute("data-idx"))] : undefined;
    if (!el || !datum) return null;
    return {
      datum,
      series: series.name,
      rect: el.getBoundingClientRect(),
      cx: xPx(datum.x),
      cy: yScale(datum.y),
    };
  };
  const handleEnter = (e: { target: EventTarget | null }) => {
    const hover = resolvePoint(e.target);
    if (hover) onPointHover(hover);
  };
  const handleLeave = (e: { target: EventTarget | null }) => {
    if (e.target instanceof Element && e.target.closest("[data-idx]")) onPointLeave();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pure event delegation — the interactive/focusable surface is each point's circle (role="button", tabIndex) below; the group only hosts the shared listeners (issue #14).
    <g
      onPointerOver={handleEnter}
      onPointerOut={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {series.data.map((d, i) => {
        const px = xPx(d.x);
        const py = yScale(d.y);
        return (
          // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
          <circle
            key={`${series.name}-${String(d.x)}-${d.y}`}
            data-idx={i}
            cx={px}
            cy={py}
            r={4}
            className={styles.point}
            style={{ fill: series.color ?? "var(--sf-color-primary)" }}
            role="button"
            tabIndex={0}
            aria-label={d.label ?? `${series.name}: ${d.y}`}
          >
            <title>{d.label ?? `${series.name}: ${d.y}`}</title>
          </circle>
        );
      })}
    </g>
  );
});

function toNumber(x: ScatterX): number {
  return isDateValue(x) ? x.getTime() : x;
}

function defaultTooltip(d: ScatterDatum & { series: string }): ReactNode {
  const xLabel = isDateValue(d.x) ? d.x.toLocaleDateString() : String(d.x);
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.series}</div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {xLabel}, {d.y}
      </div>
    </>
  );
}

function formatXValue(x: ScatterX): string {
  if (isDateValue(x)) {
    return x.toLocaleString(undefined, { month: "short", day: "numeric" });
  }
  return formatNumber(x);
}

/** Drop labels that would crowd their neighbours. Always preserves the first
 *  and last ticks so the visible range is unambiguous. Operates on already-
 *  positioned ticks (`position` in 0..1). */
function pruneClose(ticks: AxisTick[], minDelta: number): AxisTick[] {
  if (ticks.length <= 2 || minDelta <= 0) return ticks;
  const sorted = [...ticks].sort((a, b) => a.position - b.position);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return ticks;
  const out: AxisTick[] = [first];
  let lastPos = first.position;
  for (let i = 1; i < sorted.length - 1; i++) {
    const t = sorted[i];
    if (!t) continue;
    if (t.position - lastPos >= minDelta && last.position - t.position >= minDelta) {
      out.push(t);
      lastPos = t.position;
    }
  }
  out.push(last);
  return out;
}

export const Scatterplot = forwardRef<HTMLDivElement, ScatterplotProps>(function Scatterplot(
  {
    series,
    xDomain,
    yDomain,
    xLabel,
    yLabel,
    height,
    showLegend,
    scaffolding = "hover",
    renderTooltip = defaultTooltip,
    className,
    style,
    ...rest
  },
  ref,
) {
  // Both minimal and hover modes share the dot-dash idle look; full mode
  // replaces it with nice-tick axes + gridlines.
  const isTufte = scaffolding !== "full";
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [hover, setHover] = useState<HoverState | null>(null);

  // Measure plot cell — SVG renders at the cell's pixel size so points stay
  // perfectly circular regardless of container width.
  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setPlotSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isDateAxis = useMemo(() => {
    for (const s of series) {
      const first = s.data[0];
      if (first) return isDateValue(first.x);
    }
    return false;
  }, [series]);

  // --- Domains (auto-fit when not supplied) ---
  const resolvedXDomain: [number, number] = useMemo(() => {
    if (xDomain) return [toNumber(xDomain[0]), toNumber(xDomain[1])];
    let min = Infinity;
    let max = -Infinity;
    let isDate = false;
    for (const s of series) {
      for (const d of s.data) {
        if (isDateValue(d.x)) isDate = true;
        const v = toNumber(d.x);
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    // Date x: leave raw — Timeline's date ticks handle their own alignment.
    // Numeric x: snap to nice-tick boundaries so axis labels land at edges.
    if (isDate) return [min, max];
    return niceDomain([min, max], 5);
  }, [series, xDomain]);

  const resolvedYDomain: [number, number] = useMemo(() => {
    if (yDomain) return yDomain;
    const all: number[] = [];
    for (const s of series) for (const d of s.data) all.push(d.y);
    // niceDomain snaps to nice-tick boundaries so axis labels land exactly
    // at the plot edges (no clipping, no clamped collisions).
    return niceDomain(all, 5);
  }, [series, yDomain]);

  // --- Scales ---
  const xScaleNum = useMemo(
    () => linearScale(resolvedXDomain, [0, plotSize.width]),
    [resolvedXDomain, plotSize.width],
  );
  const xScaleDate = useMemo(
    () =>
      timeScale([new Date(resolvedXDomain[0]), new Date(resolvedXDomain[1])], [0, plotSize.width]),
    [resolvedXDomain, plotSize.width],
  );
  const yScale = useMemo(
    // Inverted: domain min → bottom (plotHeight), max → top (0).
    () => linearScale(resolvedYDomain, [plotSize.height, 0]),
    [resolvedYDomain, plotSize.height],
  );

  // --- Ticks ---
  // Tufte mode: one tick per unique datum value (dot-dash style). Full mode:
  // nice-tick axis with proportional steps.
  const xAxisTicks: AxisTick[] = useMemo(() => {
    const [xMin, xMax] = resolvedXDomain;
    if (xMax <= xMin) return [];
    if (isTufte) {
      const seen = new Set<number>();
      const ticks: AxisTick[] = [];
      for (const s of series) {
        for (const d of s.data) {
          const v = toNumber(d.x);
          if (seen.has(v)) continue;
          seen.add(v);
          ticks.push({
            label: formatXValue(d.x),
            position: (v - xMin) / (xMax - xMin),
            major: false,
          });
        }
      }
      // Drop labels that would crowd; reserve ~48px per x-axis label.
      const minDelta = plotSize.width > 0 ? 48 / plotSize.width : 0;
      return pruneClose(ticks, minDelta);
    }
    if (isDateAxis) {
      const totalDays = (xMax - xMin) / MS_DAY;
      const pxPerDay = plotSize.width > 0 ? plotSize.width / totalDays : 4;
      const dt = computeDateTicks(new Date(xMin), new Date(xMax), pxPerDay);
      return dt.map((t) => ({
        label: t.label,
        position: (t.date.getTime() - xMin) / (xMax - xMin),
        major: t.major,
      }));
    }
    return niceTicks(xMin, xMax).map((t) => ({
      label: t.label,
      position: (t.value - xMin) / (xMax - xMin),
      major: t.major,
    }));
  }, [resolvedXDomain, isDateAxis, plotSize.width, isTufte, series]);

  const yAxisTicks: AxisTick[] = useMemo(() => {
    const [yMin, yMax] = resolvedYDomain;
    if (yMax <= yMin) return [];
    if (isTufte) {
      const seen = new Set<number>();
      const ticks: AxisTick[] = [];
      for (const s of series) {
        for (const d of s.data) {
          if (seen.has(d.y)) continue;
          seen.add(d.y);
          ticks.push({
            label: formatNumber(d.y),
            position: (d.y - yMin) / (yMax - yMin),
            major: false,
          });
        }
      }
      // Drop labels that would crowd; ~16px per y-axis label (one line height).
      const minDelta = plotSize.height > 0 ? 16 / plotSize.height : 0;
      return pruneClose(ticks, minDelta);
    }
    return niceTicks(yMin, yMax, 5).map((t) => ({
      label: t.label,
      position: (t.value - yMin) / (yMax - yMin),
      major: t.major,
    }));
  }, [resolvedYDomain, isTufte, series, plotSize.height]);

  // Gridline positions — always niceY ticks (regardless of axis ticks), so the
  // hover-revealed gridlines snap to readable values like 5/10/15/20 even when
  // the axis itself shows per-datum dot-dash marks.
  const gridlineTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    const [yMin, yMax] = resolvedYDomain;
    if (yMax <= yMin) return [];
    return niceTicks(yMin, yMax, 5).map((t) => ({
      label: t.label,
      position: (t.value - yMin) / (yMax - yMin),
      major: t.major,
    }));
  }, [resolvedYDomain, scaffolding]);

  // --- Plot geometry ---
  const xPx = useCallback(
    (x: ScatterX): number => (isDateValue(x) ? xScaleDate(x) : xScaleNum(x)),
    [xScaleDate, xScaleNum],
  );

  const handlePointHover = useCallback((hover: HoverState) => setHover(hover), []);
  const handlePointLeave = useCallback(() => setHover(null), []);

  const wrapperStyle: CSSProperties = {
    ...(height != null ? { height: typeof height === "number" ? `${height}px` : height } : {}),
    ...style,
  };

  const legendVisible = showLegend ?? series.length > 1;
  const hasYLabel = !!yLabel;
  const hasXLabel = !!xLabel;

  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.root, className)}
      style={wrapperStyle}
      data-axis-y-label={hasYLabel || undefined}
      data-axis-x-label={hasXLabel || undefined}
      data-scaffolding={scaffolding}
      data-hovered={hover != null ? "true" : undefined}
    >
      {hasYLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
      <Axis orientation="y" ticks={yAxisTicks} noLine={isTufte} className={styles.yAxis} />
      <div ref={plotRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={[yLabel, xLabel].filter(Boolean).join(" vs ") || "Scatter plot"}
            onMouseLeave={handlePointLeave}
          >
            {/* Gridlines render in both hover and full modes (CSS controls
                opacity). In hover mode they fade in on point hover. */}
            {gridlineTicks.map((tick) => {
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
            })}

            {/* Lines (rendered first so points sit on top). */}
            {series.map((s) => {
              if (!s.showLine || s.data.length < 2) return null;
              const points = s.data.map((d) => `${xPx(d.x)},${yScale(d.y)}`).join(" ");
              return (
                <polyline
                  key={`line-${s.name}`}
                  points={points}
                  className={styles.line}
                  style={{ stroke: s.color ?? "var(--sf-color-primary)" }}
                />
              );
            })}

            {/* Points — memo'd per series so hover re-renders bail out at one
                fiber. The polylines above stay inline (one fiber each, cheap). */}
            {series.map((s) =>
              s.showPoints === false ? null : (
                <ScatterPointsLayer
                  key={`points-${s.name}`}
                  series={s}
                  xPx={xPx}
                  yScale={yScale}
                  onPointHover={handlePointHover}
                  onPointLeave={handlePointLeave}
                />
              ),
            )}

            {isTufte && hover ? (
              <Crosshair
                x={hover.cx}
                y={hover.cy}
                height={plotSize.height}
                xLabel={formatXValue(hover.datum.x)}
                yLabel={formatNumber(hover.datum.y)}
              />
            ) : null}
          </svg>
        ) : null}
      </div>
      <Axis orientation="x" ticks={xAxisTicks} noLine={isTufte} className={styles.xAxis} />
      {hasXLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}
      {legendVisible ? (
        <div className={styles.legend}>
          {series.map((s) => (
            <span key={`leg-${s.name}`} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: s.color ?? "var(--sf-color-primary)" }}
                aria-hidden="true"
              />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? renderTooltip({ ...hover.datum, series: hover.series }) : null}
      </Tooltip>
    </div>
  );
});
