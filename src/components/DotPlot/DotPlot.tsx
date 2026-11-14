import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  anchorRectFromPoint,
  ChartChrome,
  type ChartFormatProps,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  Crosshair,
  ellipsize,
  FullscreenToggle,
  fitBandTicks,
  formatNumber,
  getTextMeasurer,
  linearScale,
  maxLabelWidth,
  niceTicks,
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
import { formatNumber as formatExact } from "../../lib/format";
import { DEFAULT_UNIT_PX } from "../../lib/useCssPx";
import {
  type DotPlotSort,
  fitDomain,
  orderRows,
  rangeDirection,
  resolveRange,
  rowLayout,
} from "./DotPlot.math";
import styles from "./DotPlot.module.css";

export type { ChartScaffolding } from "../../lib/chart";
export type { DotPlotSort, RangeDirection } from "./DotPlot.math";

export interface DotSeries {
  name: string;
  /** Parallel to `categories`; `null` leaves the row without this dot. */
  values: (number | null)[];
  /** CSS colour. Defaults cycle primary / ink / muted; odd-numbered series
   *  draw as rings, so two series stay apart in ink alone. */
  color?: string;
}

/** The datum a DotPlot emits on hover, activate and selection: the dot's own
 *  category / series / value, plus every series value of the row and the
 *  row's marker, so a tooltip reads the whole row. */
export interface DotPlotDatum {
  category: string;
  series: string;
  value: number;
  /** Every series value of the row, by series name. */
  values: Record<string, number | null>;
  /** The row's `marker` value, or `null`. */
  marker: number | null;
}

export interface DotPlotProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartFormatProps,
    ChartScaffoldingProps,
    ChartSelectionProps<DotPlotDatum> {
  /** One row (horizontal) or column (vertical) per category. */
  categories: string[];
  /** One dot per series per category. */
  series: DotSeries[];
  /** Connect two dots per row with a bar (the dumbbell): `true` pairs the
   *  first two series (exactly two must exist), or name the pair. */
  range?: boolean | [string, string];
  /** Colour the range bar by its direction (`from` → `to`): rising in success,
   *  falling in danger. Default `"none"`, a neutral bar. */
  rangeTone?: "direction" | "none";
  /** A current-value tick per category (parallel to `categories`), e.g. the
   *  price inside a 52-week low / high range. */
  marker?: (number | null)[];
  /** The marker's name in the tooltip and legend. Default `"Current"`. */
  markerLabel?: string;
  /** Row order: as given, ascending / descending by the first series, or the
   *  name of the series to rank by (descending). Default `"none"`. */
  sort?: DotPlotSort;
  /** Categories down the side with values along x (default), or categories
   *  along the bottom with values up y. */
  orientation?: "horizontal" | "vertical";
  /** A hairline from the baseline to each dot, for a single series whose
   *  baseline carries meaning; the value extent then includes zero. */
  lollipop?: boolean;
  /** Print the values: beside each dot (one series), at the row's lowest and
   *  highest dot (several series), or at both ends of a range. Default: on in
   *  the Tufte postures (`minimal` / `hover`), off in `full`. */
  showValues?: boolean;
  /** Value-axis range. Auto-fit when omitted: the data's extent widened to
   *  round ticks, zero pulled in only for a `lollipop`. */
  valueDomain?: [number, number];
  /** Component height. Rows spread over the plot (pitch = plot height / row
   *  count) down to one `--sf-unit` each; with more rows than fit, a horizontal
   *  plot grows past this height instead of squeezing them. Default
   *  `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** A fixed row pitch in px (the compact reading): the plot is exactly
   *  `rows * rowHeight` tall and `height` is ignored. Horizontal only. */
  rowHeight?: number;
  /** Render a legend below the chart. Default: true when >1 series or a marker. */
  showLegend?: boolean;
  /** Fires on every value-axis zoom / pan (`zoomable`); `null` = full range. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
  /** Click / Enter on a dot, the drill-down hook. */
  onPointActivate?: (datum: DotPlotDatum) => void;
  renderTooltip?: (datum: DotPlotDatum) => ReactNode;
}

