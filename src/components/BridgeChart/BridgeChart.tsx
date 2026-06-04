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
import styles from "./BridgeChart.module.css";

export type BridgeKind = "total" | "delta";
export type ChartScaffolding = "minimal" | "hover" | "full";

export interface BridgeItem {
  label: string;
  value: number;
  kind: BridgeKind;
}

export interface BridgeTooltipDatum extends BridgeItem {
  /** Running total AFTER this item is applied. */
  cumulative: number;
}

export interface BridgeChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: BridgeItem[];
  yDomain?: [number, number];
  yLabel?: string;
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Dashed connector lines between adjacent bars. Default true. */
  showConnectors?: boolean;
  /** Visual posture (see BarChart for the full description):
   *   - `"minimal"`: Tufte idle, no scaffolding ever.
   *   - `"hover"` (default): minimal idle + nice-tick y-axis and gridlines
   *     fade in when any bar is hovered.
   *   - `"full"`: traditional axis + gridlines always, no inline labels. */
  scaffolding?: ChartScaffolding;
  renderTooltip?: (datum: BridgeTooltipDatum) => ReactNode;
}

interface ResolvedBar {
  item: BridgeItem;
  /** Domain-space upper edge of the bar (max of from/to). */
  top: number;
  /** Domain-space lower edge of the bar (min of from/to). */
  bottom: number;
  /** Cumulative AFTER applying this item — used for connector y and tooltip. */
  cumulative: number;
}

interface HoverState {
  bar: ResolvedBar;
  rect: DOMRect;
  cx: number;
  cy: number;
}

function resolveBars(items: BridgeItem[]): ResolvedBar[] {
  let cum = 0;
  const out: ResolvedBar[] = [];
  for (const item of items) {
    if (item.kind === "total") {
      cum = item.value;
      out.push({
        item,
        top: Math.max(0, item.value),
        bottom: Math.min(0, item.value),
        cumulative: cum,
      });
    } else {
      const prev = cum;
      cum = prev + item.value;
      out.push({
        item,
        top: Math.max(prev, cum),
        bottom: Math.min(prev, cum),
        cumulative: cum,
      });
    }
  }
  return out;
}

function defaultTooltip(d: BridgeTooltipDatum): ReactNode {
  const sign = d.kind === "delta" && d.value >= 0 ? "+" : "";
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.label}</div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {sign}
        {formatNumber(d.value)}
        {d.kind === "delta" ? ` → ${formatNumber(d.cumulative)}` : ""}
      </div>
    </>
  );
}

/** Compact bar-label form: deltas get explicit sign; totals don't. */
function formatBarValue(item: BridgeItem): string {
  if (item.kind === "total") return formatNumber(item.value);
  const sign = item.value >= 0 ? "+" : "";
  return `${sign}${formatNumber(item.value)}`;
}

export const BridgeChart = forwardRef<HTMLDivElement, BridgeChartProps>(function BridgeChart(
  {
    items,
    yDomain,
    yLabel,
    height,
    showConnectors = true,
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

  const bars = useMemo(() => resolveBars(items), [items]);

  const resolvedYDomain: [number, number] = useMemo(() => {
    if (yDomain) return yDomain;
    const all: number[] = [];
    for (const b of bars) {
      all.push(b.top);
      all.push(b.bottom);
    }
    return niceDomain(all);
  }, [bars, yDomain]);

  const categories = useMemo(() => bars.map((b) => b.item.label), [bars]);
  const xBand = useMemo(
    () => bandScale(categories, [0, plotSize.width], 0.2),
    [categories, plotSize.width],
  );
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
    bar: ResolvedBar,
    cx_: number,
    cy_: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ bar, rect, cx: cx_, cy: cy_ });
  };
  const handleLeave = () => setHover(null);

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
            aria-label={yLabel ? `${yLabel} waterfall` : "Waterfall chart"}
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

            {bars.map((b) => {
              const left = xBand.position(b.item.label);
              if (left == null) return null;
              const yTop = yScale(b.top);
              const yBottom = yScale(b.bottom);
              const h = Math.max(1, yBottom - yTop);
              const cls =
                b.item.kind === "total"
                  ? styles.barTotal
                  : b.item.value >= 0
                    ? styles.barPositive
                    : styles.barNegative;
              const cx_ = left + xBand.bandwidth / 2;
              // Crosshair anchor at the bar's TOP edge (where the value sits).
              const cy_ = yTop;
              return (
                <g key={`bar-${b.item.label}`}>
                  {/* biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback */}
                  <rect
                    x={left}
                    y={yTop}
                    width={xBand.bandwidth}
                    height={h}
                    className={cx(styles.bar, cls)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${b.item.label}: ${b.item.value}`}
                    onPointerEnter={(e) => handleEnter(e, b, cx_, cy_)}
                    onPointerLeave={handleLeave}
                    onFocus={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHover({ bar: b, rect, cx: cx_, cy: cy_ });
                    }}
                    onBlur={handleLeave}
                  >
                    <title>
                      {b.item.label}: {b.item.value} (→ {b.cumulative})
                    </title>
                  </rect>
                  {isTufte
                    ? (() => {
                        const flip = yTop < 14;
                        return (
                          <text
                            x={cx_}
                            y={flip ? yTop + 14 : yTop - 4}
                            className={cx(styles.valueLabel, flip && styles.valueLabelInside)}
                            textAnchor="middle"
                          >
                            {formatBarValue(b.item)}
                          </text>
                        );
                      })()
                    : null}
                </g>
              );
            })}

            {/* Connectors — drawn AFTER bars so the dashes sit on top. */}
            {showConnectors
              ? bars.slice(0, -1).map((cur, bi) => {
                  const next = bars[bi + 1];
                  if (!next) return null;
                  const curLeft = xBand.position(cur.item.label);
                  const nextLeft = xBand.position(next.item.label);
                  if (curLeft == null || nextLeft == null) return null;
                  const xStart = curLeft + xBand.bandwidth;
                  const xEnd = nextLeft;
                  const y = yScale(cur.cumulative);
                  return (
                    <line
                      key={`conn-${cur.item.label}-${next.item.label}`}
                      x1={xStart}
                      x2={xEnd}
                      y1={y}
                      y2={y}
                      className={styles.connector}
                    />
                  );
                })
              : null}

            {isTufte && hover ? (
              <Crosshair
                x={hover.cx}
                y={hover.cy}
                height={plotSize.height}
                axes="y"
                yLabel={formatNumber(hover.bar.cumulative)}
              />
            ) : null}
          </svg>
        ) : null}
      </div>
      <Axis orientation="x" ticks={xAxisTicks} className={styles.xAxis} />

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? renderTooltip({ ...hover.bar.item, cumulative: hover.bar.cumulative }) : null}
      </Tooltip>
    </div>
  );
});
