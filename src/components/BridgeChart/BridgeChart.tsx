import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useMemo, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  anchorRectFromPoint,
  bandScale,
  ChartChrome,
  type ChartScaffoldingProps,
  Crosshair,
  FullscreenToggle,
  fitBandTicks,
  formatNumber,
  getTextMeasurer,
  linearScale,
  maxLabelWidth,
  niceDomain,
  niceTicks,
  resolveTickFont,
  scaffoldStyles,
  snapFraction,
  snapHairline,
  Tooltip,
  useChartScaffold,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import styles from "./BridgeChart.module.css";

export type BridgeKind = "total" | "delta";
export type { ChartScaffolding } from "../../lib/chart";

export interface BridgeItem {
  label: string;
  value: number;
  kind: BridgeKind;
}

export interface BridgeTooltipDatum extends BridgeItem {
  /** Running total AFTER this item is applied. */
  cumulative: number;
}

export interface BridgeChartProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps {
  items: BridgeItem[];
  yDomain?: [number, number];
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Dashed connector lines between adjacent bars. Default true. */
  showConnectors?: boolean;
  /** Fires on every value-axis zoom/pan (`zoomable`); `null` = full range. The
   *  x axis is categorical, so it's the y (value) axis that windows. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
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
    xLabel,
    yLabel,
    height,
    showConnectors = true,
    scaffolding = "hover",
    frame,
    fullscreen,
    controls,
    zoomable,
    zoomOutLimit,
    annotations,
    onAnnotationsChange,
    onValueDomainChange,
    renderTooltip = defaultTooltip,
    className,
    style,
    ...rest
  },
  ref,
) {
  const isTufte = scaffolding !== "full";
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  // Hover state at the root re-renders the whole chart per enter/leave. That
  // pattern was extracted into memo layers for Scatterplot/CandlestickChart
  // (issue #14) but is deliberately EXEMPT here: a bridge chart's realistic N
  // is dozens of bars, measured at the harness floor (BarChart@100 equivalent,
  // 2026-07-04). Revisit only if a use case pushes N into the hundreds.
  const [hover, setHover] = useState<HoverState | null>(null);
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));

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

  // Shared scaffolding: fullscreen, annotation editor, and value-axis (y) zoom
  // — the waterfall's x is categorical, so the continuous value axis windows
  // (issue #35).
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable,
    annotations,
    onAnnotationsChange,
    value: {
      extent: resolvedYDomain,
      onDomainChange: onValueDomainChange,
      minSpan: Math.max((resolvedYDomain[1] - resolvedYDomain[0]) / 100, Number.EPSILON),
      zoomOutLimit,
      formatValue: formatNumber,
      axis: "y",
    },
  });
  const viewYDomain = zoomable ? scaffold.viewport.domain : resolvedYDomain;

  const xBand = useMemo(
    () => bandScale(categories, [0, plotSize.width], 0.2),
    [categories, plotSize.width],
  );
  const yScale = useMemo(
    () => linearScale(viewYDomain, [plotSize.height, 0]),
    [viewYDomain, plotSize.height],
  );

  // Data→px for annotations: x maps to a fractional bar index [0, n], y to the
  // (zoomed) value scale; the inverses feed the annotation editor.
  const nCats = Math.max(1, categories.length);
  const xToPx = (x: AnnotationX) => (Number(x) / nCats) * plotSize.width;
  scaffold.invertRef.current = {
    xFromPx: (px) => (plotSize.width > 0 ? (px / plotSize.width) * nCats : 0),
    yFromPx: (px) => {
      const [y0, y1] = viewYDomain;
      return plotSize.height > 0 ? y1 - (px / plotSize.height) * (y1 - y0) : y0;
    },
  };

  const yAxisTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    const [yMin, yMax] = viewYDomain;
    if (yMax <= yMin) return [];
    return niceTicks(yMin, yMax, 5)
      .filter((t) => t.value >= yMin && t.value <= yMax)
      .map((t) => ({
        label: t.label,
        position: (t.value - yMin) / (yMax - yMin),
        major: t.major,
      }));
  }, [viewYDomain, scaffolding]);

  // Step labels through the measured fitting ladder: full text when every
  // label fits its band, ellipsized (full text in title) when close, thinned
  // to a stride keeping first + last when bands get too narrow.
  const xAxisTicks: AxisTick[] = useMemo(() => {
    if (categories.length === 0 || plotSize.width <= 0) return [];
    const centers = categories.map((c) => {
      const left = xBand.position(c) ?? 0;
      return snapFraction((left + xBand.bandwidth / 2) / plotSize.width, plotSize.width);
    });
    return fitBandTicks(categories, centers, xBand.step, plotSize.width, measure).map((t) => ({
      label: t.label,
      title: t.title,
      position: t.position,
      major: false,
    }));
  }, [categories, xBand, plotSize.width, measure]);

  // Measured y-axis column: the widest tick label sets --sf-axis-label-width
  // (8px-quantized so the resize feedback loop cannot oscillate).
  const yAxisWidth = useMemo(
    () =>
      maxLabelWidth(
        yAxisTicks.map((t) => t.label),
        measure,
      ),
    [yAxisTicks, measure],
  );

  // One anchor source: tooltip and crosshair both derive from the bar's
  // top-center in plot space, so they can never disagree.
  const handleEnter = (
    _e: React.PointerEvent<SVGRectElement> | React.FocusEvent<SVGRectElement>,
    bar: ResolvedBar,
    cx_: number,
    cy_: number,
  ) => {
    const plotEl = plotRef.current;
    if (!plotEl) return;
    const rect = anchorRectFromPoint(plotEl, cx_, cy_);
    setHover({ bar, rect, cx: cx_, cy: cy_ });
  };
  const handleLeave = () => setHover(null);

  const wrapperStyle: CSSProperties = {
    ...(yAxisWidth > 0 ? { "--sf-axis-label-width": `${yAxisWidth}px` } : {}),
    // Inline height wins over the .expanded class, so drop it while maximized.
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  return (
    <div
      {...rest}
      ref={ref}
      {...scaffold.rootProps}
      {...scaffold.rootData}
      className={cx(
        styles.root,
        frame && scaffoldStyles.frame,
        scaffold.expanded && scaffoldStyles.expanded,
        className,
      )}
      style={wrapperStyle}
      data-hovered={hover != null ? "true" : undefined}
    >
      {yLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
      <Axis orientation="y" ticks={yAxisTicks} noLine={isTufte} className={styles.yAxis} />
      <div ref={plotAreaRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            {...scaffold.editor.surfaceProps}
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
                  const y = snapHairline(plotSize.height * (1 - tick.position));
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
                    onFocus={(e) => handleEnter(e, b, cx_, cy_)}
                    onBlur={handleLeave}
                  >
                    <title>
                      {b.item.label}: {b.item.value} (→ {b.cumulative})
                    </title>
                  </rect>
                  {/* Tufte mode: value label sits just above the bar's top —
                      skipped when the measured text overflows the band step. */}
                  {isTufte && measure(formatBarValue(b.item)) <= xBand.step
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
                  // 1px dashed hairline — snap so it fills whole pixels.
                  const y = snapHairline(yScale(cur.cumulative));
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

            {/* Data-anchored annotations (issue #35): an hline is the natural
                reference-level marker on a waterfall. x anchors to a fractional
                bar index, y to the (zoomed) value scale. */}
            {scaffold.editingEnabled || (annotations && annotations.length > 0) ? (
              <AnnotationsLayer
                annotations={
                  scaffold.editingEnabled ? scaffold.editor.displayAnnotations : (annotations ?? [])
                }
                xPx={xToPx}
                yPx={yScale}
                width={plotSize.width}
                height={plotSize.height}
                formatXDelta={(a, b) => `${Math.abs(Number(b) - Number(a)).toFixed(1)} step`}
                formatY={formatNumber}
                editing={scaffold.editor.layerEditing}
              />
            ) : null}

            {/* Value-axis zoom marquee: a full-width band across the y range. */}
            {scaffold.viewport.marquee
              ? (() => {
                  const [f0, f1] = scaffold.viewport.marquee;
                  const yTop = (1 - Math.max(f0, f1)) * plotSize.height;
                  const yBot = (1 - Math.min(f0, f1)) * plotSize.height;
                  return (
                    <rect
                      x={0}
                      y={yTop}
                      width={plotSize.width}
                      height={yBot - yTop}
                      className={scaffoldStyles.marquee}
                    />
                  );
                })()
              : null}
          </svg>
        ) : null}
        <ChartChrome
          scaffold={scaffold}
          controls={!!controls}
          xDataToPx={xToPx}
          yDataToPx={yScale}
        />
      </div>
      <Axis orientation="x" ticks={xAxisTicks} className={styles.xAxis} />
      {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? renderTooltip({ ...hover.bar.item, cumulative: hover.bar.cumulative }) : null}
      </Tooltip>
    </div>
  );
});
