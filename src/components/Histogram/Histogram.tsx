import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, memo, useCallback, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  adaptiveTicks,
  anchorRectFromPoint,
  ChartChrome,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  Crosshair,
  FullscreenToggle,
  formatNumber as formatCompact,
  getTextMeasurer,
  invertLinear,
  type LabelBox,
  linearScale,
  maxLabelWidth,
  niceDomain,
  niceTicks,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  snapEdges,
  snapHairline,
  Tooltip,
  thinLabels,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { formatNumber as formatSwiss } from "../../lib/format";
import {
  autoBinCount,
  binValues,
  cumulative as cumulativeTotals,
  densityScale,
  extent,
  gaussianKde,
  type HistogramBin,
  type HistogramNormalize,
  linspace,
  niceThresholds,
  normalizeBin,
  normalizeThresholds,
  silvermanBandwidth,
} from "./Histogram.math";
import styles from "./Histogram.module.css";

export type { ChartAnnotation, ChartScaffolding } from "../../lib/chart";
export type { HistogramBin, HistogramNormalize } from "./Histogram.math";

export interface HistogramSeries {
  name: string;
  /** The sample. Non-finite entries are ignored. */
  data: number[];
  /** CSS colour (e.g. `"var(--sf-color-primary)"`). Default `--sf-color-primary`.
   *  Overlaid series should supply explicit colours. */
  color?: string;
}

/** The datum a Histogram emits on hover, activate and selection: one bin of
 *  one series, with its height in the chart's unit. */
export interface HistogramBinDatum {
  series: string;
  /** Bin range: `[x0, x1)`, closed on the last bin. */
  x0: number;
  x1: number;
  /** Raw count of values in the bin. */
  count: number;
  /** Bar height in the unit of `normalize` (count, percent, or density). */
  value: number;
  /** Running total at `x1` in the same unit (the ECDF value). */
  cumulative: number;
}

export interface HistogramProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps,
    ChartSelectionProps<HistogramBinDatum> {
  /** One sample. Shorthand for a single unnamed series. */
  data?: number[];
  /** Several samples overlaid on the same bins (translucent fills). */
  series?: HistogramSeries[];
  /** A bin count, or explicit ascending thresholds (k + 1 edges make k bins).
   *  Default: an automatic count (Freedman-Diaconis, falling back to Sturges)
   *  snapped to the nice-number ladder the axis ticks use. */
  bins?: number | number[];
  /** Fixes the binned range. Values outside are dropped. With `zoomable`, this
   *  is the full extent; the visible window is what zooms. */
  domain?: [number, number];
  /** The bar unit: raw counts, the share of the sample in percent, or a
   *  probability density (bar areas sum to 1). Default `"count"`. */
  normalize?: HistogramNormalize;
  /** Draw the running total as a step line (the ECDF) instead of bars. */
  cumulative?: boolean;
  /** Overlay a Gaussian kernel density curve, scaled onto the bar unit.
   *  `true` picks the bandwidth by Silverman's rule of thumb. */
  density?: boolean | { bandwidth?: number };
  /** Print each bin's value above its bar (where the label fits the bin). */
  showValues?: boolean;
  /** Formats the x values (bin edges, tick labels, the tooltip range). Default:
   *  the compact axis formatter. */
  valueFormat?: (value: number) => string;
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Render a legend below the x-axis. Default: true when >1 series. */
  showLegend?: boolean;
  /** Fires as the visible x-window changes (`zoomable`); `null` = reset to the
   *  full extent. */
  onXDomainChange?: (domain: [number, number] | null) => void;
  /** Click/Enter on a bin, the drill-down hook (the consumer swaps the sample
   *  for the bin's members, for example). */
  onPointActivate?: (datum: HistogramBinDatum) => void;
  /** Tooltip body for a hovered bin. Default: the range, the count and the
   *  share. */
  renderTooltip?: (datum: HistogramBinDatum) => ReactNode;
}

interface BinnedSeries {
  name: string;
  color: string;
  bins: HistogramBin[];
  /** Values that landed in a bin (the normalization base). */
  total: number;
  /** Bar heights in the chart unit, parallel to `bins`. */
  values: number[];
  /** Running totals at each bin's right edge, parallel to `bins`. */
  cumulative: number[];
}

