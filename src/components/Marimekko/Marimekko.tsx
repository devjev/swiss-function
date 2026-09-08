import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useId, useMemo, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  anchorRectFromPoint,
  ChartChrome,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  ellipsize,
  FullscreenToggle,
  formatNumber as formatCompact,
  getTextMeasurer,
  linearScale,
  maxLabelWidth,
  niceDomain,
  niceTicks,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  snapHairline,
  Tooltip,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { formatNumber } from "../../lib/format";
import {
  type Band,
  columnTotals,
  ditherCells,
  ditherDots,
  fitBandLabels,
  formatShare,
  indexToPx,
  labelFits,
  layoutBands,
  pxToIndex,
  rampStrength,
  type Segment,
  stackColumn,
  widthMeasures,
} from "./Marimekko.math";
import styles from "./Marimekko.module.css";

export type { ChartScaffolding } from "../../lib/chart";

export interface MarimekkoSeries {
  name: string;
  /** Parallel to `categories`; one segment per column. Values below zero,
   *  missing or not finite count as zero. */
  values: number[];
  /** CSS colour of this series' segments. Default: a step of the neutral ramp
   *  (or of the dither densities with `fill="dither"`). */
  color?: string;
}

/** Which figure a segment prints when it fits: its share of the column, its
 *  value, or both. `true` picks the share when normalized and the value
 *  otherwise. */
export type MarimekkoValueLabels = boolean | "percent" | "value" | "both";

/** The category label under (beside) each column: the name alone, the name
 *  with the column's share of the width axis, or nothing. */
export type MarimekkoColumnLabels = "name" | "name+share" | "none";

/** How the default series fills step: a neutral ramp of the ink mixed into the
 *  page (the first series darkest), or the house halftone at stepped dot
 *  densities. A per-series `color` wins over either. */
export type MarimekkoFill = "ramp" | "dither";

/** The datum a Marimekko emits on hover, activate and selection. */
export interface MarimekkoDatum {
  category: string;
  series: string;
  value: number;
  /** The segment's share of its column. */
  share: number;
  /** The segment's share of the grand total. */
  total: number;
  /** The column's share of the width axis. */
  width: number;
}

export interface MarimekkoProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps,
    ChartSelectionProps<MarimekkoDatum> {
  /** The columns (rows when horizontal). */
  categories: string[];
  /** One stacked segment per series per column. */
  series: MarimekkoSeries[];
  /** The width measure per column: the column's total (default), or an
   *  explicit measure parallel to `categories`. */
  widthBy?: "total" | number[];
  /** Stack every column to 100% (default). `false` stacks in the values' own
   *  units: a variable-width stacked bar chart whose value axis can zoom. */
  normalize?: boolean;
  /** Columns along x with the stacks vertical (default), or rows down the
   *  side with the stacks running left to right. */
  orientation?: "vertical" | "horizontal";
  /** The px of page between columns. Default `1`, a hairline. */
  gap?: number;
  /** How the default series fills step. Default `"ramp"`. */
  fill?: MarimekkoFill;
  /** Segment labels, printed only where they fit (measured, hidden below a
   *  minimum size, never rotated). Default `true`. */
  showValues?: MarimekkoValueLabels;
  /** Formats printed values (segment labels, the value axis, the default
   *  tooltip). Default: compact on the chart, Swiss typography in the tooltip. */
  valueFormat?: (value: number) => string;
  /** The category label under (beside) each column. Default `"name"`. */
  columnLabels?: MarimekkoColumnLabels;
  /** Value-axis range when not normalized. Auto-fit to the tallest column
   *  (zero anchored) when omitted. */
  valueDomain?: [number, number];
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Render a legend below the chart. Default `true`. */
  showLegend?: boolean;
  /** Fires on every value-axis zoom/pan (`zoomable`, not normalized); `null`
   *  = full range. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
  /** Click/Enter on a segment, the drill-down hook. */
  onPointActivate?: (datum: MarimekkoDatum) => void;
  renderTooltip?: (datum: MarimekkoDatum) => ReactNode;
}

interface HoverState {
  datum: MarimekkoDatum;
  rect: DOMRect;
  cx: number;
  cy: number;
}

/** Below this px the row labels of a horizontal chart are dropped (except
 *  the endpoints): a label taller than its row collides with its neighbours. */
const MIN_ROW_LABEL_PX = 13;

