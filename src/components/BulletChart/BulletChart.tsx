import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  Axis,
  type AxisTick,
  anchorRectFromPoint,
  ChartChrome,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  Crosshair,
  FullscreenToggle,
  formatNumber as formatAxisNumber,
  getTextMeasurer,
  maxLabelWidth,
  niceTicks,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  snapEdges,
  snapHairline,
  Tooltip,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { formatNumber } from "../../lib/format";
import {
  type BulletItem,
  type BulletTone,
  clamp,
  measureExtent,
  resolveDomain,
  rowGeometry,
  scalePosition,
  type Tier,
  targetDelta,
  tierIndexOf,
  tierSegments,
  unionDomain,
} from "./BulletChart.math";
import styles from "./BulletChart.module.css";

export type { ChartScaffolding } from "../../lib/chart";
export type { BulletItem, BulletTone } from "./BulletChart.math";

/** The datum a BulletChart emits on activate / selection: the row plus the
 *  scale it was drawn on and the tier its value falls in. */
export interface BulletDatum {
  index: number;
  label: string;
  sublabel?: string;
  value: number;
  target?: number;
  domain: [number, number];
  /** 0-based tier the value falls in, or null without ranges. */
  tier: number | null;
  tierCount: number;
}

export interface BulletChartProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps,
    ChartSelectionProps<BulletDatum> {
  /** One row per item, stacking as a panel. */
  items: BulletItem[];
  /** One scale for the whole panel, with a single axis below (or beside) it.
   *  Without it every row resolves its own scale (`item.domain`, else an
   *  auto-fit) and shows a compact scale of its own on hover. */
  domain?: [number, number];
  /** The measure bar's colour; a row's own `tone` wins. Default `"primary"`. */
  tone?: BulletTone;
  /** How the qualitative tiers are painted: densities of the house halftone
   *  dither (the poorest tier densest), or grey shades stepping lighter.
   *  Default `"dither"`. */
  rangeFill?: "dither" | "shade";
  /** Rows across the panel (default) or columns side by side. */
  orientation?: "horizontal" | "vertical";
  /** Row height on the unit grid: `sm` 1u, `md` 1.5u, `lg` 2u. Default `"md"`. */
  size?: "sm" | "md" | "lg";
  /** Print each value at the row's end in Swiss number formatting. Default `true`. */
  showValues?: boolean;
  /** Formats printed values (the readout, the tooltip, the crosshair). */
  valueFormat?: (value: number) => string;
  /** Component height. Default: the rows at their `size` (horizontal) or 8u
   *  (vertical). With a height the rows share it evenly. */
  height?: number | string;
  /** Fires on every value-axis zoom/pan (`zoomable` with a shared `domain`);
   *  `null` = the full range. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
  /** Click/Enter on a row, the drill-down hook. */
  onPointActivate?: (datum: BulletDatum) => void;
  renderTooltip?: (datum: BulletDatum) => ReactNode;
}

interface HoverState {
  index: number;
  rect: DOMRect;
  cx: number;
  cy: number;
}

interface Row {
  item: BulletItem;
  index: number;
  domain: [number, number];
  tiers: Tier[];
  tier: number | null;
}

const toneColor: Record<BulletTone, string> = {
  neutral: "var(--sf-color-fg)",
  primary: "var(--sf-color-primary)",
  success: "var(--sf-color-success)",
  warning: "var(--sf-color-warning)",
  danger: "var(--sf-color-danger)",
};

/** Halftone cells by tier rank: 50%, 25%, 12.5%, 6.25% and plain. */
const DITHER_BY_RANK: { size: number; dots: [number, number][] }[] = [
  {
    size: 2,
    dots: [
      [0, 0],
      [1, 1],
    ],
  },
  {
    size: 4,
    dots: [
      [0, 0],
      [2, 0],
      [1, 2],
      [3, 2],
    ],
  },
  {
    size: 4,
    dots: [
      [0, 0],
      [2, 2],
    ],
  },
  { size: 4, dots: [[0, 0]] },
  { size: 4, dots: [] },
];

const defaultValueFormat = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });

