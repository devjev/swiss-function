import { describe, expect, it } from "vitest";
import { resolveChartFormat } from "./chartFormat";

describe("resolveChartFormat", () => {
  it("prints values in the house Swiss formatting by default", () => {
    const f = resolveChartFormat({});
    expect(f.value(1284500)).toBe("1'284'500");
    expect(f.hasValueFormat).toBe(false);
  });

  it("takes a chart's own default when it has one", () => {
    const f = resolveChartFormat({}, (v) => `${Math.round(v * 100)}%`);
    expect(f.value(0.42)).toBe("42%");
  });

  it("lets the consumer's valueFormat win over the chart's default", () => {
    const f = resolveChartFormat({ valueFormat: (v) => `CHF ${v}` }, (v) => `${v}%`);
    expect(f.value(12)).toBe("CHF 12");
    expect(f.hasValueFormat).toBe(true);
  });

  it("keeps the chart's compact tick labels when nothing was asked for", () => {
    const f = resolveChartFormat({});
    expect(f.tick(1_500_000, "1.5M")).toBe("1.5M");
  });

  it("carries valueFormat into the ticks, so one prop retitles the whole chart", () => {
    const f = resolveChartFormat({ valueFormat: (v) => `${v} kg` });
    expect(f.tick(1_500_000, "1.5M")).toBe("1500000 kg");
  });

  it("lets tickFormat keep the axis short while values carry their units", () => {
    const f = resolveChartFormat({
      valueFormat: (v) => `CHF ${v}`,
      tickFormat: (v) => `${v / 1000}k`,
    });
    expect(f.value(2000)).toBe("CHF 2000");
    expect(f.tick(2000, "2k")).toBe("2k");
  });

  it("tells a tick formatter which axis it is printing", () => {
    const f = resolveChartFormat({ tickFormat: (v, axis) => `${axis}:${v}` });
    expect(f.tick(3, "3")).toBe("y:3");
    expect(f.tick(3, "3", "x")).toBe("x:3");
    expect(f.timeTick(3, "Feb")).toBe("x:3");
  });

  it("never prints a timestamp through valueFormat", () => {
    const f = resolveChartFormat({ valueFormat: (v) => `CHF ${v}` });
    expect(f.timeTick(1_769_904_000_000, "12 Feb")).toBe("12 Feb");
    const explicit = resolveChartFormat({
      tickFormat: (v: number) => new Date(v).getUTCFullYear().toString(),
    });
    expect(explicit.timeTick(Date.UTC(2026, 1, 12), "12 Feb")).toBe("2026");
  });

  it("passes category labels through, or through the consumer's formatter", () => {
    expect(resolveChartFormat({}).category("Equity", 0)).toBe("Equity");
    const f = resolveChartFormat({ categoryFormat: (l, i) => `${i + 1}. ${l}` });
    expect(f.category("Equity", 0)).toBe("1. Equity");
  });

  it("formats a series name separately from a category label", () => {
    expect(resolveChartFormat({}).series("Actual", 0)).toBe("Actual");
    const f = resolveChartFormat({
      categoryFormat: (l) => `cat:${l}`,
      seriesFormat: (n, i) => `s${i}:${n}`,
    });
    expect(f.category("Q1", 0)).toBe("cat:Q1");
    expect(f.series("Actual", 1)).toBe("s1:Actual");
  });

  it("leaves series names alone when only categories are formatted", () => {
    const f = resolveChartFormat({ categoryFormat: (l) => l.toUpperCase() });
    expect(f.series("Actual", 0)).toBe("Actual");
  });
});