interface HoverState {
  /** Display row index (after sorting). */
  row: number;
  /** Hovered series index, or `null` when the row band itself is hovered. */
  si: number | null;
  rect: DOMRect;
  cx: number;
  cy: number;
}

/** Widest category column before labels ellipsize (a multiple of the 8px
 *  quantum the axis width snaps to). Override `--sf-axis-label-width` on a
 *  container to pin it. */
const LABEL_CAP_PX = 176;
const LABEL_GAP_PX = 4;
const DEFAULT_COLORS = ["var(--sf-color-primary)", "var(--sf-color-fg)", "var(--sf-color-muted)"];

function seriesColor(s: DotSeries, si: number): string {
  return s.color ?? (DEFAULT_COLORS[si % DEFAULT_COLORS.length] as string);
}

function isRing(si: number): boolean {
  return si % 2 === 1;
}

function pointKey(category: string, series: string): string {
  return `${category}\u0000${series}`;
}

function DefaultTooltip({
  d,
  markerLabel,
  seriesName,
}: {
  d: DotPlotDatum;
  markerLabel: string;
  seriesName: (name: string) => string;
}) {
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.category}</div>
      {Object.entries(d.values).map(([name, v]) => (
        <div key={name} style={{ fontFamily: "var(--sf-font-mono)" }}>
          {seriesName(name)}: {v == null ? "n/a" : formatExact(v)}
        </div>
      ))}
      {d.marker != null ? (
        <div style={{ fontFamily: "var(--sf-font-mono)" }}>
          {markerLabel}: {formatExact(d.marker)}
        </div>
      ) : null}
    </>
  );
}

/**
 * A dot plot: ranked comparison of many categories with almost no ink
 * (Cleveland's dot plot). Categories down the side, one dot per series along a
 * shared value axis; two series can join into a range bar (the dumbbell), a
 * marker tick shows a current value inside it, and a lollipop stem grows from
 * the baseline when that baseline means something. Every category keeps its
 * row: rows never drop under one unit, the chart grows instead.
 */
