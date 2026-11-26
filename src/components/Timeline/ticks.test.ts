import { describe, expect, it } from "vitest";
import { isLabelled, labelStride, pickUnit } from "./ticks";

describe("labelStride", () => {
  it("prints every label when they have room", () => {
    // 10 hours over 800px: 80px per hour for a 40px label.
    expect(labelStride("hour", 80 * 24, 40)).toBe(1);
  });

  it("widens the stride until the labels clear each other", () => {
    // 10 hours over 326px (a phone): 32.6px per hour for a 40px label.
    expect(labelStride("hour", 32.6 * 24, 40)).toBe(2);
    expect(labelStride("hour", 10 * 24, 40)).toBe(6);
    expect(labelStride("month", 0.6, 30)).toBe(3);
  });

  it("stops at the last step of the ladder", () => {
    expect(labelStride("hour", 24, 400)).toBe(12);
  });
});

describe("isLabelled", () => {
  it("labels every tick at a stride of one", () => {
    expect(isLabelled(new Date(2026, 5, 4, 9), "hour", 1)).toBe(true);
  });

  it("counts hours from midnight", () => {
    expect(isLabelled(new Date(2026, 5, 4, 8), "hour", 2)).toBe(true);
    expect(isLabelled(new Date(2026, 5, 4, 9), "hour", 2)).toBe(false);
    expect(isLabelled(new Date(2026, 5, 4, 0), "hour", 12)).toBe(true);
    expect(isLabelled(new Date(2026, 5, 4, 18), "hour", 12)).toBe(false);
  });

  it("puts a seven-day stride on Mondays", () => {
    // 2026-06-01 is a Monday.
    expect(isLabelled(new Date(2026, 5, 1), "day", 7)).toBe(true);
    expect(isLabelled(new Date(2026, 5, 2), "day", 7)).toBe(false);
    expect(isLabelled(new Date(2026, 5, 8), "day", 7)).toBe(true);
    const fortnight = [new Date(2026, 5, 1), new Date(2026, 5, 8)].map((d) =>
      isLabelled(d, "day", 14),
    );
    expect(fortnight.filter(Boolean)).toHaveLength(1);
  });

  it("counts months from January and years from zero", () => {
    expect(isLabelled(new Date(2026, 0, 1), "month", 3)).toBe(true);
    expect(isLabelled(new Date(2026, 1, 1), "month", 3)).toBe(false);
    expect(isLabelled(new Date(2026, 3, 1), "month", 3)).toBe(true);
    expect(isLabelled(new Date(2030, 0, 1), "year", 5)).toBe(true);
    expect(isLabelled(new Date(2031, 0, 1), "year", 5)).toBe(false);
  });

  it("alternates on every second day", () => {
    const run = [1, 2, 3, 4].map((d) => isLabelled(new Date(2026, 5, d), "day", 2));
    expect(run[0]).not.toBe(run[1]);
    expect(run).toEqual([run[0], run[1], run[0], run[1]]);
  });
});

describe("pickUnit", () => {
  it("is the unit the stride is measured on", () => {
    expect(pickUnit(32.6 * 24)).toBe("hour");
  });
});
