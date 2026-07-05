import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  bandScale,
  ChartChrome,
  type ChartScaffoldingProps,
  Crosshair,
  FullscreenToggle,
  formatNumber,
  linearScale,
  niceDomain,
  niceTicks,
  scaffoldStyles,
  Tooltip,
  useChartScaffold,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import styles from "./Flows.module.css";

export type { ChartScaffolding } from "../../lib/chart";

export type FlowX = number | string | Date;

/** The four fund-flow components of a period. Subscriptions/redemptions are
 *  magnitudes (≥0) drawn up/down; performance/fxEffect are signed (either
 *  direction). Any omitted component simply contributes no segment. */
export interface FlowComponents {
  /** Inflow (new money) — drawn upward. */
  subscriptions?: number;
  /** Outflow (money withdrawn), a magnitude — drawn downward. */
  redemptions?: number;
  /** Net market performance for the period — signed. */
  performance?: number;
  /** Currency-translation effect — signed. */
  fxEffect?: number;
}

export interface FlowPeriod extends FlowComponents {
  /** Period label / time. */
  x: FlowX;
  /** Opening AUM. The period's closing AUM is derived
   *  (`open + subscriptions − redemptions + performance + fxEffect`). */
  open: number;
}

export type FlowComponentKey = keyof FlowComponents;

/** Per-component fill overrides (any CSS color / token). */
export type FlowColors = Partial<Record<FlowComponentKey, string>>;

export interface FlowTooltipDatum {
  x: FlowX;
  period: FlowPeriod;
  /** Which flow component this segment is. */
  component: FlowComponentKey;
  label: string;
  /** The input value (magnitude for subs/redemptions, signed for perf/fx). */
  value: number;
  /** The signed amount applied to the running AUM. */
  delta: number;
  /** Running AUM after this component. */
  level: number;
}

interface FlowComponentMeta {
  key: FlowComponentKey;
  label: string;
  /** Applied to the input value to get the signed delta. */
  sign: 1 | -1;
  color: string;
}

// Reading order: flows first (subscriptions in, redemptions out), then the
// market effects (performance, fx). Fixed so the ribbon reads consistently.
const COMPONENTS: FlowComponentMeta[] = [
  { key: "subscriptions", label: "Subscriptions", sign: 1, color: "var(--sf-color-success)" },
  { key: "redemptions", label: "Redemptions", sign: -1, color: "var(--sf-color-danger)" },
  { key: "performance", label: "Performance", sign: 1, color: "var(--sf-color-primary)" },
  { key: "fxEffect", label: "FX effect", sign: 1, color: "var(--sf-color-warning)" },
];

interface FlowSegment {
  key: FlowComponentKey;
  label: string;
  color: string;
  value: number;
  delta: number;
  /** Running AUM before this component. */
  from: number;
  /** Running AUM after this component. */
  to: number;
}

interface ResolvedPeriod {
  period: FlowPeriod;
  label: string;
  open: number;
  close: number;
  segments: FlowSegment[];
}

function formatX(x: FlowX): string {
  return x instanceof Date
    ? x.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    : String(x);
}

/** Run each period's within-period waterfall, recording every segment's
 *  before/after AUM level. */
function resolvePeriods(periods: FlowPeriod[], colors: FlowColors | undefined): ResolvedPeriod[] {
  return periods.map((period) => {
    let level = period.open;
    const segments: FlowSegment[] = [];
    for (const meta of COMPONENTS) {
      const raw = period[meta.key];
      if (raw == null || raw === 0) continue;
      const delta = meta.sign * raw;
      const from = level;
      level += delta;
      segments.push({
        key: meta.key,
        label: meta.label,
        color: colors?.[meta.key] ?? meta.color,
        value: raw,
        delta,
        from,
        to: level,
      });
    }
    return { period, label: formatX(period.x), open: period.open, close: level, segments };
  });
}

function defaultTooltip(d: FlowTooltipDatum): ReactNode {
  const sign = d.delta >= 0 ? "+" : "−";
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>
        {formatX(d.x)} · {d.label}
      </div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {sign}
        {formatNumber(Math.abs(d.delta))} → {formatNumber(d.level)}
      </div>
    </>
  );
}

