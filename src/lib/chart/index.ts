/** Internal shared layer for chart components. Not re-exported from the
 *  package root — kept private so charting math stays an implementation
 *  detail of Scatterplot / BarChart / BridgeChart. (Annotation/viewport
 *  *types* are re-exported by the chart components that accept them — the
 *  types are public API, the implementations are not.) */

export type {
  AnnotationPart,
  AnnotationsEditingProps,
  AnnotationsLayerProps,
  AnnotationX,
  ChartAnnotation,
} from "./Annotations";
export { AnnotationsLayer, formatDateDelta } from "./Annotations";
export type { AxisOrientation, AxisProps, AxisTick } from "./Axis";
export { Axis } from "./Axis";
export type { IndexedBar } from "./barIndex";
export { indexToX, xToIndex } from "./barIndex";
export type { ChartControlsProps } from "./ChartControls";
export { ChartControls } from "./ChartControls";
export type { CrosshairProps } from "./Crosshair";
export { Crosshair } from "./Crosshair";
export { lttb, minMaxDownsample, sliceRange } from "./downsample";
export type { AdaptiveTicks, NumericTick } from "./numericTicks";
export {
  adaptiveTicks,
  formatNumber,
  formatTickValue,
  niceDomain,
  niceTicks,
} from "./numericTicks";
export type { BandScale } from "./scales";
export { bandScale, invertLinear, linearScale, timeScale } from "./scales";
export type { TooltipProps } from "./Tooltip";
export { Tooltip } from "./Tooltip";
export type { TimeTick, TimeUnit } from "./timeTicks";
export {
  formatTimeTick,
  pickTimeUnit,
  promotionLevel,
  startOfUnit,
  timeTicks,
  unitRank,
} from "./timeTicks";
export type {
  AnnotationEditor,
  AnnotationTool,
  TextEditState,
  UseAnnotationEditorOptions,
} from "./useAnnotationEditor";
export {
  DRAW_THRESHOLD_PX,
  draftFromDrag,
  moveAnnotationPoint,
  translateAnnotation,
  useAnnotationEditor,
} from "./useAnnotationEditor";
export type { Domain, UseViewportOptions, Viewport } from "./useViewport";
export { clampDomain, useViewport, zoomDomain } from "./useViewport";
