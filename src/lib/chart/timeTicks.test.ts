import { describe, expect, it } from "vitest";
import { formatTimeTick, pickTimeUnit, promotionLevel, startOfUnit, timeTicks } from "./timeTicks";

/** Local-time helper — tests must hold in any TZ, so all expected dates are
 *  built with the same local-time constructors the module uses. */
function d(y: number, mo = 0, day = 1, h = 0, mi = 0, s = 0): Date {
  return new Date(y, mo, day, h, mi, s);
}

describe("pickTimeUnit", () => {
  const WIDTH = 640; // → 8 ticks at the default 80px spacing

  it("walks the ladder as the span shrinks", () => {
    const year = 365.25 * 24 * 3600 * 1000;
    expect(pickTimeUnit(40 * year, WIDTH)).toEqual({ unit: "year", step: 5 });
    expect(pickTimeUnit(8 * year, WIDTH)).toEqual({ unit: "year", step: 1 });
    expect(pickTimeUnit(2 * year, WIDTH)).toEqual({ unit: "month", step: 3 });
    expect(pickTimeUnit((2 * year) / 3, WIDTH)).toEqual({ unit: "month", step: 1 });
    expect(pickTimeUnit(56 * 86_400_000, WIDTH)).toEqual({ unit: "week", step: 1 });
    expect(pickTimeUnit(8 * 86_400_000, WIDTH)).toEqual({ unit: "day", step: 1 });
    expect(pickTimeUnit(8 * 3_600_000, WIDTH)).toEqual({ unit: "hour", step: 1 });
    expect(pickTimeUnit(8 * 60_000, WIDTH)).toEqual({ unit: "minute", step: 1 });
    expect(pickTimeUnit(8_000, WIDTH)).toEqual({ unit: "second", step: 1 });
  });

  it("uses multiples between whole units", () => {
    expect(pickTimeUnit(2 * 3_600_000, WIDTH)).toEqual({ unit: "minute", step: 15 });
    expect(pickTimeUnit(48 * 3_600_000, WIDTH)).toEqual({ unit: "hour", step: 6 });
  });

  it("grows 1/2/5×10ⁿ year steps past the ladder", () => {
    const year = 365.25 * 24 * 3600 * 1000;
    // 900y/8 ticks → 112.5y raw step; the house niceStep rounds UP → 200.
    expect(pickTimeUnit(900 * year, WIDTH)).toEqual({ unit: "year", step: 200 });
  });

  it("adapts to plot width, not just span", () => {
    const span = 30 * 86_400_000;
    // Same month-long span: a narrow plot gets weekly ticks, a wide one
    // half-daily ones.
    expect(pickTimeUnit(span, 240).unit).toBe("week");
    expect(pickTimeUnit(span, 4000)).toEqual({ unit: "hour", step: 12 });
  });
});

describe("timeTicks calendar alignment", () => {
  it("daily ticks land on midnights", () => {
    const ticks = timeTicks(d(2024, 2, 3, 7).getTime(), d(2024, 2, 11, 19).getTime(), 640);
    expect(ticks.length).toBeGreaterThan(4);
    for (const t of ticks) {
      expect(t.date.getHours()).toBe(0);
      expect(t.date.getMinutes()).toBe(0);
    }
    expect(ticks[0]?.date.getTime()).toBe(d(2024, 2, 4).getTime());
  });

  it("15-minute ticks land on :00/:15/:30/:45", () => {
    const ticks = timeTicks(d(2024, 0, 1, 9, 7).getTime(), d(2024, 0, 1, 11, 2).getTime(), 640);
    for (const t of ticks) expect(t.date.getMinutes() % 15).toBe(0);
    expect(ticks[0]?.date.getTime()).toBe(d(2024, 0, 1, 9, 15).getTime());
  });

  it("stays calendar-aligned across a DST month (daily ticks all read as midnight)", () => {
    // Late March covers the European DST switch; late-October run covers the
    // US one. Whatever the host TZ, every tick must still be a local midnight.
    for (const [from, to] of [
      [d(2024, 2, 20), d(2024, 3, 5)],
      [d(2024, 9, 25), d(2024, 10, 10)],
    ] as const) {
      for (const t of timeTicks(from.getTime(), to.getTime(), 1400)) {
        expect(t.date.getHours()).toBe(0);
      }
    }
  });

  it("returns [] for degenerate domains", () => {
    expect(timeTicks(5, 5, 640)).toEqual([]);
    expect(timeTicks(10, 5, 640)).toEqual([]);
    expect(timeTicks(0, 1000, 0)).toEqual([]);
  });
});

