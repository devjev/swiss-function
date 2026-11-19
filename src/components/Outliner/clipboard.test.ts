import { describe, expect, it } from "vitest";
import { isOutlineText, parseOutline, toMarkdownList, withIds } from "./clipboard";
import type { Bullet } from "./types";

const tree: Bullet[] = [
  {
    id: "a",
    content: "Alpha",
    children: [
      { id: "a1", content: "one\nsecond line" },
      { id: "a2", content: "two", children: [{ id: "a2x", content: "deep" }] },
    ],
  },
  { id: "b", content: "Bravo" },
];

const shape = (blocks: ReturnType<typeof parseOutline>): unknown =>
  blocks.map((b) => (b.children.length ? [b.content, shape(b.children)] : b.content));

describe("toMarkdownList", () => {
  it("writes a nested list, further lines under their marker", () => {
    expect(toMarkdownList(tree)).toBe(
      ["- Alpha", "  - one", "    second line", "  - two", "    - deep", "- Bravo"].join("\n"),
    );
  });
});

describe("parseOutline", () => {
  it("reads back what toMarkdownList wrote", () => {
    expect(shape(parseOutline(toMarkdownList(tree)))).toEqual([
      ["Alpha", ["one\nsecond line", ["two", ["deep"]]]],
      "Bravo",
    ]);
  });

  it("takes any marker, tabs and four-space indents", () => {
    expect(shape(parseOutline("* a\n\t* b\n1. c\n    + d"))).toEqual([
      ["a", ["b"]],
      ["1. c", ["d"]],
    ]);
  });

  it("makes one block per paragraph", () => {
    expect(shape(parseOutline("first line\nsame paragraph\n\nsecond\r\n\r\nthird"))).toEqual([
      "first line\nsame paragraph",
      "second",
      "third",
    ]);
  });

  it("keeps text after a list as its own block", () => {
    expect(shape(parseOutline("- a\n  - b\nplain"))).toEqual([["a", ["b"]], "plain"]);
  });
});

describe("isOutlineText", () => {
  it("is false for one line and for one paragraph of several lines", () => {
    expect(isOutlineText("just text")).toBe(false);
    expect(isOutlineText("const a = 1;\nconst b = 2;")).toBe(false);
    expect(isOutlineText("- single item\n")).toBe(false);
  });

  it("is true for a list and for separate paragraphs", () => {
    expect(isOutlineText("- a\n- b")).toBe(true);
    expect(isOutlineText("intro\n- a")).toBe(true);
    expect(isOutlineText("one\n\ntwo")).toBe(true);
  });
});

describe("withIds", () => {
  it("mints an id per block, depth first", () => {
    let n = 0;
    const out = withIds(parseOutline("- a\n  - b\n- c"), () => `n${++n}`);
    expect(out).toEqual([
      { id: "n1", content: "a", children: [{ id: "n2", content: "b" }] },
      { id: "n3", content: "c" },
    ]);
  });
});
