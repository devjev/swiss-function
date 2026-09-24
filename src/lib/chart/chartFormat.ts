/** One way to say how a chart prints its numbers and its labels (issue #97).
 *
 *  A chart prints text in four different jobs, and they want different things:
 *  a *value* the reader is meant to take away (a tooltip figure, a printed bar
 *  label, the accessible name) wants to be exact and in the reader's own units;
 *  an *axis tick* wants to be short enough that a row of them fits; a *category*
 *  label names a position on the chart; a *series* name names one of the
 *  datasets drawn across those positions. So the mixin has one function per
 *  job, and a chart routes each of its printed strings through the matching
 *  one.
 *
 *  Defaults, when the consumer sets nothing: values print in the house Swiss
 *  formatting (`1'284'500`), ticks keep whatever compact or calendar label the
 *  chart computed for them, and categories and series names print as supplied.
 */

import { formatNumber } from "../format";

/** Which axis a tick belongs to. A chart with one value axis always says
 *  which of the two it is, so a `tickFormat` can tell them apart. */
export type ChartAxis = "x" | "y";

export interface ChartFormatProps {
  /** Formats every number the chart prints **as data**: tooltip and pinned-popover
   *  figures, printed value labels, the accessible name of a mark. Use it for
   *  units and currency (`(v) => `CHF ${formatNumber(v)}``). Default: the house
   *  Swiss `formatNumber` (`1'284'500`). */
  valueFormat?: (value: number) => string;
  /** Formats the **axis tick labels**. Receives the tick's value and which axis
   *  it belongs to, so one function can retitle both on a chart that has two
   *  continuous axes. Default: `valueFormat` when that is given, else the
   *  chart's own compact labels (`1.5M`), which is what keeps a crowded axis
   *  readable. Set it explicitly to keep the axis short while `valueFormat`
   *  carries units into the tooltips. On a time axis it receives the timestamp
   *  in ms, and leaving it unset keeps the calendar ladder. */
  tickFormat?: (value: number, axis: ChartAxis) => string;
  /** Formats a **category label** before it is measured and drawn: a label that
   *  names a *position* on the chart, which is a band on the category axis, a
   *  node, a cell, a slice, an item row or a column header. Receives the label
   *  and its index. Default: the label as supplied. */
  categoryFormat?: (label: string, index: number) => string;
  /** Formats a **series name**: a label that names a *dataset* drawn across
   *  those positions, which is whatever came in through the chart's `series`
   *  prop, wherever the chart prints it (a legend entry, a tooltip line, a
   *  mark's accessible name). Receives the name and its index in `series`.
   *  Default: the name as supplied. */
  seriesFormat?: (name: string, index: number) => string;
}

/** The resolved formatters a chart actually calls. */
export interface ChartFormat {
  /** A number printed as data. */
  value: (value: number) => string;
  /** A numeric axis tick. `fallback` is the chart's own computed label, kept
   *  whenever the consumer asked for nothing; `axis` says which axis it is. */
  tick: (value: number, fallback: string, axis?: ChartAxis) => string;
  /** A time-axis tick. Unlike {@link tick} this never falls back to
   *  `valueFormat`, which would print a timestamp as a plain number. */
  timeTick: (value: number, fallback: string, axis?: ChartAxis) => string;
  /** A category label: the name of a position on the chart. */
  category: (label: string, index: number) => string;
  /** A series name: the name of a dataset drawn across those positions. */
  series: (name: string, index: number) => string;
  /** True when the consumer supplied a value formatter, for the charts that
   *  print a value only once it means something in their own units. */
  hasValueFormat: boolean;
}

/**
 * Resolve the mixin into the four functions a chart calls. `defaultValue`
 * overrides the house default for charts whose numbers are not plain counts
 * (a percentage axis, say) and is itself overridden by the consumer's
 * `valueFormat`.
 */
export function resolveChartFormat(
  props: ChartFormatProps,
  defaultValue: (value: number) => string = formatNumber,
): ChartFormat {
  const { valueFormat, tickFormat, categoryFormat, seriesFormat } = props;
  const value = valueFormat ?? defaultValue;
  return {
    value,
    tick: (v, fallback, axis = "y") =>
      tickFormat ? tickFormat(v, axis) : valueFormat ? valueFormat(v) : fallback,
    timeTick: (v, fallback, axis = "x") => (tickFormat ? tickFormat(v, axis) : fallback),
    category: categoryFormat ? (label, i) => categoryFormat(label, i) : (label) => label,
    series: seriesFormat ? (name, i) => seriesFormat(name, i) : (name) => name,
    hasValueFormat: valueFormat !== undefined,
  };
}
