import { describe, expect, it } from "vitest";
import {
  formatDateByPrecision,
  formatParamsSummary,
  formatParamValue,
  isoWeek,
  paramValues,
  sameParamValue,
  type WidgetParam,
} from "./Widget.params";

describe("isoWeek", () => {
  it("follows ISO 8601 week numbering across year ends", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(new Date(2027, 0, 1))).toEqual({ year: 2026, week: 53 });
    expect(isoWeek(new Date(2024, 11, 30))).toEqual({ year: 2025, week: 1 });
    expect(isoWeek(new Date(2026, 8, 8))).toEqual({ year: 2026, week: 37 });
  });
});

describe("formatDateByPrecision", () => {
  const d = new Date(2026, 8, 8);
  it("prints the ISO form of each precision", () => {
    expect(formatDateByPrecision(d)).toBe("2026-09-08");
    expect(formatDateByPrecision(d, "week")).toBe("2026-W37");
    expect(formatDateByPrecision(d, "month")).toBe("2026-09");
    expect(formatDateByPrecision(d, "year")).toBe("2026");
  });
});

describe("formatParamValue", () => {
  it("prints an option's label, a Swiss number with unit, on/off, and empty when unset", () => {
    const select: WidgetParam = {
      id: "ccy",
      label: "Currency",
      type: "select",
      value: "chf",
      options: [{ value: "chf", label: "CHF" }, "USD"],
    };
    expect(formatParamValue(select)).toBe("CHF");
    expect(formatParamValue(select, "USD")).toBe("USD");
    expect(formatParamValue(select, "")).toBe("");
    const n: WidgetParam = {
      id: "n",
      label: "Limit",
      type: "number",
      value: 1284500,
      unit: "kCHF",
    };
    expect(formatParamValue(n)).toBe("1'284'500 kCHF");
    expect(formatParamValue(n, null)).toBe("");
    const b: WidgetParam = { id: "b", label: "Net", type: "boolean", value: true };
    expect(formatParamValue(b)).toBe("on");
    expect(formatParamValue(b, false)).toBe("off");
    const t: WidgetParam = { id: "t", label: "Note", type: "text", value: "hello" };
    expect(formatParamValue(t)).toBe("hello");
    const date: WidgetParam = {
      id: "m",
      label: "Month",
      type: "date",
      value: new Date(2026, 8, 1),
      precision: "month",
    };
    expect(formatParamValue(date)).toBe("2026-09");
    expect(formatParamValue(date, null)).toBe("");
  });
});

describe("formatParamsSummary / paramValues / sameParamValue", () => {
  it("joins the set values and maps ids to values", () => {
    const params: WidgetParam[] = [
      { id: "m", label: "Month", type: "date", value: new Date(2026, 8, 1), precision: "month" },
      { id: "ccy", label: "Currency", type: "select", value: "CHF", options: ["CHF", "USD"] },
      { id: "note", label: "Note", type: "text", value: "" },
    ];
    expect(formatParamsSummary(params)).toBe("2026-09 \u00b7 CHF");
    expect(paramValues(params)).toEqual({ m: params[0]?.value, ccy: "CHF", note: "" });
    expect(sameParamValue(new Date(2026, 0, 1), new Date(2026, 0, 1))).toBe(true);
    expect(sameParamValue(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
    expect(sameParamValue(null, new Date(2026, 0, 1))).toBe(false);
    expect(sameParamValue("a", "a")).toBe(true);
  });
});
