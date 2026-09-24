import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useId, useMemo, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  anchorRectFromPoint,
  bandScale,
  ChartChrome,
  type ChartFormatProps,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  Crosshair,
  ditherCells,
  ditherDots,
  FullscreenToggle,
  fitBandTicks,
  formatNumber,
  formatShare,
  getTextMeasurer,
  linearScale,
  maxLabelWidth,
  niceDomain,
  niceTicks,
  rampStrength,
  resolveChartFormat,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  snapFraction,
  snapHairline,
  Tooltip,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { stackAll, stackExtent, stackTotal } from "./BarChart.math";
import styles from "./BarChart.module.css";

export type { ChartScaffolding } from "../../lib/chart";

export interface BarSeries {
  name: string;
  /** Parallel to `categories`. */
  values: number[];
  /** CSS color. Default `--sf-color-primary`. */
  color?: string;
}

/** The datum a BarChart emits on activate / selection. Already carries
 *  `series`, unlike Scatterplot's point datum, so it doubles as the
 *  selection-with-series shape with no extra wrapper type. */
export interface BarTooltipDatum {
  category: string;
  series: string;
  value: number;
  /** The part's share of its category (0..1). Present only when stacked. */
  share?: number;
}

/** How several series share a category: side by side (the default), piled into
 *  one bar, or piled into one bar of equal height. */
export type BarStack = boolean | "percent";

/** How a stacked segment with no colour of its own is painted. */
export type BarFill = "ramp" | "dither";

export interface BarChartProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartFormatProps,
    ChartScaffoldingProps,
    ChartSelectionProps<BarTooltipDatum> {
  categories: string[];
  series: BarSeries[];
  /** Pile the series into one bar per category instead of setting them side by
   *  side (issue #98). `true` stacks in value units (positives up from the baseline,
   *  negatives down from it); `"percent"` makes every bar the same height and
   *  each part its share of the category. Default `false`. */
  stacked?: BarStack;
  /** How a stacked segment with no `color` is painted: the neutral ink ramp
   *  (default, first series darkest) or the house halftone. Grouped bars keep
   *  the accent colour, since position already tells them apart. */
  fill?: BarFill;
  /** y-axis range. Auto-fit when omitted (zero anchored if all positive). */
  yDomain?: [number, number];
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Render a legend below the x-axis. Default: true when >1 series. */
  showLegend?: boolean;
  /** Fires on every value-axis zoom/pan (`zoomable`); `null` = full range. The
   *  x axis is categorical, so it's the y (value) axis that windows. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
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
  /** What the bar's top edge means on the value axis. The same as `value` for
   *  a plain bar; a stacked segment's top is the running total up to it, so
   *  the crosshair labels that instead of lying about the segment. */
  axisValue: number;
  /** The part's share of its category, when it is part of a stack. */
  share?: number;
}

/** Stable identity of a bar across renders (for the pinned-selection match /
 *  toggle), independent of object reference — the selection is a spread copy. */
function barPointKey(category: string, series: string, value: number): string {
  return `${category} ${series} ${value}`;
}

function defaultTooltip(
  d: BarTooltipDatum,
  format: (v: number) => string,
  seriesName: (name: string) => string,
): ReactNode {
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.category}</div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {seriesName(d.series)}: {format(d.value)}
        {d.share !== undefined ? ` · ${formatShare(d.share)}` : null}
      </div>
    </>
  );
}