export interface FlowsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps {
  /** One entry per period, in chronological order. */
  periods: FlowPeriod[];
  /** AUM (value) range. Auto-fit across every open/close/step level when omitted. */
  yDomain?: [number, number];
  /** Component height. Default `calc(var(--sf-unit) * 12)`. */
  height?: number | string;
  /** Per-component fill overrides. */
  colors?: FlowColors;
  /** Dashed connectors tracing the ribbon (close→open, and between steps).
   *  Default `true`. */
  showConnectors?: boolean;
  /** Legend of the components present. Default `true`. */
  showLegend?: boolean;
  /** Fires on every value-axis (AUM) zoom/pan (`zoomable`); `null` = full range. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
  renderTooltip?: (datum: FlowTooltipDatum) => ReactNode;
}

export const Flows = forwardRef<HTMLDivElement, FlowsProps>(function Flows(
  {
    periods,
    yDomain,
    xLabel,
    yLabel,
    height,
    colors,
    showConnectors = true,
    showLegend = true,
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
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [hover, setHover] = useState<{
    datum: FlowTooltipDatum;
    rect: DOMRect;
    cx: number;
    cy: number;
  } | null>(null);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setPlotSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const resolved = useMemo(() => resolvePeriods(periods, colors), [periods, colors]);
  const categories = useMemo(() => resolved.map((r) => r.label), [resolved]);

  const resolvedYDomain: [number, number] = useMemo(() => {
    if (yDomain) return yDomain;
    const all: number[] = [];
    for (const r of resolved) {
      all.push(r.open, r.close);
      for (const s of r.segments) all.push(s.from, s.to);
    }
    return niceDomain(all);
  }, [resolved, yDomain]);

  // Shared scaffolding: fullscreen, annotation editor and value-axis (AUM) zoom
  // — the x axis is per-period (categorical), so the AUM axis windows (#35).
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
      .map((t) => ({ label: t.label, position: (t.value - yMin) / (yMax - yMin), major: t.major }));
  }, [viewYDomain, scaffolding]);

  const xAxisTicks: AxisTick[] = useMemo(() => {
    if (categories.length === 0 || plotSize.width <= 0) return [];
    return categories.map((c) => {
      const left = xBand.position(c) ?? 0;
      return { label: c, position: (left + xBand.bandwidth / 2) / plotSize.width, major: false };
    });
  }, [categories, xBand, plotSize.width]);

  const handleLeave = () => setHover(null);

  const wrapperStyle: CSSProperties = {
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  // Slot geometry within a period band.
  const slotWidthOf = (n: number) => (n > 0 ? xBand.bandwidth / n : xBand.bandwidth);
  const barLeftOf = (bandLeft: number, slotW: number, i: number) =>
    bandLeft + i * slotW + slotW * 0.12;
  const barRightOf = (bandLeft: number, slotW: number, i: number) =>
    bandLeft + i * slotW + slotW * 0.88;

  // The dashed ribbon: open marker → step links → close marker, then close→open
  // between periods. Computed inline (cheap; recomputes with the render's live
  // scales) rather than memoized on the per-render slot helpers.
  const connectors = ((): {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    open?: boolean;
  }[] => {
    if (!showConnectors) return [];
    const out: { key: string; x1: number; y1: number; x2: number; y2: number; open?: boolean }[] =
      [];
    resolved.forEach((rp, pi) => {
      const bandLeft = xBand.position(rp.label);
      if (bandLeft == null) return;
      const n = rp.segments.length;
      const slotW = slotWidthOf(n);
      // Open marker: dashed rule from the band edge to the first segment.
      if (n > 0) {
        out.push({
          key: `open-${pi}`,
          x1: bandLeft,
          y1: yScale(rp.open),
          x2: barLeftOf(bandLeft, slotW, 0),
          y2: yScale(rp.open),
          open: true,
        });
      }
      // Between consecutive steps, a rule at the shared level.
      for (let i = 0; i < n - 1; i++) {
        const seg = rp.segments[i];
        if (!seg) continue;
        out.push({
          key: `step-${pi}-${i}`,
          x1: barRightOf(bandLeft, slotW, i),
          y1: yScale(seg.to),
          x2: barLeftOf(bandLeft, slotW, i + 1),
          y2: yScale(seg.to),
        });
      }
      // Close marker: solid rule from the last segment to the band edge.
      out.push({
        key: `close-${pi}`,
        x1: n > 0 ? barRightOf(bandLeft, slotW, n - 1) : bandLeft,
        y1: yScale(rp.close),
        x2: bandLeft + xBand.bandwidth,
        y2: yScale(rp.close),
      });
      // Link this close to the next open.
      const next = resolved[pi + 1];
      if (next) {
        const nbl = xBand.position(next.label);
        if (nbl != null) {
          out.push({
            key: `link-${pi}`,
            x1: bandLeft + xBand.bandwidth,
            y1: yScale(rp.close),
            x2: nbl,
            y2: yScale(next.open),
          });
        }
      }
    });
    return out;
  })();

  // Which components actually appear (drives the legend).
  const presentComponents = useMemo(() => {
    const seen = new Set<FlowComponentKey>();
    for (const r of resolved) for (const s of r.segments) seen.add(s.key);
    return COMPONENTS.filter((c) => seen.has(c.key)).map((c) => ({
      ...c,
      color: colors?.[c.key] ?? c.color,
    }));
  }, [resolved, colors]);

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
      <div ref={plotRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            {...scaffold.editor.surfaceProps}
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={yLabel ? `${yLabel} fund flows` : "Fund flows"}
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

            {/* Ribbon connectors (drawn under the bars). */}
            {connectors.map((c) => (
              <line
                key={c.key}
                x1={c.x1}
                y1={c.y1}
                x2={c.x2}
                y2={c.y2}
                className={cx(styles.connector, c.open && styles.markerOpen)}
              />
            ))}

            {/* Per-period waterfall segments. */}
            {resolved.map((rp, pi) => {
              const bandLeft = xBand.position(rp.label);
              if (bandLeft == null) return null;
              const n = rp.segments.length;
              const slotW = slotWidthOf(n);
              const w = Math.max(1, slotW * 0.76);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: period labels can repeat (e.g. two "Jan"s across years); the index disambiguates.
                <g key={`period-${rp.label}-${pi}`}>
                  {rp.segments.map((s, i) => {
                    const x = barLeftOf(bandLeft, slotW, i);
                    const yA = yScale(s.to);
                    const yB = yScale(s.from);
                    const top = Math.min(yA, yB);
                    const h = Math.max(1, Math.abs(yA - yB));
                    const cx_ = x + w / 2;
                    const datum: FlowTooltipDatum = {
                      x: rp.period.x,
                      period: rp.period,
                      component: s.key,
                      label: s.label,
                      value: s.value,
                      delta: s.delta,
                      level: s.to,
                    };
                    const setHoverHere = (rect: DOMRect) =>
                      setHover({ datum, rect, cx: cx_, cy: top });
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
                      <rect
                        key={`${rp.label}-${s.key}`}
                        x={x}
                        y={top}
                        width={w}
                        height={h}
                        className={styles.segment}
                        style={{ fill: s.color }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${rp.label} ${s.label}: ${s.delta >= 0 ? "+" : "−"}${Math.abs(s.delta)}`}
                        onPointerEnter={(e) =>
                          setHoverHere(e.currentTarget.getBoundingClientRect())
                        }
                        onPointerLeave={handleLeave}
                        onFocus={(e) => setHoverHere(e.currentTarget.getBoundingClientRect())}
                        onBlur={handleLeave}
                      >
                        <title>
                          {rp.label} — {s.label}: {s.delta >= 0 ? "+" : "−"}
                          {Math.abs(s.delta)} (→ {s.to})
                        </title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}

            {isTufte && hover ? (
              <Crosshair
                x={hover.cx}
                y={hover.cy}
                height={plotSize.height}
                axes="y"
                yLabel={formatNumber(hover.datum.level)}
              />
            ) : null}

            {/* Data-anchored annotations (issue #35): x anchors to a fractional
                period index, y to the (zoomed) AUM scale. */}
            {scaffold.editingEnabled || (annotations && annotations.length > 0) ? (
              <AnnotationsLayer
                annotations={
                  scaffold.editingEnabled ? scaffold.editor.displayAnnotations : (annotations ?? [])
                }
                xPx={xToPx}
                yPx={yScale}
                width={plotSize.width}
                height={plotSize.height}
                formatXDelta={(a, b) => `${Math.abs(Number(b) - Number(a)).toFixed(1)} period`}
                formatY={formatNumber}
                editing={scaffold.editor.layerEditing}
              />
            ) : null}

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
      {showLegend && presentComponents.length > 0 ? (
        <div className={styles.legend}>
          {presentComponents.map((c) => (
            <span key={c.key} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              {c.label}
            </span>
          ))}
        </div>
      ) : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? renderTooltip(hover.datum) : null}
      </Tooltip>
    </div>
  );
});