interface BinHit {
  datum: HistogramBinDatum;
  /** SVG coordinates of the mark: the bar's top centre, or the step's corner. */
  cx: number;
  cy: number;
}

interface HoverState extends BinHit {
  rect: DOMRect;
}

/** Stable identity of a bin across renders (the selection is a spread copy). */
function binKey(series: string, x0: number, x1: number): string {
  return `${series} ${x0} ${x1}`;
}

const UNIT_LABEL: Record<HistogramNormalize, string> = {
  count: "count",
  percent: "share",
  density: "density",
};

function formatUnit(value: number, mode: HistogramNormalize): string {
  if (mode === "count") return formatSwiss(value);
  if (mode === "percent") return `${formatSwiss(value, { maximumFractionDigits: 1 })}%`;
  return formatSwiss(value, { maximumFractionDigits: 4 });
}

/** One series' bins as a memoized layer with delegated pointer / focus handling
 *  (rects carry `data-idx`), so a hover re-render bails out at one fiber. */
const HistogramBinsLayer = memo(function HistogramBinsLayer({
  layer,
  mode,
  xScale,
  yScale,
  baselineY,
  cumulativeMode,
  plotHeight,
  onHover,
  onLeave,
  onActivate,
  selectedKey,
  activatable,
  visible,
}: {
  layer: BinnedSeries;
  mode: HistogramNormalize;
  xScale: (x: number) => number;
  yScale: (y: number) => number;
  baselineY: number;
  cumulativeMode: boolean;
  plotHeight: number;
  onHover: (hit: BinHit) => void;
  onLeave: () => void;
  onActivate?: (hit: BinHit) => void;
  selectedKey: string | null;
  activatable: boolean;
  /** The visible x-window, so off-screen bins are not rendered. */
  visible: [number, number];
}) {
  const hitFor = (i: number): BinHit | null => {
    const bin = layer.bins[i];
    const value = layer.values[i];
    const cum = layer.cumulative[i];
    if (!bin || value == null || cum == null) return null;
    const x0 = xScale(bin.x0);
    const x1 = xScale(bin.x1);
    return {
      datum: {
        series: layer.name,
        x0: bin.x0,
        x1: bin.x1,
        count: bin.count,
        value,
        cumulative: cum,
      },
      cx: cumulativeMode ? x1 : (x0 + x1) / 2,
      cy: yScale(cumulativeMode ? cum : value),
    };
  };
  const resolve = (target: EventTarget | null): BinHit | null => {
    const el = target instanceof Element ? target.closest("[data-idx]") : null;
    return el ? hitFor(Number(el.getAttribute("data-idx"))) : null;
  };
  const handleEnter = (e: { target: EventTarget | null }) => {
    const hit = resolve(e.target);
    if (hit) onHover(hit);
  };
  const handleLeave = (e: { target: EventTarget | null }) => {
    if (e.target instanceof Element && e.target.closest("[data-idx]")) onLeave();
  };
  const handleClick = onActivate
    ? (e: { target: EventTarget | null }) => {
        const hit = resolve(e.target);
        if (hit) onActivate(hit);
      }
    : undefined;
  const handleKeyDown = onActivate
    ? (e: { target: EventTarget | null; key: string; preventDefault: () => void }) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const hit = resolve(e.target);
        if (hit) {
          e.preventDefault();
          onActivate(hit);
        }
      }
    : undefined;
  const [v0, v1] = visible;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pure event delegation; the interactive surface is each bin's rect (role="button", tabIndex) below.
    <g
      onPointerOver={handleEnter}
      onPointerOut={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {layer.bins.map((bin, i) => {
        if (bin.x1 < v0 || bin.x0 > v1) return null;
        const value = layer.values[i] ?? 0;
        const edges = snapEdges(xScale(bin.x0), xScale(bin.x1));
        const width = Math.max(1, edges.end - edges.start);
        const selected = selectedKey != null && binKey(layer.name, bin.x0, bin.x1) === selectedKey;
        const label = `${layer.name}: ${formatCompact(bin.x0)} to ${formatCompact(bin.x1)}, ${formatUnit(value, mode)}`;
        if (cumulativeMode) {
          return (
            // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
            <rect
              key={`hit-${bin.x0}`}
              data-idx={i}
              data-chart-mark=""
              x={edges.start}
              y={0}
              width={width}
              height={plotHeight}
              className={styles.hit}
              role="button"
              tabIndex={0}
              aria-label={label}
              data-activatable={activatable ? "" : undefined}
              data-selected={selected || undefined}
            >
              <title>{label}</title>
            </rect>
          );
        }
        const yVal = yScale(value);
        const top = Math.min(yVal, baselineY);
        const h = Math.abs(yVal - baselineY);
        return (
          // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
          <rect
            key={`bin-${bin.x0}`}
            data-idx={i}
            data-chart-mark=""
            x={edges.start}
            y={top}
            width={width}
            height={h}
            className={styles.bar}
            style={{ fill: layer.color }}
            role="button"
            tabIndex={0}
            aria-label={label}
            data-activatable={activatable ? "" : undefined}
            data-selected={selected || undefined}
          >
            <title>{label}</title>
          </rect>
        );
      })}
    </g>
  );
});

