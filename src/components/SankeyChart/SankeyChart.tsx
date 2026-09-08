import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useEffect, useId, useMemo, useState } from "react";
import {
  anchorRectFromPoint,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  FullscreenToggle,
  getTextMeasurer,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  Tooltip,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { formatNumber } from "../../lib/format";
import {
  type SankeyAlign,
  type SankeyLayoutLink,
  type SankeyLayoutNode,
  type SankeyLink,
  type SankeyNode,
  type SankeySort,
  sankeyLayout,
  sankeyLinkMidpoint,
  sankeyLinkPath,
} from "./SankeyChart.math";
import styles from "./SankeyChart.module.css";

export type { ChartScaffolding } from "../../lib/chart";
export type { SankeyAlign, SankeyLink, SankeyNode, SankeySort } from "./SankeyChart.math";

/** How the ribbons are painted. */
export type SankeyLinkFill = "neutral" | "source" | "target" | "dither";

/** A node, as the chart reports it on hover, activate and selection. */
export interface SankeyNodeDatum {
  kind: "node";
  id: string;
  name: string;
  layer: number;
  /** Sum of incoming flow. */
  valueIn: number;
  /** Sum of outgoing flow. */
  valueOut: number;
  /** `max(valueIn, valueOut)`, the node's size. */
  value: number;
}

/** A link, as the chart reports it on hover, activate and selection. */
export interface SankeyLinkDatum {
  kind: "link";
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  value: number;
  /** This link's share of its source's outgoing flow (0..1). */
  shareOfSource: number;
  /** This link's share of its target's incoming flow (0..1). */
  shareOfTarget: number;
  /** The link closes a cycle (drawn, but outside the layering). */
  cyclic: boolean;
}

export type SankeyDatum = SankeyNodeDatum | SankeyLinkDatum;

function nodeDatum(n: SankeyLayoutNode): SankeyNodeDatum {
  return {
    kind: "node",
    id: n.id,
    name: n.name,
    layer: n.layer,
    valueIn: n.valueIn,
    valueOut: n.valueOut,
    value: n.value,
  };
}

function linkDatum(l: SankeyLayoutLink): SankeyLinkDatum {
  return {
    kind: "link",
    source: l.source.id,
    target: l.target.id,
    sourceName: l.source.name,
    targetName: l.target.name,
    value: l.value,
    shareOfSource: l.source.valueOut > 0 ? l.value / l.source.valueOut : 0,
    shareOfTarget: l.target.valueIn > 0 ? l.value / l.target.valueIn : 0,
    cyclic: l.cyclic,
  };
}

/** Stable identity of a mark across renders (the selection is a spread copy). */
function datumKey(d: SankeyDatum): string {
  return d.kind === "node" ? `n:${d.id}` : `l:${d.source}>${d.target}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function defaultTooltip(d: SankeyDatum, format: (v: number) => string): ReactNode {
  if (d.kind === "node") {
    return (
      <>
        <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>{d.name}</div>
        <div style={{ fontFamily: "var(--sf-font-mono)" }}>
          {d.valueIn > 0 ? `in ${format(d.valueIn)}` : null}
          {d.valueIn > 0 && d.valueOut > 0 ? " · " : null}
          {d.valueOut > 0 ? `out ${format(d.valueOut)}` : null}
        </div>
      </>
    );
  }
  return (
    <>
      <div style={{ fontWeight: "var(--sf-font-weight-semibold)" }}>
        {d.sourceName} → {d.targetName}
      </div>
      <div style={{ fontFamily: "var(--sf-font-mono)" }}>
        {format(d.value)} · {percent(d.shareOfSource)} of {d.sourceName}
      </div>
    </>
  );
}

export interface SankeyChartProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    Pick<ChartScaffoldingProps, "frame" | "fullscreen" | "scaffolding">,
    ChartSelectionProps<SankeyDatum> {
  /** The nodes. Unknown link ends are dropped with a dev warning. */
  nodes: SankeyNode[];
  /** The weighted flows. A link that closes a cycle is drawn (dashed) but
   *  takes no part in the layering; a dev warning names it. */
  links: SankeyLink[];
  /** Column alignment. `justify` (default) moves every sink to the last
   *  column; `left` / `right` pack toward one side; `center` pulls late
   *  sources up against their targets. */
  align?: SankeyAlign;
  /** Node (column) thickness in px. Default half a `--sf-unit` (12px). */
  nodeWidth?: number;
  /** Vertical gap between the nodes of one column in px. Default a third of
   *  a `--sf-unit` (8px). */
  nodePadding?: number;
  /** Node order within a column: `"auto"` (default) lets the relaxation
   *  reorder to untangle the ribbons, `"none"` keeps the input order, a
   *  comparator over the laid-out nodes fixes it. */
  sort?: SankeySort;
  /** Relaxation passes of the barycenter ordering. Default `6`. */
  iterations?: number;
  /** Ribbon paint: `neutral` (default, translucent ink), `source` / `target`
   *  (that node's colour), or `dither` (the house halftone field). */
  linkFill?: SankeyLinkFill;
  /** Node names beside the nodes: `"auto"` (default; outside the diagram on
   *  the first and last columns, to the right of a node elsewhere, measured,
   *  ellipsized and thinned so they never collide) or `"none"`. */
  labels?: "auto" | "none";
  /** Print each node's flow after its name. Default `false`; the `full`
   *  scaffolding posture prints it too. */
  showValues?: boolean;
  /** Formats printed and tooltip values. Default Swiss `formatNumber`. */
  valueFormat?: (value: number) => string;
  /** Component height. Default `calc(var(--sf-unit) * 14)`. */
  height?: number | string;
  /** Click / Enter on a node or a link. */
  onPointActivate?: (datum: SankeyDatum) => void;
  renderTooltip?: (datum: SankeyDatum) => ReactNode;
}

interface Hover {
  datum: SankeyDatum;
  rect: DOMRect;
}

interface PlacedLabel {
  node: SankeyLayoutNode;
  x: number;
  y: number;
  anchor: "start" | "end";
  name: string;
  value: string;
  title: string;
}

const LINE_HEIGHT = 16;
const LABEL_GAP = 6;

/**
 * Weighted flows between nodes in layers: a budget from revenue to line
 * items, fund flows between share classes and strategies, a funnel, an energy
 * balance. Nodes are columns sized by their flow; links are ribbons as thick
 * as their value. The layout is d3-sankey's, hand-rolled: layer by longest
 * path, order by barycenter relaxation, then resolve collisions.
 *
 * Neutral ink by default; colour only where it means something. Hovering a
 * node lights its incident ribbons and fades the rest. Mixes in the frame /
 * fullscreen / posture parts of the chart scaffolding (there is no continuous
 * axis to window) and click-to-freeze selection.
 *
 * `Flows` and `BridgeChart` read change along time; this reads flow between
 * categories.
 */
export const SankeyChart = forwardRef<HTMLDivElement, SankeyChartProps>(function SankeyChart(
  {
    nodes,
    links,
    align = "justify",
    nodeWidth = 12,
    nodePadding = 8,
    sort = "auto",
    iterations = 6,
    linkFill = "neutral",
    labels = "auto",
    showValues = false,
    valueFormat = formatNumber,
    height,
    scaffolding = "hover",
    frame,
    fullscreen,
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
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const patternId = `${useId()}-dither`;

  const { selection, setSelection } = useChartSelection<SankeyDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  // The shared scaffold for fullscreen and the posture attributes. There is no
  // continuous axis, so the viewport is inert (an unused unit extent).
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    value: { extent: [0, 1], minSpan: 1, formatValue: String },
  });

  const measureSans = getTextMeasurer(resolveTickFont(plotRef.current, "sans"));
  const measureMono = getTextMeasurer(resolveTickFont(plotRef.current, "mono"));
  const printValues = showValues || scaffolding === "full";

  // Outer margins reserve room for the first and last columns' labels: the
  // widest measured label, capped at a quarter of the plot so the diagram
  // keeps most of the width.
  const margins = useMemo(() => {
    if (labels === "none" || plotSize.width <= 0 || nodes.length === 0)
      return { left: 0, right: 0 };
    const probe = sankeyLayout(nodes, links, {
      width: 100,
      height: 100,
      nodeWidth: 1,
      nodePadding: 0,
      align,
      iterations: 0,
      sort: "none",
    });
    const widthOf = (n: SankeyLayoutNode) =>
      measureSans(n.name) + (printValues ? measureMono(valueFormat(n.value)) + LABEL_GAP : 0);
    const cap = plotSize.width * 0.25;
    const first = probe.layers[0] ?? [];
    const last = probe.layers.length > 1 ? (probe.layers[probe.layers.length - 1] ?? []) : [];
    const left = Math.min(cap, Math.max(0, ...first.map(widthOf)) + LABEL_GAP);
    const right = Math.min(cap, Math.max(0, ...last.map(widthOf)) + LABEL_GAP);
    return { left: Math.ceil(left), right: Math.ceil(right) };
  }, [
    labels,
    plotSize.width,
    nodes,
    links,
    align,
    measureSans,
    measureMono,
    printValues,
    valueFormat,
  ]);

  const layout = useMemo(
    () =>
      sankeyLayout(nodes, links, {
        width: Math.max(0, plotSize.width - margins.left - margins.right),
        height: plotSize.height,
        nodeWidth,
        nodePadding,
        align,
        iterations,
        sort,
      }),
    [
      nodes,
      links,
      plotSize.width,
      plotSize.height,
      margins,
      nodeWidth,
      nodePadding,
      align,
      iterations,
      sort,
    ],
  );
  const offsetX = margins.left;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && layout.warnings.length > 0) {
      console.warn(`SankeyChart: ${layout.warnings.join("; ")}`);
    }
  }, [layout.warnings]);

  // Labels: outside on the outer columns, to the right elsewhere; each one
  // measured and ellipsized to its room, then thinned per column so two never
  // overlap (the greedy pass keeps the bigger node when they would).
  const placedLabels = useMemo((): PlacedLabel[] => {
    if (labels === "none" || plotSize.width <= 0) return [];
    const out: PlacedLabel[] = [];
    const lastLayer = layout.layers.length - 1;
    layout.layers.forEach((column, ci) => {
      const nextColumn = layout.layers[ci + 1];
      const nextX0 = nextColumn?.[0]?.x0 ?? plotSize.width - offsetX;
      const ordered = [...column].sort((a, b) => b.value - a.value);
      const taken: { y0: number; y1: number }[] = [];
      for (const n of ordered) {
        const y = (n.y0 + n.y1) / 2;
        if (taken.some((t) => y > t.y0 - LINE_HEIGHT && y < t.y1 + LINE_HEIGHT)) continue;
        let x: number;
        let anchor: "start" | "end";
        let room: number;
        if (ci === 0 && lastLayer > 0) {
          x = offsetX + n.x0 - LABEL_GAP;
          anchor = "end";
          room = margins.left - LABEL_GAP;
        } else if (ci === lastLayer) {
          x = offsetX + n.x1 + LABEL_GAP;
          anchor = "start";
          room = margins.right - LABEL_GAP;
        } else {
          x = offsetX + n.x1 + LABEL_GAP;
          anchor = "start";
          room = nextX0 - n.x1 - 2 * LABEL_GAP;
        }
        const value = printValues ? valueFormat(n.value) : "";
        const valueWidth = value ? measureMono(value) + LABEL_GAP : 0;
        const nameRoom = room - valueWidth;
        if (nameRoom < measureSans("…")) continue;
        const name = fitText(n.name, nameRoom, measureSans);
        if (!name) continue;
        out.push({ node: n, x, y, anchor, name, value, title: n.name });
        taken.push({ y0: y, y1: y });
      }
    });
    return out;
  }, [
    labels,
    layout,
    plotSize.width,
    offsetX,
    margins,
    printValues,
    valueFormat,
    measureSans,
    measureMono,
  ]);

  const hoveredKey = hover ? datumKey(hover.datum) : null;
  const selectedKey = selection ? datumKey(selection) : null;
  const focusKey = hoveredKey ?? selectedKey;

  // Which marks light up: the focused node's incident links and neighbours,
  // or the focused link and its two ends. Everything else fades.
  const lit = useMemo(() => {
    if (!focusKey) return null;
    const set = new Set<string>([focusKey]);
    if (focusKey.startsWith("n:")) {
      const id = focusKey.slice(2);
      for (const l of layout.links) {
        if (l.source.id === id || l.target.id === id) {
          set.add(datumKey(linkDatum(l)));
          set.add(`n:${l.source.id}`);
          set.add(`n:${l.target.id}`);
        }
      }
    } else {
      const l = layout.links.find((x) => datumKey(linkDatum(x)) === focusKey);
      if (l) {
        set.add(`n:${l.source.id}`);
        set.add(`n:${l.target.id}`);
      }
    }
    return set;
  }, [focusKey, layout.links]);

  const anchorOf = (d: SankeyDatum): { x: number; y: number } | null => {
    if (d.kind === "node") {
      const n = layout.nodes.find((x) => x.id === d.id);
      if (!n) return null;
      return { x: offsetX + (n.x0 + n.x1) / 2, y: (n.y0 + n.y1) / 2 };
    }
    const l = layout.links.find((x) => x.source.id === d.source && x.target.id === d.target);
    if (!l) return null;
    const m = sankeyLinkMidpoint(l);
    return { x: offsetX + m.x, y: m.y };
  };

  const hoverAt = (d: SankeyDatum) => {
    const plotEl = plotRef.current;
    const p = anchorOf(d);
    if (!plotEl || !p) return;
    setHover({ datum: d, rect: anchorRectFromPoint(plotEl, p.x, p.y) });
  };
  const handleLeave = () => setHover(null);

  const activatable = !!onPointActivate || selectable;
  const activate = (d: SankeyDatum) => {
    onPointActivate?.(d);
    if (!selectable) return;
    const same = selection != null && datumKey(selection) === datumKey(d);
    setSelection(same ? null : d);
  };
  const onMarkKeyDown = (d: SankeyDatum) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(d);
    }
  };

  const selectionPoint = useMemo(() => {
    if (!selectable || !selection || plotSize.width <= 0 || plotSize.height <= 0) return null;
    return anchorOf(selection);
    // anchorOf reads the layout and margins, which are in the deps.
    // biome-ignore lint/correctness/useExhaustiveDependencies: anchorOf is a per-render closure over layout / offsetX
  }, [selectable, selection, layout, offsetX, plotSize.width, plotSize.height]);

  const tooltip = renderTooltip ?? ((d: SankeyDatum) => defaultTooltip(d, valueFormat));

  const wrapperStyle: CSSProperties = {
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  const markProps = (d: SankeyDatum, label: string) => ({
    "data-chart-mark": "" as const,
    "data-lit": lit ? (lit.has(datumKey(d)) ? "" : undefined) : undefined,
    "data-faded": lit && !lit.has(datumKey(d)) ? "" : undefined,
    "data-selected": selectedKey === datumKey(d) ? "" : undefined,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onPointerEnter: () => hoverAt(d),
    onPointerLeave: handleLeave,
    onFocus: () => hoverAt(d),
    onBlur: handleLeave,
    onClick: activatable ? () => activate(d) : undefined,
    onKeyDown: activatable ? onMarkKeyDown(d) : undefined,
  });

  // A ribbon's own colour, else its source's or target's under those fills.
  // Uncoloured ribbons stay neutral ink whatever the fill mode.
  const linkColor = (l: SankeyLayoutLink): string | undefined => {
    if (l.color) return l.color;
    if (linkFill === "source") return l.source.color;
    if (linkFill === "target") return l.target.color;
    return undefined;
  };

  return (
    <div
      {...rest}
      ref={ref}
      {...scaffold.rootData}
      className={cx(
        styles.root,
        frame && scaffoldStyles.frame,
        scaffold.expanded && scaffoldStyles.expanded,
        className,
      )}
      style={wrapperStyle}
      data-hovered={hover != null ? "true" : undefined}
      data-link-fill={linkFill}
    >
      <div ref={plotAreaRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 ? (
          <svg
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label="Flow diagram"
            onMouseLeave={handleLeave}
          >
            {linkFill === "dither" ? (
              <defs>
                <pattern id={patternId} patternUnits="userSpaceOnUse" width="4" height="4">
                  <rect width="1" height="1" className={styles.ditherDot} />
                  <rect x="2" y="2" width="1" height="1" className={styles.ditherDot} />
                </pattern>
              </defs>
            ) : null}
            <g transform={`translate(${offsetX} 0)`}>
              {/* Ribbons under the nodes. Stroked centre lines, as d3-sankey
                  draws them, so a pattern stroke gives the dither. */}
              {layout.links.map((l) => {
                const d = linkDatum(l);
                const color = linkColor(l);
                const stroke = color ?? (linkFill === "dither" ? `url(#${patternId})` : undefined);
                return (
                  <path
                    key={`${l.source.id}>${l.target.id}:${l.index}`}
                    d={sankeyLinkPath(l)}
                    className={cx(styles.link, l.cyclic && styles.linkCyclic)}
                    style={stroke ? { stroke } : undefined}
                    data-colored={color ? "" : undefined}
                    strokeWidth={Math.max(1, l.width)}
                    {...markProps(d, `${d.sourceName} to ${d.targetName}: ${valueFormat(d.value)}`)}
                  >
                    <title>
                      {d.sourceName} → {d.targetName}: {valueFormat(d.value)}
                    </title>
                  </path>
                );
              })}
              {layout.nodes.map((n) => {
                const d = nodeDatum(n);
                return (
                  <rect
                    key={n.id}
                    x={n.x0}
                    y={n.y0}
                    width={Math.max(1, n.x1 - n.x0)}
                    height={Math.max(1, n.y1 - n.y0)}
                    className={styles.node}
                    style={n.color ? { fill: n.color } : undefined}
                    {...markProps(d, `${n.name}: ${valueFormat(n.value)}`)}
                  >
                    <title>
                      {n.name}: {valueFormat(n.value)}
                    </title>
                  </rect>
                );
              })}
            </g>
            {placedLabels.map((p) => (
              <text
                key={p.node.id}
                x={p.x}
                y={p.y}
                textAnchor={p.anchor}
                dominantBaseline="central"
                className={styles.label}
                data-faded={lit && !lit.has(`n:${p.node.id}`) ? "" : undefined}
              >
                <title>{p.title}</title>
                <tspan>{p.name}</tspan>
                {p.value ? (
                  <tspan className={styles.labelValue} dx={LABEL_GAP}>
                    {p.value}
                  </tspan>
                ) : null}
              </text>
            ))}
          </svg>
        ) : null}
      </div>

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? tooltip(hover.datum) : null}
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

/** Ellipsize `text` to fit `room` px under `measure`; empty when even one
 *  character plus the ellipsis does not fit. */
function fitText(text: string, room: number, measure: (s: string) => number): string {
  if (measure(text) <= room) return text;
  const ell = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid) + ell) <= room) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo).trimEnd() + ell : "";
}
