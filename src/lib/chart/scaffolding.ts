/** Shared prop surface for the interactive 2D-chart scaffolding (issue #35).
 *
 *  Every Cartesian data chart (Scatterplot, CandlestickChart, BarChart,
 *  BridgeChart, Heatmap) mixes this in so the affordances — frame, fullscreen,
 *  a controls toolbar, zoom, data-anchored annotations, axis labels and axis
 *  posture — are one identical set, defined once, that can't drift apart chart
 *  by chart. Pieces that don't map to a chart's geometry are documented no-ops,
 *  not exceptions: on a categorical chart there is no continuous *x* to window,
 *  so `zoomable` there windows the continuous *value* axis instead.
 *
 *  The per-chart domain-change callback (`onXDomainChange` / `onValueDomainChange`)
 *  is intentionally NOT part of this mixin: what gets windowed — an x domain that
 *  may be dates, or a numeric value domain — is chart-specific, so each chart
 *  declares its own, correctly typed.
 */

import type { ChartAnnotation } from "./Annotations";

/** Axis + gridline posture, shared by every 2D chart:
 *   - `"minimal"`: Tufte idle — no axis scaffolding ever, inline labels only.
 *   - `"hover"` (default): minimal at rest; a nice-tick axis and gridlines fade
 *     in while the chart is hovered.
 *   - `"full"`: a traditional axis and gridlines are always drawn. */
export type ChartScaffolding = "minimal" | "hover" | "full";

export interface ChartScaffoldingProps {
  /** Interactive zoom/pan viewport. Where a chart has a continuous axis to
   *  window it does (Scatterplot/Candlestick zoom x; BarChart/BridgeChart/Heatmap
   *  zoom the continuous *value* axis). Wheel zooms at the cursor, drag pans,
   *  the arrow keys pan, `+`/`-` step-zoom, `0` resets; the toolbar adds a
   *  marquee "zoom to region". Default `false`. */
  zoomable?: boolean;
  /** Data-anchored overlays: `hline`/`vline`/`line`/`rect`/`text`/`measure`.
   *  Read-only unless `onAnnotationsChange` is also given. */
  annotations?: ChartAnnotation[];
  /** Enables annotation *editing* (together with `controls`): the toolbar shows
   *  the drawing tools and this fires on every commit (draw, move, delete). */
  onAnnotationsChange?: (annotations: ChartAnnotation[]) => void;
  /** On-chart toolbar overlaid top-left: the zoom cluster (when `zoomable`) and
   *  the annotation-tool palette (when `onAnnotationsChange`). Default `false`. */
  controls?: boolean;
  /** Maximize-to-viewport toggle in the top-right corner; Escape exits.
   *  Default `false`. */
  fullscreen?: boolean;
  /** A 1px border + padding wrapper so the chart reads as a framed panel.
   *  Default `false`. */
  frame?: boolean;
  /** Label along the category / independent axis. */
  xLabel?: string;
  /** Label along the value axis. */
  yLabel?: string;
  /** Axis + gridline posture. Default `"hover"`. */
  scaffolding?: ChartScaffolding;
}
