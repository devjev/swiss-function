import { describe, expect, it } from "vitest";
import { blockSelection, extendSelection, subtreeEnd } from "./selection";
import { flatVisible } from "./tree";
import type { OutlinerValue } from "./types";

// a
//   a1
//   a2
//     a2x
// b
// c
//   c1
const tree: OutlinerValue = [
  {
    id: "a",
    content: "A",
    children: [
      { id: "a1", content: "A.1" },
      { id: "a2", content: "A.2", children: [{ id: "a2x", content: "A.2.x" }] },
    ],
  },
  { id: "b", content: "B" },
  { id: "c", content: "C", children: [{ id: "c1", content: "C.1" }] },
];
const flat = flatVisible(tree);
const sel = (anchor: string, focus: string) => {
  const s = blockSelection(flat, anchor, focus);
  return { ids: [...(s?.ids ?? [])], roots: s?.roots };
};

describe("subtreeEnd", () => {
  it("is the last visible descendant", () => {
    expect(flat[subtreeEnd(flat, 0)]?.id).toBe("a2x");
    expect(flat[subtreeEnd(flat, 2)]?.id).toBe("a2x");
    expect(flat[subtreeEnd(flat, 4)]?.id).toBe("b");
  });
});

describe("blockSelection", () => {
  it("a block is selected with its children", () => {
    expect(sel("a", "a")).toEqual({ ids: ["a", "a1", "a2", "a2x"], roots: ["a"] });
    expect(sel("b", "b")).toEqual({ ids: ["b"], roots: ["b"] });
  });

  it("the roots are the rows whose parent is not selected", () => {
    expect(sel("a1", "a2")).toEqual({ ids: ["a1", "a2", "a2x"], roots: ["a1", "a2"] });
    expect(sel("a2x", "b")).toEqual({ ids: ["a2x", "b"], roots: ["a2x", "b"] });
    expect(sel("a", "c")).toEqual({
      ids: ["a", "a1", "a2", "a2x", "b", "c", "c1"],
      roots: ["a", "b", "c"],
    });
  });

  it("is the same in either direction", () => {
    expect(sel("b", "a1")).toEqual(sel("a1", "b"));
  });

  it("is null for an unknown row", () => {
    expect(blockSelection(flat, "a", "nope")).toBeNull();
  });
});

describe("extendSelection", () => {
  it("grows downward over the focus block's children", () => {
    expect(extendSelection(flat, "a", "a", 1)).toBe("b");
    expect(extendSelection(flat, "a", "b", 1)).toBe("c");
    expect(extendSelection(flat, "a1", "a1", 1)).toBe("a2");
  });

  it("stays at the last block", () => {
    expect(extendSelection(flat, "a", "c", 1)).toBe("c");
  });

  it("grows upward row by row", () => {
    expect(extendSelection(flat, "b", "b", -1)).toBe("a2x");
    expect(extendSelection(flat, "b", "a2x", -1)).toBe("a2");
  });

  it("shrinks upward to the root that holds the row above", () => {
    // a..b selected, focus on b: one step up leaves a (with its subtree).
    expect(extendSelection(flat, "a", "b", -1)).toBe("a");
    // a1..b: the row above b is a2x, held by the root a2.
    expect(extendSelection(flat, "a1", "b", -1)).toBe("a2");
  });

  it("shrinks downward row by row", () => {
    expect(extendSelection(flat, "b", "a2", 1)).toBe("a2x");
  });
});