export const DotPlot = forwardRef<HTMLDivElement, DotPlotProps>(function DotPlot(
  {
    categories,
    series,
    range,
    rangeTone = "none",
    marker,
    markerLabel = "Current",
    sort,
    orientation = "horizontal",
    lollipop = false,
    showValues,
    valueFormat: valueFormatProp,
    tickFormat,
    categoryFormat,
    seriesFormat,
    valueDomain,
    xLabel,
    yLabel,
    height,
    rowHeight,
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
  const horizontal = orientation !== "vertical";
  const isTufte = scaffolding !== "full";
  const valuesOn = showValues ?? isTufte;
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));
  const format = useMemo(
    () =>
      resolveChartFormat(
        { valueFormat: valueFormatProp, tickFormat, categoryFormat, seriesFormat },
        formatNumber,
      ),
    [valueFormatProp, tickFormat, categoryFormat, seriesFormat],
  );
  const valueFormat = format.value;
  const seriesName = (name: string) =>
    format.series(
      name,
      series.findIndex((x) => x.name === name),
    );
  const { selection, setSelection } = useChartSelection<DotPlotDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  const n = categories.length;
  const order = useMemo(() => orderRows(n, series, sort), [n, series, sort]);

  const rangePair = useMemo(() => resolveRange(range, series), [range, series]);

  const resolvedDomain: [number, number] = useMemo(() => {
    if (valueDomain) return valueDomain;
    const all: (number | null)[] = [];
    for (const s of series) for (const v of s.values) all.push(v);
    if (marker) for (const v of marker) all.push(v);
    return fitDomain(all, lollipop);
  }, [series, marker, valueDomain, lollipop]);

  // Shared scaffolding. The continuous axis is the value axis: x when the
  // categories run down the side, y when they run along the bottom.
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable,
    annotations,
    onAnnotationsChange,
    value: {
      extent: resolvedDomain,
      onDomainChange: onValueDomainChange,
      minSpan: Math.max((resolvedDomain[1] - resolvedDomain[0]) / 100, Number.EPSILON),
      zoomOutLimit,
      formatValue: formatNumber,
      axis: horizontal ? "x" : "y",
    },
  });
  const viewDomain = zoomable ? scaffold.viewport.domain : resolvedDomain;

  // The row model: rows share the plot height down to one --sf-unit each; past
  // that the chart grows by the deficit (`extra`). The probe measures the unit
  // in px; the deficit is judged against the plot height without the growth
  // already applied, so the loop settles in one step.
  const probeRef = useRef<HTMLDivElement>(null);
  const [extra, setExtra] = useState(0);
  const extraRef = useRef(extra);
  extraRef.current = extra;
  // One --sf-unit in px, from the probe (the default density's until measured).
  const [unitPx, setUnitPx] = useState(DEFAULT_UNIT_PX);
  const fillRows = horizontal && rowHeight == null && !scaffold.expanded;
  // With the toolbar on, the rows start two units down so it sits in empty
  // space above the first row instead of over its dots.
  const insetUnits = controls && horizontal ? 2 : 0;
  // The toolbar's measured bottom edge (px from the plot's top): with the
  // annotation tools on it wraps to two rows, taller than the two units.
  const [toolbarPx, setToolbarPx] = useState(0);
  // Judged only when the measured plot height changes: that measurement
  // already includes the growth in force, so subtracting it gives the height
  // the rows would have on their own. Re-running on `extra` itself would read
  // a stale measurement and flip the growth off again.
  useLayoutEffect(() => {
    const unit = probeRef.current?.offsetHeight || DEFAULT_UNIT_PX;
    setUnitPx((u) => (u === unit ? u : unit));
    const toolbar = insetUnits
      ? plotRef.current?.querySelector<HTMLElement>('[role="toolbar"]')
      : null;
    const tb = toolbar ? toolbar.offsetTop + toolbar.offsetHeight : 0;
    setToolbarPx((t) => (t === tb ? t : tb));
    if (!fillRows) {
      if (extraRef.current !== 0) setExtra(0);
      return;
    }
    const inset = insetUnits ? Math.max(insetUnits * unit, tb + unit / 2) : 0;
    const base = plotSize.height - extraRef.current;
    const needed = base > 0 ? Math.max(0, Math.ceil(n * unit + inset - base)) : 0;
    if (needed !== extraRef.current) setExtra(needed);
  }, [fillRows, plotSize.height, plotSize.width, n, insetUnits, plotRef]);

  const bandLength = horizontal ? plotSize.height : plotSize.width;
  const valueLength = horizontal ? plotSize.width : plotSize.height;
  const valueScale = useMemo(
    () => linearScale(viewDomain, horizontal ? [0, valueLength] : [valueLength, 0]),
    [viewDomain, horizontal, valueLength],
  );
  const topInset = insetUnits ? Math.max(insetUnits * unitPx, toolbarPx + unitPx / 2) : 0;
  const rows = useMemo(
    () => rowLayout(n, Math.max(0, bandLength - topInset)),
    [n, bandLength, topInset],
  );
  // Row centres sit on the half-pixel so stems, marker ticks and range bars
  // (1px and 2px hairlines) stay crisp; the dots are anti-aliased marks.
  const centers = useMemo(
    () => rows.centers.map((c) => snapHairline(c + topInset)),
    [rows, topInset],
  );
  const dotR = rows.step > 0 ? Math.max(3, Math.min(5, rows.step * 0.16)) : 4;

  const point = (row: number, v: number): { x: number; y: number } => {
    const c = centers[row] ?? 0;
    return horizontal ? { x: valueScale(v), y: c } : { x: c, y: valueScale(v) };
  };

  // The baseline a lollipop stem grows from: zero when in view, else the
  // nearer edge of the visible domain.
  const baselinePx = useMemo(() => {
    const [d0, d1] = viewDomain;
    const base = d0 <= 0 && d1 >= 0 ? 0 : d0 > 0 ? d0 : d1;
    return valueScale(base);
  }, [viewDomain, valueScale]);

  // Data → px for annotations. The continuous axis is the value scale; the
  // other axis is a fractional row / column index in [0, n].
  const nBands = Math.max(1, n);
  const bandSpan = Math.max(0, bandLength - topInset);
  const bandToPx = (i: number) => topInset + (i / nBands) * bandSpan;
  const xToPx = (x: AnnotationX) => (horizontal ? valueScale(Number(x)) : bandToPx(Number(x)));
  const yToPx = (y: number) => (horizontal ? bandToPx(y) : valueScale(y));
  const [vd0, vd1] = viewDomain;
  const valueFromPx = (px: number) => {
    if (!(valueLength > 0)) return vd0;
    return horizontal
      ? vd0 + (px / valueLength) * (vd1 - vd0)
      : vd1 - (px / valueLength) * (vd1 - vd0);
  };
  const bandFromPx = (px: number) => (bandSpan > 0 ? ((px - topInset) / bandSpan) * nBands : 0);
  scaffold.invertRef.current = {
    xFromPx: horizontal ? valueFromPx : bandFromPx,
    yFromPx: horizontal ? bandFromPx : valueFromPx,
  };

  // Value-axis nice ticks (hidden in minimal; CSS fades them in hover mode).
  const valueTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    if (vd1 <= vd0) return [];
    return niceTicks(vd0, vd1, 5)
      .filter((t) => t.value >= vd0 && t.value <= vd1)
      .map((t) => ({
        label: format.tick(t.value, t.label, horizontal ? "x" : "y"),
        position: (t.value - vd0) / (vd1 - vd0),
        major: t.major,
      }));
  }, [vd0, vd1, scaffolding, format, horizontal]);

  // One formatter for every printed number and category name (issue #97).
  // DotPlot's own default is the compact chart formatter.
  const orderedLabels = useMemo(
    () => order.map((i) => format.category(categories[i] ?? "", i)),
    [order, categories, format],
  );

  // Category ticks. Down the side every row keeps its label, ellipsized to
  // the column cap with the full text in a title; along the bottom they go
  // through the band-fitting ladder (ellipsize, then thin, first + last kept).
  const categoryTicks: AxisTick[] = useMemo(() => {
    if (n === 0 || bandLength <= 0) return [];
    if (horizontal) {
      const maxPx = LABEL_CAP_PX - 8;
      return orderedLabels.map((label, i) => {
        const text = ellipsize(label, maxPx, measure);
        return {
          label: text,
          title: text !== label ? label : undefined,
          position: 1 - (centers[i] ?? 0) / bandLength,
          major: false,
        };
      });
    }
    const fractions = centers.map((c) => snapFraction(c / bandLength, bandLength));
    return fitBandTicks(orderedLabels, fractions, rows.step, bandLength, measure).map((t) => ({
      label: t.label,
      title: t.title,
      position: t.position,
      major: false,
    }));
  }, [n, bandLength, horizontal, orderedLabels, centers, rows.step, measure]);

  // The side axis column: category labels (horizontal) or value ticks
  // (vertical), measured and quantized so a resize cannot oscillate.
  const sideAxisWidth = useMemo(() => {
    if (horizontal) {
      return Math.min(
        maxLabelWidth(
          categoryTicks.map((t) => t.label),
          measure,
        ),
        LABEL_CAP_PX,
      );
    }
    return maxLabelWidth(
      valueTicks.map((t) => t.label),
      measure,
    );
  }, [horizontal, categoryTicks, valueTicks, measure]);

  const datumAt = (row: number, si: number | null): DotPlotDatum | null => {
    const ci = order[row];
    if (ci == null) return null;
    const category = categories[ci] ?? "";
    const values: Record<string, number | null> = {};
    for (const s of series) values[s.name] = s.values[ci] ?? null;
    let pick = si;
    if (pick == null) pick = series.findIndex((s) => s.values[ci] != null);
    const s = series[pick];
    const v = s ? (s.values[ci] ?? null) : null;
    if (!s || v == null) return null;
    return { category, series: s.name, value: v, values, marker: marker?.[ci] ?? null };
  };

  const handleEnter = (row: number, si: number | null) => {
    const plotEl = plotRef.current;
    if (!plotEl) return;
    const ci = order[row];
    if (ci == null) return;
    let anchorValue: number | null = null;
    if (si != null) anchorValue = series[si]?.values[ci] ?? null;
    else {
      // The row band: anchor on the row's outermost dot.
      for (const s of series) {
        const v = s.values[ci];
        if (v != null && (anchorValue == null || v > anchorValue)) anchorValue = v;
      }
    }
    if (anchorValue == null) return;
    const p = point(row, anchorValue);
    setHover({ row, si, rect: anchorRectFromPoint(plotEl, p.x, p.y), cx: p.x, cy: p.y });
  };
  const handleLeave = () => setHover(null);

  const activatable = !!onPointActivate || selectable;
  const handleActivate = (datum: DotPlotDatum) => {
    onPointActivate?.(datum);
    if (!selectable) return;
    const same =
      selection != null &&
      pointKey(selection.category, selection.series) === pointKey(datum.category, datum.series);
    setSelection(same ? null : datum);
  };

  // The pinned popover's anchor, re-derived from the datum through the live
  // scales each render so it tracks zoom / sort / resize.
  const selectionPoint = useMemo(() => {
    if (!selectable || !selection || plotSize.width <= 0 || plotSize.height <= 0) return null;
    const ci = categories.indexOf(selection.category);
    const row = order.indexOf(ci);
    if (ci < 0 || row < 0) return null;
    const c = centers[row] ?? 0;
    return horizontal
      ? { x: valueScale(selection.value), y: c }
      : { x: c, y: valueScale(selection.value) };
  }, [selectable, selection, categories, order, centers, horizontal, valueScale, plotSize]);
  const selectedKey = selection ? pointKey(selection.category, selection.series) : null;

  const baseHeight =
    height != null
      ? typeof height === "number"
        ? `${height}px`
        : height
      : "calc(var(--sf-unit) * 12)";
  const wrapperStyle: CSSProperties = {
    ...(sideAxisWidth > 0 ? { "--sf-axis-label-width": `${sideAxisWidth}px` } : {}),
    // Inline sizing wins over the .expanded class, so none while maximized. A
    // fixed row pitch lets the plot set the height; otherwise the height is
    // the prop, plus the growth the rows demanded.
    ...(scaffold.expanded
      ? {}
      : rowHeight != null && horizontal
        ? { blockSize: "auto" }
        : extra > 0
          ? { blockSize: `calc(${baseHeight} + ${extra}px)` }
          : height != null
            ? { blockSize: baseHeight }
            : {}),
    ...style,
  } as CSSProperties;

  const legendVisible = showLegend ?? (series.length > 1 || !!marker);
  const tooltipFor = (d: DotPlotDatum) =>
    renderTooltip ? (
      renderTooltip(d)
    ) : (
      <DefaultTooltip d={d} markerLabel={markerLabel} seriesName={seriesName} />
    );
  const hoverDatum = hover ? datumAt(hover.row, hover.si) : null;
  const hoverValue = hover?.si != null ? hoverDatum?.value : undefined;

  // A printed value beside a dot. Horizontal: right of the dot, flipped to the
  // left when it would run past the plot; `side` forces an end of a range.
  const renderValueLabel = (
    key: string,
    row: number,
    v: number,
    side: "auto" | "low" | "high",
    text = valueFormat(v),
  ) => {
    const w = measure(text);
    const p = point(row, v);
    if (horizontal) {
      let right =
        side === "high" || (side === "auto" && p.x + dotR + LABEL_GAP_PX + w <= valueLength);
      if (side === "low" && p.x - dotR - LABEL_GAP_PX - w < 0) right = true;
      return (
        <text
          key={key}
          x={right ? p.x + dotR + LABEL_GAP_PX : p.x - dotR - LABEL_GAP_PX}
          y={p.y}
          dominantBaseline="central"
          textAnchor={right ? "start" : "end"}
          className={styles.valueLabel}
        >
          {text}
        </text>
      );
    }
    let above = side === "high" || (side === "auto" && p.y - dotR - LABEL_GAP_PX - 12 >= 0);
    if (side === "low" && p.y + dotR + LABEL_GAP_PX + 12 > valueLength) above = true;
    return (
      <text
        key={key}
        x={p.x}
        y={above ? p.y - dotR - LABEL_GAP_PX : p.y + dotR + LABEL_GAP_PX + 11}
        textAnchor="middle"
        className={styles.valueLabel}
      >
        {text}
      </text>
    );
  };

  const categoryAxisLabel = xLabel;
  const valueAxisLabel = yLabel;
  const sideLabel = horizontal ? categoryAxisLabel : valueAxisLabel;
  const bottomLabel = horizontal ? valueAxisLabel : categoryAxisLabel;
  const sideTicks = horizontal ? categoryTicks : valueTicks;
  const bottomTicks = horizontal ? valueTicks : categoryTicks;

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
      <div ref={probeRef} className={styles.unitProbe} aria-hidden="true" />
      {sideLabel ? <div className={styles.sideLabel}>{sideLabel}</div> : null}
      <Axis
        orientation="y"
        ticks={sideTicks}
        noLine={isTufte}
        className={cx(styles.sideAxis, horizontal ? styles.categoryAxis : styles.valueAxis)}
      />
      <div
        ref={plotAreaRef}
        className={styles.plot}
        style={
          rowHeight != null && horizontal
            ? { blockSize: n * rowHeight + topInset, minBlockSize: 0 }
            : undefined
        }
      >
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            {...scaffold.editor.surfaceProps}
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={
              [valueAxisLabel, categoryAxisLabel].filter(Boolean).join(" by ") || "Dot plot"
            }
            onMouseLeave={handleLeave}
          >
            {/* Value gridlines (hover / full modes; CSS drives the opacity). */}
            {scaffolding !== "minimal"
              ? valueTicks.map((tick) => {
                  if (horizontal) {
                    const x = snapHairline(plotSize.width * tick.position);
                    return (
                      <line
                        key={`grid-${tick.label}-${tick.position}`}
                        x1={x}
                        x2={x}
                        y1={0}
                        y2={plotSize.height}
                        className={cx(styles.gridline, tick.major && styles.gridlineMajor)}
                      />
                    );
                  }
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

            {order.map((ci, row) => {
              const category = categories[ci] ?? "";
              const c = centers[row] ?? 0;
              const half = rows.step / 2;
              const rowHovered = hover?.row === row;
              const pair = rangePair;
              const from = pair ? (series[pair[0]]?.values[ci] ?? null) : null;
              const to = pair ? (series[pair[1]]?.values[ci] ?? null) : null;
              const mk = marker?.[ci] ?? null;
              const labels: ReactNode[] = [];
              if (valuesOn) {
                if (pair && from != null && to != null) {
                  const lo = Math.min(from, to);
                  const hi = Math.max(from, to);
                  const loText = valueFormat(lo);
                  const pLo = point(row, lo);
                  // The low label sits outside the low dot. When that would run
                  // off the plot, both values print together past the high dot
                  // rather than pile up inside a narrow range.
                  const loFits = horizontal
                    ? pLo.x - dotR - LABEL_GAP_PX - measure(loText) >= 0
                    : pLo.y + dotR + LABEL_GAP_PX + 12 <= valueLength;
                  if (hi === lo) {
                    labels.push(renderValueLabel(`v-${category}`, row, lo, "auto"));
                  } else if (loFits) {
                    labels.push(renderValueLabel(`lo-${category}`, row, lo, "low", loText));
                    labels.push(renderValueLabel(`hi-${category}`, row, hi, "high"));
                  } else {
                    labels.push(
                      renderValueLabel(
                        `hi-${category}`,
                        row,
                        hi,
                        "high",
                        `${loText} to ${valueFormat(hi)}`,
                      ),
                    );
                  }
                } else if (series.length === 1) {
                  const v = series[0]?.values[ci];
                  if (v != null) labels.push(renderValueLabel(`v-${category}`, row, v, "auto"));
                } else {
                  // Several series without a range: the row's lowest and
                  // highest dot carry the numbers, outside the pair.
                  let lo: number | null = null;
                  let hi: number | null = null;
                  for (const s of series) {
                    const v = s.values[ci];
                    if (v == null) continue;
                    if (lo == null || v < lo) lo = v;
                    if (hi == null || v > hi) hi = v;
                  }
                  if (lo != null && hi != null) {
                    if (lo === hi) {
                      labels.push(renderValueLabel(`v-${category}`, row, lo, "auto"));
                    } else {
                      const loText = valueFormat(lo);
                      const pLo = point(row, lo);
                      const loFits = horizontal
                        ? pLo.x - dotR - LABEL_GAP_PX - measure(loText) >= 0
                        : pLo.y + dotR + LABEL_GAP_PX + 12 <= valueLength;
                      if (loFits)
                        labels.push(renderValueLabel(`lo-${category}`, row, lo, "low", loText));
                      labels.push(renderValueLabel(`hi-${category}`, row, hi, "high"));
                    }
                  }
                }
              }
              return (
                <g key={`row-${category}`} data-row={category}>
                  {/* The row band: hover anywhere in it reads the whole row. */}
                  <rect
                    x={horizontal ? 0 : c - half}
                    y={horizontal ? c - half : 0}
                    width={horizontal ? plotSize.width : rows.step}
                    height={horizontal ? rows.step : plotSize.height}
                    className={styles.rowBand}
                    data-hovered={rowHovered || undefined}
                    onPointerEnter={() => handleEnter(row, null)}
                    onPointerLeave={handleLeave}
                  />
                  {lollipop
                    ? series.map((s, si) => {
                        const v = s.values[ci];
                        if (v == null) return null;
                        const p = point(row, v);
                        return horizontal ? (
                          <line
                            key={`stem-${s.name}`}
                            x1={snapHairline(baselinePx)}
                            x2={p.x}
                            y1={c}
                            y2={c}
                            className={styles.stem}
                          />
                        ) : (
                          <line
                            key={`stem-${s.name}`}
                            x1={c}
                            x2={c}
                            y1={snapHairline(baselinePx)}
                            y2={p.y}
                            className={styles.stem}
                          />
                        );
                      })
                    : null}
                  {pair && from != null && to != null
                    ? (() => {
                        const a = point(row, from);
                        const b = point(row, to);
                        return (
                          <line
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            className={styles.rangeBar}
                            data-direction={
                              rangeTone === "direction" ? rangeDirection(from, to) : undefined
                            }
                          />
                        );
                      })()
                    : null}
                  {mk != null
                    ? (() => {
                        const p = point(row, mk);
                        const reach = Math.min(rows.step * 0.32, 8);
                        return horizontal ? (
                          <line
                            x1={p.x}
                            x2={p.x}
                            y1={p.y - reach}
                            y2={p.y + reach}
                            className={styles.marker}
                          />
                        ) : (
                          <line
                            x1={p.x - reach}
                            x2={p.x + reach}
                            y1={p.y}
                            y2={p.y}
                            className={styles.marker}
                          />
                        );
                      })()
                    : null}
                  {series.map((s, si) => {
                    const v = s.values[ci];
                    if (v == null) return null;
                    const p = point(row, v);
                    const color = seriesColor(s, si);
                    const ring = isRing(si);
                    const selected =
                      selectedKey != null && pointKey(category, s.name) === selectedKey;
                    const datum = () => datumAt(row, si);
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the ARIA fallback
                      <circle
                        key={`dot-${s.name}`}
                        cx={p.x}
                        cy={p.y}
                        r={dotR}
                        className={cx(styles.dot, ring && styles.dotRing)}
                        style={ring ? { stroke: color } : { fill: color }}
                        data-chart-mark=""
                        data-series={s.name}
                        role="button"
                        tabIndex={0}
                        aria-label={`${category} ${format.series(s.name, si)}: ${valueFormat(v)}`}
                        data-activatable={activatable ? "" : undefined}
                        data-selected={selected || undefined}
                        onPointerEnter={() => handleEnter(row, si)}
                        onPointerLeave={handleLeave}
                        onFocus={() => handleEnter(row, si)}
                        onBlur={handleLeave}
                        onClick={
                          activatable
                            ? () => {
                                const d = datum();
                                if (d) handleActivate(d);
                              }
                            : undefined
                        }
                        onKeyDown={
                          activatable
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  const d = datum();
                                  if (d) handleActivate(d);
                                }
                              }
                            : undefined
                        }
                      >
                        <title>
                          {category}, {format.series(s.name, si)}: {formatExact(v)}
                        </title>
                      </circle>
                    );
                  })}
                  {labels}
                </g>
              );
            })}

            {/* Tufte crosshair: the hovered dot projected onto the value axis. */}
            {isTufte && hover && hover.si != null && hoverValue != null ? (
              <Crosshair
                x={hover.cx}
                y={hover.cy}
                height={plotSize.height}
                axes={horizontal ? "x" : "y"}
                xLabel={horizontal ? valueFormat(hoverValue) : undefined}
                yLabel={horizontal ? undefined : valueFormat(hoverValue)}
              />
            ) : null}

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
                  horizontal
                    ? formatNumber(Math.abs(Number(b) - Number(a)))
                    : `${Math.abs(Number(b) - Number(a)).toFixed(1)} cat`
                }
                formatY={(y) => (horizontal ? `${y.toFixed(1)} row` : formatNumber(y))}
                editing={scaffold.editor.layerEditing}
              />
            ) : null}

            {/* Value-axis zoom marquee: a band across the value range. */}
            {scaffold.viewport.marquee
              ? (() => {
                  const [f0, f1] = scaffold.viewport.marquee;
                  const lo = Math.min(f0, f1);
                  const hi = Math.max(f0, f1);
                  return horizontal ? (
                    <rect
                      x={lo * plotSize.width}
                      y={0}
                      width={(hi - lo) * plotSize.width}
                      height={plotSize.height}
                      className={scaffoldStyles.marquee}
                    />
                  ) : (
                    <rect
                      x={0}
                      y={(1 - hi) * plotSize.height}
                      width={plotSize.width}
                      height={(hi - lo) * plotSize.height}
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
        ticks={bottomTicks}
        noLine={isTufte && horizontal}
        className={cx(styles.bottomAxis, horizontal ? styles.valueAxis : styles.categoryAxis)}
      />
      {bottomLabel ? <div className={styles.bottomLabel}>{bottomLabel}</div> : null}
      {legendVisible ? (
        <div className={styles.legend}>
          {series.map((s, si) => (
            <span key={`leg-${s.name}`} className={styles.legendItem}>
              <svg className={styles.legendGlyph} viewBox="0 0 12 12" aria-hidden="true">
                <circle
                  cx={6}
                  cy={6}
                  r={4}
                  className={cx(styles.dot, isRing(si) && styles.dotRing)}
                  style={isRing(si) ? { stroke: seriesColor(s, si) } : { fill: seriesColor(s, si) }}
                />
              </svg>
              {format.series(s.name, si)}
            </span>
          ))}
          {marker ? (
            <span className={styles.legendItem}>
              <svg className={styles.legendGlyph} viewBox="0 0 12 12" aria-hidden="true">
                <line x1={6} x2={6} y1={1} y2={11} className={styles.marker} />
              </svg>
              {markerLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hoverDatum != null} anchorRect={hover?.rect ?? null}>
        {hoverDatum ? tooltipFor(hoverDatum) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection
            ? renderSelection
              ? renderSelection(selection)
              : tooltipFor(selection)
            : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
