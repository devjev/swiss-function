import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { forwardRef, memo, useCallback, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  Axis,
  type AxisTick,
  adaptiveTicks,
  anchorRectFromPoint,
  ChartControls,
  type ChartScaffoldingProps,
  Crosshair,
  domainKeyOf,
  formatDateDelta,
  formatNumber,
  getTextMeasurer,
  invertLinear,
  type LabelBox,
  linearScale,
  maxLabelWidth,
  minMaxDownsample,
  niceDomain,
  niceTicks,
  resolveTickFont,
  type StepSession,
  sliceRange,
  snapHairline,
  stableValue,
  Tooltip,
  thinLabels,
  timeScale,
  timeTicks,
  useAnnotationEditor,
  useMeasuredPlot,
  useViewport,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { useFullscreen } from "../../lib/useFullscreen";
import { FullscreenToggle } from "../Fullscreen";
import styles from "./Scatterplot.module.css";

export type { AnnotationX, ChartAnnotation, ChartScaffolding } from "../../lib/chart";

export type ScatterX = number | Date;

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

export interface ScatterplotProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps {
  series: ScatterSeries[];
  /** Fixes the x range. With `zoomable`, this is the *controlled visible
   *  window* — pair it with `onXDomainChange` (standard controlled pattern;
   *  without the handler the viewport is frozen). */
  xDomain?: [number, number] | [Date, Date];
  yDomain?: [number, number];
  /** Fires as the visible x-window changes ([Date, Date] on date axes);
   *  `null` = reset to the full extent. Doubles as the semantic-zoom hook:
   *  load finer-grained data when the window narrows, swap `series`. Here
   *  `zoomable` windows the (continuous, possibly dated) x axis: while zoomed
   *  the y-axis follows the visible data unless `yDomain` fixes it, and series
   *  beyond ~4 points/px are decimated (min/max per column — spikes survive). */
  onXDomainChange?: (domain: [number, number] | [Date, Date] | null) => void;
  /** Click/Enter on a point — the drill-down hook. The consumer swaps
   *  `series` for finer-grained data (and renders its own breadcrumb). */
  onPointActivate?: (datum: ScatterDatum & { series: string }) => void;
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Render a legend below the x-axis. Default: true when >1 series. */
  showLegend?: boolean;
  /** Tooltip body. Receives the hovered datum + series name. Default: a
   *  monospace `(x, y)` line. */
  renderTooltip?: (datum: ScatterDatum & { series: string }) => ReactNode;
}

interface PointHit {
  datum: ScatterDatum;
  series: string;
  /** SVG-coords for the hovered point — the shared tooltip/crosshair anchor. */
  cx: number;
  cy: number;
}

interface HoverState extends PointHit {
  rect: DOMRect;
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
  onPointActivate,
}: {
  series: ScatterSeries;
  xPx: (x: ScatterX) => number;
  yScale: (y: number) => number;
  onPointHover: (hit: PointHit) => void;
  onPointLeave: () => void;
  onPointActivate?: (hit: PointHit) => void;
}) {
  const resolvePoint = (target: EventTarget | null): PointHit | null => {
    const el = target instanceof Element ? target.closest("[data-idx]") : null;
    const datum = el ? series.data[Number(el.getAttribute("data-idx"))] : undefined;
    if (!el || !datum) return null;
    return {
      datum,
      series: series.name,
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
  const handleClick = onPointActivate
    ? (e: { target: EventTarget | null }) => {
        const hit = resolvePoint(e.target);
        if (hit) onPointActivate(hit);
      }
    : undefined;
  const handleKeyDown = onPointActivate
    ? (e: { target: EventTarget | null; key: string; preventDefault: () => void }) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const hit = resolvePoint(e.target);
        if (hit) {
          e.preventDefault();
          onPointActivate(hit);
        }
      }
    : undefined;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pure event delegation — the interactive/focusable surface is each point's circle (role="button", tabIndex) below; the group only hosts the shared listeners (issue #14).
    <g
      onPointerOver={handleEnter}
      onPointerOut={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-activatable={onPointActivate ? "" : undefined}
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

function getXNumber(d: ScatterDatum): number {
  return toNumber(d.x);
}

function getY(d: ScatterDatum): number {
  return d.y;
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
    zoomable = false,
    zoomOutLimit,
    onXDomainChange,
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
  // Both minimal and hover modes share the dot-dash idle look; full mode
  // replaces it with nice-tick axes + gridlines.
  const isTufte = scaffolding !== "full";
  // SVG renders at the plot cell's pixel size so points stay perfectly
  // circular regardless of container width.
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));

  const isDateAxis = useMemo(() => {
    for (const s of series) {
      const first = s.data[0];
      if (first) return isDateValue(first.x);
    }
    return false;
  }, [series]);

  // --- Domains (auto-fit when not supplied) ---
  // Full data extent — the zoom-out floor when `zoomable`, the resolved
  // domain otherwise.
  const dataXExtent: [number, number] = useMemo(() => {
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
    // Date x: leave raw — the calendar ticks handle their own alignment.
    // Numeric x: snap to nice-tick boundaries so axis labels land at edges.
    if (isDate) return [min, max];
    return niceDomain([min, max], 5);
  }, [series]);

  const staticXDomain: [number, number] = useMemo(
    () => (xDomain ? [toNumber(xDomain[0]), toNumber(xDomain[1])] : dataXExtent),
    [xDomain, dataXExtent],
  );

  const maxSeriesLength = useMemo(() => {
    let n = 0;
    for (const s of series) n = Math.max(n, s.data.length);
    return n;
  }, [series]);

  const formatDomainValue = useCallback(
    // Marquee/pinch domains are raw floats — cap the announced precision.
    (v: number) =>
      isDateAxis ? new Date(v).toLocaleDateString() : formatNumber(Number(v.toPrecision(4))),
    [isDateAxis],
  );

  const handleDomainChange = useCallback(
    (domain: [number, number] | null) => {
      if (!onXDomainChange) return;
      if (domain === null) onXDomainChange(null);
      else if (isDateAxis) onXDomainChange([new Date(domain[0]), new Date(domain[1])]);
      else onXDomainChange(domain);
    },
    [onXDomainChange, isDateAxis],
  );

  // --- Annotation editor ---
  // Called BEFORE useViewport (which needs a fresh `toolArmed` for pointer
  // precedence) and before the domains exist — its px→data converters are
  // only invoked inside pointer handlers, so they read a ref that the render
  // fills once the resolved (possibly zoomed) domains are known below.
  const invertRef = useRef<{
    xFromPx: (px: number) => ScatterX;
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
    extent: dataXExtent,
    // With `zoomable`, an explicit xDomain is the controlled visible window.
    domain: zoomable && xDomain ? staticXDomain : undefined,
    onDomainChange: handleDomainChange,
    // Zoom-in ceiling ≈ 4 data points across the plot.
    minSpan: ((dataXExtent[1] - dataXExtent[0]) * 4) / Math.max(4, maxSeriesLength),
    zoomOutLimit,
    plotRef,
    enabled: zoomable,
    // An armed draw tool owns the pointer: pan/pinch/dblclick off, wheel on.
    suspended: editor.toolArmed,
    formatValue: formatDomainValue,
  });

  const resolvedXDomain: [number, number] = zoomable ? viewport.domain : staticXDomain;

  // LOD hysteresis: the bucket count survives a live resize while it still
  // yields ~4px columns, so decimation doesn't flap frame-to-frame; a domain
  // change (zoom/pan) re-buckets immediately.
  const bucketSession = useRef<StepSession<number>>({});

  // Visible, decimated data: slice each sorted series to the x-window
  // (widened by one point so lines run off-plot), then min/max-decimate to
  // ~4 points per pixel column so SVG element counts stay bounded no matter
  // how far out the viewport zooms. Unsorted series only get filtered.
  const visibleSeries: ScatterSeries[] = useMemo(() => {
    if (!zoomable) return series;
    const [x0, x1] = resolvedXDomain;
    const session = bucketSession.current;
    const buckets = stableValue(
      session,
      Math.max(16, Math.floor(plotSize.width / 4)),
      session.value !== undefined ? plotSize.width / session.value : undefined,
      4,
      domainKeyOf(resolvedXDomain),
    );
    return series.map((s) => {
      let sorted = true;
      for (let i = 1; i < s.data.length; i++) {
        const prev = s.data[i - 1];
        const cur = s.data[i];
        if (prev && cur && toNumber(cur.x) < toNumber(prev.x)) {
          sorted = false;
          break;
        }
      }
      let windowed: readonly ScatterDatum[] = s.data;
      if (sorted) {
        const [start, end] = sliceRange(s.data, getXNumber, x0, x1);
        if (start !== 0 || end !== s.data.length) windowed = s.data.slice(start, end);
        windowed = minMaxDownsample(windowed, getXNumber, getY, buckets);
      } else if (viewport.isZoomed) {
        windowed = s.data.filter((d) => {
          const v = toNumber(d.x);
          return v >= x0 && v <= x1;
        });
      }
      return windowed === s.data ? s : { ...s, data: windowed as ScatterDatum[] };
    });
  }, [series, zoomable, resolvedXDomain, plotSize.width, viewport.isZoomed]);

  const resolvedYDomain: [number, number] = useMemo(() => {
    if (yDomain) return yDomain;
    if (zoomable && viewport.isZoomed) {
      // Y follows the visible x-window — padded, NOT zero-anchored (zoomed
      // into y ∈ [1234.1, 1234.9], a zero-anchored axis would flatline).
      const [x0, x1] = resolvedXDomain;
      let lo = Infinity;
      let hi = -Infinity;
      for (const s of visibleSeries) {
        for (const d of s.data) {
          const v = toNumber(d.x);
          if (v < x0 || v > x1) continue;
          if (d.y < lo) lo = d.y;
          if (d.y > hi) hi = d.y;
        }
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
      if (lo === hi) return [lo - 1, hi + 1];
      const pad = (hi - lo) * 0.04;
      return [lo - pad, hi + pad];
    }
    const all: number[] = [];
    for (const s of series) for (const d of s.data) all.push(d.y);
    // niceDomain snaps to nice-tick boundaries so axis labels land exactly
    // at the plot edges (no clipping, no clamped collisions).
    return niceDomain(all, 5);
  }, [series, visibleSeries, yDomain, zoomable, viewport.isZoomed, resolvedXDomain]);

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

  // px → data inverses for the annotation editor (see invertRef above) —
  // closing over the RESOLVED domains, so y-follows-x zoom is respected.
  const xInvert = invertLinear(resolvedXDomain, [0, plotSize.width]);
  const yInvert = invertLinear(resolvedYDomain, [plotSize.height, 0]);
  invertRef.current = {
    xFromPx: (px) => (isDateAxis ? new Date(xInvert(px)) : xInvert(px)),
    yFromPx: yInvert,
  };

  // Survivor bias for the x labels: keys kept last frame win ties this frame,
  // so a live pan/zoom/resize doesn't strobe between alternating subsets.
  const prevXTickKeys = useRef<ReadonlySet<string>>(new Set());

  // --- Ticks ---
  // Tufte mode: one tick per unique datum value (dot-dash style). Full mode:
  // adaptive ticks — step, precision and promotion recompute from the
  // (possibly zoomed) domain and pixel density. Either set can collide (dense
  // data, zoom), so both pass through measured collision thinning.
  const xTicks: { ticks: AxisTick[]; offsetLabel: string } = useMemo(() => {
    const [xMin, xMax] = resolvedXDomain;
    if (xMax <= xMin) return { ticks: [], offsetLabel: "" };
    let raw: AxisTick[];
    let offsetLabel = "";
    if (isTufte) {
      const seen = new Set<number>();
      raw = [];
      for (const s of visibleSeries) {
        for (const d of s.data) {
          const v = toNumber(d.x);
          if (seen.has(v)) continue;
          seen.add(v);
          raw.push({
            label: formatXValue(d.x),
            position: (v - xMin) / (xMax - xMin),
            major: false,
          });
        }
      }
      // Sorted so first/last are the range endpoints (always kept below).
      raw.sort((a, b) => a.position - b.position);
    } else if (isDateAxis) {
      raw = timeTicks(xMin, xMax, plotSize.width).map((t) => ({
        label: t.label,
        position: (t.date.getTime() - xMin) / (xMax - xMin),
        major: t.major,
      }));
    } else {
      const adaptive = adaptiveTicks(xMin, xMax, plotSize.width);
      raw = adaptive.ticks.map((t) => ({
        label: t.label,
        position: (t.value - xMin) / (xMax - xMin),
        major: t.major,
      }));
      offsetLabel = adaptive.offsetLabel;
    }
    // Per-datum ticks pin the range endpoints; full-mode majors outrank minors.
    const boxes: LabelBox[] = raw.map((t, i) => ({
      center: t.position * plotSize.width,
      size: measure(t.label),
      priority: isTufte ? (i === 0 || i === raw.length - 1 ? 2 : 0) : t.major ? 1 : 0,
      key: t.label,
    }));
    const keep = thinLabels(boxes, { previousKeys: prevXTickKeys.current });
    const ticks = raw.filter((_, i) => keep[i]);
    prevXTickKeys.current = new Set(ticks.map((t) => t.label));
    return { ticks, offsetLabel };
  }, [resolvedXDomain, isDateAxis, plotSize.width, isTufte, visibleSeries, measure]);

  const yTicks: { ticks: AxisTick[]; offsetLabel: string } = useMemo(() => {
    const [yMin, yMax] = resolvedYDomain;
    if (yMax <= yMin) return { ticks: [], offsetLabel: "" };
    let raw: AxisTick[];
    let offsetLabel = "";
    if (isTufte) {
      const seen = new Set<number>();
      raw = [];
      for (const s of visibleSeries) {
        for (const d of s.data) {
          if (seen.has(d.y)) continue;
          seen.add(d.y);
          raw.push({
            label: formatNumber(d.y),
            position: (d.y - yMin) / (yMax - yMin),
            major: false,
          });
        }
      }
      raw.sort((a, b) => a.position - b.position);
    } else if (zoomable && viewport.isZoomed) {
      // While zoomed the y-domain is padded raw data (not nice-snapped), so
      // the axis needs in-domain adaptive ticks; at rest keep the nice-tick
      // set aligned with the snapped domain.
      const adaptive = adaptiveTicks(yMin, yMax, plotSize.height, 50);
      raw = adaptive.ticks.map((t) => ({
        label: t.label,
        position: (t.value - yMin) / (yMax - yMin),
        major: t.major,
      }));
      offsetLabel = adaptive.offsetLabel;
    } else {
      raw = niceTicks(yMin, yMax, 5).map((t) => ({
        label: t.label,
        position: (t.value - yMin) / (yMax - yMin),
        major: t.major,
      }));
    }
    // A y label occupies one line height (~16px) along the axis.
    const boxes: LabelBox[] = raw.map((t, i) => ({
      center: t.position * plotSize.height,
      size: 16,
      priority: isTufte ? (i === 0 || i === raw.length - 1 ? 2 : 0) : t.major ? 1 : 0,
      key: t.label,
    }));
    const keep = thinLabels(boxes);
    return { ticks: raw.filter((_, i) => keep[i]), offsetLabel };
  }, [resolvedYDomain, isTufte, visibleSeries, plotSize.height, zoomable, viewport.isZoomed]);

  const xAxisTicks = xTicks.ticks;
  const yAxisTicks = yTicks.ticks;

  // Gridline positions — mirror the full-mode y ticks (readable values like
  // 5/10/15/20) even when the axis itself shows per-datum dot-dash marks.
  const gridlineTicks: AxisTick[] = useMemo(() => {
    if (scaffolding === "minimal") return [];
    const [yMin, yMax] = resolvedYDomain;
    if (yMax <= yMin) return [];
    if (zoomable && viewport.isZoomed) {
      return adaptiveTicks(yMin, yMax, plotSize.height, 50).ticks.map((t) => ({
        label: t.label,
        position: (t.value - yMin) / (yMax - yMin),
        major: t.major,
      }));
    }
    return niceTicks(yMin, yMax, 5).map((t) => ({
      label: t.label,
      position: (t.value - yMin) / (yMax - yMin),
      major: t.major,
    }));
  }, [resolvedYDomain, scaffolding, zoomable, viewport.isZoomed, plotSize.height]);

  // --- Plot geometry ---
  const xPx = useCallback(
    (x: ScatterX): number => (isDateValue(x) ? xScaleDate(x) : xScaleNum(x)),
    [xScaleDate, xScaleNum],
  );

  // One anchor source: tooltip and crosshair both derive from the point's
  // plot-space center, so they can never disagree (hover and focus route
  // through the same delegated handler in the points layer).
  const handlePointHover = useCallback(
    (hit: PointHit) => {
      const plotEl = plotRef.current;
      if (!plotEl) return;
      setHover({ ...hit, rect: anchorRectFromPoint(plotEl, hit.cx, hit.cy) });
    },
    [plotRef],
  );
  const handlePointLeave = useCallback(() => setHover(null), []);
  const handlePointActivate = useMemo(
    () =>
      onPointActivate
        ? (hit: PointHit) => onPointActivate({ ...hit.datum, series: hit.series })
        : undefined,
    [onPointActivate],
  );

  const formatXDelta = useCallback(
    (a: ScatterX, b: ScatterX) =>
      isDateAxis ? formatDateDelta(a, b) : formatNumber(Math.abs(toNumber(b) - toNumber(a))),
    [isDateAxis],
  );

  // Measured y-axis column: the widest tick label sets --sf-axis-label-width
  // (8px-quantized so the resize feedback loop cannot oscillate).
  const yAxisWidth = useMemo(
    () =>
      maxLabelWidth(
        yTicks.ticks.map((t) => t.label),
        measure,
      ),
    [yTicks, measure],
  );

  const wrapperStyle: CSSProperties = {
    ...(yAxisWidth > 0 ? { "--sf-axis-label-width": `${yAxisWidth}px` } : {}),
    // The inline height would beat the fullscreen class (inset: 0 must own
    // the size), so drop it while expanded.
    ...(height != null && !expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  const legendVisible = showLegend ?? series.length > 1;
  const hasYLabel = !!yLabel;
  const hasXLabel = !!xLabel;

  // Editor keys (Delete/Escape/Enter, and everything while the text input is
  // open) run before the viewport's zoom/pan keys.
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
      data-axis-y-label={hasYLabel || undefined}
      data-axis-x-label={hasXLabel || undefined}
      data-scaffolding={scaffolding}
      data-zoomable={zoomable || undefined}
      data-tool={editor.toolArmed || viewport.marqueeArmed || undefined}
      data-expanded={expanded || undefined}
      data-hovered={hover != null ? "true" : undefined}
    >
      {hasYLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
      <Axis orientation="y" ticks={yAxisTicks} noLine={isTufte} className={styles.yAxis} />
      <div ref={plotAreaRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={[yLabel, xLabel].filter(Boolean).join(" vs ") || "Scatter plot"}
            onMouseLeave={handlePointLeave}
            {...editor.surfaceProps}
          >
            {/* Gridlines render in both hover and full modes (CSS controls
                opacity). In hover mode they fade in on point hover. */}
            {gridlineTicks.map((tick) => {
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
            })}

            {/* Lines (rendered first so points sit on top). */}
            {visibleSeries.map((s) => {
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
            {visibleSeries.map((s) =>
              s.showPoints === false ? null : (
                <ScatterPointsLayer
                  key={`points-${s.name}`}
                  series={s}
                  xPx={xPx}
                  yScale={yScale}
                  onPointHover={handlePointHover}
                  onPointLeave={handlePointLeave}
                  onPointActivate={handlePointActivate}
                />
              ),
            )}

            {editingEnabled || (annotations && annotations.length > 0) ? (
              <AnnotationsLayer
                annotations={editingEnabled ? editor.displayAnnotations : (annotations ?? [])}
                xPx={xPx}
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
              // Crosshair hairlines snap to the pixel grid; the point marker
              // itself stays unsnapped (data marks are never quantized).
              <Crosshair
                x={snapHairline(hover.cx)}
                y={snapHairline(hover.cy)}
                height={plotSize.height}
                xLabel={formatXValue(hover.datum.x)}
                yLabel={formatNumber(hover.datum.y)}
              />
            ) : null}
          </svg>
        ) : null}
        {(xTicks.offsetLabel || yTicks.offsetLabel) && !isTufte ? (
          // Shared-magnitude readout: tick labels show only the varying part,
          // this corner shows the factored-out offset once.
          <div className={styles.offsetReadout} aria-hidden="true">
            {yTicks.offsetLabel ? <div>{`y ${yTicks.offsetLabel}`}</div> : null}
            {xTicks.offsetLabel ? <div>{`x ${xTicks.offsetLabel}`}</div> : null}
          </div>
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
          // Inline note editor at the annotation's data anchor. The wrapper's
          // data-annotation makes the viewport ignore pointerdowns on it.
          <div
            className={styles.textEditWrap}
            style={{ left: xPx(editor.textEdit.anchor.x), top: yScale(editor.textEdit.anchor.y) }}
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

      {zoomable ? (
        <div className={styles.srOnly} aria-live="polite">
          {viewport.announcement}
        </div>
      ) : null}
    </div>
  );
});
