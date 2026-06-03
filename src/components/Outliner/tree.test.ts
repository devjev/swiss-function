import { describe, expect, it } from "vitest";
import {
  deleteBullet,
  findBullet,
  flatVisible,
  getNextVisible,
  getPrevVisible,
  indent,
  insertAfter,
  moveDown,
  moveUp,
  outdent,
  setCollapsed,
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

  it("no-ops at edges", () => {
    expect(moveUp(tree, "a1")).toBe(tree);
    expect(moveDown(tree, "a2")).toBe(tree);
    expect(moveUp(tree, "a")).toBe(tree);
    expect(moveDown(tree, "b")).toBe(tree);
  });
});