function datumKey(category: string, series: string): string {
  return `${category} ${series}`;
}

function defaultTooltip(d: MarimekkoDatum, fmt: (v: number) => string): ReactNode {
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.category}</div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {d.series}: {fmt(d.value)}
      </div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {formatShare(d.share)} of column, {formatShare(d.total)} of total
      </div>
    </>
  );
}

/**
 * A Marimekko (mosaic) chart: 100% stacked columns whose widths carry a second
 * measure, so two part-to-whole readings share one panel (market share by
 * segment within regions sized by revenue). Every column is a stack of one
 * segment per series; the column's width is its share of the width measure,
 * its height the shares of its own total. Series fill with a neutral ramp or
 * the house halftone, never a rainbow; segment labels print only where they
 * fit. Mixes in the shared chart scaffolding (frame, fullscreen, controls,
 * annotations; the value axis zooms when the stacks are not normalized) and
 * click-to-freeze selection.
 */
export const Marimekko = forwardRef<HTMLDivElement, MarimekkoProps>(function Marimekko(
  {
    categories,
    series,
    widthBy,
    normalize,
    orientation = "vertical",
    gap = 1,
    fill = "ramp",
    showValues = true,
    valueFormat,
    columnLabels = "name",
    valueDomain,
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
  const vertical = orientation !== "horizontal";
  const normalized = normalize !== false;
  const isTufte = scaffolding !== "full";
  const uid = useId();
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));
  const { selection, setSelection } = useChartSelection<MarimekkoDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  const fmtCompact = valueFormat ?? formatCompact;
  const fmtFull = valueFormat ?? ((v: number) => formatNumber(v));

  /* --- Data --- */
  const nCats = categories.length;
  const nSeries = series.length;
  const totals = useMemo(
    () =>
      columnTotals(
        series.map((s) => s.values),
        nCats,
      ),
    [series, nCats],
  );
  const measures = useMemo(() => widthMeasures(totals, widthBy), [totals, widthBy]);
  const grand = useMemo(() => totals.reduce((a, b) => a + b, 0), [totals]);
  const measureTotal = useMemo(() => measures.reduce((a, b) => a + b, 0), [measures]);
  const stacks: Segment[][] = useMemo(
    () =>
      categories.map((_, ci) =>
        stackColumn(
          series.map((s) => s.values[ci] ?? 0),
          normalized,
        ),
      ),
    [categories, series, normalized],
  );

  const extent: [number, number] = useMemo(() => {
    if (normalized) return [0, 1];
    if (valueDomain) return valueDomain;
    return niceDomain([0, ...totals]);
  }, [normalized, valueDomain, totals]);

  /* --- Shared scaffolding: fullscreen, annotations, and the value-axis zoom
     (only meaningful when the stacks are in value units). --- */
  const zoomOn = !!zoomable && !normalized;
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable: zoomOn,
    annotations,
    onAnnotationsChange,
    value: {
      extent,
      onDomainChange: onValueDomainChange,
      minSpan: Math.max((extent[1] - extent[0]) / 100, Number.EPSILON),
      zoomOutLimit,
      formatValue: normalized ? formatShare : fmtCompact,
      axis: vertical ? "y" : "x",
    },
  });
  const viewDomain = zoomOn ? scaffold.viewport.domain : extent;

  /* --- Geometry --- */
  const axisLen = vertical ? plotSize.width : plotSize.height;
  const bands: Band[] = useMemo(
    () => layoutBands(measures, axisLen, gap),
    [measures, axisLen, gap],
  );
  const valueScale = useMemo(
    () => linearScale(viewDomain, vertical ? [plotSize.height, 0] : [0, plotSize.width]),
    [viewDomain, vertical, plotSize.height, plotSize.width],
  );

  // Annotation projectors and their inverses. Vertical: x is a fractional
  // column index (piecewise over the bands), y the value. Horizontal: the
  // roles swap, x is the value and y the fractional row index.
  const xToPx = (x: AnnotationX) =>
    vertical ? indexToPx(Number(x), bands, plotSize.width) : valueScale(Number(x));
  const yToPx = (y: number) => (vertical ? valueScale(y) : indexToPx(y, bands, plotSize.height));
  scaffold.invertRef.current = {
    xFromPx: (px) => {
      if (vertical) return pxToIndex(px, bands);
      const [v0, v1] = viewDomain;
      return plotSize.width > 0 ? v0 + (px / plotSize.width) * (v1 - v0) : v0;
    },
    yFromPx: (px) => {
      if (!vertical) return pxToIndex(px, bands);
      const [v0, v1] = viewDomain;
      return plotSize.height > 0 ? v1 - (px / plotSize.height) * (v1 - v0) : v0;
    },
  };

  /* --- Ticks --- */
  const valueTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    const [v0, v1] = viewDomain;
    if (v1 <= v0) return [];
    if (normalized) {
      return niceTicks(v0 * 100, v1 * 100, 5)
        .filter((t) => t.value >= v0 * 100 - 1e-9 && t.value <= v1 * 100 + 1e-9)
        .map((t) => ({
          label: `${t.label}%`,
          position: (t.value / 100 - v0) / (v1 - v0),
          major: t.major,
        }));
    }
    return niceTicks(v0, v1, 5)
      .filter((t) => t.value >= v0 && t.value <= v1)
      .map((t) => ({ label: t.label, position: (t.value - v0) / (v1 - v0), major: t.major }));
  }, [viewDomain, normalized, scaffolding]);

  // The column's share of the width axis, kept whole beside an ellipsized name.
  const shareSuffixes = useMemo(
    () =>
      columnLabels === "name+share"
        ? categories.map(
            (_, i) => ` ${formatShare(measureTotal > 0 ? (measures[i] ?? 0) / measureTotal : 0)}`,
          )
        : undefined,
    [categories, columnLabels, measures, measureTotal],
  );
  const categoryTexts = useMemo(
    () => categories.map((c, i) => c + (shareSuffixes?.[i] ?? "")),
    [categories, shareSuffixes],
  );

  const categoryTicks: AxisTick[] = useMemo(() => {
    if (columnLabels === "none" || axisLen <= 0) return [];
    if (vertical) {
      return fitBandLabels(categories, bands, axisLen, measure, ellipsize, {
        suffixes: shareSuffixes,
      }).map((l) => ({
        label: l.label,
        title: l.title,
        position: l.position,
        major: false,
      }));
    }
    // Rows: the label's height is the constraint, its width a cap. The y axis
    // counts its fraction from the bottom.
    const cap = Math.max(48, Math.min(240, plotSize.width * 0.4));
    const out: AxisTick[] = [];
    categoryTexts.forEach((text, i) => {
      const band = bands[i];
      if (!band || band.size <= 0) return;
      const endpoint = i === 0 || i === categoryTexts.length - 1;
      if (band.size < MIN_ROW_LABEL_PX && !endpoint) return;
      const label = ellipsize(text, cap, measure);
      if (!label) return;
      out.push({
        label,
        title: label === text ? undefined : text,
        position: 1 - (band.start + band.size / 2) / axisLen,
        major: false,
      });
    });
    return out;
  }, [
    columnLabels,
    axisLen,
    vertical,
    categories,
    categoryTexts,
    shareSuffixes,
    bands,
    measure,
    plotSize.width,
  ]);

  const yTicks = vertical ? valueTicks : categoryTicks;
  const xTicks = vertical ? categoryTicks : valueTicks;
  const yAxisWidth = useMemo(
    () =>
      maxLabelWidth(
        yTicks.map((t) => t.label),
        measure,
      ),
    [yTicks, measure],
  );

  /* --- Fills --- */
  const strengthOf = (si: number) =>
    fill === "dither" ? ditherDots(si, nSeries) / 16 : rampStrength(si, nSeries);
  const swatchOf = (s: MarimekkoSeries, si: number) =>
    s.color ??
    `color-mix(in srgb, var(--sf-color-fg) ${Math.round(strengthOf(si) * 100)}%, var(--sf-color-bg))`;
  const fillOf = (s: MarimekkoSeries, si: number) =>
    s.color ?? (fill === "dither" ? `url(#${uid}-d${si})` : swatchOf(s, si));
  // Ink on a light step, page on a dark one; on the halftone the label keeps
  // the ink and wears a page-coloured halo, since a dot field has no single
  // shade to contrast against.
  const labelFillOf = (s: MarimekkoSeries, si: number) => {
    if (s.color) return "var(--sf-color-primary-fg)";
    if (fill === "dither") return "var(--sf-color-fg)";
    return strengthOf(si) > 0.5 ? "var(--sf-color-bg)" : "var(--sf-color-fg)";
  };
  const labelHalo = (s: MarimekkoSeries) => fill === "dither" && !s.color;

  /* --- Labels --- */
  const labelMode: "none" | "percent" | "value" | "both" =
    showValues === false
      ? "none"
      : showValues === true
        ? normalized
          ? "percent"
          : "value"
        : showValues;

  /* --- Interaction --- */
  const datumAt = (ci: number, si: number): MarimekkoDatum | null => {
    const c = categories[ci];
    const s = series[si];
    const seg = stacks[ci]?.[si];
    if (c === undefined || !s || !seg) return null;
    return {
      category: c,
      series: s.name,
      value: seg.value,
      share: seg.share,
      total: grand > 0 ? seg.value / grand : 0,
      width: measureTotal > 0 ? (measures[ci] ?? 0) / measureTotal : 0,
    };
  };

  const handleEnter = (datum: MarimekkoDatum, cx_: number, cy_: number) => {
    const plotEl = plotRef.current;
    if (!plotEl) return;
    setHover({ datum, rect: anchorRectFromPoint(plotEl, cx_, cy_), cx: cx_, cy: cy_ });
  };
  const handleLeave = () => setHover(null);

  const activatable = !!onPointActivate || selectable;
  const handleActivate = (datum: MarimekkoDatum) => {
    onPointActivate?.(datum);
    if (!selectable) return;
    const same =
      selection != null &&
      datumKey(selection.category, selection.series) === datumKey(datum.category, datum.series);
    setSelection(same ? null : datum);
  };

  // The segment's rect in plot px, from its column band and stack position.
  const segmentRect = (ci: number, si: number) => {
    const band = bands[ci];
    const seg = stacks[ci]?.[si];
    if (!band || !seg) return null;
    const p0 = valueScale(seg.start);
    const p1 = valueScale(seg.end);
    const lo = Math.round(Math.min(p0, p1));
    const hi = Math.round(Math.max(p0, p1));
    if (vertical) return { x: band.start, y: lo, width: band.size, height: hi - lo };
    return { x: lo, y: band.start, width: hi - lo, height: band.size };
  };

  // The pinned popover's anchor, re-derived from the selected datum through the
  // live bands and value scale every render, so it tracks zoom and resize.
  const selectionPoint = (() => {
    if (!selectable || !selection || plotSize.width <= 0 || plotSize.height <= 0) return null;
    const ci = categories.indexOf(selection.category);
    const si = series.findIndex((s) => s.name === selection.series);
    if (ci < 0 || si < 0) return null;
    const r = segmentRect(ci, si);
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  })();
  const selectedKey = selection ? datumKey(selection.category, selection.series) : null;

  const wrapperStyle: CSSProperties = {
    ...(yAxisWidth > 0 ? { "--sf-axis-label-width": `${yAxisWidth}px` } : {}),
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  const legendVisible = showLegend ?? series.length > 0;
  const renderTip = renderTooltip ?? ((d: MarimekkoDatum) => defaultTooltip(d, fmtFull));

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
      data-orientation={orientation}
      data-hovered={hover != null ? "true" : undefined}
    >
      {yLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
      <Axis
        orientation="y"
        ticks={yTicks}
        noLine={vertical && isTufte}
        className={cx(styles.yAxis, vertical && styles.valueAxis)}
      />
      <div ref={plotAreaRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            {...scaffold.editor.surfaceProps}
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={[yLabel, xLabel].filter(Boolean).join(" by ") || "Marimekko chart"}
            onMouseLeave={handleLeave}
          >
            {fill === "dither" ? (
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

            {/* Value-axis gridlines: horizontal in a column chart, vertical in
                a row chart. CSS fades them by posture. */}
            {scaffolding !== "minimal"
              ? valueTicks.map((tick) =>
                  vertical ? (
                    <line
                      key={`grid-${tick.label}-${tick.position}`}
                      x1={0}
                      x2={plotSize.width}
                      y1={snapHairline(plotSize.height * (1 - tick.position))}
                      y2={snapHairline(plotSize.height * (1 - tick.position))}
                      className={cx(styles.gridline, tick.major && styles.gridlineMajor)}
                    />
                  ) : (
                    <line
                      key={`grid-${tick.label}-${tick.position}`}
                      x1={snapHairline(plotSize.width * tick.position)}
                      x2={snapHairline(plotSize.width * tick.position)}
                      y1={0}
                      y2={plotSize.height}
                      className={cx(styles.gridline, tick.major && styles.gridlineMajor)}
                    />
                  ),
                )
              : null}

            {categories.map((c, ci) =>
              series.map((s, si) => {
                const r = segmentRect(ci, si);
                const datum = datumAt(ci, si);
                if (!r || !datum || r.width <= 0 || r.height <= 0) return null;
                const cx_ = r.x + r.width / 2;
                const cy_ = r.y + r.height / 2;
                const selected = selectedKey != null && datumKey(c, s.name) === selectedKey;
                let text: string | null = null;
                if (labelMode !== "none") {
                  const pct = formatShare(datum.share);
                  const val = fmtCompact(datum.value);
                  const candidates =
                    labelMode === "percent"
                      ? [pct]
                      : labelMode === "value"
                        ? [val]
                        : [`${pct} ${val}`, pct];
                  for (const t of candidates) {
                    if (labelFits(measure(t), r.width, r.height)) {
                      text = t;
                      break;
                    }
                  }
                }
                return (
                  <g key={`seg-${c}-${s.name}`}>
                    {/* biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback */}
                    <rect
                      x={r.x}
                      y={r.y}
                      width={r.width}
                      height={r.height}
                      className={styles.segment}
                      style={{ fill: fillOf(s, si) }}
                      data-chart-mark=""
                      role="button"
                      tabIndex={0}
                      aria-label={`${c} ${s.name}: ${fmtFull(datum.value)}, ${formatShare(datum.share)}`}
                      onPointerEnter={() => handleEnter(datum, cx_, cy_)}
                      onPointerLeave={handleLeave}
                      onClick={activatable ? () => handleActivate(datum) : undefined}
                      onKeyDown={
                        activatable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleActivate(datum);
                              }
                            }
                          : undefined
                      }
                      data-activatable={activatable ? "" : undefined}
                      data-selected={selected || undefined}
                      onFocus={() => handleEnter(datum, cx_, cy_)}
                      onBlur={handleLeave}
                    >
                      <title>
                        {c}, {s.name}: {fmtFull(datum.value)} ({formatShare(datum.share)})
                      </title>
                    </rect>
                    {text ? (
                      <text
                        x={cx_}
                        y={cy_}
                        className={cx(styles.segmentLabel, labelHalo(s) && styles.segmentLabelHalo)}
                        style={{ fill: labelFillOf(s, si) }}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {text}
                      </text>
                    ) : null}
                  </g>
                );
              }),
            )}

            {scaffold.editingEnabled || (annotations && annotations.length > 0) ? (
              <AnnotationsLayer
                annotations={
                  scaffold.editingEnabled ? scaffold.editor.displayAnnotations : (annotations ?? [])
                }
                xPx={xToPx}
                yPx={yToPx}
                width={plotSize.width}
                height={plotSize.height}
                formatXDelta={(a, b) =>
                  vertical
                    ? `${Math.abs(Number(b) - Number(a)).toFixed(1)} col`
                    : fmtCompact(Math.abs(Number(b) - Number(a)))
                }
                formatY={(y) =>
                  vertical ? (normalized ? formatShare(y) : fmtCompact(y)) : `${y.toFixed(1)} row`
                }
                editing={scaffold.editor.layerEditing}
              />
            ) : null}

            {scaffold.viewport.marquee
              ? (() => {
                  const [f0, f1] = scaffold.viewport.marquee;
                  const lo = Math.min(f0, f1);
                  const hi = Math.max(f0, f1);
                  return vertical ? (
                    <rect
                      x={0}
                      y={(1 - hi) * plotSize.height}
                      width={plotSize.width}
                      height={(hi - lo) * plotSize.height}
                      className={scaffoldStyles.marquee}
                    />
                  ) : (
                    <rect
                      x={lo * plotSize.width}
                      y={0}
                      width={(hi - lo) * plotSize.width}
                      height={plotSize.height}
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
          yDataToPx={yToPx}
        />
      </div>
      <Axis
        orientation="x"
        ticks={xTicks}
        noLine={!vertical && isTufte}
        className={cx(styles.xAxis, !vertical && styles.valueAxis)}
      />
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
              {s.name}
            </span>
          ))}
        </div>
      ) : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? renderTip(hover.datum) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection ? (renderSelection ?? renderTip)(selection) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
