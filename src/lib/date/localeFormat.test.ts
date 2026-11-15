import { describe, expect, it } from "vitest";
import { formatLocaleDate } from "./localeFormat";

describe("formatLocaleDate", () => {
  const dates = [new Date(2026, 0, 1), new Date(2026, 6, 15, 13, 45), new Date(1999, 11, 31)];

  it("matches toLocaleDateString for date options and for none", () => {
    const optionSets: (Intl.DateTimeFormatOptions | undefined)[] = [
      undefined,
      { month: "short", day: "numeric" },
      { month: "short", year: "2-digit" },
      { month: "long", year: "numeric" },
      { weekday: "short" },
    ];
    for (const options of optionSets) {
      for (const d of dates) {
        expect(formatLocaleDate(d, options)).toBe(d.toLocaleDateString(undefined, options));
      }
    }
  });

  it("matches toLocaleString when the options name a date field", () => {
    for (const d of dates) {
      const options = { month: "short", day: "numeric" } as const;
      expect(formatLocaleDate(d, options)).toBe(d.toLocaleString(undefined, options));
    }
  });

  it("returns Invalid Date for an invalid date instead of throwing", () => {
    const bad = new Date(Number.NaN);
    expect(formatLocaleDate(bad, { month: "short" })).toBe(
      bad.toLocaleDateString(undefined, { month: "short" }),
    );
  });
});