function defaultTooltip(d: BulletDatum, fmt: (v: number) => string): ReactNode {
  const delta = targetDelta(d.value, d.target);
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>
        {d.label}
        {d.sublabel ? ` ${d.sublabel}` : ""}
      </div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {fmt(d.value)}
        {d.target != null ? ` / ${fmt(d.target)}` : ""}
      </div>
      {delta?.pct != null ? (
        <div style={{ fontFamily: "var(--sf-font-mono)" }}>
          {delta.pct >= 0 ? "+" : ""}
          {formatNumber(delta.pct, { maximumFractionDigits: 1 })}% vs target
        </div>
      ) : null}
      {d.tier != null ? (
        <div>
          tier {d.tier + 1} of {d.tierCount}
        </div>
      ) : null}
    </>
  );
}

function rowKey(index: number, value: number): string {
  return `${index}:${value}`;
}

/**
 * A bullet graph (Stephen Few): a KPI as a thin measure bar over a thicker
 * band of qualitative tiers, with a target tick and optional comparative
 * ticks, one row per item. The gauge replacement: linear, dense, monochrome
 * except for the measure. One shared `domain` gives the panel a single axis
 * (zoomable, annotatable); without it each row has its own scale, shown on
 * hover. Extends `HTMLAttributes<HTMLDivElement>`, mixes in
 * `ChartScaffoldingProps` and `ChartSelectionProps`.
 */
