import { describe, expect, it } from "vitest";
import {
  deleteBullet,
  findBullet,
  flatVisible,
  getNextVisible,
  getParentId,
  getPrevVisible,
  indent,
  insertAfter,
  mergeInto,
  moveDown,
  moveUp,
  outdent,
  setCollapsed,
  splitBullet,
  toggleCollapsed,
  updateContent,
} from "./tree";
import type { OutlinerValue } from "./types";

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
];

describe("findBullet", () => {
  it("returns bullet + path for matches at any depth", () => {
    expect(findBullet(tree, "a")?.path).toEqual([0]);
    expect(findBullet(tree, "a2")?.path).toEqual([0, 1]);
    expect(findBullet(tree, "a2x")?.path).toEqual([0, 1, 0]);
    expect(findBullet(tree, "b")?.path).toEqual([1]);
  });

  it("returns null for missing ids", () => {
    expect(findBullet(tree, "nope")).toBeNull();
  });
});

describe("flatVisible / nav", () => {
  it("flattens expanded tree in DFS order with depth", () => {
    const flat = flatVisible(tree).map((f) => [f.id, f.depth]);
    expect(flat).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a2", 1],
      ["a2x", 2],
      ["b", 0],
    ]);
  });

  it("hides children of collapsed parents", () => {
    const collapsed = setCollapsed(tree, "a", true);
    const flat = flatVisible(collapsed).map((f) => f.id);
    expect(flat).toEqual(["a", "b"]);
  });

  it("getPrevVisible / getNextVisible walk the visible order", () => {
    expect(getNextVisible(tree, "a")).toBe("a1");
    expect(getNextVisible(tree, "a2x")).toBe("b");
    expect(getPrevVisible(tree, "a2x")).toBe("a2");
    expect(getPrevVisible(tree, "a")).toBeNull();
    expect(getNextVisible(tree, "b")).toBeNull();
  });
});

describe("updateContent / toggleCollapsed (immutability)", () => {
  it("returns a new tree", () => {
    const next = updateContent(tree, "a1", "changed");
    expect(next).not.toBe(tree);
    expect(findBullet(next, "a1")?.bullet.content).toBe("changed");
    // Original unchanged.
    expect(findBullet(tree, "a1")?.bullet.content).toBe("A.1");
  });

  it("toggles collapsed flag", () => {
    const next = toggleCollapsed(tree, "a");
    expect(findBullet(next, "a")?.bullet.collapsed).toBe(true);
    const back = toggleCollapsed(next, "a");
    expect(findBullet(back, "a")?.bullet.collapsed).toBe(false);
  });
});

describe("insertAfter", () => {
  it("inserts a sibling at the right place", () => {
    const next = insertAfter(tree, "a1", { id: "new", content: "NEW" });
    const flat = flatVisible(next).map((f) => f.id);
    expect(flat).toEqual(["a", "a1", "new", "a2", "a2x", "b"]);
  });
});

describe("deleteBullet", () => {
  it("removes a leaf", () => {
    const next = deleteBullet(tree, "a1");
    expect(findBullet(next, "a1")).toBeNull();
  });

  it("promotes children up one level when deleting a parent", () => {
    const next = deleteBullet(tree, "a");
    // a's children (a1, a2) should now be at root, before b.
    const flat = flatVisible(next).map((f) => [f.id, f.depth]);
    expect(flat).toEqual([
      ["a1", 0],
      ["a2", 0],
      ["a2x", 1],
      ["b", 0],
    ]);
  });
});

