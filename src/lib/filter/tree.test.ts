import { describe, expect, it } from "vitest";
import { filterForest, type KeptNode } from "./tree";

type N = { name: string; tag?: string; children?: N[] };

// Engineering (team) → Alice, Bob (people); Sales (team) → Carol; Ops (team).
const forest: N[] = [
  {
    name: "Engineering",
    tag: "team",
    children: [
      { name: "Alice", tag: "person" },
      { name: "Bob", tag: "person", children: [{ name: "Bobby", tag: "intern" }] },
    ],
  },
  { name: "Sales", tag: "team", children: [{ name: "Carol", tag: "person" }] },
  { name: "Ops", tag: "team" },
];
const kids = (n: N) => n.children;

/** The kept forest as nested names, a match marked with no suffix and a path
 *  row with "*" (the path to a match). */
function shape(kept: KeptNode<N>[]): unknown[] {
  return kept.map((k) => {
    const label = k.match ? k.node.name : `${k.node.name}*`;
    return k.children && k.children.length > 0 ? [label, shape(k.children)] : label;
  });
}

describe("filterForest, filtering every level", () => {
  it("keeps the path to a match and drops the rest", () => {
    const kept = filterForest(forest, kids, (n) => n.name === "Bobby");
    expect(shape(kept)).toEqual([["Engineering*", [["Bob*", ["Bobby"]]]]]);
  });

  it("filters below a match", () => {
    // Every name but Alice: Engineering matches, Alice still goes.
    const kept = filterForest(forest, kids, (n) => n.name !== "Alice");
    expect(shape(kept)).toEqual([
      ["Engineering", [["Bob", ["Bobby"]]]],
      ["Sales", ["Carol"]],
      "Ops",
    ]);
  });

  it("keeps a failing parent as the path to its matching children", () => {
    const kept = filterForest(forest, kids, (n) => n.tag === "person");
    expect(shape(kept)).toEqual([
      ["Engineering*", ["Alice", "Bob"]],
      ["Sales*", ["Carol"]],
    ]);
  });

  it("records each node's index among its unfiltered siblings", () => {
    const kept = filterForest(forest, kids, (n) => n.name === "Bob" || n.name === "Ops");
    expect(kept.map((k) => k.index)).toEqual([0, 2]);
    expect(kept[0]?.children?.map((k) => k.index)).toEqual([1]);
  });

  it("keeps nothing when nothing matches", () => {
    expect(filterForest(forest, kids, () => false)).toEqual([]);
  });
});

describe("filterForest, keepMatchSubtree", () => {
  it("keeps a match's subtree whole and does not walk it", () => {
    const seen: string[] = [];
    const kept = filterForest(
      forest,
      kids,
      (n) => {
        seen.push(n.name);
        return n.name !== "Alice";
      },
      { keepMatchSubtree: true },
    );
    expect(kept.map((k) => k.node.name)).toEqual(["Engineering", "Sales", "Ops"]);
    expect(kept.every((k) => k.children === null)).toBe(true);
    expect(seen).toEqual(["Engineering", "Sales", "Ops"]);
  });

  it("still prunes below a failing parent", () => {
    const kept = filterForest(forest, kids, (n) => n.name === "Bob", { keepMatchSubtree: true });
    expect(kept).toHaveLength(1);
    expect(kept[0]?.match).toBe(false);
    expect(kept[0]?.children?.map((k) => [k.node.name, k.children])).toEqual([["Bob", null]]);
  });
});