export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(function BarChart(
  {
    categories,
    series,
    stacked = false,
    fill = "ramp",
    yDomain,
    xLabel,
    yLabel,
    height,
    showLegend,
    scaffolding = "hover",
    frame,
    fullscreen,
    controls,
    zoomable,
    zoomOutLimit,
    annotations,
    onAnnotationsChange,
    onValueDomainChange,
    valueFormat,
    tickFormat,
    categoryFormat,
    seriesFormat,
    onPointActivate,
    renderTooltip,
    selectable = false,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
    renderSelection,
    className,
    style,
    ...rest
  },
  ref,
) {
  // "Tufte-styled" idle look (no nice-tick chrome, per-bar value labels) covers
  // both minimal and hover modes. Full mode replaces it with the v0.1 chrome.
  const isTufte = scaffolding !== "full";
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));
  // Unlike Scatterplot, bars render inline in this component's own render (no
  // separate memoized mark layer), so the live `selection` can be closed over
  // directly below with no staleness risk — no selectionRef indirection needed.
  const { selection, setSelection } = useChartSelection<BarTooltipDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  const isStacked = stacked !== false;
  const normalized = stacked === "percent";
  const uid = useId();

  // One formatter for every printed number and category label (issue #97).
  const format = useMemo(
    () =>
      resolveChartFormat({ valueFormat, tickFormat, categoryFormat, seriesFormat }, formatNumber),
    [valueFormat, tickFormat, categoryFormat, seriesFormat],
  );
  // A series name is formatted by its position in `series`, so a name printed
  // in a tooltip gets the same treatment as the one in the legend.
  const seriesName = useCallback(
    (name: string) =>
      format.series(
        name,
        series.findIndex((s) => s.name === name),
      ),
    [format, series],
  );
  const tooltipOf =
    renderTooltip ?? ((d: BarTooltipDatum) => defaultTooltip(d, format.value, seriesName));

  // One stack per category when stacking, each series a band inside it.
  const stacks = useMemo(
    () => (isStacked ? stackAll(series, categories.length, normalized) : []),
    [isStacked, series, categories.length, normalized],
  );

  const resolvedYDomain: [number, number] = useMemo(() => {
    if (yDomain) return yDomain;
    // A stack's height is its parts summed, so the axis has to span the stacks,
    // not the individual values. Normalized, every bar is the same height.
    if (normalized) return [0, 1];
    if (isStacked) return niceDomain(stackExtent(stacks));
    const all: number[] = [];
    for (const s of series) for (const v of s.values) all.push(v);
    return niceDomain(all);
  }, [series, yDomain, isStacked, normalized, stacks]);

  // Shared scaffolding: fullscreen, annotation editor, and the value-axis (y)
  // zoom viewport — x is categorical, so it's the continuous value axis that
  // windows (issue #35).
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
      formatValue: (v) => format.tick(v, normalized ? formatShare(v) : formatNumber(v)),
      axis: "y",
    },
  });
  // The visible value domain — the zoomed window when zoomable, else the full
  // extent. Scales, gridlines and ticks all recompute from it.
  const viewYDomain = zoomable ? scaffold.viewport.domain : resolvedYDomain;

  const xBand = useMemo(
    () => bandScale(categories, [0, plotSize.width], 0.2),
    [categories, plotSize.width],
  );
  const yScale = useMemo(
    () => linearScale(viewYDomain, [plotSize.height, 0]),
    [viewYDomain, plotSize.height],
  );

  const baselineY = useMemo(() => {
    const [yMin, yMax] = viewYDomain;
    if (yMin >= 0) return plotSize.height;
    if (yMax <= 0) return 0;
    return yScale(0);
  }, [viewYDomain, plotSize.height, yScale]);

  // Data→px for annotations: x maps to a fractional category index [0, n], y is
  // the (zoomed) value scale. The px→data inverses feed the annotation editor.
  const nCats = Math.max(1, categories.length);
  const xToPx = (x: AnnotationX) => (Number(x) / nCats) * plotSize.width;
  scaffold.invertRef.current = {
    xFromPx: (px) => (plotSize.width > 0 ? (px / plotSize.width) * nCats : 0),
    yFromPx: (px) => {
      const [y0, y1] = viewYDomain;
      return plotSize.height > 0 ? y1 - (px / plotSize.height) * (y1 - y0) : y0;
    },
  };

  // Y-axis nice ticks. In minimal mode they're never shown; in hover and full
  // modes the same data drives them, but CSS controls visibility (hover mode
  // fades them in on bar hover via a data attribute on the chart root).
  const yAxisTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    const [yMin, yMax] = viewYDomain;
    if (yMax <= yMin) return [];
    return niceTicks(yMin, yMax, 5)
      .filter((t) => t.value >= yMin && t.value <= yMax)
      .map((t) => ({
        label: format.tick(t.value, normalized ? formatShare(t.value) : t.label),
        position: (t.value - yMin) / (yMax - yMin),
        major: t.major,
      }));
  }, [viewYDomain, scaffolding, format, normalized]);

  // Categorical labels through the measured fitting ladder: full text when
  // every label fits its band, ellipsized (full text in title) when close,
  // thinned to a stride keeping first + last when bands get too narrow.
  const xAxisTicks: AxisTick[] = useMemo(() => {
    if (categories.length === 0 || plotSize.width <= 0) return [];
    const centers = categories.map((c) => {
      const left = xBand.position(c) ?? 0;
      return snapFraction((left + xBand.bandwidth / 2) / plotSize.width, plotSize.width);
    });
    const labels = categories.map((c, i) => format.category(c, i));
    return fitBandTicks(labels, centers, xBand.step, plotSize.width, measure).map((t) => ({
      label: t.label,
      title: t.title,
      position: t.position,
      major: false,
    }));
  }, [categories, xBand, plotSize.width, measure, format]);

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
    category: string,
    seriesName: string,
    value: number,
    cx_: number,
    cy_: number,
    axisValue: number = value,
    share?: number,
  ) => {
    const plotEl = plotRef.current;
    if (!plotEl) return;
    const rect = anchorRectFromPoint(plotEl, cx_, cy_);
    setHover({
      category,
      series: seriesName,
      value,
      rect,
      cx: cx_,
      cy: cy_,
      axisValue,
      ...(share !== undefined ? { share } : {}),
    });
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

  const legendVisible = showLegend ?? series.length > 1;
  const nSeries = Math.max(1, series.length);
  // Grouped, the band is divided between the series; stacked, one bar takes it.
  const innerStep = xBand.bandwidth / (isStacked ? 1 : nSeries);
  const innerBarWidth = innerStep * 0.85;

  // Grouped bars keep the accent colour: position already tells them apart.
  // Stacked segments touch, so they step through the neutral ramp (or the
  // halftone) unless the series carries a colour of its own.
  const strengthOf = (si: number) =>
    fill === "dither" ? ditherDots(si, nSeries) / 16 : rampStrength(si, nSeries);
  const swatchOf = (s: BarSeries, si: number) =>
    s.color ??
    (isStacked
      ? `color-mix(in srgb, var(--sf-color-fg) ${Math.round(strengthOf(si) * 100)}%, var(--sf-color-bg))`
      : "var(--sf-color-primary)");
  const fillOf = (s: BarSeries, si: number) =>
    s.color ?? (isStacked && fill === "dither" ? `url(#${uid}-d${si})` : swatchOf(s, si));

  /** The topmost drawn rect of a category's stack, for the printed total. */
  const topOfStack = (ci: number) => {
    let top: { x: number; y: number; width: number; height: number } | null = null;
    for (let si = 0; si < series.length; si++) {
      const rect = segmentRect(ci, si);
      if (!rect || rect.height <= 0) continue;
      if (!top || rect.y < top.y) top = rect;
    }
    return top;
  };

  /** A stacked segment's rect, or null when the category or part is missing. */
  const segmentRect = (ci: number, si: number) => {
    const c = categories[ci];
    const bandLeft = c != null ? xBand.position(c) : null;
    const segment = stacks[ci]?.[si];
    if (bandLeft == null || !segment) return null;
    const top = Math.min(yScale(segment.end), yScale(segment.start));
    const bottom = Math.max(yScale(segment.end), yScale(segment.start));
    return {
      x: bandLeft + (innerStep - innerBarWidth) / 2,
      y: top,
      width: innerBarWidth,
      height: bottom - top,
      segment,
    };
  };

  // Click/Enter on a bar: report the activate event, then (when selectable)
  // toggle the pin — re-clicking the pinned bar clears it, any other bar
  // moves the pin. Compared by the stable key, not object identity.
  const activatable = !!onPointActivate || selectable;
  const handleBarActivate = (payload: BarTooltipDatum) => {
    onPointActivate?.(payload);
    if (!selectable) return;
    const same =
      selection != null &&
      barPointKey(selection.category, selection.series, selection.value) ===
        barPointKey(payload.category, payload.series, payload.value);
    setSelection(same ? null : payload);
  };

  // The pinned popover's anchor, re-derived from the selected datum through the
  // live band/value scales every render, so it tracks zoom / resize. Never a
  // lookup into the currently rendered bars — the stored datum drives it
  // directly, the same cx/cy derivation `handleEnter` uses for the hover path.
  const selectionPoint = useMemo(() => {
    if (!selectable || !selection || plotSize.width <= 0 || plotSize.height <= 0) return null;
    const bandLeft = xBand.position(selection.category);
    const si = series.findIndex((s) => s.name === selection.series);
    if (bandLeft == null || si < 0) return null;
    if (isStacked) {
      const segment = stacks[categories.indexOf(selection.category)]?.[si];
      if (!segment) return null;
      return {
        x: bandLeft + innerStep / 2,
        y: Math.min(yScale(segment.end), yScale(segment.start)),
      };
    }
    const x = bandLeft + innerStep * si + (innerStep - innerBarWidth) / 2;
    return { x: x + innerBarWidth / 2, y: yScale(selection.value) };
  }, [
    selectable,
    selection,
    xBand,
    series,
    innerStep,
    innerBarWidth,
    yScale,
    isStacked,
    stacks,
    categories,
    plotSize.width,
    plotSize.height,
  ]);
  const selectedKey = selection
    ? barPointKey(selection.category, selection.series, selection.value)
    : null;

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
            aria-label={[yLabel, xLabel].filter(Boolean).join(" by ") || "Bar chart"}
            onMouseLeave={handleLeave}
          >
            {/* Gridlines render in both hover and full modes. CSS controls
                opacity: full-mode shows them always; hover-mode shows only
                when the chart root carries [data-hovered]. */}
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
            {isStacked && fill === "dither" ? (
              <defs>
                {series.map((s, si) =>
                  s.color ? null : (
                    <pattern
                      key={`pat-${s.name}`}
                      id={`${uid}-d${si}`}
                      patternUnits="userSpaceOnUse"
                      width={4}
                      height={4}
                    >
                      {ditherCells(ditherDots(si, nSeries)).map((c) => (
                        <rect
                          key={`${c.x}-${c.y}`}
                          x={c.x}
                          y={c.y}
                          width={1}
                          height={1}
                          className={styles.ditherDot}
                        />
                      ))}
                    </pattern>
                  ),
                )}
              </defs>
            ) : null}

            {/* Stacked: one bar per category, the series piled inside it. The
                segments touch, so a 1px page-coloured hairline separates them
                (CSS), and the printed figure goes above the whole stack. */}
            {isStacked
              ? categories.map((c, ci) => {
                  const stack = stacks[ci];
                  if (!stack) return null;
                  const total = stackTotal(stack);
                  const totalText = format.value(total);
                  const topRect = topOfStack(ci);
                  return (
                    <g key={`stack-${c}`}>
                      {series.map((s, si) => {
                        const rect = segmentRect(ci, si);
                        if (!rect || rect.height <= 0) return null;
                        const datum: BarTooltipDatum = {
                          category: c,
                          series: s.name,
                          value: rect.segment.value,
                          share: rect.segment.share,
                        };
                        const selected =
                          selectedKey != null &&
                          barPointKey(c, s.name, rect.segment.value) === selectedKey;
                        return (
                          // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
                          <rect
                            key={`seg-${c}-${s.name}`}
                            x={rect.x}
                            y={rect.y}
                            width={rect.width}
                            height={rect.height}
                            className={cx(styles.bar, styles.segment)}
                            style={{ fill: fillOf(s, si) }}
                            data-chart-mark=""
                            role="button"
                            tabIndex={0}
                            aria-label={`${format.category(c, ci)} ${format.series(
                              s.name,
                              si,
                            )}: ${format.value(rect.segment.value)}, ${formatShare(
                              rect.segment.share,
                            )}`}
                            onPointerEnter={(e) =>
                              handleEnter(
                                e,
                                c,
                                s.name,
                                rect.segment.value,
                                rect.x + rect.width / 2,
                                rect.y,
                                rect.segment.end,
                                rect.segment.share,
                              )
                            }
                            onPointerLeave={handleLeave}
                            onFocus={(e) =>
                              handleEnter(
                                e,
                                c,
                                s.name,
                                rect.segment.value,
                                rect.x + rect.width / 2,
                                rect.y,
                                rect.segment.end,
                                rect.segment.share,
                              )
                            }
                            onBlur={handleLeave}
                            onClick={activatable ? () => handleBarActivate(datum) : undefined}
                            onKeyDown={
                              activatable
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleBarActivate(datum);
                                    }
                                  }
                                : undefined
                            }
                            data-activatable={activatable ? "" : undefined}
                            data-selected={selected || undefined}
                          >
                            <title>
                              {format.category(c, ci)} — {format.series(s.name, si)}:{" "}
                              {format.value(rect.segment.value)}
                            </title>
                          </rect>
                        );
                      })}
                      {/* The stack's own total, which is the figure the axis
                          cannot be read for. Normalized, every bar is 100%, so
                          there is nothing to print. */}
                      {isTufte && !normalized && topRect && measure(totalText) <= innerStep
                        ? (() => {
                            const flip = topRect.y < 14;
                            return (
                              <text
                                x={topRect.x + topRect.width / 2}
                                y={flip ? topRect.y + 14 : topRect.y - 4}
                                className={cx(styles.valueLabel, flip && styles.valueLabelHalo)}
                                textAnchor="middle"
                              >
                                {totalText}
                              </text>
                            );
                          })()
                        : null}
                    </g>
                  );
                })
              : null}

            {!isStacked
              ? categories.map((c, ci) => {
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
                    const selected =
                      selectedKey != null && barPointKey(c, s.name, v) === selectedKey;
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
                          data-chart-mark=""
                          role="button"
                          tabIndex={0}
                          aria-label={`${format.category(c, ci)} ${format.series(s.name, si)}: ${format.value(v)}`}
                          onPointerEnter={(e) => handleEnter(e, c, s.name, v, cx_, cy_)}
                          onPointerLeave={handleLeave}
                          onClick={
                            activatable
                              ? () => handleBarActivate({ category: c, series: s.name, value: v })
                              : undefined
                          }
                          onKeyDown={
                            activatable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleBarActivate({ category: c, series: s.name, value: v });
                                  }
                                }
                              : undefined
                          }
                          data-activatable={activatable ? "" : undefined}
                          data-selected={selected || undefined}
                          onFocus={(e) => handleEnter(e, c, s.name, v, cx_, cy_)}
                          onBlur={handleLeave}
                        >
                          <title>
                            {format.category(c, ci)} — {format.series(s.name, si)}:{" "}
                            {format.value(v)}
                          </title>
                        </rect>
                        {/* Tufte mode: value label sits just above the bar's top.
                        Flips inside the bar when it would clip the plot top. */}
                        {isTufte && measure(format.value(v)) <= innerStep
                          ? (() => {
                              const flip = yVal < 14;
                              return (
                                <text
                                  x={cx_}
                                  y={flip ? yVal + 14 : yVal - 4}
                                  className={cx(styles.valueLabel, flip && styles.valueLabelInside)}
                                  textAnchor="middle"
                                >
                                  {format.value(v)}
                                </text>
                              );
                            })()
                          : null}
                      </g>
                    );
                  });
                })
              : null}

            {/* Tufte mode crosshair on hover — horizontal line from bar top
                to y-axis with the value labeled at the edge. */}
            {isTufte && hover ? (
              <Crosshair
                x={hover.cx}
                y={hover.cy}
                height={plotSize.height}
                axes="y"
                yLabel={
                  normalized
                    ? formatShare(hover.axisValue)
                    : format.tick(hover.axisValue, formatNumber(hover.axisValue))
                }
              />
            ) : null}

            {/* Data-anchored annotations (issue #35): rendered in the bars' own
                pixel-space SVG. x anchors to a fractional category index, y to
                the (zoomed) value scale. */}
            {scaffold.editingEnabled || (annotations && annotations.length > 0) ? (
              <AnnotationsLayer
                annotations={
                  scaffold.editingEnabled ? scaffold.editor.displayAnnotations : (annotations ?? [])
                }
                xPx={xToPx}
                yPx={yScale}
                width={plotSize.width}
                height={plotSize.height}
                formatXDelta={(a, b) => `${Math.abs(Number(b) - Number(a)).toFixed(1)} cat`}
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
      {legendVisible ? (
        <div className={styles.legend}>
          {series.map((s, si) => (
            <span key={`leg-${s.name}`} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: swatchOf(s, si) }}
                aria-hidden="true"
              />
              {format.series(s.name, si)}
            </span>
          ))}
        </div>
      ) : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover
          ? tooltipOf({
              category: hover.category,
              series: hover.series,
              value: hover.value,
              ...(hover.share !== undefined ? { share: hover.share } : {}),
            })
          : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection ? (renderSelection ?? tooltipOf)(selection) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