describe("indent / outdent", () => {
  it("indent makes bullet a child of preceding sibling", () => {
    const next = indent(tree, "a2");
    // a2 becomes child of a1.
    expect(findBullet(next, "a2")?.path).toEqual([0, 0, 0]);
  });

  it("indent is a no-op when no preceding sibling", () => {
    expect(indent(tree, "a1")).toBe(tree); // a1 has no preceding sibling
    expect(indent(tree, "a")).toBe(tree); // a is first root
  });

  it("outdent makes bullet a sibling of its parent", () => {
    const next = outdent(tree, "a2x");
    // a2x becomes sibling of a2 (after it).
    expect(findBullet(next, "a2x")?.path).toEqual([0, 2]);
  });

  it("outdent adopts the following siblings, so no line changes place", () => {
    const next = outdent(tree, "a1");
    // a1 leaves a and takes a2 (and its subtree) along as a child.
    expect(findBullet(next, "a1")?.path).toEqual([1]);
    expect(findBullet(next, "a2")?.path).toEqual([1, 0]);
    expect(findBullet(next, "a2x")?.path).toEqual([1, 0, 0]);
    expect(findBullet(next, "b")?.path).toEqual([2]);
    expect(flatVisible(next).map((f) => f.id)).toEqual(flatVisible(tree).map((f) => f.id));
  });

  it("outdent opens a folded bullet that adopts siblings", () => {
    const folded: OutlinerValue = [
      {
        id: "p",
        content: "P",
        children: [
          { id: "x", content: "X", collapsed: true, children: [{ id: "x1", content: "X1" }] },
          { id: "y", content: "Y" },
        ],
      },
    ];
    const next = outdent(folded, "x");
    expect(findBullet(next, "x")?.bullet.collapsed).toBe(false);
    expect(findBullet(next, "y")?.path).toEqual([1, 1]);
  });

  it("outdent is a no-op at root", () => {
    expect(outdent(tree, "a")).toBe(tree);
    expect(outdent(tree, "b")).toBe(tree);
  });
});

describe("moveUp / moveDown", () => {
  it("moveDown swaps with next sibling", () => {
    const next = moveDown(tree, "a1");
    expect(findBullet(next, "a1")?.path).toEqual([0, 1]);
    expect(findBullet(next, "a2")?.path).toEqual([0, 0]);
  });

  it("moveUp swaps with previous sibling", () => {
    const next = moveUp(tree, "a2");
    expect(findBullet(next, "a2")?.path).toEqual([0, 0]);
  });

  it("moveDown past the last sibling enters the parent's next sibling", () => {
    const next = moveDown(tree, "a2");
    // a2 becomes b's first child, with its own child.
    expect(findBullet(next, "a2")?.path).toEqual([1, 0]);
    expect(findBullet(next, "a2x")?.path).toEqual([1, 0, 0]);
  });

  it("moveUp past the first sibling enters the parent's previous sibling", () => {
    const wide: OutlinerValue = [
      { id: "a", content: "A", collapsed: true, children: [{ id: "a1", content: "A.1" }] },
      { id: "b", content: "B", children: [{ id: "b1", content: "B.1" }] },
    ];
    const next = moveUp(wide, "b1");
    expect(findBullet(next, "b1")?.path).toEqual([0, 1]);
    // The new parent opens, so the bullet stays on screen.
    expect(findBullet(next, "a")?.bullet.collapsed).toBe(false);
  });

  it("no-ops at the outline's edges", () => {
    expect(moveUp(tree, "a1")).toBe(tree);
    expect(moveUp(tree, "a")).toBe(tree);
    expect(moveDown(tree, "b")).toBe(tree);
    expect(moveDown(tree, "a2x")).toBe(tree);
  });
});