export const BulletChart = forwardRef<HTMLDivElement, BulletChartProps>(function BulletChart(
  {
    items,
    domain,
    tone = "primary",
    rangeFill = "dither",
    orientation = "horizontal",
    size = "md",
    showValues = true,
    valueFormat = defaultValueFormat,
    xLabel,
    yLabel,
    height,
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
  const shared = domain != null;
  const n = items.length;
  const isTufte = scaffolding !== "full";
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<HoverState | null>(null);
  const measureText = getTextMeasurer(resolveTickFont(plotRef.current));
  const patternId = useId();
  const { selection, setSelection } = useChartSelection<BulletDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  // The panel's extent: the shared domain, or (for the scaffold's benefit
  // only) a union of the rows. Zoom exists only on a shared scale: a window
  // over five unrelated scales would mean nothing.
  const sharedExtent: [number, number] = useMemo(
    () => domain ?? unionDomain(items),
    [domain, items],
  );
  const zoomOn = !!zoomable && shared;
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable: zoomOn,
    annotations,
    onAnnotationsChange,
    value: {
      extent: sharedExtent,
      onDomainChange: onValueDomainChange,
      minSpan: Math.max((sharedExtent[1] - sharedExtent[0]) / 100, Number.EPSILON),
      zoomOutLimit,
      formatValue: formatAxisNumber,
      axis: horizontal ? "x" : "y",
    },
  });
  const viewDomain: [number, number] = zoomOn ? scaffold.viewport.domain : sharedExtent;

  // With the controls toolbar overlaid top-left, a row panel starts its rows
  // below it: a 2u inset, resolved to px through a CSS-sized probe (the same
  // unit the rows are sized in), so the toolbar sits in empty space. A toolbar
  // that wraps (the annotation tools on a narrow plot) is taller than 2u, so
  // the inset grows to its measured height plus a quarter unit.
  const insetRef = useRef<HTMLDivElement>(null);
  const [probePx, setProbePx] = useState(0);
  const insetOn = !!controls && horizontal;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the probe and the toolbar are re-measured when the plot resizes
  useLayoutEffect(() => {
    if (!insetOn) return;
    const unit2 = insetRef.current?.getBoundingClientRect().height ?? 0;
    const plotEl = plotRef.current;
    const toolbar = plotEl?.querySelector('[role="toolbar"]');
    let h = unit2;
    if (plotEl && toolbar) {
      const bottom = toolbar.getBoundingClientRect().bottom - plotEl.getBoundingClientRect().top;
      h = Math.max(unit2, bottom + unit2 / 8);
    }
    setProbePx((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
  }, [insetOn, plotSize.height, plotSize.width, scaffold.editingEnabled]);
  const inset = insetOn ? probePx : 0;

  // `along` is the value axis, `across` the rows' axis, whichever way round.
  const along = horizontal ? plotSize.width : plotSize.height;
  const across = horizontal ? plotSize.height : plotSize.width;
  const rowsLength = Math.max(0, across - inset);
  const geom = rowGeometry(rowsLength, n);

  const rows: Row[] = useMemo(
    () =>
      items.map((item, index) => {
        const dom = shared ? viewDomain : resolveDomain(item);
        const tiers = tierSegments(item.ranges, dom, item.goodDirection);
        return { item, index, domain: dom, tiers, tier: tierIndexOf(item.value, tiers) };
      }),
    [items, shared, viewDomain],
  );

  /** px along the value axis: left to right, or bottom to top. */
  const alongPx = (value: number, dom: [number, number]) =>
    horizontal ? scalePosition(value, dom, along) : along - scalePosition(value, dom, along);
  const rowCentre = (index: number) => inset + geom.step * (index + 0.5);

  // The panel axis (shared scale only): nice ticks at one per ~80px.
  const axisTicks: AxisTick[] = useMemo(() => {
    if (!shared || scaffolding === "minimal" || along <= 0) return [];
    const [d0, d1] = viewDomain;
    if (!(d1 > d0)) return [];
    return niceTicks(d0, d1, Math.max(2, Math.round(along / 80)))
      .filter((t) => t.value >= d0 && t.value <= d1)
      .map((t) => ({ label: t.label, position: (t.value - d0) / (d1 - d0), major: t.major }));
  }, [shared, scaffolding, along, viewDomain]);

  const axisWidth = useMemo(
    () =>
      horizontal
        ? 0
        : maxLabelWidth(
            axisTicks.map((t) => t.label),
            measureText,
          ),
    [horizontal, axisTicks, measureText],
  );

  // Data to px for annotations: on a horizontal panel x is the value and y a
  // fractional row index; on a vertical one x is the column index, y the value.
  const nRows = Math.max(1, n);
  const xToPx = (x: AnnotationX) =>
    horizontal ? alongPx(Number(x), viewDomain) : (Number(x) / nRows) * plotSize.width;
  const yToPx = (y: number) =>
    horizontal ? inset + (y / nRows) * rowsLength : alongPx(y, viewDomain);
  const invertAlong = (px: number) => {
    const [d0, d1] = viewDomain;
    return along > 0 ? d0 + (px / along) * (d1 - d0) : d0;
  };
  scaffold.invertRef.current = {
    xFromPx: (px) =>
      horizontal ? invertAlong(px) : plotSize.width > 0 ? (px / plotSize.width) * nRows : 0,
    yFromPx: (px) =>
      horizontal
        ? rowsLength > 0
          ? ((px - inset) / rowsLength) * nRows
          : 0
        : invertAlong(plotSize.height - px),
  };

  const datumOf = (row: Row): BulletDatum => ({
    index: row.index,
    label: row.item.label,
    sublabel: row.item.sublabel,
    value: row.item.value,
    target: row.item.target,
    domain: row.domain,
    tier: row.tier,
    tierCount: row.tiers.length,
  });

  /** The bar's end in plot px, the one anchor for tooltip and crosshair. */
  const barEnd = (row: Row): { x: number; y: number } => {
    const px = clamp(alongPx(row.item.value, row.domain), 0, Math.max(0, along));
    const c = rowCentre(row.index);
    return horizontal ? { x: px, y: c } : { x: c, y: px };
  };

  const handleEnter = (row: Row) => {
    const plotEl = plotRef.current;
    if (!plotEl) return;
    const { x, y } = barEnd(row);
    setHover({ index: row.index, rect: anchorRectFromPoint(plotEl, x, y), cx: x, cy: y });
  };
  const handleLeave = () => setHover(null);

  const activatable = !!onPointActivate || selectable;
  const handleActivate = (row: Row) => {
    const datum = datumOf(row);
    onPointActivate?.(datum);
    if (!selectable) return;
    const same =
      selection != null &&
      rowKey(selection.index, selection.value) === rowKey(datum.index, datum.value);
    setSelection(same ? null : datum);
  };
  const selectedKey = selection ? rowKey(selection.index, selection.value) : null;

  // The pinned popover's anchor, re-derived from the selected datum through
  // the live scales every render, so it tracks zoom / resize.
  const selectedRow = selectable && selection ? rows[selection.index] : undefined;
  const selectionPoint =
    selectedRow && selectedRow.item.value === selection?.value && along > 0 && across > 0
      ? barEnd(selectedRow)
      : null;

  const wrapperStyle: CSSProperties = {
    ...(axisWidth > 0 ? { "--sf-axis-label-width": `${axisWidth}px` } : {}),
    ...(insetOn ? { "--bullet-inset": `${inset}px` } : {}),
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };
  // Without a height the plot takes the rows at their size (or 8u vertically);
  // the labels and values columns share the same grid row and follow it.
  const plotStyle: CSSProperties | undefined =
    height == null && !scaffold.expanded
      ? {
          blockSize: horizontal
            ? `calc(var(--bullet-row) * ${nRows}${insetOn ? " + var(--bullet-inset, 0px)" : ""})`
            : "calc(var(--sf-unit) * 8)",
        }
      : undefined;
  const rowGridStyle: CSSProperties = horizontal
    ? { gridTemplateRows: `repeat(${nRows}, minmax(0, 1fr))` }
    : { gridTemplateColumns: `repeat(${nRows}, minmax(0, 1fr))` };

  const tooltip = renderTooltip ?? ((d: BulletDatum) => defaultTooltip(d, valueFormat));

  /** A rect from along/across extents, whichever way the panel runs. */
  const rectOf = (a0: number, a1: number, b0: number, b1: number) => {
    const aMin = Math.min(a0, a1);
    const aMax = Math.max(a0, a1);
    return horizontal
      ? { x: aMin, y: b0, width: aMax - aMin, height: b1 - b0 }
      : { x: b0, y: aMin, width: b1 - b0, height: aMax - aMin };
  };

  const ariaLabel =
    [horizontal ? xLabel : yLabel, "bullet chart"].filter(Boolean).join(", ") || "Bullet chart";

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
      data-size={size}
      data-shared={shared || undefined}
      data-range-fill={rangeFill}
      data-inset={insetOn || undefined}
      data-hovered={hover != null ? "true" : undefined}
    >
      {!horizontal && yLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
      {!horizontal && shared ? (
        <Axis orientation="y" ticks={axisTicks} noLine={isTufte} className={styles.yAxis} />
      ) : null}

      <div className={styles.labels} style={rowGridStyle}>
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; labels may repeat
          <div key={i} className={styles.label}>
            <span className={styles.labelText} title={item.label}>
              {item.label}
            </span>
            {item.sublabel ? <span className={styles.sublabel}>{item.sublabel}</span> : null}
          </div>
        ))}
      </div>

      <div ref={plotAreaRef} className={styles.plot} style={plotStyle}>
        <div ref={insetRef} className={styles.insetProbe} aria-hidden="true" />
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            {...scaffold.editor.surfaceProps}
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={ariaLabel}
            onMouseLeave={handleLeave}
          >
            {rangeFill === "dither" ? (
              <defs>
                {DITHER_BY_RANK.map((p, rank) => (
                  <pattern
                    // biome-ignore lint/suspicious/noArrayIndexKey: the rank is the identity
                    key={rank}
                    id={`${patternId}-r${rank}`}
                    patternUnits="userSpaceOnUse"
                    width={p.size}
                    height={p.size}
                  >
                    <rect width={p.size} height={p.size} className={styles.tierBase} />
                    {p.dots.map(([x, y]) => (
                      <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width={1}
                        height={1}
                        className={styles.ditherDot}
                      />
                    ))}
                  </pattern>
                ))}
              </defs>
            ) : null}

            {/* Gridlines on the shared scale; CSS fades them in hover mode. */}
            {shared && scaffolding !== "minimal"
              ? axisTicks.map((tick) => {
                  const p = horizontal
                    ? snapHairline(tick.position * plotSize.width)
                    : snapHairline((1 - tick.position) * plotSize.height);
                  return (
                    <line
                      key={`grid-${tick.label}-${tick.position}`}
                      x1={horizontal ? p : 0}
                      x2={horizontal ? p : plotSize.width}
                      y1={horizontal ? inset : p}
                      y2={horizontal ? plotSize.height : p}
                      className={cx(styles.gridline, tick.major && styles.gridlineMajor)}
                    />
                  );
                })
              : null}

            {rows.map((row) => {
              const { item, index, domain: dom, tiers } = row;
              const c = rowCentre(index);
              const band = snapEdges(c - geom.band / 2, c + geom.band / 2);
              const measure = snapEdges(c - geom.measure / 2, c + geom.measure / 2);
              const [m0, m1] = measureExtent(item.value, dom);
              const mRect = rectOf(alongPx(m0, dom), alongPx(m1, dom), measure.start, measure.end);
              const selected = selectedKey != null && rowKey(index, item.value) === selectedKey;
              const accent = toneColor[item.tone ?? tone];
              const hovered = hover?.index === index;
              const showScale =
                !shared && scaffolding !== "minimal" && (scaffolding === "full" || hovered);
              const hit = rectOf(0, along, c - geom.step / 2, c + geom.step / 2);
              const datum = datumOf(row);
              return (
                <g
                  key={rowKey(index, item.value)}
                  className={styles.row}
                  style={{ "--bullet-accent": accent } as CSSProperties}
                  data-row={index}
                >
                  {tiers.length === 0 ? (
                    <rect
                      {...rectOf(0, along, band.start, band.end)}
                      className={styles.tier}
                      data-rank={DITHER_BY_RANK.length - 1}
                      style={
                        rangeFill === "dither"
                          ? { fill: `url(#${patternId}-r${DITHER_BY_RANK.length - 1})` }
                          : undefined
                      }
                    />
                  ) : (
                    tiers.map((t) => {
                      const e = snapEdges(
                        Math.min(alongPx(t.from, dom), alongPx(t.to, dom)),
                        Math.max(alongPx(t.from, dom), alongPx(t.to, dom)),
                      );
                      const rank = Math.min(t.rank, DITHER_BY_RANK.length - 1);
                      return (
                        <rect
                          key={t.index}
                          {...rectOf(e.start, e.end, band.start, band.end)}
                          className={styles.tier}
                          data-rank={rank}
                          style={
                            rangeFill === "dither"
                              ? { fill: `url(#${patternId}-r${rank})` }
                              : undefined
                          }
                        />
                      );
                    })
                  )}

                  <rect
                    {...mRect}
                    className={styles.measure}
                    data-selected={selected || undefined}
                  />

                  {item.comparative?.map((v) => {
                    if (!Number.isFinite(v)) return null;
                    const p = snapHairline(clamp(alongPx(v, dom), 0, along));
                    const t = snapEdges(c - geom.band * 0.3, c + geom.band * 0.3);
                    return (
                      <rect
                        key={`cmp-${v}`}
                        {...rectOf(p - 0.5, p + 0.5, t.start, t.end)}
                        className={styles.comparative}
                        data-comparative=""
                      />
                    );
                  })}

                  {item.target != null && Number.isFinite(item.target)
                    ? (() => {
                        const p = snapHairline(clamp(alongPx(item.target, dom), 0, along), 2);
                        const t = snapEdges(c - geom.band * 0.45, c + geom.band * 0.45);
                        return (
                          <rect
                            {...rectOf(p - 1, p + 1, t.start, t.end)}
                            className={styles.target}
                            data-target=""
                          />
                        );
                      })()
                    : null}

                  {/* A row's own scale: tick marks at the band's far edge and
                      the scale's end printed inside the last tier. */}
                  {showScale && along > 0
                    ? (() => {
                        const [d0, d1] = dom;
                        const ticks = niceTicks(d0, d1, Math.max(2, Math.round(along / 80))).filter(
                          (t) => t.value >= d0 && t.value <= d1,
                        );
                        return (
                          <g className={styles.rowScale} data-row-scale="">
                            {ticks.map((t) => {
                              const p = snapHairline(alongPx(t.value, dom));
                              return (
                                <rect
                                  key={`tick-${t.value}`}
                                  {...rectOf(p - 0.5, p + 0.5, band.end - 3, band.end)}
                                  className={styles.rowTick}
                                />
                              );
                            })}
                            <text
                              x={horizontal ? along - 3 : c}
                              y={horizontal ? c + 3.5 : 10}
                              textAnchor={horizontal ? "end" : "middle"}
                              className={styles.rowScaleLabel}
                            >
                              {formatAxisNumber(d1)}
                            </text>
                          </g>
                        );
                      })()
                    : null}

                  {/* The row's hit target and its accessible control: a
                      transparent rect the height of the row. */}
                  {/* biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback */}
                  <rect
                    {...hit}
                    className={styles.hit}
                    data-chart-mark=""
                    data-row-hit=""
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.label}: ${valueFormat(item.value)}${item.target != null ? ` of ${valueFormat(item.target)}` : ""}`}
                    data-activatable={activatable ? "" : undefined}
                    onPointerEnter={() => handleEnter(row)}
                    onPointerLeave={handleLeave}
                    onFocus={() => handleEnter(row)}
                    onBlur={handleLeave}
                    onClick={activatable ? () => handleActivate(row) : undefined}
                    onKeyDown={
                      activatable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleActivate(row);
                            }
                          }
                        : undefined
                    }
                  >
                    <title>
                      {datum.label}: {valueFormat(datum.value)}
                    </title>
                  </rect>
                </g>
              );
            })}

            {shared && isTufte && hover
              ? (() => {
                  const v = rows[hover.index]?.item.value;
                  return v == null ? null : (
                    <Crosshair
                      x={hover.cx}
                      y={hover.cy}
                      height={plotSize.height}
                      axes={horizontal ? "x" : "y"}
                      xLabel={horizontal ? valueFormat(v) : undefined}
                      yLabel={horizontal ? undefined : valueFormat(v)}
                    />
                  );
                })()
              : null}

            {shared && (scaffold.editingEnabled || (annotations && annotations.length > 0)) ? (
              <g transform={inset > 0 ? `translate(0 ${inset})` : undefined}>
                <AnnotationsLayer
                  annotations={
                    scaffold.editingEnabled
                      ? scaffold.editor.displayAnnotations
                      : (annotations ?? [])
                  }
                  xPx={xToPx}
                  yPx={(y) => yToPx(y) - inset}
                  width={plotSize.width}
                  height={plotSize.height - inset}
                  formatXDelta={(a, b) =>
                    horizontal
                      ? formatAxisNumber(Math.abs(Number(b) - Number(a)))
                      : `${Math.abs(Number(b) - Number(a)).toFixed(1)} rows`
                  }
                  formatY={(y) => (horizontal ? `${y.toFixed(1)} rows` : formatAxisNumber(y))}
                  editing={scaffold.editor.layerEditing}
                />
              </g>
            ) : null}

            {scaffold.viewport.marquee
              ? (() => {
                  const [f0, f1] = scaffold.viewport.marquee;
                  const lo = Math.min(f0, f1);
                  const hi = Math.max(f0, f1);
                  const r = horizontal
                    ? {
                        x: lo * plotSize.width,
                        y: 0,
                        width: (hi - lo) * plotSize.width,
                        height: plotSize.height,
                      }
                    : {
                        x: 0,
                        y: (1 - hi) * plotSize.height,
                        width: plotSize.width,
                        height: (hi - lo) * plotSize.height,
                      };
                  return <rect {...r} className={scaffoldStyles.marquee} />;
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

      {showValues ? (
        <div className={styles.values} style={rowGridStyle}>
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <div key={i} className={styles.value}>
              {valueFormat(item.value)}
            </div>
          ))}
        </div>
      ) : null}

      {horizontal && shared ? (
        <Axis orientation="x" ticks={axisTicks} noLine={isTufte} className={styles.xAxis} />
      ) : null}
      {horizontal && xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover && rows[hover.index] ? tooltip(datumOf(rows[hover.index] as Row)) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection ? (renderSelection ?? tooltip)(selection) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
