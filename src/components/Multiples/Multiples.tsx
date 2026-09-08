import type {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  RefAttributes,
} from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Axis,
  type AxisTick,
  type ChartScaffolding,
  FullscreenToggle,
  getTextMeasurer,
  maxLabelWidth,
  resolveTickFont,
  scaffoldStyles,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { useFullscreen } from "../../lib/useFullscreen";
import { axisTicksFor, columnCount, gridPlacement, type MultiplesDomain } from "./Multiples.math";
import styles from "./Multiples.module.css";

export type { ChartScaffolding } from "../../lib/chart";
export type { MultiplesDomain } from "./Multiples.math";

/** Which shared domains the panels are linked on. */
export type MultiplesLink = "x" | "y" | "both" | "none";

/** Where the axes are drawn: inside every panel, or once per row and column. */
export type MultiplesAxes = "each" | "outer";

/** What every panel receives: its place in the grid, the shared domains, the
 *  callbacks that report a zoom back so every panel follows, the scaffolding
 *  posture the grid wants, and the panel height. Spread the domains and the
 *  callbacks onto the chart's own props (`xDomain` / `onXDomainChange` on a
 *  Scatterplot or Histogram, `yDomain` / `onValueDomainChange` on a BarChart). */
export interface MultiplesShared {
  index: number;
  row: number;
  col: number;
  /** The shared x window when the grid links x; else undefined. */
  xDomain?: MultiplesDomain;
  /** The shared value domain when the grid links y; else undefined. */
  yDomain?: [number, number];
  /** Report an x zoom (`null` = reset). Inert unless x is linked. */
  onXDomainChange: (domain: MultiplesDomain | null) => void;
  /** Report a value-axis zoom (`null` = reset). Inert unless y is linked. */
  onValueDomainChange: (domain: [number, number] | null) => void;
  /** The posture the panel should render with: the grid's `scaffolding`, or
   *  `"minimal"` when the grid draws the axes itself (`axes="outer"`). */
  scaffolding: ChartScaffolding;
  /** The panel's chart height (px, or a CSS length); pass it as `height`. */
  height: number | string;
}

export interface MultiplesProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** One panel per item. */
  items: readonly T[];
  /** Renders a panel's chart. Spread `shared` onto the chart's domain props. */
  render: (item: T, shared: MultiplesShared) => ReactNode;
  /** The panel title, above each panel and aligned to its plot. */
  title?: (item: T, index: number) => ReactNode;
  /** A property of `T` to use as the title when `title` is not given. */
  titleKey?: keyof T;
  /** A fixed column count, or `"auto"` (default): as many panels of at least
   *  `minPanelWidth` as the container fits. Container-driven, via a
   *  ResizeObserver, so the grid reflows inside a sidebar or a split pane. */
  columns?: number | "auto";
  /** A fixed row count (auto layout only): the columns derive from it. */
  rows?: number;
  /** Smallest panel width the auto layout accepts. A number is px, a string
   *  any CSS length. Default `calc(var(--sf-unit) * 12)`. */
  minPanelWidth?: number | string;
  /** Panel chart height in px. Default six units (`calc(var(--sf-unit) * 6)`).
   *  Keep it at or above the chart's own minimum (a Scatterplot or Histogram
   *  holds a four-unit plot plus its axis row, about 5.5 units); below that
   *  the chart overflows its panel. */
  panelHeight?: number;
  /** Gap between panels in `--sf-unit` multiples. Default `1`. */
  gap?: number;
  /** Hairline dividers between panels, drawn in the gaps. Default `false`. */
  dividers?: boolean;
  /** Controlled shared x window. Pair with `onXDomainChange`. */
  xDomain?: MultiplesDomain;
  /** Initial shared x window (uncontrolled). */
  defaultXDomain?: MultiplesDomain;
  /** Fires when any panel zooms x (`null` = reset to each panel's own extent). */
  onXDomainChange?: (domain: MultiplesDomain | null) => void;
  /** Controlled shared value domain. Pair with `onYDomainChange`. */
  yDomain?: [number, number];
  /** Initial shared value domain (uncontrolled). */
  defaultYDomain?: [number, number];
  /** Fires when any panel zooms its value axis (`null` = reset). */
  onYDomainChange?: (domain: [number, number] | null) => void;
  /** Which domains the panels share and zoom together. Default `"x"`. */
  link?: MultiplesLink;
  /** `"each"` (default): every panel keeps its own axes. `"outer"`: the panels
   *  render without axes and the grid draws one x axis under each column and
   *  one y axis left of each row from the shared domains (an outer axis needs
   *  its domain known: given, or reported by a panel's zoom). */
  axes?: MultiplesAxes;
  /** Axis posture passed to the panels. Default `"hover"`. */
  scaffolding?: ChartScaffolding;
  /** A 1px border + padding wrapper so the grid reads as a framed panel. */
  frame?: boolean;
  /** Maximize-to-viewport toggle in the top-right corner; Escape exits. */
  fullscreen?: boolean;
  /** Root height. Default: the grid's natural height. */
  height?: number | string;
  /** Label under the outer x axes (`axes="outer"`). */
  xLabel?: string;
  /** Label left of the outer y axes (`axes="outer"`). */
  yLabel?: string;
}