describe("splitBullet (Enter)", () => {
  const flat: OutlinerValue = [
    { id: "x", content: "Hello world" },
    { id: "y", content: "Next" },
  ];

  it("splits at the caret into a new next sibling and trims the seam", () => {
    const r = splitBullet(flat, "x", 6, 6, "n");
    expect(r?.focusId).toBe("n");
    expect(r?.offset).toBe(0);
    expect(r?.value.map((b) => [b.id, b.content])).toEqual([
      ["x", "Hello"],
      ["n", "world"],
      ["y", "Next"],
    ]);
  });

  it("drops a selection and splits where it began", () => {
    const r = splitBullet(flat, "x", 2, 6, "n");
    expect(r?.value.slice(0, 2).map((b) => b.content)).toEqual(["He", "world"]);
  });

  it("at the end creates an empty sibling", () => {
    const r = splitBullet(flat, "x", 11, 11, "n");
    expect(r?.value.map((b) => b.content)).toEqual(["Hello world", "", "Next"]);
    expect(r?.focusId).toBe("n");
  });

  it("at the start of a non-empty bullet inserts an empty one above and keeps the caret", () => {
    const r = splitBullet(flat, "x", 0, 0, "n");
    expect(r?.value.map((b) => b.id)).toEqual(["n", "x", "y"]);
    expect(r?.focusId).toBe("x");
    expect(findBullet(r?.value ?? [], "x")?.bullet.content).toBe("Hello world");
  });

  it("with open children the new bullet is the first child", () => {
    const r = splitBullet(tree, "a", 1, 1, "n");
    expect(findBullet(r?.value ?? [], "n")?.path).toEqual([0, 0]);
    expect(findBullet(r?.value ?? [], "a1")?.path).toEqual([0, 1]);
  });

  it("with folded children the new bullet is the next sibling", () => {
    const folded = setCollapsed(tree, "a", true);
    const r = splitBullet(folded, "a", 1, 1, "n");
    expect(findBullet(r?.value ?? [], "n")?.path).toEqual([1]);
    expect(findBullet(r?.value ?? [], "a1")?.path).toEqual([0, 0]);
  });

  it("an empty nested last child outdents instead", () => {
    const nested: OutlinerValue = [
      {
        id: "p",
        content: "P",
        children: [
          { id: "c1", content: "one" },
          { id: "c2", content: "" },
        ],
      },
    ];
    const r = splitBullet(nested, "c2", 0, 0, "n");
    expect(r?.focusId).toBe("c2");
    expect(findBullet(r?.value ?? [], "c2")?.path).toEqual([1]);
    expect(findBullet(r?.value ?? [], "n")).toBeNull();
  });

  it("an empty top-level bullet just gets a sibling", () => {
    const r = splitBullet([{ id: "e", content: "" }], "e", 0, 0, "n");
    expect(r?.value.map((b) => b.id)).toEqual(["e", "n"]);
    expect(r?.focusId).toBe("n");
  });
});

describe("mergeInto (Backspace at the start, Delete at the end)", () => {
  it("appends the source's text and reports the join", () => {
    const r = mergeInto(tree, "a2x", "b");
    expect(r?.offset).toBe("A.2.x".length);
    expect(r?.focusId).toBe("a2x");
    expect(findBullet(r?.value ?? [], "a2x")?.bullet.content).toBe("A.2.xB");
    expect(findBullet(r?.value ?? [], "b")).toBeNull();
  });

  it("merges a first child into its parent", () => {
    const r = mergeInto(tree, "a", "a1");
    expect(findBullet(r?.value ?? [], "a")?.bullet.content).toBe("AA.1");
    expect(findBullet(r?.value ?? [], "a2")?.path).toEqual([0, 0]);
  });

  it("a source with children is adopted by a childless previous sibling", () => {
    const r = mergeInto(tree, "a1", "a2");
    expect(findBullet(r?.value ?? [], "a1")?.bullet.content).toBe("A.1A.2");
    expect(findBullet(r?.value ?? [], "a2x")?.path).toEqual([0, 0, 0]);
  });

  it("refuses to move a subtree to another depth", () => {
    // a (with children) into nothing above it at the same level; b into a2x is
    // fine, but a2 (with a child) into its parent is not.
    expect(mergeInto(tree, "a", "a2")).toBeNull();
    const parentOfTwo: OutlinerValue = [
      { id: "p", content: "P", children: [{ id: "p1", content: "P1" }] },
      { id: "q", content: "Q", children: [{ id: "q1", content: "Q1" }] },
    ];
    expect(mergeInto(parentOfTwo, "p1", "q")).toBeNull();
    expect(mergeInto(parentOfTwo, "p", "q")).toBeNull();
  });
});

describe("getParentId", () => {
  it("returns the parent, or null at root", () => {
    expect(getParentId(tree, "a2x")).toBe("a2");
    expect(getParentId(tree, "a1")).toBe("a");
    expect(getParentId(tree, "a")).toBeNull();
  });
});
