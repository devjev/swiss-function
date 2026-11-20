import { describe, expect, it } from "vitest";
import { indent, outdent, updateContent } from "./tree";
import type { OutlinerValue } from "./types";
import { labelParts, plainLabel, zoomBack, zoomRoot, zoomView } from "./zoom";

const TREE: OutlinerValue = [
  {
    id: "a",
    content: "Alpha",
    collapsed: true,
    children: [
      { id: "a1", content: "one" },
      { id: "a2", content: "two" },
    ],
  },
  { id: "b", content: "Bravo" },
];

describe("zoom", () => {
  it("finds the zoomed block, or none", () => {
    expect(zoomRoot(TREE, "a1")?.content).toBe("one");
    expect(zoomRoot(TREE, null)).toBeNull();
    expect(zoomRoot(TREE, "gone")).toBeNull();
  });

  it("the view is the block alone, unfolded", () => {
    const root = zoomRoot(TREE, "a");
    if (!root) throw new Error("no root");
    const view = zoomView(root);
    expect(view).toHaveLength(1);
    expect(view[0]?.collapsed).toBe(false);
    expect(view[0]?.children?.map((c) => c.id)).toEqual(["a1", "a2"]);
  });

  it("a change in the view lands in the block's place, which keeps its fold", () => {
    const root = zoomRoot(TREE, "a");
    if (!root) throw new Error("no root");
    const view = indent(updateContent(zoomView(root), "a2", "two!"), "a2");
    const next = zoomBack(TREE, root, view);
    expect(next?.[0]?.collapsed).toBe(true);
    expect(next?.[0]?.children?.[0]?.children?.[0]).toMatchObject({ id: "a2", content: "two!" });
    expect(next?.[1]).toBe(TREE[1]);
  });

  it("a change that takes a block out of the view is refused", () => {
    const root = zoomRoot(TREE, "a");
    if (!root) throw new Error("no root");
    expect(zoomBack(TREE, root, outdent(zoomView(root), "a1"))).toBeNull();
    expect(zoomBack(TREE, root, [])).toBeNull();
  });
});

describe("plainLabel", () => {
  it("keeps the first line and drops the markup", () => {
    expect(plainLabel("**Bold** and `code`\nsecond line")).toBe("Bold and code");
    expect(plainLabel("[x] Ship [[Project Alpha]] via [the docs](https://x.test)")).toBe(
      "Ship Project Alpha via the docs",
    );
    expect(plainLabel("an *italic* word, 2 * 3 stays")).toBe("an italic word, 2 * 3 stays");
    expect(plainLabel("")).toBe("");
  });
});

describe("labelParts", () => {
  const math = [{ open: "$" }];

  it("is the plain label when no span is registered or found", () => {
    expect(labelParts("**Bold** $x$", [])).toEqual(["Bold $x$"]);
    expect(labelParts("## A *title*", math)).toEqual(["A title"]);
    expect(labelParts("", math)).toEqual([]);
  });

  it("keeps the spans apart, with their source as written", () => {
    expect(labelParts("[ ] **Energy** $E = m*c^{2}$ of `it`\nmore", math)).toEqual([
      "Energy ",
      { index: 0, source: "E = m*c^{2}" },
      " of it",
    ]);
    expect(labelParts("$a$ $b$", math)).toEqual([
      { index: 0, source: "a" },
      " ",
      { index: 0, source: "b" },
    ]);
  });

  it("leaves prices and code alone", () => {
    expect(labelParts("for $5 and `$x$`", math)).toEqual(["for $5 and $x$"]);
  });

  it("takes a line that is plain already as it is", () => {
    expect(labelParts("1. Plans › $x^2$ › 2. More", math, true)).toEqual([
      "1. Plans › ",
      { index: 0, source: "x^2" },
      " › 2. More",
    ]);
  });
});
