/** Internal shared layer for chart components. Not re-exported from the
 *  package root — kept private so charting math stays an implementation
 *  detail of Scatterplot / BarChart / BridgeChart. */

export type { AxisOrientation, AxisProps, AxisTick } from "./Axis";
export { Axis } from "./Axis";
export type { CrosshairProps } from "./Crosshair";
export { Crosshair } from "./Crosshair";
export type { NumericTick } from "./numericTicks";
export { formatNumber, niceDomain, niceTicks } from "./numericTicks";
export type { BandScale } from "./scales";
export { bandScale, linearScale, timeScale } from "./scales";
export type { TooltipProps } from "./Tooltip";
export { Tooltip } from "./Tooltip";