describe("boundary promotion", () => {
  it("promotes month starts among daily ticks", () => {
    const ticks = timeTicks(d(2024, 2, 27).getTime(), d(2024, 3, 4).getTime(), 640);
    const first = ticks.find((t) => t.date.getDate() === 1);
    expect(first).toBeDefined();
    expect(first?.major).toBe(true);
    expect(first?.label).toBe(d(2024, 3, 1).toLocaleString(undefined, { month: "short" }));
    const plain = ticks.find((t) => t.date.getDate() === 29);
    expect(plain?.major).toBe(false);
  });

  it("promotes Jan 1 to a year label among monthly ticks", () => {
    const ticks = timeTicks(d(2023, 9, 15).getTime(), d(2024, 2, 15).getTime(), 640);
    const jan = ticks.find((t) => t.date.getMonth() === 0 && t.date.getDate() === 1);
    expect(jan?.label).toBe("2024");
    expect(jan?.major).toBe(true);
  });

  it("promotes midnight to a date label among hourly ticks", () => {
    const ticks = timeTicks(d(2024, 4, 1, 18).getTime(), d(2024, 4, 2, 6).getTime(), 640);
    const midnight = ticks.find((t) => t.date.getHours() === 0);
    expect(midnight?.major).toBe(true);
    expect(midnight?.label).toBe(
      d(2024, 4, 2).toLocaleString(undefined, { month: "short", day: "numeric" }),
    );
    const three = ticks.find((t) => t.date.getHours() === 3);
    expect(three?.major).toBe(false);
  });

  it("promotes decades among yearly ticks", () => {
    const ticks = timeTicks(d(2015).getTime(), d(2023).getTime(), 800);
    const decade = ticks.find((t) => t.date.getFullYear() === 2020);
    const plain = ticks.find((t) => t.date.getFullYear() === 2021);
    expect(decade?.major).toBe(true);
    expect(plain?.major).toBe(false);
  });
});

describe("promotionLevel / startOfUnit / formatTimeTick", () => {
  it("classifies boundaries by the largest starting unit", () => {
    expect(promotionLevel(d(2024))).toBe("year");
    expect(promotionLevel(d(2024, 5))).toBe("month");
    expect(promotionLevel(d(2024, 5, 12))).toBe("day");
    expect(promotionLevel(d(2024, 5, 12, 9))).toBe("hour");
    expect(promotionLevel(d(2024, 5, 12, 9, 30))).toBe("minute");
    expect(promotionLevel(d(2024, 5, 12, 9, 30, 7))).toBe("second");
  });

  it("startOfUnit floors to each unit", () => {
    const probe = d(2024, 5, 12, 9, 30, 7);
    expect(startOfUnit(probe, "day").getTime()).toBe(d(2024, 5, 12).getTime());
    expect(startOfUnit(probe, "month").getTime()).toBe(d(2024, 5).getTime());
    expect(startOfUnit(probe, "year").getTime()).toBe(d(2024).getTime());
    // Weeks start on Sunday.
    expect(startOfUnit(probe, "week").getDay()).toBe(0);
  });

  it("keeps every label level short", () => {
    const probe = d(2024, 5, 12, 9, 30, 7);
    for (const level of ["year", "month", "day", "hour", "minute"] as const) {
      expect(formatTimeTick(probe, level).length).toBeLessThanOrEqual(8);
    }
  });
});
