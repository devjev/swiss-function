import { describe, expect, it } from "vitest";
import { checklistTest, keepAll, rangeTest } from "./predicates";

describe("checklistTest", () => {
  it("keeps everything when the allow-list is empty", () => {
    expect(checklistTest([])("anything")).toBe(true);
    expect(checklistTest(undefined)("anything")).toBe(true);
  });

  it("returns the shared keepAll test for an inactive filter", () => {
    expect(checklistTest([])).toBe(keepAll);
    expect(checklistTest(undefined)).toBe(keepAll);
    expect(checklistTest(["a"])).not.toBe(keepAll);
  });

  it("matches a cell by its string form", () => {
    const test = checklistTest(["1", "true", "alpha"]);
    expect(test(1)).toBe(true);
    expect(test("1")).toBe(true);
    expect(test(true)).toBe(true);
    expect(test("alpha")).toBe(true);
    expect(test(2)).toBe(false);
    expect(test("alph")).toBe(false);
  });

  it("drops the one unchecked value of a large allow-list", () => {
    const values = Array.from({ length: 10_000 }, (_, i) => `Row ${i}`);
    const test = checklistTest(values.slice(1));
    expect(test("Row 0")).toBe(false);
    expect(test("Row 1")).toBe(true);
    expect(test("Row 9999")).toBe(true);
  });
});

describe("rangeTest", () => {
  it("honours open bounds", () => {
    expect(rangeTest([10, undefined])(10)).toBe(true);
    expect(rangeTest([10, undefined])(9)).toBe(false);
    expect(rangeTest([undefined, 10])(11)).toBe(false);
    expect(rangeTest(undefined)(123)).toBe(true);
  });

  it("drops a value that is not a number when a bound is set", () => {
    expect(rangeTest([0, undefined])("n/a")).toBe(false);
    expect(rangeTest([undefined, undefined])("n/a")).toBe(true);
  });

  it("returns the shared keepAll test for an open range", () => {
    expect(rangeTest(undefined)).toBe(keepAll);
    expect(rangeTest([undefined, undefined])).toBe(keepAll);
    expect(rangeTest([0, undefined])).not.toBe(keepAll);
  });
});
