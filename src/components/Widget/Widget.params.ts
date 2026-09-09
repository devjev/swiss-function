import { formatNumber } from "../../lib/format";
import type { PickerItem } from "../Picker";

/** A date param's granularity: the DatePicker precision it edits at, and the
 *  ISO form it prints in (`2026-09-08`, `2026-W37`, `2026-09`, `2026`). */
export type WidgetParamPrecision = "day" | "week" | "month" | "year";

/** What a param can hold. */
export type WidgetParamValue = string | number | boolean | Date | null;

interface WidgetParamBase {
  /** The key in the values map. */
  id: string;
  /** The row label in the settings table; the inline control's accessible name. */
  label: string;
}
export interface WidgetSelectParam extends WidgetParamBase {
  type: "select";
  value: string;
  options: PickerItem[];
}
export interface WidgetDateParam extends WidgetParamBase {
  type: "date";
  value: Date | null;
  precision?: WidgetParamPrecision;
  minDate?: Date;
  maxDate?: Date;
}
export interface WidgetNumberParam extends WidgetParamBase {
  type: "number";
  value: number | null;
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  slots?: number;
}
export interface WidgetTextParam extends WidgetParamBase {
  type: "text";
  value: string;
  placeholder?: string;
}
export interface WidgetBooleanParam extends WidgetParamBase {
  type: "boolean";
  value: boolean;
}

/** One input parameter of a widget: its editor is picked by `type`. */
export type WidgetParam =
  | WidgetSelectParam
  | WidgetDateParam
  | WidgetNumberParam
  | WidgetTextParam
  | WidgetBooleanParam;

/** The params' values keyed by id, the shape `onParamsChange` reports. */
export type WidgetParamValues = Record<string, WidgetParamValue>;

export function paramValues(params: readonly WidgetParam[]): WidgetParamValues {
  const out: WidgetParamValues = {};
  for (const p of params) out[p.id] = p.value;
  return out;
}

export function sameParamValue(a: WidgetParamValue, b: WidgetParamValue): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  return a === b;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** ISO 8601 week-numbering year and week of a (local) date. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** A date in ISO form at the given precision. */
export function formatDateByPrecision(date: Date, precision: WidgetParamPrecision = "day"): string {
  const y = date.getFullYear();
  switch (precision) {
    case "year":
      return String(y);
    case "month":
      return `${y}-${pad(date.getMonth() + 1)}`;
    case "week": {
      const w = isoWeek(date);
      return `${w.year}-W${pad(w.week)}`;
    }
    default:
      return `${y}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}

function optionLabel(options: readonly PickerItem[], value: string): string {
  for (const option of options) {
    if (typeof option === "string") {
      if (option === value) return option;
    } else if (option.value === value) {
      return String(option.label);
    }
  }
  return value;
}

/** A param's value as text, the way the header summary and the settings table
 *  print it: an option's label, an ISO date at the param's precision, a Swiss
 *  number with its unit, the text itself, on / off for a switch. Empty when
 *  unset. */
export function formatParamValue(
  param: WidgetParam,
  value: WidgetParamValue = param.value,
): string {
  switch (param.type) {
    case "select":
      return typeof value === "string" && value !== "" ? optionLabel(param.options, value) : "";
    case "date":
      return value instanceof Date ? formatDateByPrecision(value, param.precision) : "";
    case "number":
      return typeof value === "number"
        ? `${formatNumber(value, { decimals: param.decimals })}${param.unit ? ` ${param.unit}` : ""}`
        : "";
    case "text":
      return typeof value === "string" ? value : "";
    case "boolean":
      return value ? "on" : "off";
  }
}

/** The header summary: every set value, joined. */
export function formatParamsSummary(params: readonly WidgetParam[]): string {
  return params
    .map((p) => formatParamValue(p))
    .filter(Boolean)
    .join(" \u00b7 ");
}
