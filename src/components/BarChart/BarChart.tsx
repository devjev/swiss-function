import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Axis,
  type AxisTick,
  bandScale,
  Crosshair,
  formatNumber,
  linearScale,
  niceDomain,
  niceTicks,
  Tooltip,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import styles from "./BarChart.module.css";

export type ChartScaffolding = "minimal" | "hover" | "full";

export interface BarSeries {
  name: string;
  /** Parallel to `categories`. */
  values: number[];
  /** CSS color. Default `--sf-color-primary`. */
  color?: string;
}

export interface BarTooltipDatum {
  category: string;
  series: string;
  value: number;
}

export interface BarChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  categories: string[];
  series: BarSeries[];
  /** y-axis range. Auto-fit when omitted (zero anchored if all positive). */
  yDomain?: [number, number];
  xLabel?: string;
  yLabel?: string;
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Render a legend below the x-axis. Default: true when >1 series. */
  showLegend?: boolean;
  /** Visual posture:
   *   - `"minimal"` (Tufte): no y-axis chrome, no gridlines at any time. Each
   *     bar's value is printed directly above it.
   *   - `"hover"` (default): same minimal idle, but the nice-tick y-axis and
   *     gridlines fade in when any bar is hovered/focused (the "scale appears
   *     on demand" UX).
   *   - `"full"`: nice-tick y-axis with gridlines visible at all times, no
   *     inline value labels — the previous v0.1 behavior. */
  scaffolding?: ChartScaffolding;
  /** Click/Enter on a bar — the drill-down hook (issue #27). The consumer
   *  swaps `categories`/`series` for finer-grained data (year → months) and
   *  renders its own breadcrumb / back affordance. */
  onPointActivate?: (datum: BarTooltipDatum) => void;
  renderTooltip?: (datum: BarTooltipDatum) => ReactNode;
}

interface HoverState {
  category: string;
  series: string;
  value: number;
  rect: DOMRect;
  /** SVG-coords for the hovered bar's top-center — used to anchor crosshair. */
  cx: number;
  cy: number;
}

function defaultTooltip(d: BarTooltipDatum): ReactNode {
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.category}</div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {d.series}: {formatNumber(d.value)}
      </div>
    </>
  );
}

