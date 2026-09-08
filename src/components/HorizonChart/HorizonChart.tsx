import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, memo, useCallback, useId, useMemo, useRef, useState } from "react";
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
  domainKeyOf,
  FullscreenToggle,
  formatDateDelta,
  getTextMeasurer,
  invertLinear,
  type LabelBox,
  linearScale,
  maxLabelWidth,
  minMaxDownsample,
  resolveTickFont,
  SelectionPopover,
  type StepSession,
  scaffoldStyles,
  sliceRange,
  snapHairline,
  stableValue,
  Tooltip,
  thinLabels,
  timeTicks,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { formatNumber } from "../../lib/format";
import {
  bandColor,
  bandPath,
  type HorizonBaseline,
  type HorizonDatum,
  type HorizonMode,
  type HorizonX,
  isSortedByX,
  nearestIndex,
  resolveBandRanges,
  resolveBaseline,
  rowMaxAbs,
  toNumber,
} from "./HorizonChart.math";
import styles from "./HorizonChart.module.css";

export type { AnnotationX, ChartAnnotation, ChartScaffolding } from "../../lib/chart";
export type { HorizonBaseline, HorizonDatum, HorizonMode, HorizonX } from "./HorizonChart.math";

export interface HorizonSeries {
  name: string;
  /** Points in ascending x order (dates or numbers). An unsorted row is sorted
   *  on a copy. */
  data: HorizonDatum[];
}

/** The datum-with-series a HorizonChart emits on activate / selection. */
export type HorizonPoint = HorizonDatum & { series: string };

/** What the crosshair reads at one x: every row's nearest datum, and which row
 *  the pointer is over. */
export interface HorizonHover {
  x: HorizonX;
  /** One entry per row, in row order. */
  rows: HorizonPoint[];
  /** The row under the pointer. */
  active: HorizonPoint;
}

export interface HorizonChartProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps,
    ChartSelectionProps<HorizonPoint> {
  /** One row per series, top to bottom. */
  series: HorizonSeries[];
  /** How many bands a row folds its range into. A row of height h then shows
   *  a range of `bands` times h. Default `3`. */
  bands?: number;
  /** Negative values: `"mirror"` (default) flips them upward in the negative
   *  hue so both signs rise from the row's floor; `"offset"` hangs them from
   *  the row's ceiling, Saito's original two-tone form. */
  mode?: HorizonMode;
  /** The value each row folds around: a number, the row's `"mean"`, or its
   *  `"first"` value. Default `0`. */
  baseline?: HorizonBaseline;
  /** Explicit band range for every row, read as the larger magnitude of its
   *  edges. Overrides `sharedScale`. */
  domain?: [number, number];
  /** Share one band range across rows (the largest deviation), so a taller
   *  fill means a larger move in any row. `false` gives each row its own range
   *  (every row fills its full height at its own peak). Default `true`. */
  sharedScale?: boolean;
  /** Row height in px. Default 1.5 times `--sf-unit`. */
  rowHeight?: number;
  /** The two hues. Default: the accent above the baseline, danger below. Each
   *  band mixes the hue toward the page background, pale to full. */
  colors?: { positive?: string; negative?: string };
  /** Row names: a measured column to the left (default), printed over the
   *  row's left edge, or hidden. */
  labels?: "left" | "overlay" | "none";
  /** A column of the last visible value per row, at the right. Default `false`. */
  showValues?: boolean;
  /** Formats values (the value column, the tooltip). Default: Swiss
   *  typography with up to 2 decimals. */
  valueFormat?: (value: number) => string;
  /** Fixes the x range. With `zoomable`, this is the controlled visible
   *  window (pair it with `onXDomainChange`). */
  xDomain?: [number, number] | [Date, Date];
  /** Fires as the visible x-window changes (`[Date, Date]` on date axes);
   *  `null` = reset to the full extent. */
  onXDomainChange?: (domain: [number, number] | [Date, Date] | null) => void;
  /** Click (or Enter on a focused row) on the row under the pointer: the
   *  drill-down hook. */
  onPointActivate?: (point: HorizonPoint) => void;
  /** Tooltip body for the crosshair reading. Default: the x value, then every
   *  row's name and value (only the row under the pointer past 16 rows). */
  renderTooltip?: (hover: HorizonHover) => ReactNode;
  /** Component height. Default: the rows plus the axis; when set, the rows
   *  scroll inside it. */
  height?: number | string;
}

