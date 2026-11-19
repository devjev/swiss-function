import { describe, expect, it } from "vitest";
import { type DragRow, dropTarget } from "./drag";

// a
//   a1
//   a2
//     a2x
// b (folded, with children)
// c
const ROWS: DragRow[] = [
  { id: "a", depth: 0, folded: false },
  { id: "a1", depth: 1, folded: false },
  { id: "a2", depth: 1, folded: false },
  { id: "a2x", depth: 2, folded: false },
  { id: "b", depth: 0, folded: true },
  { id: "c", depth: 0, folded: false },
];

const place = (after: number, depth: number, rows = ROWS, floor = 0) => {
  const t = dropTarget(rows, after, depth, floor);
  return t && `${t.parentId ?? "top"}>${t.afterId ?? "first"}@${t.depth}`;
};

describe("dropTarget", () => {
  it("above the first row is the top of the outline", () => {
    expect(place(-1, 3)).toBe("top>first@0");
  });

  it("under an open parent the only place is its first child", () => {
    expect(place(0, 0)).toBe("a>first@1");
    expect(place(0, 5)).toBe("a>first@1");
  });

  it("between two siblings the block is a sibling or a child of the upper one", () => {
    expect(place(1, 1)).toBe("a>a1@1");
    expect(place(1, 2)).toBe("a1>first@2");
    // No shallower than the row below.
    expect(place(1, 0)).toBe("a>a1@1");
  });

  it("under the last row of a subtree the depth picks the ancestor to follow", () => {
    expect(place(3, 3)).toBe("a2x>first@3");
    expect(place(3, 2)).toBe("a2>a2x@2");
    expect(place(3, 1)).toBe("a>a2@1");
    expect(place(3, 0)).toBe("top>a@0");
  });

  it("a folded row takes no child", () => {
    expect(place(4, 1)).toBe("top>b@0");
  });

  it("under the last row the block can go back to the top level", () => {
    expect(place(5, 0)).toBe("top>c@0");
    expect(place(5, 1)).toBe("c>first@1");
    expect(place(99, 0)).toBe("top>c@0");
  });

  it("an empty outline takes the block at the top", () => {
    expect(place(-1, 0, [])).toBe("top>first@0");
  });

  it("zoomed, nothing lands above the title or beside it", () => {
    const zoomed: DragRow[] = [
      { id: "a", depth: 0, folded: false },
      { id: "a1", depth: 1, folded: false },
      { id: "a2", depth: 1, folded: false },
    ];
    expect(place(-1, 0, zoomed, 1)).toBe("a>first@1");
    expect(place(2, 0, zoomed, 1)).toBe("a>a2@1");
    expect(place(2, 2, zoomed, 1)).toBe("a2>first@2");
    expect(place(0, 1, [{ id: "a", depth: 0, folded: false }], 1)).toBe("a>first@1");
  });
});
