import { describe, expect, it } from "vitest";
import { buildOptionRows, clusterOptions } from "./optionGroups";

const o = (value: string, group?: string) => ({ value, label: value, group });

describe("clusterOptions", () => {
  it("returns the same reference when nothing is grouped", () => {
    const options = [o("a"), o("b")];
    expect(clusterOptions(options)).toBe(options);
  });

  it("clusters scattered groups by first appearance, ungrouped first", () => {
    const options = [o("apple", "fruit"), o("carrot", "veg"), o("banana", "fruit"), o("plain")];
    expect(clusterOptions(options).map((x) => x.value)).toEqual([
      "plain",
      "apple",
      "banana",
      "carrot",
    ]);
  });

  it("keeps relative order inside each group", () => {
    const options = [o("b", "g"), o("a", "g"), o("c", "g")];
    expect(clusterOptions(options).map((x) => x.value)).toEqual(["b", "a", "c"]);
  });
});

describe("buildOptionRows", () => {
  it("emits no headers for an ungrouped list", () => {
    const { rows, itemRowIndex } = buildOptionRows([o("a"), o("b")]);
    expect(rows.map((r) => r.kind)).toEqual(["item", "item"]);
    expect(itemRowIndex).toEqual([0, 1]);
  });

  it("interleaves one header per group run and maps item indexes to rows", () => {
    const { rows, itemRowIndex } = buildOptionRows([
      o("plain"),
      o("apple", "fruit"),
      o("banana", "fruit"),
      o("carrot", "veg"),
    ]);
    expect(rows.map((r) => (r.kind === "header" ? `#${r.group}` : r.option.value))).toEqual([
      "plain",
      "#fruit",
      "apple",
      "banana",
      "#veg",
      "carrot",
    ]);
    // Base UI's item indexes 0..3 land on their row positions.
    expect(itemRowIndex).toEqual([0, 2, 3, 5]);
    // Item rows carry the flat filtered index Base UI navigates by.
    const items = rows.filter((r) => r.kind === "item");
    expect(items.map((r) => r.index)).toEqual([0, 1, 2, 3]);
  });

  it("drops headers for groups filtered out entirely", () => {
    // "veg" items were filtered away; no stray header appears.
    const { rows } = buildOptionRows([o("apple", "fruit"), o("plum", "fruit")]);
    expect(rows.filter((r) => r.kind === "header").length).toBe(1);
  });
});