/** A panel's plot rectangle relative to its panel element: where the chart's
 *  SVG sits once the chart has measured itself. */
interface PlotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_MIN_PANEL_WIDTH = "calc(var(--sf-unit) * 12)";
const DEFAULT_PANEL_HEIGHT = "calc(var(--sf-unit) * 6)";
/** How many frames to wait for a panel's chart to render its SVG. */
const MEASURE_RETRIES = 12;

/** Resolve a CSS length to px inside `el`, so a consumer's `--sf-unit`
 *  override is honoured (the useCollapse probe idiom). */
function resolvePx(el: HTMLElement, css: string): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;inline-size:${css};`;
  el.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  el.removeChild(probe);
  return px;
}

function samePlots(a: readonly (PlotRect | null)[], b: readonly (PlotRect | null)[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (!p || !q) {
      if (p !== q) return false;
      continue;
    }
    if (
      Math.abs(p.left - q.left) >= 0.5 ||
      Math.abs(p.top - q.top) >= 0.5 ||
      Math.abs(p.width - q.width) >= 0.5 ||
      Math.abs(p.height - q.height) >= 0.5
    ) {
      return false;
    }
  }
  return true;
}

function MultiplesInner<T>({
  forwardedRef: ref,
  ...props
}: MultiplesProps<T> & { forwardedRef: ForwardedRef<HTMLDivElement> }) {
  const {
    items,
    render,
    title,
    titleKey,
    columns = "auto",
    rows,
    minPanelWidth = DEFAULT_MIN_PANEL_WIDTH,
    panelHeight,
    gap = 1,
    dividers = false,
    xDomain: xDomainProp,
    defaultXDomain,
    onXDomainChange,
    yDomain: yDomainProp,
    defaultYDomain,
    onYDomainChange,
    link = "x",
    axes = "each",
    scaffolding = "hover",
    frame,
    fullscreen,
    height,
    xLabel,
    yLabel,
    className,
    style,
    ...rest
  } = props;
  const linkX = link === "x" || link === "both";
  const linkY = link === "y" || link === "both";
  const outer = axes === "outer";

  /* --- Shared domains: controlled or held here; a panel's zoom updates them. --- */
  const [xState, setXState] = useState<MultiplesDomain | undefined>(defaultXDomain);
  const [yState, setYState] = useState<[number, number] | undefined>(defaultYDomain);
  const xControlled = xDomainProp !== undefined;
  const yControlled = yDomainProp !== undefined;
  const sharedX = xControlled ? xDomainProp : xState;
  const sharedY = yControlled ? yDomainProp : yState;
  // A reset remounts the panels: a panel the user had zoomed on its own keeps
  // that window as internal state, and a remount is the one way to be sure
  // every panel returns to its full extent together.
  const [generation, setGeneration] = useState(0);

  const onXDomainChangeRef = useRef(onXDomainChange);
  onXDomainChangeRef.current = onXDomainChange;
  const onYDomainChangeRef = useRef(onYDomainChange);
  onYDomainChangeRef.current = onYDomainChange;

  const reportX = useCallback(
    (domain: MultiplesDomain | null) => {
      if (!linkX) return;
      if (!xControlled) setXState(domain ?? undefined);
      if (domain === null) setGeneration((g) => g + 1);
      onXDomainChangeRef.current?.(domain);
    },
    [linkX, xControlled],
  );
  const reportY = useCallback(
    (domain: [number, number] | null) => {
      if (!linkY) return;
      if (!yControlled) setYState(domain ?? undefined);
      if (domain === null) setGeneration((g) => g + 1);
      onYDomainChangeRef.current?.(domain);
    },
    [linkY, yControlled],
  );

  /* --- Container width → column count (auto layout). --- */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [gapPx, setGapPx] = useState(0);
  const [minPx, setMinPx] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const frameRef = useRef<number | null>(null);
  const minCss = typeof minPanelWidth === "number" ? `${minPanelWidth}px` : minPanelWidth;
  const gapCss = `calc(var(--sf-unit) * ${gap})`;

  const measureRoot = useCallback(() => {
    frameRef.current = null;
    const el = rootRef.current;
    if (!el) return;
    const w = el.clientWidth;
    setWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    setMinPx(resolvePx(el, minCss));
    setGapPx(resolvePx(el, gapCss));
  }, [minCss, gapCss]);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      roRef.current?.disconnect();
      roRef.current = null;
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      if (node && typeof ResizeObserver !== "undefined") {
        measureRoot();
        const ro = new ResizeObserver(() => {
          if (frameRef.current !== null) return;
          frameRef.current = requestAnimationFrame(measureRoot);
        });
        ro.observe(node);
        roRef.current = ro;
      }
    },
    [measureRoot, ref],
  );

  useEffect(
    () => () => {
      roRef.current?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const count = items.length;
  const cols = columnCount({ width, minPanelWidth: minPx, gap: gapPx, count, columns, rows });
  const placement = useMemo(() => gridPlacement(count, cols), [count, cols]);

  /* --- Fullscreen for the whole grid. --- */
  const { expanded, toggle } = useFullscreen({ ownerRef: rootRef });

  /* --- Where each panel's plot sits, for the outer axes and the title inset.
     Measured from the chart's SVG; charts render it once they have measured
     themselves, so the first pass may find nothing and retries a few frames. --- */
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [plots, setPlots] = useState<(PlotRect | null)[]>([]);
  const plotsRef = useRef(plots);
  plotsRef.current = plots;
  const measureFrameRef = useRef<number | null>(null);
  const retriesRef = useRef(0);

  const measurePlots = useCallback(() => {
    measureFrameRef.current = null;
    const grid = gridRef.current;
    if (!grid) return;
    const panels = grid.querySelectorAll<HTMLElement>("[data-panel]");
    const next: (PlotRect | null)[] = [];
    let missing = false;
    for (const panel of panels) {
      const svg = panel.querySelector('svg[role="img"]');
      const target = svg ?? panel.querySelector<HTMLElement>("[data-panel-body]");
      if (!svg) missing = true;
      if (!target) {
        next.push(null);
        continue;
      }
      const p = panel.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      next.push({ left: r.left - p.left, top: r.top - p.top, width: r.width, height: r.height });
    }
    if (!samePlots(plotsRef.current, next)) {
      plotsRef.current = next;
      setPlots(next);
    }
    if (missing && retriesRef.current < MEASURE_RETRIES) {
      retriesRef.current += 1;
      measureFrameRef.current = requestAnimationFrame(measurePlots);
    }
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (measureFrameRef.current !== null) return;
    measureFrameRef.current = requestAnimationFrame(measurePlots);
  }, [measurePlots]);

  // Measure on every commit that can move a plot (items, columns, sizes,
  // domains: a zoom can change a panel's own axis width), and again on the
  // next frame for charts that render their SVG after their own measure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the listed values are the triggers, not inputs
  useLayoutEffect(() => {
    retriesRef.current = 0;
    measurePlots();
    scheduleMeasure();
  }, [count, cols, sharedX, sharedY, generation, panelHeight, gap, axes, expanded, width]);

  // Panels resize when the grid does; the observer catches the chart's own
  // later layout changes (a measured axis column) as well.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(grid);
    for (const body of grid.querySelectorAll("[data-panel-body]")) ro.observe(body);
    for (const svg of grid.querySelectorAll('svg[role="img"]')) ro.observe(svg);
    return () => {
      ro.disconnect();
      if (measureFrameRef.current !== null) {
        cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = null;
      }
    };
  }, [scheduleMeasure, count, cols, generation]);

  /* --- Outer axes: one x axis per column (from the bottom panel), one y axis
     per row (from the first panel), ticks from the shared domains. --- */
  const measure = useMemo(() => getTextMeasurer(resolveTickFont(rootRef.current, "mono")), []);

  const xAxes = useMemo(() => {
    if (!outer || !sharedX) return new Map<number, { plot: PlotRect; ticks: AxisTick[] }>();
    const out = new Map<number, { plot: PlotRect; ticks: AxisTick[] }>();
    for (const cell of placement.cells) {
      if (!cell.lastInColumn) continue;
      const plot = plots[cell.index];
      if (!plot) continue;
      out.set(cell.col, { plot, ticks: axisTicksFor(sharedX, plot.width, "x") });
    }
    return out;
  }, [outer, sharedX, placement, plots]);

  const yAxes = useMemo(() => {
    if (!outer || !sharedY) return new Map<number, { plot: PlotRect; ticks: AxisTick[] }>();
    const out = new Map<number, { plot: PlotRect; ticks: AxisTick[] }>();
    for (const cell of placement.cells) {
      if (!cell.firstInRow) continue;
      const plot = plots[cell.index];
      if (!plot) continue;
      out.set(cell.row, { plot, ticks: axisTicksFor(sharedY, plot.height, "y") });
    }
    return out;
  }, [outer, sharedY, placement, plots]);

  const yAxisWidth = useMemo(() => {
    const labels: string[] = [];
    for (const axis of yAxes.values()) for (const t of axis.ticks) labels.push(t.label);
    return maxLabelWidth(labels, measure);
  }, [yAxes, measure]);

  /* --- Render --- */
  const panelHeightCss = panelHeight != null ? `${panelHeight}px` : DEFAULT_PANEL_HEIGHT;
  const rootStyle: CSSProperties = {
    ...style,
    ...(height != null && !expanded
      ? { blockSize: typeof height === "number" ? `${height}px` : height }
      : {}),
  };
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${outer ? "auto " : ""}repeat(${cols}, minmax(0, 1fr))`,
    gap: gapCss,
    "--multiples-gap": gapCss,
    ...(yAxisWidth > 0 ? { "--sf-axis-label-width": `${yAxisWidth}px` } : {}),
  } as CSSProperties;
  // Grid lines are 1-based; the outer y-axis column shifts the panels right.
  const colStart = (col: number) => col + (outer ? 2 : 1);
  const hasTitle = !!title || titleKey != null;
  const titleOf = (item: T, index: number): ReactNode =>
    title ? title(item, index) : titleKey != null ? String(item[titleKey]) : null;

  return (
    <div
      {...rest}
      ref={setRootRef}
      className={cx(
        styles.root,
        frame && scaffoldStyles.frame,
        expanded && scaffoldStyles.expanded,
        className,
      )}
      style={rootStyle}
      data-columns={cols}
      data-rows={placement.rows}
      data-link={link}
      data-axes={axes}
      data-scaffolding={scaffolding}
      data-frame={frame || undefined}
      data-expanded={expanded || undefined}
      data-zoomed={sharedX || sharedY ? "" : undefined}
    >
      {fullscreen ? <FullscreenToggle expanded={expanded} onToggle={toggle} /> : null}
      <div className={styles.frameGrid} data-outer={outer || undefined}>
        {outer && yLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
        <div ref={gridRef} className={styles.grid} style={gridStyle}>
          {placement.cells.map((cell) => {
            const item = items[cell.index] as T;
            const shared: MultiplesShared = {
              index: cell.index,
              row: cell.row,
              col: cell.col,
              xDomain: linkX ? sharedX : undefined,
              yDomain: linkY ? sharedY : undefined,
              onXDomainChange: reportX,
              onValueDomainChange: reportY,
              scaffolding: outer ? "minimal" : scaffolding,
              height: panelHeight ?? DEFAULT_PANEL_HEIGHT,
            };
            const plot = plots[cell.index];
            const yAxis = outer && cell.firstInRow ? yAxes.get(cell.row) : undefined;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: panels are positional; the generation remounts them on a reset
              <PanelFragment key={`${generation}-${cell.index}`}>
                {outer && cell.firstInRow ? (
                  <div
                    className={styles.yAxisCell}
                    data-axis-row={cell.row}
                    style={{ gridRow: cell.row + 1, gridColumn: 1 }}
                  >
                    {yAxis ? (
                      <Axis
                        orientation="y"
                        ticks={yAxis.ticks}
                        className={styles.outerAxis}
                        style={{ top: yAxis.plot.top, blockSize: yAxis.plot.height }}
                      />
                    ) : null}
                  </div>
                ) : null}
                <div
                  className={styles.panel}
                  data-panel=""
                  data-index={cell.index}
                  data-row={cell.row}
                  data-col={cell.col}
                  data-divider-col={
                    dividers && cell.col < cols - 1 && cell.index + 1 < count ? "" : undefined
                  }
                  data-divider-row={dividers && !cell.lastInColumn ? "" : undefined}
                  style={{ gridRow: cell.row + 1, gridColumn: colStart(cell.col) }}
                >
                  {hasTitle ? (
                    <div
                      className={styles.title}
                      style={plot && plot.left > 0 ? { paddingInlineStart: plot.left } : undefined}
                    >
                      {titleOf(item, cell.index)}
                    </div>
                  ) : null}
                  <div
                    className={styles.body}
                    data-panel-body=""
                    style={{ blockSize: panelHeightCss }}
                  >
                    {render(item, shared)}
                  </div>
                </div>
              </PanelFragment>
            );
          })}
          {outer
            ? placement.cells
                .filter((cell) => cell.lastInColumn)
                .map((cell) => {
                  const col = cell.col;
                  const xAxis = xAxes.get(col);
                  return (
                    <div
                      key={`axis-${cell.col}`}
                      className={styles.xAxisCell}
                      data-axis-col={col}
                      style={{ gridRow: placement.rows + 1, gridColumn: colStart(col) }}
                    >
                      {xAxis ? (
                        <Axis
                          orientation="x"
                          ticks={xAxis.ticks}
                          className={styles.outerAxis}
                          style={{ left: xAxis.plot.left, inlineSize: xAxis.plot.width }}
                        />
                      ) : null}
                    </div>
                  );
                })
            : null}
        </div>
        {outer && xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}
      </div>
    </div>
  );
}

/** A keyed pass-through, so a panel and its row's y-axis cell share one key. */
function PanelFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Tufte's small multiples: a grid of N panels of the same chart over
 * different slices, with shared scales and linked zoom, one title per panel,
 * and, with `axes="outer"`, the axes drawn once per row and column instead of
 * in every panel. A layout and coordination component: it renders the panels
 * the consumer gives it (a Scatterplot, BarChart, Histogram, any chart that
 * takes a domain and reports its zoom) and multiplies their value.
 *
 * Columns follow the container width (a ResizeObserver, no media queries), so
 * the grid reflows inside a sidebar or a split pane.
 */
export const Multiples = forwardRef<HTMLDivElement, MultiplesProps<unknown>>(
  function Multiples(props, ref) {
    return <MultiplesInner {...props} forwardedRef={ref} />;
  },
) as <T>(props: MultiplesProps<T> & RefAttributes<HTMLDivElement>) => ReactElement | null;