/** The ECDF as a step path: flat across each bin at its running total, a riser
 *  at the bin's right edge. Starts at the baseline on the first edge. */
function stepPath(
  layer: BinnedSeries,
  xScale: (x: number) => number,
  yScale: (y: number) => number,
  baselineY: number,
): string {
  const first = layer.bins[0];
  if (!first) return "";
  const parts: string[] = [`M ${xScale(first.x0)} ${baselineY}`];
  let prevY = baselineY;
  for (let i = 0; i < layer.bins.length; i++) {
    const bin = layer.bins[i];
    const cum = layer.cumulative[i];
    if (!bin || cum == null) continue;
    const y = yScale(cum);
    // Rise at the left edge to the running total, then run to the right edge.
    parts.push(
      `L ${xScale(bin.x0)} ${prevY}`,
      `L ${xScale(bin.x0)} ${y}`,
      `L ${xScale(bin.x1)} ${y}`,
    );
    prevY = y;
  }
  return parts.join(" ");
}

export const Histogram = forwardRef<HTMLDivElement, HistogramProps>(function Histogram(
  {
    data,
    series,
    bins,
    domain,
    normalize = "count",
    cumulative = false,
    density = false,
    showValues = false,
    valueFormat = formatCompact,
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
    onXDomainChange,
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
  const isTufte = scaffolding !== "full";
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));
  const { selection, setSelection } = useChartSelection<HistogramBinDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const resolvedSeries: HistogramSeries[] = useMemo(() => {
    if (series && series.length > 0) return series;
    return data ? [{ name: "Values", data }] : [];
  }, [series, data]);

  // --- Bins: one shared threshold ladder so overlaid series align ---
  const thresholds = useMemo(() => {
    if (Array.isArray(bins)) {
      const explicit = normalizeThresholds(bins);
      if (explicit.length >= 2) return explicit;
    }
    const all: number[] = [];
    for (const s of resolvedSeries) for (const v of s.data) if (Number.isFinite(v)) all.push(v);
    const count = typeof bins === "number" ? Math.max(1, Math.floor(bins)) : autoBinCount(all);
    if (domain) return linspace(domain[0], domain[1], count);
    const ext = extent(all) ?? [0, 1];
    return niceThresholds(ext[0], ext[1], count);
  }, [bins, domain, resolvedSeries]);

  const xExtent: [number, number] = useMemo(
    () => [thresholds[0] ?? 0, thresholds[thresholds.length - 1] ?? 1],
    [thresholds],
  );

  const layers: BinnedSeries[] = useMemo(
    () =>
      resolvedSeries.map((s) => {
        const binned = binValues(s.data, thresholds);
        let total = 0;
        for (const b of binned) total += b.count;
        return {
          name: s.name,
          color: s.color ?? "var(--sf-color-primary)",
          bins: binned,
          total,
          values: binned.map((b) => normalizeBin(b, normalize, total)),
          cumulative: cumulativeTotals(binned, normalize, total),
        };
      }),
    [resolvedSeries, thresholds, normalize],
  );

  // --- Density curves, on a fixed grid across the full extent ---
  const densityCurves = useMemo(() => {
    if (!density) return null;
    const bandwidth = typeof density === "object" ? density.bandwidth : undefined;
    const grid = linspace(xExtent[0], xExtent[1], 240);
    return layers.map((layer, i) => {
      const sample = resolvedSeries[i]?.data ?? [];
      const h = bandwidth ?? silvermanBandwidth(sample);
      const scale = densityScale(layer.bins, normalize, layer.total);
      return {
        color: layer.color,
        points: gaussianKde(sample, grid, h).map((d, k) => ({ x: grid[k] ?? 0, y: d * scale })),
      };
    });
  }, [density, layers, resolvedSeries, xExtent, normalize]);

  // --- y domain: zero-anchored, fixed across zoom (a distribution's scale
  //     should not breathe as the window pans) ---
  const yDomain: [number, number] = useMemo(() => {
    let max = 0;
    if (cumulative) {
      for (const l of layers) {
        const last = l.cumulative[l.cumulative.length - 1];
        if (last != null && last > max) max = last;
      }
    } else {
      for (const l of layers) for (const v of l.values) if (v > max) max = v;
      if (densityCurves) {
        for (const c of densityCurves) for (const p of c.points) if (p.y > max) max = p.y;
      }
    }
    if (!(max > 0)) return [0, 1];
    const nice = niceDomain([0, max], 5);
    return [0, nice[1]];
  }, [layers, cumulative, densityCurves]);

  // --- Shared scaffolding: the continuous x axis is what windows ---
  const formatDomainValue = useCallback(
    (v: number) => valueFormat(Number(v.toPrecision(4))),
    [valueFormat],
  );
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable,
    annotations,
    onAnnotationsChange,
    value: {
      extent: xExtent,
      onDomainChange: onXDomainChange,
      // Zoom-in ceiling: about two bins across the plot.
      minSpan: Math.max(
        ((xExtent[1] - xExtent[0]) * 2) / Math.max(2, thresholds.length - 1),
        Number.EPSILON,
      ),
      zoomOutLimit,
      formatValue: formatDomainValue,
      axis: "x",
    },
  });
  const viewX: [number, number] = zoomable ? scaffold.viewport.domain : xExtent;

  const xScale = useMemo(() => linearScale(viewX, [0, plotSize.width]), [viewX, plotSize.width]);
  const yScale = useMemo(
    () => linearScale(yDomain, [plotSize.height, 0]),
    [yDomain, plotSize.height],
  );
  const baselineY = plotSize.height;

  const xInvert = invertLinear(viewX, [0, plotSize.width]);
  const yInvert = invertLinear(yDomain, [plotSize.height, 0]);
  scaffold.invertRef.current = { xFromPx: xInvert, yFromPx: yInvert };
  const xToPx = useCallback((x: AnnotationX) => xScale(Number(x)), [xScale]);

  // --- Ticks ---
  // Tufte modes label the bin edges themselves (the range-frame reading);
  // full mode uses adaptive nice ticks. Both pass through measured thinning
  // with survivor bias so a live pan never strobes the label set.
  const prevXKeys = useRef<ReadonlySet<string>>(new Set());
  const xTicks = useMemo(() => {
    const [x0, x1] = viewX;
    if (!(x1 > x0) || plotSize.width <= 0) return { ticks: [] as AxisTick[], offsetLabel: "" };
    let raw: AxisTick[];
    let offsetLabel = "";
    if (isTufte) {
      raw = thresholds
        .filter((t) => t >= x0 && t <= x1)
        .map((t) => ({ label: valueFormat(t), position: (t - x0) / (x1 - x0), major: false }));
    } else {
      const adaptive = adaptiveTicks(x0, x1, plotSize.width);
      raw = adaptive.ticks.map((t) => ({
        label: t.label,
        position: (t.value - x0) / (x1 - x0),
        major: t.major,
      }));
      offsetLabel = adaptive.offsetLabel;
    }
    const boxes: LabelBox[] = raw.map((t, i) => ({
      center: t.position * plotSize.width,
      size: measure(t.label),
      priority: isTufte ? (i === 0 || i === raw.length - 1 ? 2 : 0) : t.major ? 1 : 0,
      key: t.label,
    }));
    const keep = thinLabels(boxes, { previousKeys: prevXKeys.current });
    const ticks = raw.filter((_, i) => keep[i]);
    prevXKeys.current = new Set(ticks.map((t) => t.label));
    return { ticks, offsetLabel };
  }, [viewX, plotSize.width, isTufte, thresholds, valueFormat, measure]);

  const yAxisTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    const [y0, y1] = yDomain;
    if (!(y1 > y0)) return [];
    return niceTicks(y0, y1, 5)
      .filter((t) => t.value >= y0 && t.value <= y1)
      .map((t) => ({
        label: normalize === "percent" ? `${t.label}%` : t.label,
        position: (t.value - y0) / (y1 - y0),
        major: t.major,
      }));
  }, [yDomain, scaffolding, normalize]);

  const yAxisWidth = useMemo(
    () =>
      maxLabelWidth(
        yAxisTicks.map((t) => t.label),
        measure,
      ),
    [yAxisTicks, measure],
  );

  // --- Hover / activate / selection ---
  const handleHover = useCallback(
    (hit: BinHit) => {
      const plotEl = plotRef.current;
      if (!plotEl) return;
      setHover({ ...hit, rect: anchorRectFromPoint(plotEl, hit.cx, hit.cy) });
    },
    [plotRef],
  );
  const handleLeave = useCallback(() => setHover(null), []);
  const handleActivate = useMemo(() => {
    if (!onPointActivate && !selectable) return undefined;
    return (hit: BinHit) => {
      onPointActivate?.(hit.datum);
      if (!selectable) return;
      const cur = selectionRef.current;
      const same =
        cur != null &&
        binKey(cur.series, cur.x0, cur.x1) === binKey(hit.datum.series, hit.datum.x0, hit.datum.x1);
      setSelection(same ? null : hit.datum);
    };
  }, [onPointActivate, selectable, setSelection]);
  const activatable = !!onPointActivate || selectable;

  const selectionPoint = useMemo(() => {
    if (!selectable || !selection || plotSize.width <= 0 || plotSize.height <= 0) return null;
    const x = cumulative ? xScale(selection.x1) : (xScale(selection.x0) + xScale(selection.x1)) / 2;
    return { x, y: yScale(cumulative ? selection.cumulative : selection.value) };
  }, [selectable, selection, cumulative, xScale, yScale, plotSize.width, plotSize.height]);
  const selectedKey = selection ? binKey(selection.series, selection.x0, selection.x1) : null;

  const tooltipBody = useCallback(
    (d: HistogramBinDatum): ReactNode => {
      if (renderTooltip) return renderTooltip(d);
      return (
        <>
          {resolvedSeries.length > 1 ? (
            <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.series}</div>
          ) : null}
          <div style={{ fontFamily: "var(--sf-font-mono)" }}>
            {valueFormat(d.x0)} to {valueFormat(d.x1)}
          </div>
          <div style={{ fontFamily: "var(--sf-font-mono)" }}>
            {normalize === "count"
              ? `${UNIT_LABEL.count}: ${formatSwiss(d.count)}`
              : `${UNIT_LABEL[normalize]}: ${formatUnit(d.value, normalize)} (${formatSwiss(d.count)})`}
          </div>
          {cumulative ? (
            <div style={{ fontFamily: "var(--sf-font-mono)" }}>
              cumulative: {formatUnit(d.cumulative, normalize)}
            </div>
          ) : null}
        </>
      );
    },
    [renderTooltip, resolvedSeries.length, valueFormat, normalize, cumulative],
  );

  const wrapperStyle: CSSProperties = {
    ...(yAxisWidth > 0 ? { "--sf-axis-label-width": `${yAxisWidth}px` } : {}),
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  const legendVisible = showLegend ?? resolvedSeries.length > 1;
  const overlaid = layers.length > 1;
  const gridlineTicks = yAxisTicks;

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
            aria-label={[yLabel, xLabel].filter(Boolean).join(" by ") || "Histogram"}
            data-overlaid={overlaid ? "" : undefined}
            onMouseLeave={handleLeave}
          >
            {scaffolding !== "minimal"
              ? gridlineTicks.map((tick) => {
                  const y = snapHairline(plotSize.height * (1 - tick.position));
                  return (
                    <line
                      key={`grid-${tick.label}`}
                      x1={0}
                      x2={plotSize.width}
                      y1={y}
                      y2={y}
                      className={cx(styles.gridline, tick.major && styles.gridlineMajor)}
                    />
                  );
                })
              : null}

            {layers.map((layer) => (
              <HistogramBinsLayer
                key={`bins-${layer.name}`}
                layer={layer}
                mode={normalize}
                xScale={xScale}
                yScale={yScale}
                baselineY={baselineY}
                cumulativeMode={cumulative}
                plotHeight={plotSize.height}
                onHover={handleHover}
                onLeave={handleLeave}
                onActivate={handleActivate}
                selectedKey={selectedKey}
                activatable={activatable}
                visible={viewX}
              />
            ))}

            {cumulative
              ? layers.map((layer) => (
                  <path
                    key={`step-${layer.name}`}
                    d={stepPath(layer, xScale, yScale, baselineY)}
                    className={styles.step}
                    style={{ stroke: layer.color }}
                    data-cumulative=""
                  />
                ))
              : null}

            {densityCurves
              ? densityCurves.map((curve, i) => (
                  <path
                    key={`density-${layers[i]?.name ?? i}`}
                    d={curve.points
                      .map((p, k) => `${k === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.y)}`)
                      .join(" ")}
                    className={styles.curve}
                    style={{ stroke: curve.color }}
                    data-density=""
                  />
                ))
              : null}

            {showValues && !cumulative
              ? layers.map((layer) =>
                  layer.bins.map((bin, i) => {
                    if (bin.x1 < viewX[0] || bin.x0 > viewX[1]) return null;
                    const value = layer.values[i] ?? 0;
                    const text = formatUnit(value, normalize);
                    const w = xScale(bin.x1) - xScale(bin.x0);
                    if (measure(text) > w - 4 || value <= 0) return null;
                    const yVal = yScale(value);
                    const flip = yVal < 14;
                    return (
                      <text
                        key={`label-${layer.name}-${bin.x0}`}
                        x={(xScale(bin.x0) + xScale(bin.x1)) / 2}
                        y={flip ? yVal + 14 : yVal - 4}
                        className={cx(styles.valueLabel, flip && styles.valueLabelInside)}
                        textAnchor="middle"
                      >
                        {text}
                      </text>
                    );
                  }),
                )
              : null}

            {selectable && selectionPoint && cumulative ? (
              <circle
                cx={selectionPoint.x}
                cy={selectionPoint.y}
                r={5}
                className={styles.selectedRing}
              />
            ) : null}

            {isTufte && hover ? (
              <Crosshair
                x={snapHairline(hover.cx)}
                y={snapHairline(hover.cy)}
                height={plotSize.height}
                axes="y"
                yLabel={formatUnit(
                  cumulative ? hover.datum.cumulative : hover.datum.value,
                  normalize,
                )}
              />
            ) : null}

            {scaffold.editingEnabled || (annotations && annotations.length > 0) ? (
              <AnnotationsLayer
                annotations={
                  scaffold.editingEnabled ? scaffold.editor.displayAnnotations : (annotations ?? [])
                }
                xPx={xToPx}
                yPx={yScale}
                width={plotSize.width}
                height={plotSize.height}
                formatXDelta={(a, b) => valueFormat(Math.abs(Number(b) - Number(a)))}
                formatY={(v) => formatUnit(v, normalize)}
                editing={scaffold.editor.layerEditing}
              />
            ) : null}

            {scaffold.viewport.marquee ? (
              <rect
                x={
                  Math.min(scaffold.viewport.marquee[0], scaffold.viewport.marquee[1]) *
                  plotSize.width
                }
                y={0}
                width={
                  Math.abs(scaffold.viewport.marquee[1] - scaffold.viewport.marquee[0]) *
                  plotSize.width
                }
                height={plotSize.height}
                className={scaffoldStyles.marquee}
              />
            ) : null}
          </svg>
        ) : null}
        <ChartChrome
          scaffold={scaffold}
          controls={!!controls}
          xDataToPx={xToPx}
          yDataToPx={yScale}
        />
        {zoomable && scaffold.viewport.isZoomed && !controls ? (
          <button type="button" className={styles.resetButton} onClick={scaffold.viewport.reset}>
            Reset
          </button>
        ) : null}
      </div>
      <Axis orientation="x" ticks={xTicks.ticks} noLine={isTufte} className={styles.xAxis} />
      {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}
      {legendVisible ? (
        <div className={styles.legend}>
          {layers.map((l) => (
            <span key={`leg-${l.name}`} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: l.color }}
                aria-hidden="true"
              />
              {l.name}
            </span>
          ))}
        </div>
      ) : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? tooltipBody(hover.datum) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection ? (renderSelection ?? tooltipBody)(selection) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
