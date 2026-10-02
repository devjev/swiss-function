import { describe, expect, it } from "vitest";
import { fractionDigits, startTotal, toNumeric } from "./totals";
import type { TotalAggregate } from "./types";

/** Feed a whole column through an accumulator, the way DataTable does. */
function total(kind: TotalAggregate, values: unknown[], decimals?: number): string {
  const acc = startTotal(kind);
  for (const v of values) acc.add(v);
  return acc.text(decimals);
}

describe("startTotal", () => {
  it("sums in Swiss typography", () => {
    expect(total("sum", [1_000_000, 284_500, 12])).toBe("1'284'512");
  });

  it("keeps a sum at the precision of the values it was fed", () => {
    // Float noise (0.1 + 0.2 = 0.30000000000000004) never reaches the screen.
    expect(total("sum", [0.1, 0.2])).toBe("0.3");
    expect(total("sum", [1.5, 2.25])).toBe("3.75");
    expect(total("sum", [1, 2])).toBe("3");
  });

  it("takes a declared precision over the values'", () => {
    expect(total("sum", [1, 2], 2)).toBe("3.00");
    expect(total("sum", [1.555, 2], 1)).toBe("3.6");
  });

  it("gives an average at least two decimals", () => {
    expect(total("avg", [1, 2])).toBe("1.5");
    expect(total("avg", [1, 1, 2])).toBe("1.33");
    // A column declaring 0 decimals still gets a readable average.
    expect(total("avg", [1, 2], 0)).toBe("1.50");
    expect(total("avg", [1, 2], 3)).toBe("1.500");
  });

  it("takes the extremes", () => {
    expect(total("min", [4, -2, 9])).toBe("-2");
    expect(total("max", [4, -2, 9])).toBe("9");
  });

  it("counts the rows that carry a value, as a spreadsheet's COUNTA does", () => {
    // A zero and a false flag are values; a blank, a null and a missing one are not.
    expect(total("count", ["a", "", null, undefined, "b", 0, false])).toBe("4");
  });

  it("counts distinct values", () => {
    expect(total("countUnique", ["eur", "chf", "eur", null, "usd"])).toBe("3");
  });

  it("counts a value of any type, a number apart from its string", () => {
    expect(total("countUnique", [1, "1", true])).toBe("2");
  });

  it("renders nothing when no value qualified", () => {
    expect(total("sum", [])).toBe("");
    expect(total("sum", [null, "", "n/a"])).toBe("");
    expect(total("avg", [null])).toBe("");
    expect(total("min", [])).toBe("");
  });

  it("counts zero rather than rendering nothing", () => {
    expect(total("count", [])).toBe("0");
    expect(total("countUnique", [null])).toBe("0");
  });

  it("adds numeric strings and skips what is not a quantity", () => {
    expect(total("sum", ["1200", " 30 ", "", "n/a", null, true, new Date(0)])).toBe("1'230");
  });

  it("reports the number behind the text", () => {
    const acc = startTotal("sum");
    acc.add(2);
    acc.add(3);
    expect(acc.value()).toBe(5);
    expect(startTotal("sum").value()).toBeNull();
    expect(startTotal("count").value()).toBe(0);
  });
});

describe("toNumeric", () => {
  it("takes finite numbers and numeric strings only", () => {
    expect(toNumeric(12)).toBe(12);
    expect(toNumeric(-0.5)).toBe(-0.5);
    expect(toNumeric("12.5")).toBe(12.5);
    expect(toNumeric(Number.NaN)).toBeNull();
    expect(toNumeric(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toNumeric("")).toBeNull();
    expect(toNumeric("12 units")).toBeNull();
    expect(toNumeric(true)).toBeNull();
    expect(toNumeric(new Date())).toBeNull();
    expect(toNumeric(null)).toBeNull();
  });
});

describe("fractionDigits", () => {
  it("counts the digits a number is written with", () => {
    expect(fractionDigits(12)).toBe(0);
    expect(fractionDigits(1.5)).toBe(1);
    expect(fractionDigits(-2.25)).toBe(2);
  });

  it("reads the exponent of a small magnitude", () => {
    expect(fractionDigits(1e-7)).toBe(7);
    expect(fractionDigits(1.5e-7)).toBe(8);
  });

  it("caps at ten digits, past which the count is noise", () => {
    expect(fractionDigits(1 / 3)).toBe(10);
    expect(fractionDigits(1e-30)).toBe(10);
  });
});