export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(function BarChart(
  {
    categories,
    series,
    yDomain,
    xLabel,
    yLabel,
    height,
    showLegend,
    scaffolding = "hover",
    onPointActivate,
    renderTooltip = defaultTooltip,
    className,
    style,
    ...rest
  },
  ref,
) {
  // "Tufte-styled" idle look (no nice-tick chrome, per-bar value labels) covers
  // both minimal and hover modes. Full mode replaces it with the v0.1 chrome.
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

  const resolvedYDomain: [number, number] = useMemo(() => {
    if (yDomain) return yDomain;
    const all: number[] = [];
    for (const s of series) for (const v of s.values) all.push(v);
    return niceDomain(all);
  }, [series, yDomain]);

  const xBand = useMemo(
    () => bandScale(categories, [0, plotSize.width], 0.2),
    [categories, plotSize.width],
  );
  const yScale = useMemo(
    () => linearScale(resolvedYDomain, [plotSize.height, 0]),
    [resolvedYDomain, plotSize.height],
  );

  const baselineY = useMemo(() => {
    const [yMin, yMax] = resolvedYDomain;
    if (yMin >= 0) return plotSize.height;
    if (yMax <= 0) return 0;
    return yScale(0);
  }, [resolvedYDomain, plotSize.height, yScale]);

  // Y-axis nice ticks. In minimal mode they're never shown; in hover and full
  // modes the same data drives them, but CSS controls visibility (hover mode
  // fades them in on bar hover via a data attribute on the chart root).
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

  const xAxisTicks: AxisTick[] = useMemo(() => {
    if (categories.length === 0 || plotSize.width <= 0) return [];
    return categories.map((c) => {
      const left = xBand.position(c) ?? 0;
      const center = left + xBand.bandwidth / 2;
      return { label: c, position: center / plotSize.width, major: false };
    });
  }, [categories, xBand, plotSize.width]);

  const handleEnter = (
    e: React.PointerEvent<SVGRectElement>,
    category: string,
    seriesName: string,
    value: number,
    cx_: number,
    cy_: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ category, series: seriesName, value, rect, cx: cx_, cy: cy_ });
  };
  const handleLeave = () => setHover(null);

  const wrapperStyle: CSSProperties = {
    ...(height != null ? { height: typeof height === "number" ? `${height}px` : height } : {}),
    ...style,
  };

  const legendVisible = showLegend ?? series.length > 1;
  const nSeries = Math.max(1, series.length);
  const innerStep = xBand.bandwidth / nSeries;
  const innerBarWidth = innerStep * 0.85;

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
            aria-label={[yLabel, xLabel].filter(Boolean).join(" by ") || "Bar chart"}
            onMouseLeave={handleLeave}
          >
            {/* Gridlines render in both hover and full modes. CSS controls
                opacity: full-mode shows them always; hover-mode shows only
                when the chart root carries [data-hovered]. */}
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
            {categories.map((c, ci) => {
              const bandLeft = xBand.position(c);
              if (bandLeft == null) return null;
              return series.map((s, si) => {
                const v = s.values[ci] ?? 0;
                const x = bandLeft + innerStep * si + (innerStep - innerBarWidth) / 2;
                const yVal = yScale(v);
                const top = Math.min(yVal, baselineY);
                const h = Math.abs(yVal - baselineY);
                const cx_ = x + innerBarWidth / 2;
                const cy_ = yVal;
                return (
                  <g key={`bar-${c}-${s.name}`}>
                    {/* biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback */}
                    <rect
                      x={x}
                      y={top}
                      width={innerBarWidth}
                      height={h}
                      className={styles.bar}
                      style={{ fill: s.color ?? "var(--sf-color-primary)" }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${c} ${s.name}: ${v}`}
                      onPointerEnter={(e) => handleEnter(e, c, s.name, v, cx_, cy_)}
                      onPointerLeave={handleLeave}
                      onClick={
                        onPointActivate
                          ? () => onPointActivate({ category: c, series: s.name, value: v })
                          : undefined
                      }
                      onKeyDown={
                        onPointActivate
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onPointActivate({ category: c, series: s.name, value: v });
                              }
                            }
                          : undefined
                      }
                      data-activatable={onPointActivate ? "" : undefined}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHover({
                          category: c,
                          series: s.name,
                          value: v,
                          rect,
                          cx: cx_,
                          cy: cy_,
                        });
                      }}
                      onBlur={handleLeave}
                    >
                      <title>
                        {c} — {s.name}: {v}
                      </title>
                    </rect>
                    {/* Tufte mode: value label sits just above the bar's top.
                        Flips inside the bar when it would clip the plot top. */}
                    {isTufte
                      ? (() => {
                          const flip = yVal < 14;
                          return (
                            <text
                              x={cx_}
                              y={flip ? yVal + 14 : yVal - 4}
                              className={cx(styles.valueLabel, flip && styles.valueLabelInside)}
                              textAnchor="middle"
                            >
                              {formatNumber(v)}
                            </text>
                          );
                        })()
                      : null}
                  </g>
                );
              });
            })}

            {/* Tufte mode crosshair on hover — horizontal line from bar top
                to y-axis with the value labeled at the edge. */}
            {isTufte && hover ? (
              <Crosshair
                x={hover.cx}
                y={hover.cy}
                height={plotSize.height}
                axes="y"
                yLabel={formatNumber(hover.value)}
              />
            ) : null}
          </svg>
        ) : null}
      </div>
      <Axis orientation="x" ticks={xAxisTicks} className={styles.xAxis} />
      {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}
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
        {hover
          ? renderTooltip({
              category: hover.category,
              series: hover.series,
              value: hover.value,
            })
          : null}
      </Tooltip>
    </div>
  );
});