interface HoverState extends HorizonHover {
  rowIndex: number;
  /** Plot-space x of the active datum: the crosshair and tooltip anchor. */
  px: number;
  rect: DOMRect;
}

interface BandShape {
  row: number;
  sign: 1 | -1;
  band: number;
  d: string;
}

const MAX_TOOLTIP_ROWS = 16;
const DEFAULT_UNIT_PX = 24;
const MAX_LABEL_UNITS = 8;

function isDateValue(x: HorizonX): x is Date {
  return x instanceof Date;
}

function formatXValue(x: HorizonX): string {
  if (isDateValue(x)) return x.toLocaleDateString();
  return formatNumber(x);
}

function defaultValueFormat(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

/** The `--sf-unit` of the element in px (the row height is set on it). */
function resolveUnitPx(el: Element | null): number {
  if (!el || typeof getComputedStyle === "undefined") return DEFAULT_UNIT_PX;
  const raw = getComputedStyle(el).getPropertyValue("--sf-unit").trim();
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_UNIT_PX;
  return raw.endsWith("rem") ? parsed * 16 : parsed;
}

function pointKey(p: HorizonPoint): string {
  return `${p.series} ${toNumber(p.x)} ${p.y}`;
}

/** The bands of every row, one memo fiber: a hover render (crosshair, tooltip)
 *  bails out here instead of re-reconciling rows times bands paths. */
const HorizonBandsLayer = memo(function HorizonBandsLayer({
  shapes,
  fills,
  clipPrefix,
}: {
  shapes: readonly BandShape[];
  fills: { positive: string[]; negative: string[] };
  clipPrefix: string;
}) {
  return (
    <g>
      {shapes.map((s) => (
        <path
          key={`${s.row}-${s.sign}-${s.band}`}
          d={s.d}
          className={styles.band}
          clipPath={`url(#${clipPrefix}-${s.row})`}
          style={{ fill: (s.sign > 0 ? fills.positive : fills.negative)[s.band] }}
          data-row={s.row}
          data-sign={s.sign}
          data-band={s.band}
        />
      ))}
    </g>
  );
});

export const HorizonChart = forwardRef<HTMLDivElement, HorizonChartProps>(function HorizonChart(
  {
    series,
    bands = 3,
    mode = "mirror",
    baseline = 0,
    domain,
    sharedScale = true,
    rowHeight,
    colors,
    labels = "left",
    showValues = false,
    valueFormat = defaultValueFormat,
    xDomain,
    onXDomainChange,
    onPointActivate,
    renderTooltip,
    height,
    xLabel,
    yLabel,
    scaffolding = "hover",
    zoomable = false,
    zoomOutLimit,
    annotations,
    onAnnotationsChange,
    controls = false,
    fullscreen = false,
    frame = false,
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
  const { selection, setSelection } = useChartSelection<HorizonPoint>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const isTufte = scaffolding !== "full";
  const bandCount = Math.max(1, Math.floor(bands));
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const clipPrefix = `${useId()}-row`;

  // Rows in ascending x order (a copy when the input is not).
  const rows = useMemo(
    () =>
      series.map((s) =>
        isSortedByX(s.data)
          ? s
          : { ...s, data: [...s.data].sort((a, b) => toNumber(a.x) - toNumber(b.x)) },
      ),
    [series],
  );

  const isDateAxis = useMemo(() => {
    for (const r of rows) {
      const first = r.data[0];
      if (first) return isDateValue(first.x);
    }
    return false;
  }, [rows]);

  const dataXExtent: [number, number] = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      const first = r.data[0];
      const last = r.data[r.data.length - 1];
      if (!first || !last) continue;
      const lo = toNumber(first.x);
      const hi = toNumber(last.x);
      if (lo < min) min = lo;
      if (hi > max) max = hi;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }, [rows]);

  const staticXDomain: [number, number] = useMemo(
    () => (xDomain ? [toNumber(xDomain[0]), toNumber(xDomain[1])] : dataXExtent),
    [xDomain, dataXExtent],
  );

  const maxRowLength = useMemo(() => {
    let n = 0;
    for (const r of rows) n = Math.max(n, r.data.length);
    return n;
  }, [rows]);

  const formatDomainValue = useCallback(
    (v: number) =>
      isDateAxis ? new Date(v).toLocaleDateString() : formatNumber(Number(v.toPrecision(4))),
    [isDateAxis],
  );

  const handleDomainChange = useCallback(
    (next: [number, number] | null) => {
      if (!onXDomainChange) return;
      if (next === null) onXDomainChange(null);
      else if (isDateAxis) onXDomainChange([new Date(next[0]), new Date(next[1])]);
      else onXDomainChange(next);
    },
    [onXDomainChange, isDateAxis],
  );

  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable,
    annotations,
    onAnnotationsChange,
    value: {
      extent: dataXExtent,
      domain: zoomable && xDomain ? staticXDomain : undefined,
      onDomainChange: handleDomainChange,
      minSpan: ((dataXExtent[1] - dataXExtent[0]) * 4) / Math.max(4, maxRowLength),
      zoomOutLimit,
      formatValue: formatDomainValue,
      axis: "x",
    },
  });
  const { viewport } = scaffold;
  const resolvedXDomain: [number, number] = zoomable ? viewport.domain : staticXDomain;

  // --- Row geometry ---
  const unitPx = resolveUnitPx(plotRef.current);
  const rowH = rowHeight ?? unitPx * 1.5;
  const rowsHeight = rows.length * rowH;
  // With the toolbar on, the rows start two units down so it sits in empty
  // space above them instead of over the first row's left end.
  const topInset = controls ? unitPx * 2 : 0;
  const svgHeight = topInset + rowsHeight;
  const width = plotSize.width;

  // --- Folding parameters (from the full data, so bands hold still through zoom) ---
  const baselines = useMemo(
    () => rows.map((r) => resolveBaseline(r.data, baseline)),
    [rows, baseline],
  );
  const bandRanges = useMemo(
    () =>
      resolveBandRanges(
        rows.map((r, i) => rowMaxAbs(r.data, baselines[i] ?? 0)),
        sharedScale,
        domain,
      ),
    [rows, baselines, sharedScale, domain],
  );

  // --- Visible, decimated rows (bucket count with resize hysteresis) ---
  const bucketSession = useRef<StepSession<number>>({});
  const visibleRows = useMemo(() => {
    if (width <= 0) return rows.map((r) => r.data as readonly HorizonDatum[]);
    const [x0, x1] = resolvedXDomain;
    const session = bucketSession.current;
    const buckets = stableValue(
      session,
      Math.max(16, Math.floor(width / 4)),
      session.value !== undefined ? width / session.value : undefined,
      4,
      domainKeyOf(resolvedXDomain),
    );
    return rows.map((r) => {
      let windowed: readonly HorizonDatum[] = r.data;
      if (zoomable) {
        const [start, end] = sliceRange(r.data, (d) => toNumber(d.x), x0, x1);
        if (start !== 0 || end !== r.data.length) windowed = r.data.slice(start, end);
      }
      return minMaxDownsample(
        windowed,
        (d) => toNumber(d.x),
        (d) => d.y,
        buckets,
      );
    });
  }, [rows, zoomable, resolvedXDomain, width]);

  // --- Scales ---
  const xScale = useMemo(() => linearScale(resolvedXDomain, [0, width]), [resolvedXDomain, width]);
  const xPx = useCallback((x: HorizonX) => xScale(toNumber(x)), [xScale]);
  const xInvert = invertLinear(resolvedXDomain, [0, width]);
  // Annotation y is the row index (0 at the top edge of the first row).
  scaffold.invertRef.current = {
    xFromPx: (px) => (isDateAxis ? new Date(xInvert(px)) : xInvert(px)),
    yFromPx: (px) => (rowH > 0 ? (px - topInset) / rowH : 0),
  };
  const annotationXPx = useCallback((x: AnnotationX) => xScale(toNumber(x)), [xScale]);
  const annotationYPx = useCallback((y: number) => topInset + y * rowH, [rowH, topInset]);

  // --- Band shapes ---
  const shapes: BandShape[] = useMemo(() => {
    if (width <= 0) return [];
    const out: BandShape[] = [];
    visibleRows.forEach((data, row) => {
      const b = baselines[row] ?? 0;
      const span = (bandRanges[row] ?? 1) / bandCount;
      const xs = data.map((d) => xScale(toNumber(d.x)));
      const vs = data.map((d) => d.y - b);
      const top = topInset + row * rowH;
      for (const sign of [1, -1] as const) {
        for (let k = 0; k < bandCount; k++) {
          const d = bandPath(xs, vs, sign, k, span, top, rowH, mode);
          if (d) out.push({ row, sign, band: k, d });
        }
      }
    });
    return out;
  }, [visibleRows, baselines, bandRanges, bandCount, xScale, rowH, topInset, mode, width]);

  const fills = useMemo(() => {
    const positive = colors?.positive ?? "var(--sf-color-primary)";
    const negative = colors?.negative ?? "var(--sf-color-danger)";
    return {
      positive: Array.from({ length: bandCount }, (_, k) => bandColor(positive, k, bandCount)),
      negative: Array.from({ length: bandCount }, (_, k) => bandColor(negative, k, bandCount)),
    };
  }, [colors, bandCount]);

  // --- Ticks ---
  const measureMono = getTextMeasurer(resolveTickFont(plotRef.current));
  const measureSans = getTextMeasurer(resolveTickFont(plotRef.current, "sans"));
  const prevXTickKeys = useRef<ReadonlySet<string>>(new Set());

  const niceXTicks: AxisTick[] = useMemo(() => {
    const [xMin, xMax] = resolvedXDomain;
    if (xMax <= xMin || width <= 0) return [];
    if (isDateAxis) {
      return timeTicks(xMin, xMax, width).map((t) => ({
        label: t.label,
        position: (t.date.getTime() - xMin) / (xMax - xMin),
        major: t.major,
      }));
    }
    return adaptiveTicks(xMin, xMax, width).ticks.map((t) => ({
      label: t.label,
      position: (t.value - xMin) / (xMax - xMin),
      major: t.major,
    }));
  }, [resolvedXDomain, isDateAxis, width]);

  const xAxisTicks: AxisTick[] = useMemo(() => {
    const [xMin, xMax] = resolvedXDomain;
    if (xMax <= xMin || width <= 0) return [];
    let raw: AxisTick[];
    if (isTufte) {
      // Dot-dash: one tick per visible datum of the longest row, thinned.
      let longest: readonly HorizonDatum[] = [];
      for (const data of visibleRows) if (data.length > longest.length) longest = data;
      const seen = new Set<number>();
      raw = [];
      for (const d of longest) {
        const v = toNumber(d.x);
        if (v < xMin || v > xMax || seen.has(v)) continue;
        seen.add(v);
        raw.push({ label: formatXValue(d.x), position: (v - xMin) / (xMax - xMin), major: false });
      }
      raw.sort((a, b) => a.position - b.position);
    } else {
      raw = niceXTicks;
    }
    const boxes: LabelBox[] = raw.map((t, i) => ({
      center: t.position * width,
      size: measureMono(t.label),
      priority: isTufte ? (i === 0 || i === raw.length - 1 ? 2 : 0) : t.major ? 1 : 0,
      key: t.label,
    }));
    const keep = thinLabels(boxes, { previousKeys: prevXTickKeys.current });
    const ticks = raw.filter((_, i) => keep[i]);
    prevXTickKeys.current = new Set(ticks.map((t) => t.label));
    return ticks;
  }, [resolvedXDomain, width, isTufte, visibleRows, niceXTicks, measureMono]);

  // --- Label and value columns ---
  // Without a label column the first tick label (centred on the plot's left
  // edge) would hang out of the chart: reserve half its width as a gutter. The
  // value column does the same for the last tick on the right.
  const firstTick = xAxisTicks[0];
  const lastTick = xAxisTicks[xAxisTicks.length - 1];
  const labelWidth = useMemo(() => {
    if (rows.length === 0) return 0;
    if (labels !== "left") return firstTick ? Math.ceil(measureMono(firstTick.label) / 2) : 0;
    const measured = maxLabelWidth(
      rows.map((r) => r.name),
      measureSans,
      { padPx: 12 },
    );
    return Math.min(measured, MAX_LABEL_UNITS * unitPx);
  }, [labels, rows, measureSans, measureMono, unitPx, firstTick]);

  const lastValues = useMemo(
    () =>
      visibleRows.map((data) => {
        const last = data[data.length - 1];
        return last ? valueFormat(last.y) : "";
      }),
    [visibleRows, valueFormat],
  );
  const valueWidth = useMemo(() => {
    if (showValues) return maxLabelWidth(lastValues, measureMono, { padPx: 12 });
    return lastTick ? Math.ceil(measureMono(lastTick.label) / 2) : 0;
  }, [showValues, lastValues, measureMono, lastTick]);

  // --- Hover: the crosshair reads every row at the pointer's x ---
  const readAt = useCallback(
    (xNum: number, rowIndex: number): HorizonHover | null => {
      const points: HorizonPoint[] = [];
      let active: HorizonPoint | null = null;
      rows.forEach((r, i) => {
        const idx = nearestIndex(r.data, xNum);
        const d = r.data[idx];
        if (!d) return;
        const p = { ...d, series: r.name };
        points.push(p);
        if (i === rowIndex) active = p;
      });
      const activePoint = active ?? points[0];
      if (!activePoint) return null;
      return { x: activePoint.x, rows: points, active: activePoint };
    },
    [rows],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const plotEl = plotRef.current;
      if (!plotEl || width <= 0 || rows.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const rowIndex = Math.min(
        rows.length - 1,
        Math.max(0, Math.floor((localY - topInset) / rowH)),
      );
      const read = readAt(xInvert(localX), rowIndex);
      if (!read) return;
      const px = xScale(toNumber(read.active.x));
      const cy = topInset + rowIndex * rowH + rowH / 2;
      setHover({ ...read, rowIndex, px, rect: anchorRectFromPoint(plotEl, px, cy) });
    },
    [plotRef, width, rows.length, rowH, topInset, readAt, xInvert, xScale],
  );
  const handlePointerLeave = useCallback(() => setHover(null), []);

  const activate = useCallback(
    (point: HorizonPoint) => {
      onPointActivate?.(point);
      if (!selectable) return;
      const cur = selectionRef.current;
      const same = cur != null && pointKey(cur) === pointKey(point);
      setSelection(same ? null : point);
    },
    [onPointActivate, selectable, setSelection],
  );
  const activatable = !!onPointActivate || selectable;

  const handleClick = useCallback(() => {
    if (!activatable || !hover) return;
    activate(hover.active);
  }, [activatable, hover, activate]);

  const handleRowKeyDown = useCallback(
    (e: ReactKeyboardEvent<SVGGElement>, row: number) => {
      if (!activatable || (e.key !== "Enter" && e.key !== " ")) return;
      const data = visibleRows[row];
      const last = data?.[data.length - 1];
      const r = rows[row];
      if (!last || !r) return;
      e.preventDefault();
      activate({ ...last, series: r.name });
    },
    [activatable, visibleRows, rows, activate],
  );

  // The pinned popover's anchor, re-derived through the live scale every render.
  const selectionPoint = useMemo(() => {
    if (!selectable || !selection || width <= 0) return null;
    const row = rows.findIndex((r) => r.name === selection.series);
    if (row < 0) return null;
    return { x: xPx(selection.x), y: topInset + row * rowH + rowH / 2 };
  }, [selectable, selection, width, rows, xPx, rowH, topInset]);

  const formatXDelta = useCallback(
    (a: AnnotationX, b: AnnotationX) =>
      isDateAxis ? formatDateDelta(a, b) : formatNumber(Math.abs(toNumber(b) - toNumber(a))),
    [isDateAxis],
  );

  const tooltipBody = useCallback(
    (h: HorizonHover): ReactNode => {
      if (renderTooltip) return renderTooltip(h);
      const listed = h.rows.length > MAX_TOOLTIP_ROWS ? [h.active] : h.rows;
      return (
        <>
          <div className={styles.tipHead}>{formatXValue(h.x)}</div>
          <div className={styles.tipGrid}>
            {listed.map((p) => (
              <div
                key={p.series}
                className={styles.tipRow}
                data-active={p.series === h.active.series || undefined}
              >
                <span>{p.series}</span>
                <span className={styles.tipValue}>{valueFormat(p.y)}</span>
              </div>
            ))}
          </div>
        </>
      );
    },
    [renderTooltip, valueFormat],
  );

  const selectionBody = (p: HorizonPoint): ReactNode =>
    renderSelection ? renderSelection(p) : tooltipBody({ x: p.x, rows: [p], active: p });

  const wrapperStyle: CSSProperties = {
    "--hz-label-width": `${labelWidth}px`,
    "--hz-value-width": `${valueWidth}px`,
    "--hz-row-height": `${rowH}px`,
    "--hz-top-inset": `${topInset}px`,
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  } as CSSProperties;

  const gridlineVisible = scaffolding !== "minimal";

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
      data-mode={mode}
      data-labels={labels}
      data-fixed-height={height != null || undefined}
    >
      <div className={styles.scroller}>
        {labels === "left" ? (
          <div className={styles.labels} aria-hidden="true">
            {rows.map((r) => (
              <div key={r.name} className={styles.label} title={r.name}>
                {r.name}
              </div>
            ))}
          </div>
        ) : null}
        <div ref={plotAreaRef} className={styles.plot} style={{ blockSize: svgHeight }}>
          {width > 0 && rows.length > 0 ? (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the click is the pointer path; keyboard activation lives on the focusable rows inside (Enter / Space)
            <svg
              width={width}
              height={svgHeight}
              viewBox={`0 0 ${width} ${svgHeight}`}
              className={styles.svg}
              role="img"
              aria-label={yLabel ?? `Horizon chart of ${rows.length} series`}
              // A press anywhere on the plot is a press on this chart's mark: the
              // pinned popover must not dismiss before the click toggles it.
              data-chart-mark=""
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onClick={handleClick}
              {...scaffold.editor.surfaceProps}
            >
              <defs>
                {rows.map((r, i) => (
                  <clipPath key={r.name} id={`${clipPrefix}-${i}`}>
                    <rect x={0} y={topInset + i * rowH} width={width} height={rowH} />
                  </clipPath>
                ))}
              </defs>

              {gridlineVisible
                ? niceXTicks.map((t) => {
                    const x = snapHairline(t.position * width);
                    return (
                      <line
                        key={`grid-${t.label}-${t.position}`}
                        x1={x}
                        x2={x}
                        y1={topInset}
                        y2={svgHeight}
                        className={cx(styles.gridline, t.major && styles.gridlineMajor)}
                      />
                    );
                  })
                : null}

              <HorizonBandsLayer shapes={shapes} fills={fills} clipPrefix={clipPrefix} />

              {/* Row separators (chrome, pixel-snapped) and the focusable row
                  hit areas that carry keyboard activation. */}
              {rows.map((r, i) => {
                const top = topInset + i * rowH;
                const sep = snapHairline(top + rowH);
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: the row is role=button + tabIndex exactly when the chart is activatable; a <button> cannot be an SVG child
                  <g
                    key={r.name}
                    className={styles.row}
                    data-row={i}
                    data-activatable={activatable || undefined}
                    role={activatable ? "button" : undefined}
                    tabIndex={activatable ? 0 : undefined}
                    aria-label={activatable ? r.name : undefined}
                    onKeyDown={activatable ? (e) => handleRowKeyDown(e, i) : undefined}
                  >
                    <rect x={0} y={top} width={width} height={rowH} className={styles.rowHit} />
                    {i < rows.length - 1 ? (
                      <line x1={0} x2={width} y1={sep} y2={sep} className={styles.separator} />
                    ) : null}
                    {labels === "overlay" ? (
                      <text
                        x={4}
                        y={top + rowH / 2}
                        dominantBaseline="central"
                        className={styles.overlayLabel}
                      >
                        {r.name}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {selectable && selectionPoint ? (
                <circle
                  cx={selectionPoint.x}
                  cy={selectionPoint.y}
                  r={5}
                  className={styles.selectedRing}
                />
              ) : null}

              {scaffold.editingEnabled || (annotations && annotations.length > 0) ? (
                <AnnotationsLayer
                  annotations={
                    scaffold.editingEnabled
                      ? scaffold.editor.displayAnnotations
                      : (annotations ?? [])
                  }
                  xPx={annotationXPx}
                  yPx={annotationYPx}
                  width={width}
                  height={svgHeight}
                  formatXDelta={formatXDelta}
                  formatY={(y) => formatNumber(y, { maximumFractionDigits: 1 })}
                  editing={scaffold.editor.layerEditing}
                />
              ) : null}

              {viewport.marquee ? (
                <rect
                  x={Math.min(viewport.marquee[0], viewport.marquee[1]) * width}
                  y={topInset}
                  width={Math.abs(viewport.marquee[1] - viewport.marquee[0]) * width}
                  height={rowsHeight}
                  className={scaffoldStyles.marquee}
                />
              ) : null}

              {hover ? (
                <Crosshair
                  x={snapHairline(hover.px)}
                  y={topInset}
                  height={svgHeight}
                  axes="x"
                  xLabel={isTufte ? formatXValue(hover.x) : undefined}
                />
              ) : null}
            </svg>
          ) : null}
        </div>
        {showValues ? (
          <div className={styles.values} aria-hidden="true">
            {lastValues.map((v, i) => (
              <div key={rows[i]?.name ?? i} className={styles.value}>
                {v}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.chrome}>
        <ChartChrome
          scaffold={scaffold}
          controls={controls}
          xDataToPx={annotationXPx}
          yDataToPx={annotationYPx}
        />
        {zoomable && viewport.isZoomed && !controls ? (
          <button type="button" className={styles.resetButton} onClick={viewport.reset}>
            Reset
          </button>
        ) : null}
      </div>

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}
      <Axis orientation="x" ticks={xAxisTicks} noLine={isTufte} className={styles.xAxis} />
      {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? tooltipBody(hover) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection ? selectionBody(selection) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
