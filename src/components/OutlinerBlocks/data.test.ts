import { describe, expect, it } from "vitest";
import type { OutlinerValue } from "../Outliner";
import { parseData, parseDelimited, searchBlocks } from "./data";

describe("parseDelimited", () => {
  it("splits rows and fields", () => {
    expect(parseDelimited("a,b\n1,2\r\n3,4\n", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("reads quoted fields: delimiters, line breaks and doubled quotes", () => {
    expect(parseDelimited('name,note\n"Doe, Jane","said ""hi""\nthen left"', ",")).toEqual([
      ["name", "note"],
      ["Doe, Jane", 'said "hi"\nthen left'],
    ]);
  });

  it("drops blank lines and takes another delimiter", () => {
    expect(parseDelimited("a\tb\n\n1\t2", "\t")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseData", () => {
  it("reads csv with its header, and finds the numeric columns", () => {
    const table = parseData("csv", "fund,aum,change\nAlpha,1284,2.1\nBeta,640,-0.4");
    expect(table.columns).toEqual(["fund", "aum", "change"]);
    expect(table.rows).toEqual([
      { fund: "Alpha", aum: 1284, change: 2.1 },
      { fund: "Beta", aum: 640, change: -0.4 },
    ]);
    expect([...table.numeric]).toEqual(["aum", "change"]);
  });

  it("keeps a column of mixed values as text, and names a blank header", () => {
    const table = parseData("csv", "id,\n1,x\nn/a,y");
    expect(table.columns).toEqual(["id", "Column 2"]);
    expect(table.rows[0]).toEqual({ id: "1", "Column 2": "x" });
    expect(table.numeric.size).toBe(0);
  });

  it("reads json: an array of objects, columns in first-seen order", () => {
    const table = parseData("json", '[{"a":1,"b":"x"},{"a":2,"c":true}]');
    expect(table.columns).toEqual(["a", "b", "c"]);
    expect([...table.numeric]).toEqual(["a"]);
  });

  it("says what is wrong", () => {
    expect(() => parseData("json", "{")).toThrow(/not valid JSON/);
    expect(() => parseData("json", '{"a":1}')).toThrow(/not an array of objects/);
    expect(() => parseData("csv", "")).toThrow(/no rows/);
  });
});

describe("searchBlocks", () => {
  const tree: OutlinerValue = [
    {
      id: "p",
      content: "Project Alpha",
      children: [
        { id: "t1", content: "[ ] Review the alpha notes" },
        { id: "q", content: "{{query alpha}}" },
      ],
    },
    { id: "b", content: "Beta" },
  ];

  it("finds the blocks that hold every word, with their path", () => {
    expect(searchBlocks(tree, "ALPHA")).toEqual([
      { id: "p", content: "Project Alpha", path: undefined },
      { id: "t1", content: "[ ] Review the alpha notes", path: "Project Alpha" },
    ]);
    expect(searchBlocks(tree, "alpha review").map((r) => r.id)).toEqual(["t1"]);
  });

  it("finds nothing for an empty query, and stops at the limit", () => {
    expect(searchBlocks(tree, "  ")).toEqual([]);
    expect(searchBlocks(tree, "a", 1)).toHaveLength(1);
  });
});
